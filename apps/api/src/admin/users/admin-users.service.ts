import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RoleCode, UserStatus } from "@indihub/database";
import { hashAdminPassword } from "../../auth/admin-password";
import type { RequestUser } from "../../auth/types/indihub-request";
import { paginationFromQuery } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AdminUserQueryDto,
  SetBackOfficePasswordDto,
  UpdateDeliveryPartnerProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from "./dto/admin-user.dto";

const userInclude = {
  userRoles: {
    include: {
      role: true
    }
  },
  customer: true,
  seller: true,
  businessBuyer: true,
  deliveryProfile: true
};

@Injectable()
export class AdminUsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUserQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleCode ? { userRoles: { some: { role: { code: query.roleCode } } } } : {}),
      ...this.profileWhere(query.profile),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { fullName: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      });
      const total = await tx.user.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async getUser(userId: string) {
    return this.getUserOrThrow(userId);
  }

  async updateStatus(actor: RequestUser, userId: string, dto: UpdateUserStatusDto) {
    const existing = await this.getUserOrThrow(userId);

    if (existing.id === actor.id && dto.status !== UserStatus.ACTIVE) {
      throw new BadRequestException("Admin cannot disable their own active account.");
    }

    if (existing.userRoles.some((userRole) => userRole.role.code === RoleCode.ADMIN) && dto.status !== UserStatus.ACTIVE) {
      await this.ensureAnotherActiveAdmin(existing.id);
    }

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: { status: dto.status },
      include: userInclude
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.user.status_updated",
        entityType: "user",
        entityId: user.id,
        oldValue: { status: existing.status },
        newValue: { status: user.status, note: dto.note }
      }
    });

    return user;
  }

  async addRole(actor: RequestUser, userId: string, dto: UpdateUserRoleDto) {
    const user = await this.getUserOrThrow(userId);
    const role = await this.prisma.client.role.upsert({
      where: { code: dto.roleCode },
      update: {},
      create: {
        code: dto.roleCode,
        name: this.roleName(dto.roleCode),
        description: "Admin-created platform role."
      }
    });

    await this.prisma.client.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id
        }
      },
      update: {},
      create: {
        userId,
        roleId: role.id
      }
    });

    if (dto.roleCode === RoleCode.DELIVERY_PARTNER) {
      await this.prisma.client.deliveryPartnerProfile.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          phone: user.phone,
          isAvailable: true,
        },
      });
    }

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.user.role_added",
        entityType: "user",
        entityId: user.id,
        oldValue: { roles: user.userRoles.map((userRole) => userRole.role.code) },
        newValue: { addedRole: dto.roleCode, note: dto.note }
      }
    });

    return this.getUserOrThrow(userId);
  }

  async removeRole(actor: RequestUser, userId: string, dto: UpdateUserRoleDto) {
    const user = await this.getUserOrThrow(userId);
    const role = await this.prisma.client.role.findUnique({ where: { code: dto.roleCode } });

    if (!role) {
      throw new NotFoundException("Role not found.");
    }

    if (dto.roleCode === RoleCode.ADMIN) {
      if (user.id === actor.id) {
        throw new BadRequestException("Admin cannot remove their own admin role.");
      }
      await this.ensureAnotherActiveAdmin(user.id);
    }

    await this.prisma.client.userRole.deleteMany({
      where: {
        userId,
        roleId: role.id
      }
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.user.role_removed",
        entityType: "user",
        entityId: user.id,
        oldValue: { roles: user.userRoles.map((userRole) => userRole.role.code) },
        newValue: { removedRole: dto.roleCode, note: dto.note }
      }
    });

    return this.getUserOrThrow(userId);
  }

  async setBackOfficePassword(actor: RequestUser, userId: string, dto: SetBackOfficePasswordDto) {
    const user = await this.getUserOrThrow(userId);
    const canUseBackOffice = user.userRoles.some(
      (userRole) => userRole.role.code === RoleCode.ADMIN || userRole.role.code === RoleCode.FINANCE
    );

    if (!canUseBackOffice) {
      throw new BadRequestException("Assign Admin or Finance Manager role before setting a back-office password.");
    }

    const hashed = await hashAdminPassword(dto.password);
    await this.prisma.client.adminCredential.upsert({
      where: { userId },
      update: {
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgorithm: "scrypt",
        passwordUpdatedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      },
      create: {
        userId,
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgorithm: "scrypt"
      }
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.user.backoffice_password_set",
        entityType: "user",
        entityId: user.id,
        newValue: {
          roles: user.userRoles.map((userRole) => userRole.role.code),
          note: dto.note ?? null
        }
      }
    });

    return { updated: true, userId };
  }

  async updateDeliveryPartnerProfile(
    actor: RequestUser,
    userId: string,
    dto: UpdateDeliveryPartnerProfileDto
  ) {
    const user = await this.getUserOrThrow(userId);
    const isDeliveryPartner = user.userRoles.some(
      (userRole) => userRole.role.code === RoleCode.DELIVERY_PARTNER
    );

    if (!isDeliveryPartner) {
      throw new BadRequestException("Assign Delivery Partner role before editing delivery profile.");
    }

    const profileData = this.deliveryProfileData(dto);
    const profile = await this.prisma.client.deliveryPartnerProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        phone: dto.phone ?? user.phone,
        isAvailable: dto.isAvailable === undefined ? true : this.booleanValue(dto.isAvailable),
        ...profileData,
      },
    });

    if (dto.phone !== undefined && dto.phone !== user.phone) {
      await this.prisma.client.user.update({
        where: { id: userId },
        data: { phone: dto.phone || null },
      });
    }

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.delivery_partner.profile_updated",
        entityType: "user",
        entityId: userId,
        ...(user.deliveryProfile
          ? { oldValue: this.deliveryProfileAuditValue(user.deliveryProfile) }
          : {}),
        newValue: this.deliveryProfileAuditValue(profile),
      },
    });

    return this.getUserOrThrow(userId);
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: userInclude
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    return user;
  }

  private async ensureAnotherActiveAdmin(excludedUserId: string) {
    const otherAdminCount = await this.prisma.client.user.count({
      where: {
        id: { not: excludedUserId },
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: { code: RoleCode.ADMIN }
          }
        }
      }
    });

    if (otherAdminCount === 0) {
      throw new BadRequestException("At least one other active admin must remain.");
    }
  }

  private profileWhere(profile: AdminUserQueryDto["profile"]): Prisma.UserWhereInput {
    if (profile === "CUSTOMER") {
      return { customer: { isNot: null } };
    }

    if (profile === "SELLER") {
      return { seller: { isNot: null } };
    }

    if (profile === "BUSINESS_BUYER") {
      return { businessBuyer: { isNot: null } };
    }

    return {};
  }

  private roleName(roleCode: RoleCode) {
    return roleCode
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private deliveryProfileData(dto: UpdateDeliveryPartnerProfileDto) {
    return {
      ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
      ...(dto.vehicleNumber !== undefined ? { vehicleNumber: dto.vehicleNumber || null } : {}),
      ...(dto.isAvailable !== undefined ? { isAvailable: this.booleanValue(dto.isAvailable) } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.serviceCountryCode !== undefined ? { serviceCountryCode: dto.serviceCountryCode || null } : {}),
      ...(dto.serviceStateCode !== undefined ? { serviceStateCode: dto.serviceStateCode || null } : {}),
      ...(dto.serviceCityCode !== undefined ? { serviceCityCode: dto.serviceCityCode || null } : {}),
      ...(dto.servicePincodes !== undefined ? { servicePincodes: this.csvValues(dto.servicePincodes) } : {}),
      ...(dto.serviceLocalAreaCodes !== undefined
        ? { serviceLocalAreaCodes: this.csvValues(dto.serviceLocalAreaCodes) }
        : {}),
      ...(dto.codCashLimitPaise !== undefined ? { codCashLimitPaise: dto.codCashLimitPaise } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
    };
  }

  private deliveryProfileAuditValue(profile: {
    phone?: string | null;
    vehicleNumber?: string | null;
    isAvailable?: boolean;
    priority?: number;
    serviceCountryCode?: string | null;
    serviceStateCode?: string | null;
    serviceCityCode?: string | null;
    servicePincodes?: string[];
    serviceLocalAreaCodes?: string[];
    codCashLimitPaise?: number | null;
    notes?: string | null;
  }) {
    return {
      phone: profile.phone ?? null,
      vehicleNumber: profile.vehicleNumber ?? null,
      isAvailable: profile.isAvailable ?? true,
      priority: profile.priority ?? 100,
      serviceCountryCode: profile.serviceCountryCode ?? null,
      serviceStateCode: profile.serviceStateCode ?? null,
      serviceCityCode: profile.serviceCityCode ?? null,
      servicePincodes: profile.servicePincodes ?? [],
      serviceLocalAreaCodes: profile.serviceLocalAreaCodes ?? [],
      codCashLimitPaise: profile.codCashLimitPaise ?? null,
      notes: profile.notes ?? null,
    };
  }

  private booleanValue(value: string) {
    return value === "true" || value === "1" || value === "yes";
  }

  private csvValues(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
