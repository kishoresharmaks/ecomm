import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  DeliveryPartnerApplicationStatus,
  Prisma,
  RoleCode,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  DeliveryPartnerApplicationDecisionDto,
  DeliveryPartnerApplicationDto,
  DeliveryPartnerApplicationQueryDto,
} from "./dto/delivery-partner-application.dto";

const applicationInclude = {
  user: {
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      deliveryProfile: true,
    },
  },
  reviewedBy: true,
};

type DeliveryPartnerApplicationWithRelations = Prisma.DeliveryPartnerApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

@Injectable()
export class DeliveryPartnerApplicationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOwnApplication(actor: RequestUser) {
    const [application, user] = await Promise.all([
      this.prisma.client.deliveryPartnerApplication.findUnique({
        where: { userId: actor.id },
        include: applicationInclude,
      }),
      this.prisma.client.user.findUnique({
        where: { id: actor.id },
        include: { userRoles: { include: { role: true } }, deliveryProfile: true },
      }),
    ]);

    return {
      application: application ? this.applicationReadback(application) : null,
      isDeliveryPartner: Boolean(
        user?.userRoles.some((userRole) => userRole.role.code === RoleCode.DELIVERY_PARTNER),
      ),
      deliveryProfile: user?.deliveryProfile ?? null,
    };
  }

  async submitApplication(actor: RequestUser, dto: DeliveryPartnerApplicationDto) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: actor.id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Signed-in user was not found.");
    }

    if (user.userRoles.some((userRole) => userRole.role.code === RoleCode.DELIVERY_PARTNER)) {
      throw new BadRequestException("This account is already registered as a delivery partner.");
    }

    if (dto.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException("Application email must match the signed-in account email.");
    }

    const application = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.deliveryPartnerApplication.findUnique({
        where: { userId: actor.id },
      });

      if (existing?.status === DeliveryPartnerApplicationStatus.APPROVED) {
        throw new ConflictException("This delivery partner application is already approved.");
      }

      const data = this.applicationData(dto);
      const saved = existing
        ? await tx.deliveryPartnerApplication.update({
            where: { id: existing.id },
            data: {
              ...data,
              status: DeliveryPartnerApplicationStatus.PENDING_REVIEW,
              reviewedAt: null,
              reviewedById: null,
              reviewNote: null,
            },
            include: applicationInclude,
          })
        : await tx.deliveryPartnerApplication.create({
            data: {
              userId: actor.id,
              ...data,
            },
            include: applicationInclude,
          });

      if (!user.phone && dto.phone) {
        await tx.user.update({
          where: { id: actor.id },
          data: { phone: dto.phone },
        });
      }

      if (!user.fullName && dto.fullName.trim()) {
        await tx.user.update({
          where: { id: actor.id },
          data: { fullName: dto.fullName.trim() },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: existing
            ? "delivery_partner_application.resubmitted"
            : "delivery_partner_application.submitted",
          entityType: "delivery_partner_application",
          entityId: saved.id,
          ...(existing ? { oldValue: this.applicationAuditValue(existing) } : {}),
          newValue: this.applicationAuditValue(saved),
        },
      });

      return saved;
    });

    return this.applicationReadback(application);
  }

  async listApplications(query: DeliveryPartnerApplicationQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const search = query.search?.trim();
    const where: Prisma.DeliveryPartnerApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { vehicleNumber: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { pincode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.deliveryPartnerApplication.findMany({
        where,
        include: applicationInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.deliveryPartnerApplication.count({ where }),
    ]);

    return {
      items: items.map((item) => this.applicationReadback(item)),
      total,
      page,
      limit: take,
    };
  }

  async getApplication(applicationId: string) {
    const application = await this.prisma.client.deliveryPartnerApplication.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    });

    if (!application) {
      throw new NotFoundException("Delivery partner application not found.");
    }

    return this.applicationReadback(application);
  }

  async decideApplication(actor: RequestUser, applicationId: string, dto: DeliveryPartnerApplicationDecisionDto) {
    const application = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.deliveryPartnerApplication.findUnique({
        where: { id: applicationId },
        include: applicationInclude,
      });

      if (!existing) {
        throw new NotFoundException("Delivery partner application not found.");
      }

      if (existing.status !== DeliveryPartnerApplicationStatus.PENDING_REVIEW) {
        throw new BadRequestException("Only pending delivery partner applications can be reviewed.");
      }

      const approved = dto.decision === "APPROVE";
      const status = approved
        ? DeliveryPartnerApplicationStatus.APPROVED
        : DeliveryPartnerApplicationStatus.REJECTED;

      if (approved) {
        await this.activateDeliveryPartner(tx, existing, dto);
      }

      const updated = await tx.deliveryPartnerApplication.update({
        where: { id: existing.id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          reviewNote: this.optionalText(dto.note),
        },
        include: applicationInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: approved
            ? "delivery_partner_application.approved"
            : "delivery_partner_application.rejected",
          entityType: "delivery_partner_application",
          entityId: existing.id,
          oldValue: this.applicationAuditValue(existing),
          newValue: {
            ...this.applicationAuditValue(updated),
            decision: dto.decision,
            note: dto.note ?? null,
          },
        },
      });

      return updated;
    });

    return this.applicationReadback(application);
  }

  private async activateDeliveryPartner(
    tx: Prisma.TransactionClient,
    application: DeliveryPartnerApplicationWithRelations,
    dto: DeliveryPartnerApplicationDecisionDto,
  ) {
    const role = await tx.role.upsert({
      where: { code: RoleCode.DELIVERY_PARTNER },
      update: {},
      create: {
        code: RoleCode.DELIVERY_PARTNER,
        name: "Delivery Partner",
        description: "Local delivery partner account.",
      },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: application.userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: application.userId,
        roleId: role.id,
      },
    });

    await tx.user.update({
      where: { id: application.userId },
      data: {
        status: UserStatus.ACTIVE,
        phone: application.phone,
        fullName: application.fullName,
      },
    });

    await tx.deliveryPartnerProfile.upsert({
      where: { userId: application.userId },
      update: {
        phone: application.phone,
        vehicleNumber: application.vehicleNumber,
        isAvailable: true,
        priority: dto.priority ?? 100,
        serviceCountryCode: application.serviceCountryCode,
        serviceStateCode: application.serviceStateCode,
        serviceCityCode: application.serviceCityCode,
        servicePincodes: application.servicePincodes,
        serviceLocalAreaCodes: application.serviceLocalAreaCodes,
        baseLatitude: application.baseLatitude,
        baseLongitude: application.baseLongitude,
        serviceRadiusKm: application.serviceRadiusKm,
        codCashLimitPaise: dto.codCashLimitPaise ?? null,
        notes: this.profileNotes(application, dto.note),
      },
      create: {
        userId: application.userId,
        phone: application.phone,
        vehicleNumber: application.vehicleNumber,
        isAvailable: true,
        priority: dto.priority ?? 100,
        serviceCountryCode: application.serviceCountryCode,
        serviceStateCode: application.serviceStateCode,
        serviceCityCode: application.serviceCityCode,
        servicePincodes: application.servicePincodes,
        serviceLocalAreaCodes: application.serviceLocalAreaCodes,
        baseLatitude: application.baseLatitude,
        baseLongitude: application.baseLongitude,
        serviceRadiusKm: application.serviceRadiusKm,
        codCashLimitPaise: dto.codCashLimitPaise ?? null,
        notes: this.profileNotes(application, dto.note),
      },
    });
  }

  private applicationData(dto: DeliveryPartnerApplicationDto) {
    return {
      fullName: dto.fullName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim(),
      alternatePhone: this.optionalText(dto.alternatePhone),
      vehicleType: dto.vehicleType.trim(),
      vehicleNumber: dto.vehicleNumber.trim().toUpperCase(),
      drivingLicenseNumber: this.optionalText(dto.drivingLicenseNumber)?.toUpperCase() ?? null,
      experienceSummary: this.optionalText(dto.experienceSummary),
      serviceCountryCode: this.optionalText(dto.serviceCountryCode),
      serviceStateCode: this.optionalText(dto.serviceStateCode),
      serviceCityCode: this.optionalText(dto.serviceCityCode),
      servicePincodes: this.cleanStringArray(dto.servicePincodes),
      serviceLocalAreaCodes: this.cleanStringArray(dto.serviceLocalAreaCodes),
      addressLine1: dto.addressLine1.trim(),
      addressLine2: this.optionalText(dto.addressLine2),
      area: this.optionalText(dto.area),
      city: dto.city.trim(),
      state: dto.state.trim(),
      pincode: dto.pincode.trim(),
      country: this.optionalText(dto.country) ?? "India",
      baseLatitude: dto.latitude ?? null,
      baseLongitude: dto.longitude ?? null,
      locationSource: dto.locationSource ?? null,
      accuracyMeters: dto.accuracyMeters ?? null,
      locationConfidenceScore: dto.locationConfidenceScore ?? null,
      serviceRadiusKm: dto.serviceRadiusKm ?? null,
      availabilityNotes: this.optionalText(dto.availabilityNotes),
    };
  }

  private applicationReadback(
    application: DeliveryPartnerApplicationWithRelations,
  ) {
    return {
      id: application.id,
      userId: application.userId,
      status: application.status,
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      alternatePhone: application.alternatePhone,
      vehicleType: application.vehicleType,
      vehicleNumber: application.vehicleNumber,
      drivingLicenseNumber: application.drivingLicenseNumber,
      experienceSummary: application.experienceSummary,
      serviceCountryCode: application.serviceCountryCode,
      serviceStateCode: application.serviceStateCode,
      serviceCityCode: application.serviceCityCode,
      servicePincodes: application.servicePincodes,
      serviceLocalAreaCodes: application.serviceLocalAreaCodes,
      addressLine1: application.addressLine1,
      addressLine2: application.addressLine2,
      area: application.area,
      city: application.city,
      state: application.state,
      pincode: application.pincode,
      country: application.country,
      latitude: this.numberOrNull(application.baseLatitude),
      longitude: this.numberOrNull(application.baseLongitude),
      locationSource: application.locationSource,
      accuracyMeters: this.numberOrNull(application.accuracyMeters),
      locationConfidenceScore: this.numberOrNull(application.locationConfidenceScore),
      serviceRadiusKm: application.serviceRadiusKm,
      availabilityNotes: application.availabilityNotes,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewNote: application.reviewNote,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      user: {
        id: application.user.id,
        email: application.user.email,
        phone: application.user.phone,
        fullName: application.user.fullName,
        status: application.user.status,
        roles: application.user.userRoles.map((userRole) => userRole.role.code),
        hasDeliveryProfile: Boolean(application.user.deliveryProfile),
      },
      reviewedBy: application.reviewedBy
        ? {
            id: application.reviewedBy.id,
            email: application.reviewedBy.email,
            fullName: application.reviewedBy.fullName,
          }
        : null,
    };
  }

  private applicationAuditValue(application: {
    status: DeliveryPartnerApplicationStatus;
    phone: string;
    vehicleType: string;
    vehicleNumber: string;
    serviceCountryCode?: string | null;
    serviceStateCode?: string | null;
    serviceCityCode?: string | null;
    servicePincodes?: string[];
    serviceLocalAreaCodes?: string[];
    reviewNote?: string | null;
  }) {
    return {
      status: application.status,
      phone: application.phone,
      vehicleType: application.vehicleType,
      vehicleNumber: application.vehicleNumber,
      serviceCountryCode: application.serviceCountryCode ?? null,
      serviceStateCode: application.serviceStateCode ?? null,
      serviceCityCode: application.serviceCityCode ?? null,
      servicePincodes: application.servicePincodes ?? [],
      serviceLocalAreaCodes: application.serviceLocalAreaCodes ?? [],
      reviewNote: application.reviewNote ?? null,
    };
  }

  private profileNotes(
    application: {
      availabilityNotes?: string | null;
      experienceSummary?: string | null;
      drivingLicenseNumber?: string | null;
    },
    reviewNote?: string,
  ) {
    return [
      application.availabilityNotes ? `Availability: ${application.availabilityNotes}` : null,
      application.experienceSummary ? `Experience: ${application.experienceSummary}` : null,
      application.drivingLicenseNumber ? `License: ${application.drivingLicenseNumber}` : null,
      reviewNote ? `Approval note: ${reviewNote}` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;
  }

  private optionalText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private cleanStringArray(values?: string[]) {
    return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
  }

  private numberOrNull(value: Prisma.Decimal | number | string | null) {
    if (value === null) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
