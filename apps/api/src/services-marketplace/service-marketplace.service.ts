import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  EmailRecipientType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RefundMethod,
  RefundReason,
  RefundRequestStatus,
  RefundTransactionStatus,
  SellerCapability,
  SellerLedgerEntryType,
  SellerPayoutStatus,
  ServiceCashCollectionStatus,
  ServiceCashDisputeResolution,
  ServicePaymentCollectionType,
  ServicePaymentSettlementTreatment,
  ServiceReceivableOffsetPolicy,
  ServiceReceivableTaxAccrualStatus,
  ServiceReceivableWaiverApprovalStatus,
  ServiceSellerReceivableSource,
  ServiceSellerReceivableStatus,
  SellerSettlementStatus,
  SellerStatus,
  SellerType,
  ServiceBookingStatus,
  ServiceCancellationInitiator,
  ServiceCancellationPolicy,
  ServiceDisputeResolution,
  ServiceListingStatus,
  ServicePaymentMode,
  ServicePaymentPurpose,
  ServicePricingModel,
  ServiceQuoteStatus,
  ServiceVisitMode,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { createSlug } from "../common/slug";
import { CustomersService } from "../customers/customers.service";
import { FinanceCalculatorService } from "../finance/finance-calculator.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AdminServiceApprovalDto,
  CancelServiceBookingDto,
  CompletionSubmitDto,
  CreateServiceBookingDto,
  CreateServiceListingDto,
  CreateServiceReviewDto,
  CustomerServiceCashCollectionDecisionDto,
  CustomerServiceCashCollectionDisputeDto,
  RaiseServiceDisputeDto,
  RecordServiceCashCollectionDto,
  RecordServicePaymentDto,
  RescheduleServiceBookingDto,
  ResolveServiceCashReceivableDto,
  ResolveServiceDisputeDto,
  SellerServiceBookingActionDto,
  SendServiceQuoteDto,
  ApproveServiceRefundDto,
  ManualServiceRefundDto,
  ServiceReceivableOffsetPolicyDto,
  ServiceReceivableQueryDto,
  ServiceRefundQueryDto,
  ServiceReceivableWaiverDecisionDto,
  ServiceReceivableWaiverDto,
  ServiceFieldStatusDto,
  SettleServiceReceivableDto,
  ServiceListingQueryDto,
  ServiceReviewQueryDto,
  ServiceReviewReplyDto,
  UpdateSellerServiceCalendarDto,
  UpdateSellerCapabilitiesDto,
  UpdateServiceListingDto,
  WithdrawServiceQuoteDto,
} from "./dto/service-marketplace.dto";

const serviceListingInclude = {
  seller: {
    include: {
      user: true,
      profile: true,
      addresses: true,
    },
  },
  category: true,
  packages: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
  images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
  areas: { orderBy: [{ createdAt: "asc" as const }] },
} satisfies Prisma.ServiceListingInclude;

const serviceBookingInclude = {
  customer: { include: { user: true } },
  seller: { include: { user: true, profile: true } },
  listing: { include: { images: true, category: true } },
  package: true,
  assignedTechnician: true,
  quotes: {
    include: { lineItems: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] } },
    orderBy: { createdAt: "desc" as const },
  },
  payments: { include: { sellerReceivables: { orderBy: { createdAt: "desc" as const } } }, orderBy: { createdAt: "desc" as const } },
  disputes: { include: { refundRequest: true }, orderBy: { createdAt: "desc" as const } },
  refundRequests: {
    include: {
      servicePayment: true,
      transactions: { orderBy: { createdAt: "desc" as const } },
      reviewedBy: { select: { id: true, email: true, fullName: true } },
      createdBy: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  settlement: true,
  sellerReceivables: {
    include: {
      servicePayment: true,
      events: { orderBy: { createdAt: "desc" as const } },
      verifiedBy: { select: { id: true, email: true, fullName: true } },
      disputedBy: { select: { id: true, email: true, fullName: true } },
      resolvedBy: { select: { id: true, email: true, fullName: true } },
      waiverRequestedBy: { select: { id: true, email: true, fullName: true } },
      waiverApprovedBy: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  reviews: { include: { reply: true }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ServiceBookingInclude;

const serviceRefundInclude = {
  booking: {
    include: {
      customer: { include: { user: true } },
      seller: { include: { user: true, profile: true } },
      listing: { include: { category: true, images: true } },
      payments: true,
      settlement: true,
    },
  },
  customer: { include: { user: true } },
  seller: { include: { user: true, profile: true } },
  servicePayment: true,
  transactions: { orderBy: { createdAt: "desc" as const } },
  reviewedBy: { select: { id: true, email: true, fullName: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.ServiceRefundRequestInclude;

type ServiceBookingRecord = Prisma.ServiceBookingGetPayload<{ include: typeof serviceBookingInclude }>;
type ServiceListingRecord = Prisma.ServiceListingGetPayload<{ include: typeof serviceListingInclude }>;
type ServiceBookingTransitionPatch = {
  providerNote?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: Date | null;
  assignedTechnicianId?: string | null;
  completionNote?: string;
  completionImages?: string[];
  completionProofKeys?: string[];
  completionConfirmedById?: string;
};
type ServiceCalendarClient = Prisma.TransactionClient | PrismaService["client"];
type ScheduleValidationInput = {
  sellerId: string;
  listingDurationMinutes?: number | null;
  scheduledStartAt: Date;
  bookingId?: string;
  assignedTechnicianId?: string | null;
};
type CleanServiceAvailabilityRule = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  capacity: number;
  note: string | null;
  isActive: boolean;
};
type CleanServiceBlockedWindow = {
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  isFullDay: boolean;
};
type CleanServiceTechnician = {
  id?: string;
  name: string;
  phone: string | null;
  email: string | null;
  skills: string[];
  isActive: boolean;
};
type CalendarValidationOverrides = {
  availabilityRules?: CleanServiceAvailabilityRule[];
  blockedWindows?: CleanServiceBlockedWindow[];
  activeTechnicianIds?: Set<string>;
};
type ServiceReceivableEventInput = {
  actorUserId?: string;
  resolution?: ServiceCashDisputeResolution;
  amountDeltaPaise?: number;
  oldAmountDuePaise?: number;
  newAmountDuePaise?: number;
  note?: string | undefined;
  metadata?: Prisma.InputJsonValue;
};
type ServiceRefundCreationInput = {
  amountPaise: number;
  reason: RefundReason;
  note: string;
  actorUserId?: string | null;
  servicePaymentId?: string | null;
  status?: RefundRequestStatus;
};
type CancellationOutcome = {
  paidAmountPaise: number;
  refundablePlatformPaidPaise: number;
  feePaise: number;
  refundPaise: number;
  snapshot: Prisma.InputJsonObject;
};

const activeScheduleStatuses: ServiceBookingStatus[] = [
  ServiceBookingStatus.ACCEPTED,
  ServiceBookingStatus.SCHEDULED,
  ServiceBookingStatus.QUOTE_ACCEPTED,
  ServiceBookingStatus.IN_PROGRESS,
];

@Injectable()
export class ServiceMarketplaceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(FinanceCalculatorService) private readonly financeCalculator: FinanceCalculatorService,
  ) {}

  async updateSellerCapabilities(sellerId: string, dto: UpdateSellerCapabilitiesDto, actor: RequestUser) {
    if (!dto.enabledCapabilities.includes(dto.primaryCapability)) {
      throw new BadRequestException("Primary capability must be enabled.");
    }

    return this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.findFirst({ where: { id: sellerId, deletedAt: null } });
      if (!seller) {
        throw new NotFoundException("Seller not found.");
      }

      const enabledCapabilities = [...new Set(dto.enabledCapabilities)].map((capability) =>
        capability === "SERVICE" ? SellerCapability.SERVICE : SellerCapability.RETAIL,
      );
      const primaryCapability =
        dto.primaryCapability === "SERVICE" ? SellerCapability.SERVICE : SellerCapability.RETAIL;
      const updated = await tx.seller.update({
        where: { id: sellerId },
        data: {
          primaryCapability,
          enabledCapabilities,
          sellerType:
            primaryCapability === SellerCapability.SERVICE && seller.sellerType === SellerType.MARKETPLACE_SELLER
              ? SellerType.SERVICE_PROVIDER
              : seller.sellerType,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.capabilities.updated",
          entityType: "seller",
          entityId: sellerId,
          oldValue: {
            primaryCapability: seller.primaryCapability,
            enabledCapabilities: seller.enabledCapabilities,
          },
          newValue: {
            primaryCapability: updated.primaryCapability,
            enabledCapabilities: updated.enabledCapabilities,
            reason: dto.reason,
          },
        },
      });

      return updated;
    });
  }

  async listPublicServices(query: ServiceListingQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20 });
    const where = this.publicServiceWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.client.serviceListing.findMany({
        where,
        include: serviceListingInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceListing.count({ where }),
    ]);

    return {
      items: items.map((item) => this.decorateServiceability(item, query)),
      total,
      page,
      limit: take,
    };
  }

  async getPublicService(slug: string, query: ServiceListingQueryDto) {
    const listing = await this.prisma.client.serviceListing.findFirst({
      where: {
        slug,
        ...this.publicServiceWhere({}),
      },
      include: {
        ...serviceListingInclude,
        reviews: {
          where: { isVisible: true },
          include: { customer: { include: { user: true } }, reply: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!listing) {
      throw new NotFoundException("Service not found.");
    }

    return this.decorateServiceability(listing, query);
  }

  async listSellerServices(actor: RequestUser, query: ServiceListingQueryDto) {
    const seller = await this.resolveSeller(actor);
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20 });
    const search = query.search?.trim();
    const where: Prisma.ServiceListingWhereInput = {
      sellerId: seller.id,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { searchText: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceListing.findMany({
        where,
        include: serviceListingInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceListing.count({ where }),
    ]);

    return { items, total, page, limit: take };
  }

  async getSellerService(actor: RequestUser, serviceId: string) {
    const seller = await this.resolveSeller(actor);
    return this.getSellerServiceOrThrow(seller.id, serviceId);
  }

  async createSellerService(actor: RequestUser, dto: CreateServiceListingDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const category = await this.ensureActiveCategory(dto.categoryId);
    const slug = await this.createUniqueServiceSlug(dto.title);
    this.validateServicePricing(dto);
    const images = this.cleanImages(dto.images);
    const packages = this.cleanPackages(dto.packages);
    const areas = this.cleanAreas(dto.areas);

    const service = await this.prisma.client.$transaction(async (tx) => {
      const createData: Prisma.ServiceListingUncheckedCreateInput = {
        sellerId: seller.id,
        categoryId: category.id,
        title: dto.title.trim(),
        slug,
        description: dto.description.trim(),
        status: ServiceListingStatus.INACTIVE,
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        pricingModel: dto.pricingModel,
        paymentMode: dto.paymentMode,
        cancellationPolicy: dto.cancellationPolicy ?? ServiceCancellationPolicy.FLEXIBLE,
        basePricePaise: dto.basePricePaise ?? null,
        inspectionFeePaise: dto.inspectionFeePaise ?? 0,
        advanceAmountPaise: dto.advanceAmountPaise ?? 0,
        currency: dto.currency?.trim().toUpperCase() || "INR",
        quoteTtlHours: dto.quoteTtlHours ?? 48,
        serviceDurationMinutes: dto.serviceDurationMinutes ?? null,
        allowedVisitModes: [...new Set(dto.allowedVisitModes)],
        highlights: cleanTextArray(dto.highlights),
        inclusions: cleanTextArray(dto.inclusions),
        exclusions: cleanTextArray(dto.exclusions),
        requirements: cleanTextArray(dto.requirements),
        searchText: this.searchText(dto.title, dto.description),
      };
      if (images.length) {
        createData.images = { createMany: { data: images } };
      }
      if (packages.length) {
        createData.packages = { createMany: { data: packages } };
      }
      if (areas.length) {
        createData.areas = { createMany: { data: areas } };
      }

      const created = await tx.serviceListing.create({
        data: createData,
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_listing.created",
          entityType: "service_listing",
          entityId: created.id,
          newValue: {
            title: created.title,
            pricingModel: created.pricingModel,
            paymentMode: created.paymentMode,
          },
        },
      });

      return created;
    });

    return this.getSellerServiceOrThrow(seller.id, service.id);
  }

  async updateSellerService(actor: RequestUser, serviceId: string, dto: UpdateServiceListingDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const existing = await this.getSellerServiceOrThrow(seller.id, serviceId);
    const category = dto.categoryId ? await this.ensureActiveCategory(dto.categoryId) : existing.category;
    const merged = {
      pricingModel: dto.pricingModel ?? existing.pricingModel,
      paymentMode: dto.paymentMode ?? existing.paymentMode,
      basePricePaise: dto.basePricePaise ?? existing.basePricePaise,
      inspectionFeePaise: dto.inspectionFeePaise ?? existing.inspectionFeePaise,
      advanceAmountPaise: dto.advanceAmountPaise ?? existing.advanceAmountPaise,
      allowedVisitModes: dto.allowedVisitModes ?? existing.allowedVisitModes,
    };
    this.validateServicePricing(merged);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceListing.update({
        where: { id: serviceId },
        data: {
          ...(dto.categoryId ? { categoryId: category.id } : {}),
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(dto.pricingModel !== undefined ? { pricingModel: dto.pricingModel } : {}),
          ...(dto.paymentMode !== undefined ? { paymentMode: dto.paymentMode } : {}),
          ...(dto.cancellationPolicy !== undefined ? { cancellationPolicy: dto.cancellationPolicy } : {}),
          ...(dto.basePricePaise !== undefined ? { basePricePaise: dto.basePricePaise } : {}),
          ...(dto.inspectionFeePaise !== undefined ? { inspectionFeePaise: dto.inspectionFeePaise } : {}),
          ...(dto.advanceAmountPaise !== undefined ? { advanceAmountPaise: dto.advanceAmountPaise } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() || "INR" } : {}),
          ...(dto.quoteTtlHours !== undefined ? { quoteTtlHours: dto.quoteTtlHours } : {}),
          ...(dto.serviceDurationMinutes !== undefined ? { serviceDurationMinutes: dto.serviceDurationMinutes } : {}),
          ...(dto.allowedVisitModes !== undefined ? { allowedVisitModes: [...new Set(dto.allowedVisitModes)] } : {}),
          ...(dto.highlights !== undefined ? { highlights: cleanTextArray(dto.highlights) } : {}),
          ...(dto.inclusions !== undefined ? { inclusions: cleanTextArray(dto.inclusions) } : {}),
          ...(dto.exclusions !== undefined ? { exclusions: cleanTextArray(dto.exclusions) } : {}),
          ...(dto.requirements !== undefined ? { requirements: cleanTextArray(dto.requirements) } : {}),
          ...(dto.title !== undefined || dto.description !== undefined
            ? { searchText: this.searchText(dto.title ?? existing.title, dto.description ?? existing.description) }
            : {}),
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          status: ServiceListingStatus.INACTIVE,
        },
      });

      if (dto.images !== undefined) {
        await tx.serviceListingImage.deleteMany({ where: { serviceListingId: serviceId } });
        const images = this.cleanImages(dto.images);
        if (images.length) {
          await tx.serviceListingImage.createMany({
            data: images.map((image) => ({ ...image, serviceListingId: serviceId })),
          });
        }
      }

      if (dto.packages !== undefined) {
        await tx.servicePackage.deleteMany({ where: { serviceListingId: serviceId } });
        const packages = this.cleanPackages(dto.packages);
        if (packages.length) {
          await tx.servicePackage.createMany({
            data: packages.map((item) => ({ ...item, serviceListingId: serviceId })),
          });
        }
      }

      if (dto.areas !== undefined) {
        await tx.serviceArea.deleteMany({ where: { serviceListingId: serviceId } });
        const areas = this.cleanAreas(dto.areas);
        if (areas.length) {
          await tx.serviceArea.createMany({
            data: areas.map((area) => ({ ...area, serviceListingId: serviceId })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_listing.updated",
          entityType: "service_listing",
          entityId: serviceId,
          oldValue: {
            title: existing.title,
            approvalStatus: existing.approvalStatus,
            status: existing.status,
          },
          newValue: toJsonValue(dto),
        },
      });
    });

    return this.getSellerServiceOrThrow(seller.id, serviceId);
  }

  async archiveSellerService(actor: RequestUser, serviceId: string) {
    const seller = await this.resolveSeller(actor);
    const existing = await this.getSellerServiceOrThrow(seller.id, serviceId);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceListing.update({
        where: { id: serviceId },
        data: { status: ServiceListingStatus.ARCHIVED, deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_listing.archived",
          entityType: "service_listing",
          entityId: serviceId,
          oldValue: { status: existing.status, deletedAt: existing.deletedAt },
          newValue: { status: ServiceListingStatus.ARCHIVED },
        },
      });
    });
    return { deleted: true };
  }

  async adminListServices(query: ServiceListingQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 30 });
    const search = query.search?.trim();
    const where: Prisma.ServiceListingWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceListing.findMany({
        where,
        include: serviceListingInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceListing.count({ where }),
    ]);

    return { items, total, page, limit: take };
  }

  async adminUpdateServiceApproval(serviceId: string, dto: AdminServiceApprovalDto, actor: RequestUser) {
    const existing = await this.prisma.client.serviceListing.findFirst({
      where: { id: serviceId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Service listing not found.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.serviceListing.update({
        where: { id: serviceId },
        data: {
          approvalStatus: dto.approvalStatus,
          status:
            dto.status ??
            (dto.approvalStatus === ApprovalStatus.APPROVED
              ? ServiceListingStatus.ACTIVE
              : ServiceListingStatus.INACTIVE),
        },
        include: serviceListingInclude,
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_listing.approval_updated",
          entityType: "service_listing",
          entityId: serviceId,
          oldValue: { approvalStatus: existing.approvalStatus, status: existing.status },
          newValue: { approvalStatus: updated.approvalStatus, status: updated.status, note: dto.note ?? null },
        },
      });
      return updated;
    });

    await this.notifySeller(updated, "service_listing_approval_updated", {
      serviceTitle: updated.title,
      approvalStatus: updated.approvalStatus,
      note: dto.note ?? "",
    });
    return updated;
  }

  async createCustomerBooking(actor: RequestUser, dto: CreateServiceBookingDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const idempotencyKey = this.normalizeIdempotencyKey(dto.idempotencyKey);
    const existingIdempotentBooking = idempotencyKey
      ? await this.findCustomerBookingByIdempotencyKey(customer.id, idempotencyKey)
      : null;
    if (existingIdempotentBooking) {
      return existingIdempotentBooking;
    }

    const listing = await this.prisma.client.serviceListing.findFirst({
      where: {
        slug: dto.serviceSlug,
        ...this.publicServiceWhere({}),
      },
      include: serviceListingInclude,
    });
    if (!listing) {
      throw new NotFoundException("Service not found.");
    }
    if (!listing.allowedVisitModes.includes(dto.visitMode)) {
      throw new BadRequestException("Selected visit mode is not available for this service.");
    }

    const addressSnapshot = await this.resolveBookingAddress(customer.id, dto);
    const serviceable = this.isListingServiceable(listing, addressSnapshot);
    if (!serviceable.serviceable) {
      throw new BadRequestException(
        serviceable.reason ?? "This service is not available for the selected location.",
      );
    }

    const selectedPackage = (dto.servicePackageId
      ? listing.packages.find((item) => item.id === dto.servicePackageId && item.isActive)
      : listing.packages.find((item) => item.isActive)) ?? null;
    const pricing = this.bookingPricing(listing, selectedPackage);
    const bookingNumber = await this.createUniqueBookingNumber();
    const scheduledStartAt = dto.scheduledStartAt ? new Date(dto.scheduledStartAt) : null;
    const scheduledEndAt = this.scheduledEndAt(scheduledStartAt, listing.serviceDurationMinutes);

    let createdNew = true;
    const booking = await this.prisma.client.$transaction(async (tx) => {
      if (scheduledStartAt) {
        await this.lockSellerSchedule(tx, listing.sellerId);
        await this.ensureScheduleAvailable(
          {
            sellerId: listing.sellerId,
            listingDurationMinutes: listing.serviceDurationMinutes,
            scheduledStartAt,
          },
          tx,
        );
      }

      const bookingCreateData: Prisma.ServiceBookingUncheckedCreateInput = {
        bookingNumber,
        idempotencyKey,
        customerId: customer.id,
        sellerId: listing.sellerId,
        serviceListingId: listing.id,
        servicePackageId: selectedPackage?.id ?? null,
        visitMode: dto.visitMode,
        paymentMode: listing.paymentMode,
        cancellationPolicy: listing.cancellationPolicy,
        scheduledStartAt,
        scheduledEndAt,
        addressSnapshot: addressSnapshot ? toJsonValue(addressSnapshot) : Prisma.JsonNull,
        customerIssue: dto.customerIssue.trim(),
        customerNote: dto.customerNote?.trim() || null,
        subtotalPaise: pricing.subtotalPaise,
        inspectionFeePaise: pricing.inspectionFeePaise,
        advanceAmountPaise: pricing.advanceAmountPaise,
        totalPayablePaise: pricing.totalPayablePaise,
        currency: listing.currency,
      };
      if (pricing.initialPaymentPaise > 0) {
        bookingCreateData.payments = {
          create: {
            sellerId: listing.sellerId,
            provider:
              listing.paymentMode === ServicePaymentMode.PAY_AT_VISIT
                ? PaymentProvider.MANUAL
                : PaymentProvider.RAZORPAY,
            purpose: this.initialPaymentPurpose(listing.paymentMode),
            collectionType:
              listing.paymentMode === ServicePaymentMode.PAY_AT_VISIT
                ? ServicePaymentCollectionType.PLATFORM_OFFLINE
                : ServicePaymentCollectionType.PLATFORM_ONLINE,
            settlementTreatment: ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE,
            amountPaise: pricing.initialPaymentPaise,
            currency: listing.currency,
            status: PaymentStatus.PENDING,
          },
        };
      }

      const booking = await tx.serviceBooking.create({ data: bookingCreateData }).catch(async (error: unknown) => {
        if (idempotencyKey && this.isPrismaUniqueConstraintError(error)) {
          const recovered = await tx.serviceBooking.findFirst({
            where: { customerId: customer.id, idempotencyKey },
          });
          if (recovered) {
            createdNew = false;
            return recovered;
          }
        }
        throw error;
      });

      if (createdNew) {
        await tx.auditLog.create({
          data: {
            actor: { connect: { id: actor.id } },
            action: "service_booking.requested",
            entityType: "service_booking",
            entityId: booking.id,
            newValue: {
              bookingNumber: booking.bookingNumber,
              serviceListingId: listing.id,
              sellerId: listing.sellerId,
            },
          },
        });
      }

      return booking;
    });

    const fullBooking = await this.getCustomerBooking(actor, booking.bookingNumber);
    if (createdNew) {
      await this.notifyBooking(fullBooking, "service_booking_requested");
    }
    return fullBooking;
  }

  async listCustomerBookings(actor: RequestUser, query: ServiceListingQueryDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20 });
    const where: Prisma.ServiceBookingWhereInput = { customerId: customer.id };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceBooking.findMany({
        where,
        include: serviceBookingInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceBooking.count({ where }),
    ]);
    return { items, total, page, limit: take };
  }

  async getCustomerBooking(actor: RequestUser, bookingNumber: string) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const booking = await this.prisma.client.serviceBooking.findFirst({
      where: { bookingNumber, customerId: customer.id },
      include: serviceBookingInclude,
    });
    if (!booking) {
      throw new NotFoundException("Service booking not found.");
    }
    return booking;
  }

  async listSellerBookings(actor: RequestUser, query: ServiceListingQueryDto) {
    const seller = await this.resolveSeller(actor);
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20 });
    const where: Prisma.ServiceBookingWhereInput = { sellerId: seller.id };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceBooking.findMany({
        where,
        include: serviceBookingInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceBooking.count({ where }),
    ]);
    return { items, total, page, limit: take };
  }

  async getSellerBooking(actor: RequestUser, bookingNumber: string) {
    const seller = await this.resolveSeller(actor);
    return this.getSellerBookingOrThrow(seller.id, bookingNumber);
  }

  async getSellerServiceCalendar(actor: RequestUser) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    return this.buildSellerServiceCalendar(seller.id);
  }

  async updateSellerServiceCalendar(actor: RequestUser, dto: UpdateSellerServiceCalendarDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const rules = this.cleanAvailabilityRules(dto.availabilityRules);
    const blockedWindows = this.cleanBlockedWindows(dto.blockedWindows);
    const technicians = this.cleanTechnicians(dto.technicians);

    await this.prisma.client.$transaction(async (tx) => {
      await this.lockSellerSchedule(tx, seller.id);

      await tx.sellerServiceAvailabilityRule.deleteMany({ where: { sellerId: seller.id } });
      if (rules.length) {
        await tx.sellerServiceAvailabilityRule.createMany({
          data: rules.map((rule) => ({ ...rule, sellerId: seller.id })),
        });
      }

      await tx.sellerServiceBlockedWindow.deleteMany({ where: { sellerId: seller.id } });
      if (blockedWindows.length) {
        await tx.sellerServiceBlockedWindow.createMany({
          data: blockedWindows.map((window) => ({ ...window, sellerId: seller.id })),
        });
      }

      const existingTechnicians = await tx.sellerServiceTechnician.findMany({
        where: { sellerId: seller.id },
        select: { id: true },
      });
      const existingIds = new Set(existingTechnicians.map((technician) => technician.id));
      const submittedIds = new Set(technicians.map((technician) => technician.id).filter(Boolean) as string[]);
      const invalidIds = [...submittedIds].filter((id) => !existingIds.has(id));
      if (invalidIds.length) {
        throw new BadRequestException("One or more technicians do not belong to this seller.");
      }

      await this.ensureExistingSchedulesCompatibleWithCalendar(seller.id, rules, blockedWindows, technicians, tx);

      for (const technician of technicians) {
        if (technician.id) {
          await tx.sellerServiceTechnician.update({
            where: { id: technician.id },
            data: {
              name: technician.name,
              phone: technician.phone,
              email: technician.email,
              skills: technician.skills,
              isActive: technician.isActive,
            },
          });
        } else {
          await tx.sellerServiceTechnician.create({
            data: {
              sellerId: seller.id,
              name: technician.name,
              phone: technician.phone,
              email: technician.email,
              skills: technician.skills,
              isActive: technician.isActive,
            },
          });
        }
      }

      const omittedIds = [...existingIds].filter((id) => !submittedIds.has(id));
      if (omittedIds.length) {
        await tx.sellerServiceTechnician.updateMany({
          where: { sellerId: seller.id, id: { in: omittedIds } },
          data: { isActive: false },
        });
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_calendar.updated",
          entityType: "seller",
          entityId: seller.id,
          newValue: {
            availabilityRules: rules.length,
            blockedWindows: blockedWindows.length,
            technicians: technicians.length,
          },
        },
      });
    });

    return this.buildSellerServiceCalendar(seller.id);
  }

  async sellerAcceptBooking(actor: RequestUser, bookingNumber: string, dto: SellerServiceBookingActionDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(booking, [ServiceBookingStatus.REQUESTED], "Only requested bookings can be accepted.");
    const scheduledStartAt = dto.scheduledStartAt ? new Date(dto.scheduledStartAt) : booking.scheduledStartAt;
    if (dto.assignedTechnicianId && !scheduledStartAt) {
      throw new BadRequestException("A scheduled visit time is required before assigning a technician.");
    }
    const nextStatus =
      booking.listing.pricingModel === ServicePricingModel.QUOTE_FIRST
        ? ServiceBookingStatus.ACCEPTED
        : scheduledStartAt
          ? ServiceBookingStatus.SCHEDULED
          : ServiceBookingStatus.ACCEPTED;

    const patch: ServiceBookingTransitionPatch = {};
    if (dto.note !== undefined) {
      patch.providerNote = dto.note;
    }
    if (dto.scheduledStartAt !== undefined) {
      patch.scheduledStartAt = dto.scheduledStartAt;
      patch.scheduledEndAt = this.scheduledEndAt(scheduledStartAt, booking.listing.serviceDurationMinutes);
    } else if (scheduledStartAt) {
      patch.scheduledEndAt = this.scheduledEndAt(scheduledStartAt, booking.listing.serviceDurationMinutes);
    }
    if (dto.assignedTechnicianId !== undefined) {
      patch.assignedTechnicianId = dto.assignedTechnicianId;
    }
    const updated = await this.transitionBooking(booking, nextStatus, actor, "service_booking.accepted", patch);
    await this.notifyBooking(updated, "service_booking_accepted");
    return updated;
  }

  async sellerRejectBooking(actor: RequestUser, bookingNumber: string, dto: CancelServiceBookingDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(booking, [ServiceBookingStatus.REQUESTED, ServiceBookingStatus.ACCEPTED], "Booking cannot be rejected now.");
    const updated = await this.transitionBooking(booking, ServiceBookingStatus.REJECTED, actor, "service_booking.rejected", {
      providerNote: dto.reason,
    });
    await this.notifyBooking(updated, "service_booking_rejected");
    return updated;
  }

  async sellerSendQuote(actor: RequestUser, bookingNumber: string, dto: SendServiceQuoteDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(
      booking,
      [ServiceBookingStatus.ACCEPTED, ServiceBookingStatus.IN_PROGRESS],
      "Quote can be sent only after accepting the booking or after inspection.",
    );
    const lineItems = dto.lineItems.map((line, index) => {
      const quantity = line.quantity ?? 1;
      return {
        description: line.description.trim(),
        quantity,
        unitPaise: line.unitPaise,
        totalPaise: quantity * line.unitPaise,
        sortOrder: index,
      };
    });
    const totalPaise = lineItems.reduce((sum, item) => sum + item.totalPaise, 0);
    const quoteNumber = await this.createUniqueQuoteNumber();
    const ttlHours = dto.ttlHours ?? booking.listing.quoteTtlHours;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceQuote.updateMany({
        where: { bookingId: booking.id, status: ServiceQuoteStatus.SENT },
        data: {
          status: ServiceQuoteStatus.WITHDRAWN,
          withdrawnAt: new Date(),
          withdrawnById: actor.id,
          withdrawalNote: "Replaced by revised provider quote.",
        },
      });
      await tx.serviceQuote.create({
        data: {
          bookingId: booking.id,
          quoteNumber,
          subtotalPaise: totalPaise,
          totalPaise,
          currency: booking.currency,
          note: dto.note?.trim() || null,
          expiresAt,
          sentById: actor.id,
          lineItems: { createMany: { data: lineItems } },
        },
      });
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status: ServiceBookingStatus.QUOTE_SENT,
          subtotalPaise: totalPaise,
          totalPayablePaise: totalPaise,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_quote.sent",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { quoteNumber, totalPaise, expiresAt },
        },
      });
    });

    const updated = await this.getSellerBooking(actor, bookingNumber);
    await this.notifyBooking(updated, "service_quote_sent");
    return updated;
  }

  async sellerWithdrawQuote(actor: RequestUser, bookingNumber: string, dto: WithdrawServiceQuoteDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    const quote = this.activeQuoteOrThrow(booking);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceQuote.update({
        where: { id: quote.id },
        data: {
          status: ServiceQuoteStatus.WITHDRAWN,
          withdrawnAt: new Date(),
          withdrawnById: actor.id,
          withdrawalNote: dto.note?.trim() || null,
        },
      });
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: { status: ServiceBookingStatus.ACCEPTED },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_quote.withdrawn",
          entityType: "service_booking",
          entityId: booking.id,
          oldValue: { quoteId: quote.id, status: quote.status },
          newValue: { note: dto.note ?? null, nextStatus: ServiceBookingStatus.ACCEPTED },
        },
      });
    });
    const updated = await this.getSellerBooking(actor, bookingNumber);
    await this.notifyBooking(updated, "service_quote_rejected");
    return updated;
  }

  async customerAcceptQuote(actor: RequestUser, bookingNumber: string) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    const quote = this.activeQuoteOrThrow(booking);
    if (quote.expiresAt < new Date()) {
      await this.expireQuote(booking, quote.id);
      throw new BadRequestException("This quote has expired. Please request a new quote.");
    }
    const duePaise = Math.max(0, quote.totalPaise - booking.paidAmountPaise);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceQuote.update({ where: { id: quote.id }, data: { status: ServiceQuoteStatus.ACCEPTED, acceptedAt: new Date() } });
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status: ServiceBookingStatus.QUOTE_ACCEPTED,
          subtotalPaise: quote.totalPaise,
          totalPayablePaise: quote.totalPaise,
          ...(duePaise > 0
            ? {
                payments: {
                  create: {
                    sellerId: booking.sellerId,
                    provider:
                      booking.paymentMode === ServicePaymentMode.PAY_AT_VISIT
                        ? PaymentProvider.MANUAL
                        : PaymentProvider.RAZORPAY,
                    purpose: ServicePaymentPurpose.FINAL_QUOTE,
                    collectionType:
                      booking.paymentMode === ServicePaymentMode.PAY_AT_VISIT
                        ? ServicePaymentCollectionType.PLATFORM_OFFLINE
                        : ServicePaymentCollectionType.PLATFORM_ONLINE,
                    settlementTreatment: ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE,
                    amountPaise: duePaise,
                    currency: booking.currency,
                  },
                },
              }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_quote.accepted",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { quoteId: quote.id, totalPaise: quote.totalPaise, duePaise },
        },
      });
    });

    const updated = await this.getCustomerBooking(actor, bookingNumber);
    await this.notifyBooking(updated, "service_quote_accepted");
    return updated;
  }

  async customerRejectQuote(actor: RequestUser, bookingNumber: string) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    const quote = this.activeQuoteOrThrow(booking);
    const nextStatus =
      booking.status === ServiceBookingStatus.QUOTE_SENT && booking.inspectionFeePaise > 0
        ? ServiceBookingStatus.CLOSED_AFTER_INSPECTION
        : ServiceBookingStatus.QUOTE_REJECTED;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceQuote.update({ where: { id: quote.id }, data: { status: ServiceQuoteStatus.REJECTED, rejectedAt: new Date() } });
      await tx.serviceBooking.update({ where: { id: booking.id }, data: { status: nextStatus } });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_quote.rejected",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { quoteId: quote.id, nextStatus },
        },
      });
    });

    const updated = await this.getCustomerBooking(actor, bookingNumber);
    if (nextStatus === ServiceBookingStatus.CLOSED_AFTER_INSPECTION) {
      await this.createSettlementIfEligible(updated);
    }
    await this.notifyBooking(updated, "service_quote_rejected");
    return updated;
  }

  async sellerMarkInProgress(actor: RequestUser, bookingNumber: string) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(
      booking,
      [ServiceBookingStatus.ACCEPTED, ServiceBookingStatus.SCHEDULED, ServiceBookingStatus.QUOTE_ACCEPTED],
      "Booking must be accepted, quoted, or scheduled before work can start.",
    );
    this.ensureServicePaymentGate(booking, "start");
    const updated = await this.transitionBooking(booking, ServiceBookingStatus.IN_PROGRESS, actor, "service_booking.in_progress");
    await this.notifyBooking(updated, "service_booking_in_progress");
    return updated;
  }

  async sellerUpdateFieldStatus(actor: RequestUser, bookingNumber: string, dto: ServiceFieldStatusDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(
      booking,
      [ServiceBookingStatus.ACCEPTED, ServiceBookingStatus.SCHEDULED, ServiceBookingStatus.QUOTE_ACCEPTED, ServiceBookingStatus.IN_PROGRESS],
      "Technician field status can be updated only for accepted, scheduled, quoted, or active work.",
    );
    if (dto.status === "CHECKED_IN") {
      this.ensureServicePaymentGate(booking, "start");
    }
    const now = new Date();
    const location =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? { technicianLastLatitude: dto.latitude, technicianLastLongitude: dto.longitude }
        : {};
    const fieldPatch =
      dto.status === "EN_ROUTE"
        ? { technicianEnRouteAt: now }
        : dto.status === "ARRIVED"
          ? { technicianArrivedAt: now }
          : dto.status === "CHECKED_IN"
            ? { technicianCheckInAt: now }
            : { technicianCheckOutAt: now };
    const nextStatus =
      dto.status === "CHECKED_IN" && booking.status !== ServiceBookingStatus.IN_PROGRESS
        ? ServiceBookingStatus.IN_PROGRESS
        : booking.status;
    await this.prisma.client.$transaction(async (tx) => {
      await this.lockServiceBooking(tx, booking.id);
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          ...fieldPatch,
          ...location,
          technicianFieldStatusNote: dto.note?.trim() || booking.technicianFieldStatusNote,
          ...(dto.fieldProofKeys !== undefined
            ? { technicianFieldProofKeys: cleanTextArray([...(booking.technicianFieldProofKeys ?? []), ...dto.fieldProofKeys]) }
            : {}),
          status: nextStatus,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_booking.field_status_updated",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: {
            fieldStatus: dto.status,
            note: dto.note ?? null,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            fieldProofCount: dto.fieldProofKeys?.length ?? 0,
          },
        },
      });
    });
    const updated = await this.getSellerBooking(actor, bookingNumber);
    if (nextStatus === ServiceBookingStatus.IN_PROGRESS && booking.status !== ServiceBookingStatus.IN_PROGRESS) {
      await this.notifyBooking(updated, "service_booking_in_progress");
    }
    return updated;
  }

  async sellerRescheduleBooking(actor: RequestUser, bookingNumber: string, dto: RescheduleServiceBookingDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(
      booking,
      [ServiceBookingStatus.ACCEPTED, ServiceBookingStatus.SCHEDULED, ServiceBookingStatus.QUOTE_ACCEPTED],
      "Only accepted or scheduled bookings can be rescheduled.",
    );

    const scheduledStartAt = new Date(dto.scheduledStartAt);

    const nextStatus =
      booking.status === ServiceBookingStatus.ACCEPTED ? ServiceBookingStatus.SCHEDULED : booking.status;
    const patch: ServiceBookingTransitionPatch = {
      scheduledStartAt: dto.scheduledStartAt,
      scheduledEndAt: this.scheduledEndAt(scheduledStartAt, booking.listing.serviceDurationMinutes),
      assignedTechnicianId: dto.assignedTechnicianId ?? booking.assignedTechnicianId ?? null,
    };
    if (dto.note !== undefined) {
      patch.providerNote = dto.note;
    }
    const updated = await this.transitionBooking(booking, nextStatus, actor, "service_booking.rescheduled", patch);
    await this.notifyBooking(updated, "service_booking_accepted");
    return updated;
  }

  async sellerSubmitCompletion(actor: RequestUser, bookingNumber: string, dto: CompletionSubmitDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(
      booking,
      [ServiceBookingStatus.IN_PROGRESS, ServiceBookingStatus.SCHEDULED, ServiceBookingStatus.QUOTE_ACCEPTED],
      "Completion can be submitted only after work has started.",
    );
    this.ensureServicePaymentGate(booking, "completion");
    const patch: ServiceBookingTransitionPatch = { completionNote: dto.completionNote };
    if (dto.completionImages !== undefined) {
      patch.completionImages = dto.completionImages;
    }
    if (dto.completionProofKeys !== undefined) {
      patch.completionProofKeys = dto.completionProofKeys;
    }
    const updated = await this.transitionBooking(
      booking,
      ServiceBookingStatus.COMPLETION_SUBMITTED,
      actor,
      "service_booking.completion_submitted",
      patch,
    );
    await this.notifyBooking(updated, "service_completion_submitted");
    return updated;
  }

  async customerConfirmCompletion(actor: RequestUser, bookingNumber: string) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    this.ensureBookingStatus(booking, [ServiceBookingStatus.COMPLETION_SUBMITTED], "Completion is not awaiting confirmation.");
    const updated = await this.transitionBooking(booking, ServiceBookingStatus.COMPLETED, actor, "service_booking.completed", {
      completionConfirmedById: actor.id,
    });
    await this.createSettlementIfEligible(updated);
    await this.notifyBooking(updated, "service_completion_confirmed");
    return updated;
  }

  async customerRaiseDispute(actor: RequestUser, bookingNumber: string, dto: RaiseServiceDisputeDto) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    this.ensureBookingStatus(booking, [ServiceBookingStatus.COMPLETION_SUBMITTED], "Dispute can be raised only after completion is submitted.");
    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceDispute.create({
        data: {
          bookingId: booking.id,
          raisedById: actor.id,
          reason: dto.reason.trim(),
          evidence: cleanTextArray(dto.evidence),
          evidenceKeys: cleanTextArray(dto.evidenceKeys),
        },
      });
      await tx.serviceBooking.update({ where: { id: booking.id }, data: { status: ServiceBookingStatus.COMPLETION_DISPUTED } });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_dispute.raised",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { reason: dto.reason },
        },
      });
    });
    const updated = await this.getCustomerBooking(actor, bookingNumber);
    await this.notifyBooking(updated, "service_dispute_raised");
    return updated;
  }

  async adminResolveDispute(bookingNumber: string, disputeId: string, dto: ResolveServiceDisputeDto, actor: RequestUser) {
    const booking = await this.getAdminBookingOrThrow(bookingNumber);
    const dispute = booking.disputes.find((item) => item.id === disputeId);
    if (!dispute) {
      throw new NotFoundException("Service dispute not found.");
    }
    if (dispute.resolvedAt) {
      throw new BadRequestException("This service dispute has already been resolved.");
    }
    const refundAmountPaise = this.disputeRefundAmount(booking, dto);
    const nextStatus =
      dto.resolution === ServiceDisputeResolution.COMPLETE_BOOKING ||
      dto.resolution === ServiceDisputeResolution.RELEASE_TO_PROVIDER ||
      dto.resolution === ServiceDisputeResolution.PARTIAL_REFUND
        ? ServiceBookingStatus.COMPLETED
        : ServiceBookingStatus.CANCELLED_AFTER_DISPUTE;

    await this.prisma.client.$transaction(async (tx) => {
      await this.lockServiceBooking(tx, booking.id);
      const refundRequest =
        refundAmountPaise > 0
          ? await this.createServiceRefundRequestInTransaction(tx, booking, {
              amountPaise: refundAmountPaise,
              reason:
                dto.resolution === ServiceDisputeResolution.PARTIAL_REFUND
                  ? RefundReason.SERVICE_DISPUTE_PARTIAL_REFUND
                  : RefundReason.SERVICE_DISPUTE_REFUND,
              note: dto.adminNote,
              actorUserId: actor.id,
            })
          : null;
      await tx.serviceDispute.update({
        where: { id: disputeId },
        data: {
          resolution: dto.resolution,
          adminNote: dto.adminNote,
          refundAmountPaise,
          refundRequestId: refundRequest?.id ?? null,
          resolvedById: actor.id,
          resolvedAt: new Date(),
        },
      });
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status: nextStatus,
          ...(nextStatus === ServiceBookingStatus.COMPLETED
            ? { completionConfirmedById: actor.id, completionConfirmedAt: new Date() }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_dispute.resolved",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: {
            disputeId,
            resolution: dto.resolution,
            adminNote: dto.adminNote,
            nextStatus,
            refundAmountPaise,
            refundNumber: refundRequest?.refundNumber ?? null,
          },
        },
      });
    });

    const updated = await this.getAdminBookingOrThrow(bookingNumber);
    if (nextStatus === ServiceBookingStatus.COMPLETED) {
      await this.createSettlementIfEligible(updated);
    }
    await this.notifyBooking(updated, "service_dispute_resolved");
    return updated;
  }

  async cancelCustomerBooking(actor: RequestUser, bookingNumber: string, dto: CancelServiceBookingDto) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    return this.cancelBooking(booking, actor, dto.reason, ServiceCancellationInitiator.CUSTOMER);
  }

  async cancelSellerBooking(actor: RequestUser, bookingNumber: string, dto: CancelServiceBookingDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    return this.cancelBooking(booking, actor, dto.reason, ServiceCancellationInitiator.PROVIDER);
  }

  async adminCancelBooking(bookingNumber: string, dto: CancelServiceBookingDto, actor: RequestUser) {
    const booking = await this.getAdminBookingOrThrow(bookingNumber);
    return this.cancelBooking(booking, actor, dto.reason, dto.initiator ?? ServiceCancellationInitiator.ADMIN);
  }

  async recordServicePayment(actor: RequestUser, bookingNumber: string, dto: RecordServicePaymentDto, admin = false) {
    const booking = admin
      ? await this.getAdminBookingOrThrow(bookingNumber)
      : await this.getSellerBookingOrThrow((await this.resolveApprovedServiceSeller(actor)).id, bookingNumber);
    if (!admin) {
      throw new BadRequestException("Service providers must use cash collection recording for pay-at-visit collections.");
    }
    if (dto.provider === PaymentProvider.RAZORPAY) {
      throw new BadRequestException("Razorpay service payments must be completed through customer checkout verification.");
    }
    const status = dto.markPaid ? PaymentStatus.PAID : PaymentStatus.PENDING;
    const payment = await this.prisma.client.$transaction(async (tx) => {
      const payment = await tx.servicePayment.create({
        data: {
          bookingId: booking.id,
          sellerId: booking.sellerId,
          provider: dto.provider,
          purpose: dto.purpose,
          collectionType: ServicePaymentCollectionType.PLATFORM_OFFLINE,
          settlementTreatment: ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE,
          cashCollectionStatus: ServiceCashCollectionStatus.NOT_APPLICABLE,
          amountPaise: dto.amountPaise,
          currency: booking.currency,
          status,
          referenceNumber: dto.referenceNumber?.trim() || null,
          paidAt: status === PaymentStatus.PAID ? new Date() : null,
          events: {
            create: {
              eventType: "service_payment.recorded",
              newStatus: status,
              payload: { recordedBy: actor.id, referenceNumber: dto.referenceNumber ?? null },
            },
          },
        },
      });
      if (status === PaymentStatus.PAID) {
        const paidAggregate = await tx.servicePayment.aggregate({
          where: {
            bookingId: booking.id,
            status: PaymentStatus.PAID,
          },
          _sum: { amountPaise: true },
        });
        await tx.serviceBooking.update({
          where: { id: booking.id },
          data: { paidAmountPaise: paidAggregate._sum.amountPaise ?? 0 },
        });
      }
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_payment.recorded",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { paymentId: payment.id, amountPaise: dto.amountPaise, status },
        },
      });
      return payment;
    });
    if (status === PaymentStatus.PAID) {
      const refreshed = await this.getAdminBookingOrThrow(bookingNumber);
      await this.createSettlementIfEligible(refreshed);
    }
    return payment;
  }

  async recordSellerCashCollection(actor: RequestUser, bookingNumber: string, dto: RecordServiceCashCollectionDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    const amountPaise = dto.amountPaise;
    const remainingDue = Math.max(0, booking.totalPayablePaise - booking.paidAmountPaise);
    if (amountPaise > remainingDue) {
      throw new BadRequestException("Cash collection cannot be greater than the customer's remaining due amount.");
    }
    const idempotencyKey = this.normalizeCashKey(dto.idempotencyKey) ?? this.defaultCashIdempotencyKey(booking, dto);
    const cashCollectionEventId = this.normalizeCashKey(dto.cashCollectionEventId) ?? idempotencyKey;
    const existing = await this.prisma.client.servicePayment.findFirst({
      where: { bookingId: booking.id, sellerId: booking.sellerId, idempotencyKey },
      include: { sellerReceivables: true },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.client.$transaction(async (tx) => {
      const lockedExisting = await tx.servicePayment.findFirst({
        where: {
          OR: [
            { bookingId: booking.id, sellerId: booking.sellerId, idempotencyKey },
            { bookingId: booking.id, sellerId: booking.sellerId, cashCollectionEventId },
          ],
        },
        include: { sellerReceivables: true },
      });
      if (lockedExisting) {
        return lockedExisting;
      }

      const calculation = await this.financeCalculator.calculateServiceBooking(booking, amountPaise, tx);
      const dueToPlatform =
        calculation.commissionPaise +
        calculation.gstOnCommissionPaise +
        calculation.tdsPaise +
        calculation.tcsPaise +
        calculation.platformFeePaise;
      const now = new Date();
      const payment = await tx.servicePayment.create({
        data: {
          bookingId: booking.id,
          sellerId: booking.sellerId,
          provider: PaymentProvider.MANUAL,
          purpose: dto.purpose ?? ServicePaymentPurpose.PAY_AT_VISIT,
          collectionType: ServicePaymentCollectionType.PROVIDER_CASH,
          settlementTreatment: ServicePaymentSettlementTreatment.PLATFORM_RECEIVABLE,
          cashCollectionStatus: ServiceCashCollectionStatus.RECORDED,
          idempotencyKey,
          cashCollectionEventId,
          attemptNumber: dto.attemptNumber ?? 1,
          amountPaise,
          currency: booking.currency,
          status: PaymentStatus.PENDING,
          referenceNumber: cashCollectionEventId,
          cashCollectedById: actor.id,
          cashCollectedAt: now,
          events: {
            create: {
              eventType: "service_cash_collection.recorded",
              newStatus: PaymentStatus.PENDING,
              payload: {
                recordedBy: actor.id,
                cashCollectionEventId,
                amountPaise,
                note: dto.note ?? null,
              },
            },
          },
        },
      });

      const receivableNumber = await this.createUniqueReceivableNumber(tx);
      const receivable = await tx.serviceSellerReceivable.create({
        data: {
          receivableNumber,
          sellerId: booking.sellerId,
          bookingId: booking.id,
          servicePaymentId: payment.id,
          source: ServiceSellerReceivableSource.PROVIDER_CASH_COLLECTION,
          status: ServiceSellerReceivableStatus.PROVISIONAL,
          offsetPolicy: ServiceReceivableOffsetPolicy.MANUAL_ONLY,
          taxAccrualStatus: ServiceReceivableTaxAccrualStatus.PROVISIONAL,
          waiverApprovalStatus: ServiceReceivableWaiverApprovalStatus.NOT_REQUESTED,
          grossCashCollectedPaise: amountPaise,
          commissionPaise: calculation.commissionPaise,
          gstOnCommissionPaise: calculation.gstOnCommissionPaise,
          tdsPaise: calculation.tdsPaise,
          tcsPaise: calculation.tcsPaise,
          platformFeePaise: calculation.platformFeePaise,
          amountDueToPlatformPaise: dueToPlatform,
          currency: booking.currency,
          idempotencyKey,
          cashCollectionEventId,
          provisionalUntil: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          note: dto.note?.trim() || null,
          financeSnapshot: calculation.snapshot,
        },
      });
      await this.createReceivableEvent(tx, receivable.id, "service_receivable.provisional_opened", null, ServiceSellerReceivableStatus.PROVISIONAL, {
        actorUserId: actor.id,
        amountDeltaPaise: dueToPlatform,
        newAmountDuePaise: dueToPlatform,
        note: dto.note,
        metadata: { paymentId: payment.id, cashCollectionEventId, grossCashCollectedPaise: amountPaise },
      });
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: booking.sellerId,
          serviceBookingId: booking.id,
          entryType: SellerLedgerEntryType.SERVICE_RECEIVABLE_OPENED,
          description: `Provisional platform receivable for provider cash on ${booking.bookingNumber}`,
          debitPaise: dueToPlatform,
          currency: booking.currency,
          referenceType: "service_seller_receivable",
          referenceId: receivable.id,
          metadata: { receivableNumber, paymentId: payment.id, cashCollectionEventId },
          createdById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_cash_collection.recorded",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: {
            paymentId: payment.id,
            receivableId: receivable.id,
            receivableNumber,
            amountPaise,
            amountDueToPlatformPaise: dueToPlatform,
            cashCollectionEventId,
          },
        },
      });
      return tx.servicePayment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { sellerReceivables: true },
      });
    });
  }

  async customerConfirmCashCollection(
    actor: RequestUser,
    bookingNumber: string,
    paymentId: string,
    dto: CustomerServiceCashCollectionDecisionDto,
  ) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    const payment = this.cashPaymentOrThrow(booking, paymentId);
    if (
      payment.cashCollectionStatus !== ServiceCashCollectionStatus.RECORDED &&
      payment.cashCollectionStatus !== ServiceCashCollectionStatus.REOPENED
    ) {
      throw new BadRequestException("This cash collection is not awaiting customer confirmation.");
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.servicePayment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          customerCashConfirmedAt: new Date(),
          cashCollectionStatus: ServiceCashCollectionStatus.CUSTOMER_CONFIRMED,
          cashDisputeResolution: ServiceCashDisputeResolution.CUSTOMER_CONFIRMED,
          cashResolutionNote: dto.note?.trim() || null,
          events: {
            create: {
              eventType: "service_cash_collection.customer_confirmed",
              oldStatus: payment.status,
              newStatus: PaymentStatus.PAID,
              payload: { actorUserId: actor.id, note: dto.note ?? null },
            },
          },
        },
      });
      await tx.serviceSellerReceivable.updateMany({
        where: { servicePaymentId: payment.id, status: { in: [ServiceSellerReceivableStatus.PROVISIONAL, ServiceSellerReceivableStatus.DISPUTED] } },
        data: {
          status: ServiceSellerReceivableStatus.OPEN,
          taxAccrualStatus: ServiceReceivableTaxAccrualStatus.ACCRUED,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          taxAccruedAt: new Date(),
          resolution: ServiceCashDisputeResolution.CUSTOMER_CONFIRMED,
          resolvedById: actor.id,
          resolvedAt: new Date(),
          resolutionNote: dto.note?.trim() || "Customer confirmed cash collection.",
        },
      });
      const receivables = await tx.serviceSellerReceivable.findMany({ where: { servicePaymentId: payment.id } });
      for (const receivable of receivables) {
        await this.createReceivableEvent(tx, receivable.id, "service_receivable.customer_confirmed", receivable.status, ServiceSellerReceivableStatus.OPEN, {
          actorUserId: actor.id,
          resolution: ServiceCashDisputeResolution.CUSTOMER_CONFIRMED,
          amountDeltaPaise: 0,
          oldAmountDuePaise: receivable.amountDueToPlatformPaise,
          newAmountDuePaise: receivable.amountDueToPlatformPaise,
          note: dto.note,
        });
      }
      await this.refreshBookingPaidAmount(tx, booking.id);
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_cash_collection.customer_confirmed",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { paymentId: payment.id, amountPaise: payment.amountPaise, note: dto.note },
        },
      });
    });

    const updated = await this.getCustomerBooking(actor, bookingNumber);
    await this.createSettlementIfEligible(updated);
    return updated;
  }

  async customerDisputeCashCollection(
    actor: RequestUser,
    bookingNumber: string,
    paymentId: string,
    dto: CustomerServiceCashCollectionDisputeDto,
  ) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    const payment = this.cashPaymentOrThrow(booking, paymentId);
    if (
      payment.cashCollectionStatus !== ServiceCashCollectionStatus.RECORDED &&
      payment.cashCollectionStatus !== ServiceCashCollectionStatus.REOPENED &&
      payment.cashCollectionStatus !== ServiceCashCollectionStatus.CUSTOMER_CONFIRMED
    ) {
      throw new BadRequestException("This cash collection cannot be disputed in its current state.");
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.servicePayment.update({
        where: { id: payment.id },
        data: {
          cashCollectionStatus: ServiceCashCollectionStatus.CUSTOMER_DISPUTED,
          cashDisputedAt: new Date(),
          cashDisputeReason: dto.reason.trim(),
          events: {
            create: {
              eventType: "service_cash_collection.customer_disputed",
              oldStatus: payment.status,
              newStatus: payment.status,
              payload: { actorUserId: actor.id, reason: dto.reason },
            },
          },
        },
      });
      await tx.serviceSellerReceivable.updateMany({
        where: { servicePaymentId: payment.id, status: { in: [ServiceSellerReceivableStatus.PROVISIONAL, ServiceSellerReceivableStatus.OPEN] } },
        data: {
          status: ServiceSellerReceivableStatus.DISPUTED,
          disputedById: actor.id,
          disputedAt: new Date(),
          disputeReason: dto.reason.trim(),
        },
      });
      const receivables = await tx.serviceSellerReceivable.findMany({ where: { servicePaymentId: payment.id } });
      for (const receivable of receivables) {
        await this.createReceivableEvent(tx, receivable.id, "service_receivable.customer_disputed", receivable.status, ServiceSellerReceivableStatus.DISPUTED, {
          actorUserId: actor.id,
          note: dto.reason,
          metadata: { paymentId: payment.id },
        });
      }
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_cash_collection.customer_disputed",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { paymentId: payment.id, reason: dto.reason },
        },
      });
    });
    return this.getCustomerBooking(actor, bookingNumber);
  }

  async listServiceReceivables(query: ServiceReceivableQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 30 });
    const search = query.search?.trim();
    const where: Prisma.ServiceSellerReceivableWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.taxAccrualStatus ? { taxAccrualStatus: query.taxAccrualStatus } : {}),
      ...(query.offsetPolicy ? { offsetPolicy: query.offsetPolicy } : {}),
      ...(query.waiverApprovalStatus ? { waiverApprovalStatus: query.waiverApprovalStatus } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(search
        ? {
            OR: [
              { receivableNumber: { contains: search, mode: "insensitive" } },
              { booking: { bookingNumber: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceSellerReceivable.findMany({
        where,
        include: this.serviceReceivableInclude(),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceSellerReceivable.count({ where }),
    ]);
    return { items, total, page, limit: take };
  }

  async getServiceReceivable(receivableNumber: string) {
    const receivable = await this.prisma.client.serviceSellerReceivable.findUnique({
      where: { receivableNumber },
      include: this.serviceReceivableInclude(),
    });
    if (!receivable) {
      throw new NotFoundException("Service receivable not found.");
    }
    return receivable;
  }

  async resolveServiceReceivable(actor: RequestUser, receivableNumber: string, dto: ResolveServiceCashReceivableDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const receivable = await tx.serviceSellerReceivable.findUnique({
        where: { receivableNumber },
        include: { booking: { include: serviceBookingInclude }, servicePayment: true },
      });
      if (!receivable) throw new NotFoundException("Service receivable not found.");
      if (!receivable.servicePayment) throw new BadRequestException("Receivable is not linked to a service payment.");
      const acceptedCashPaise = this.acceptedCashAmount(receivable.grossCashCollectedPaise, dto);
      const next = await this.receivableResolutionPatch(tx, receivable, acceptedCashPaise, dto.resolution, actor.id, dto.note);
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_receivable.resolved",
          entityType: "service_seller_receivable",
          entityId: receivable.id,
          oldValue: { status: receivable.status, amountDueToPlatformPaise: receivable.amountDueToPlatformPaise },
          newValue: { resolution: dto.resolution, acceptedCashPaise, status: next.status, amountDueToPlatformPaise: next.amountDueToPlatformPaise, note: dto.note },
        },
      });
      await this.refreshBookingPaidAmount(tx, receivable.bookingId);
      const refreshed = await tx.serviceSellerReceivable.findUniqueOrThrow({
        where: { id: receivable.id },
        include: this.serviceReceivableInclude(),
      });
      return refreshed;
    });
  }

  async settleServiceReceivable(actor: RequestUser, receivableNumber: string, dto: SettleServiceReceivableDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const receivable = await tx.serviceSellerReceivable.findUnique({ where: { receivableNumber }, include: { booking: true } });
      if (!receivable) throw new NotFoundException("Service receivable not found.");
      const outstanding = this.receivableOutstanding(receivable);
      if (dto.amountPaise > outstanding) {
        throw new BadRequestException("Settlement amount cannot exceed outstanding receivable amount.");
      }
      const settledPaise = receivable.settledPaise + dto.amountPaise;
      const nextStatus =
        settledPaise >= receivable.amountDueToPlatformPaise - receivable.waivedPaise - receivable.reversalPaise - receivable.offsetPaise
          ? ServiceSellerReceivableStatus.SETTLED
          : ServiceSellerReceivableStatus.PARTIALLY_SETTLED;
      const updated = await tx.serviceSellerReceivable.update({
        where: { id: receivable.id },
        data: { settledPaise, status: nextStatus },
      });
      await this.createReceivableEvent(tx, receivable.id, "service_receivable.settled", receivable.status, nextStatus, {
        actorUserId: actor.id,
        amountDeltaPaise: -dto.amountPaise,
        oldAmountDuePaise: outstanding,
        newAmountDuePaise: this.receivableOutstanding(updated),
        note: dto.note,
        metadata: { referenceNumber: dto.referenceNumber ?? null },
      });
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: receivable.sellerId,
          serviceBookingId: receivable.bookingId,
          entryType: SellerLedgerEntryType.SERVICE_RECEIVABLE_SETTLED,
          description: `Service receivable settled ${receivable.receivableNumber}`,
          creditPaise: dto.amountPaise,
          currency: receivable.currency,
          referenceType: "service_seller_receivable",
          referenceId: receivable.id,
          createdById: actor.id,
          metadata: { referenceNumber: dto.referenceNumber ?? null },
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_receivable.settled",
          entityType: "service_seller_receivable",
          entityId: receivable.id,
          newValue: { amountPaise: dto.amountPaise, referenceNumber: dto.referenceNumber, note: dto.note },
        },
      });
      return tx.serviceSellerReceivable.findUniqueOrThrow({ where: { id: receivable.id }, include: this.serviceReceivableInclude() });
    });
  }

  async requestServiceReceivableWaiver(actor: RequestUser, receivableNumber: string, dto: ServiceReceivableWaiverDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const receivable = await tx.serviceSellerReceivable.findUnique({ where: { receivableNumber } });
      if (!receivable) throw new NotFoundException("Service receivable not found.");
      if (dto.amountPaise > this.receivableOutstanding(receivable)) {
        throw new BadRequestException("Waiver amount cannot exceed outstanding receivable amount.");
      }
      const updated = await tx.serviceSellerReceivable.update({
        where: { id: receivable.id },
        data: {
          status: ServiceSellerReceivableStatus.WAIVER_REQUESTED,
          waiverApprovalStatus: ServiceReceivableWaiverApprovalStatus.PENDING,
          waiverRequestedById: actor.id,
          waiverRequestedAt: new Date(),
          waiverRequestedPaise: dto.amountPaise,
          waiverLimitPaise: dto.waiverLimitPaise ?? null,
          waiverReason: dto.reason.trim(),
        },
      });
      await this.createReceivableEvent(tx, receivable.id, "service_receivable.waiver_requested", receivable.status, ServiceSellerReceivableStatus.WAIVER_REQUESTED, {
        actorUserId: actor.id,
        amountDeltaPaise: 0,
        note: dto.reason,
        metadata: { requestedPaise: dto.amountPaise, waiverLimitPaise: dto.waiverLimitPaise ?? null },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_receivable.waiver_requested",
          entityType: "service_seller_receivable",
          entityId: receivable.id,
          newValue: { amountPaise: dto.amountPaise, reason: dto.reason, waiverLimitPaise: dto.waiverLimitPaise },
        },
      });
      return tx.serviceSellerReceivable.findUniqueOrThrow({ where: { id: updated.id }, include: this.serviceReceivableInclude() });
    });
  }

  async decideServiceReceivableWaiver(actor: RequestUser, receivableNumber: string, dto: ServiceReceivableWaiverDecisionDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const receivable = await tx.serviceSellerReceivable.findUnique({ where: { receivableNumber } });
      if (!receivable) throw new NotFoundException("Service receivable not found.");
      if (receivable.waiverApprovalStatus !== ServiceReceivableWaiverApprovalStatus.PENDING) {
        throw new BadRequestException("No pending waiver request exists for this receivable.");
      }
      if (
        dto.decision !== ServiceReceivableWaiverApprovalStatus.APPROVED &&
        dto.decision !== ServiceReceivableWaiverApprovalStatus.REJECTED
      ) {
        throw new BadRequestException("Waiver decision must be APPROVED or REJECTED.");
      }
      const approve = dto.decision === ServiceReceivableWaiverApprovalStatus.APPROVED;
      const waivedPaise = approve ? receivable.waivedPaise + receivable.waiverRequestedPaise : receivable.waivedPaise;
      const nextStatus =
        approve && this.receivableOutstanding({ ...receivable, waivedPaise }) <= 0
          ? ServiceSellerReceivableStatus.WAIVED
          : approve
            ? ServiceSellerReceivableStatus.PARTIALLY_SETTLED
            : ServiceSellerReceivableStatus.OPEN;
      const updated = await tx.serviceSellerReceivable.update({
        where: { id: receivable.id },
        data: {
          status: nextStatus,
          waivedPaise,
          waiverApprovalStatus: dto.decision,
          waiverApprovedById: actor.id,
          waiverApprovedAt: new Date(),
          waivedAt: approve ? new Date() : receivable.waivedAt,
          resolutionNote: dto.note ?? receivable.resolutionNote,
        },
      });
      await this.createReceivableEvent(tx, receivable.id, approve ? "service_receivable.waiver_approved" : "service_receivable.waiver_rejected", receivable.status, nextStatus, {
        actorUserId: actor.id,
        amountDeltaPaise: approve ? -receivable.waiverRequestedPaise : 0,
        oldAmountDuePaise: this.receivableOutstanding(receivable),
        newAmountDuePaise: this.receivableOutstanding(updated),
        note: dto.note,
      });
      if (approve && receivable.waiverRequestedPaise > 0) {
        await tx.sellerLedgerEntry.create({
          data: {
            sellerId: receivable.sellerId,
            serviceBookingId: receivable.bookingId,
            entryType: SellerLedgerEntryType.SERVICE_RECEIVABLE_WAIVED,
            description: `Service receivable waived ${receivable.receivableNumber}`,
            creditPaise: receivable.waiverRequestedPaise,
            currency: receivable.currency,
            referenceType: "service_seller_receivable",
            referenceId: receivable.id,
            createdById: actor.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: approve ? "service_receivable.waiver_approved" : "service_receivable.waiver_rejected",
          entityType: "service_seller_receivable",
          entityId: receivable.id,
          newValue: { decision: dto.decision, amountPaise: receivable.waiverRequestedPaise, note: dto.note },
        },
      });
      return tx.serviceSellerReceivable.findUniqueOrThrow({ where: { id: receivable.id }, include: this.serviceReceivableInclude() });
    });
  }

  async setServiceReceivableOffsetPolicy(actor: RequestUser, receivableNumber: string, dto: ServiceReceivableOffsetPolicyDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const receivable = await tx.serviceSellerReceivable.findUnique({ where: { receivableNumber } });
      if (!receivable) throw new NotFoundException("Service receivable not found.");
      const updated = await tx.serviceSellerReceivable.update({
        where: { id: receivable.id },
        data: { offsetPolicy: dto.offsetPolicy },
      });
      await this.createReceivableEvent(tx, receivable.id, "service_receivable.offset_policy_updated", receivable.status, receivable.status, {
        actorUserId: actor.id,
        note: dto.note,
        metadata: { oldOffsetPolicy: receivable.offsetPolicy, newOffsetPolicy: dto.offsetPolicy },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_receivable.offset_policy_updated",
          entityType: "service_seller_receivable",
          entityId: receivable.id,
          oldValue: { offsetPolicy: receivable.offsetPolicy },
          newValue: { offsetPolicy: dto.offsetPolicy, note: dto.note },
        },
      });
      return tx.serviceSellerReceivable.findUniqueOrThrow({ where: { id: updated.id }, include: this.serviceReceivableInclude() });
    });
  }

  async createReview(actor: RequestUser, bookingNumber: string, dto: CreateServiceReviewDto) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    if (booking.status !== ServiceBookingStatus.COMPLETED) {
      throw new BadRequestException("Review unlocks after service completion.");
    }
    if (booking.completionConfirmedAt && Date.now() - booking.completionConfirmedAt.getTime() > 14 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException("Review window has expired.");
    }

    const review = await this.prisma.client.$transaction(async (tx) => {
      const review = await tx.serviceReview.create({
        data: {
          bookingId: booking.id,
          serviceListingId: booking.serviceListingId,
          customerId: booking.customerId,
          sellerId: booking.sellerId,
          rating: dto.rating,
          body: dto.body?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_review.created",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { rating: dto.rating },
        },
      });
      return review;
    });

    await this.recomputeServiceRatings(booking.sellerId, booking.serviceListingId);
    return review;
  }

  async listSellerServiceReviews(actor: RequestUser, query: ServiceReviewQueryDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    return this.listServiceReviews({ sellerId: seller.id }, query);
  }

  async replyToReview(actor: RequestUser, reviewId: string, dto: ServiceReviewReplyDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const review = await this.prisma.client.serviceReview.findFirst({ where: { id: reviewId, sellerId: seller.id } });
    if (!review) {
      throw new NotFoundException("Service review not found.");
    }
    return this.prisma.client.serviceReviewReply.upsert({
      where: { reviewId },
      update: { body: dto.body.trim(), providerId: actor.id },
      create: { reviewId, body: dto.body.trim(), providerId: actor.id },
    });
  }

  async adminListServiceReviews(query: ServiceReviewQueryDto) {
    return this.listServiceReviews({}, query);
  }

  async adminHideReview(reviewId: string, actor: RequestUser) {
    const review = await this.prisma.client.serviceReview.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException("Service review not found.");
    }
    const updated = await this.prisma.client.serviceReview.update({ where: { id: reviewId }, data: { isVisible: false } });
    await this.recomputeServiceRatings(review.sellerId, review.serviceListingId);
    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "service_review.hidden",
        entityType: "service_review",
        entityId: reviewId,
        oldValue: { isVisible: review.isVisible },
        newValue: { isVisible: false },
      },
    });
    return updated;
  }

  async adminRestoreReview(reviewId: string, actor: RequestUser) {
    const review = await this.prisma.client.serviceReview.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException("Service review not found.");
    }
    const updated = await this.prisma.client.serviceReview.update({ where: { id: reviewId }, data: { isVisible: true } });
    await this.recomputeServiceRatings(review.sellerId, review.serviceListingId);
    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "service_review.restored",
        entityType: "service_review",
        entityId: reviewId,
        oldValue: { isVisible: review.isVisible },
        newValue: { isVisible: true },
      },
    });
    return updated;
  }

  private async listServiceReviews(baseWhere: Prisma.ServiceReviewWhereInput, query: ServiceReviewQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 30 });
    const where: Prisma.ServiceReviewWhereInput = {
      ...baseWhere,
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.status === "VISIBLE" ? { isVisible: true } : {}),
      ...(query.status === "HIDDEN" ? { isVisible: false } : {}),
      ...(query.status === "REPLIED" ? { reply: { isNot: null } } : {}),
      ...(query.status === "UNREPLIED" ? { reply: { is: null } } : {}),
      ...(query.search
        ? {
            OR: [
              { body: { contains: query.search, mode: "insensitive" } },
              { booking: { bookingNumber: { contains: query.search, mode: "insensitive" } } },
              { listing: { title: { contains: query.search, mode: "insensitive" } } },
              { seller: { storeName: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceReview.findMany({
        where,
        include: {
          reply: { include: { provider: { select: { id: true, fullName: true, email: true } } } },
          customer: { include: { user: { select: { id: true, fullName: true, email: true, phone: true } } } },
          seller: { select: { id: true, storeName: true, slug: true } },
          listing: { select: { id: true, title: true, slug: true } },
          booking: { select: { id: true, bookingNumber: true, status: true, completionConfirmedAt: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceReview.count({ where }),
    ]);
    return { items, total, page, limit: take };
  }

  async adminListBookings(query: ServiceListingQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 30 });
    const [items, total] = await Promise.all([
      this.prisma.client.serviceBooking.findMany({
        include: serviceBookingInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceBooking.count(),
    ]);
    return { items, total, page, limit: take };
  }

  async listServiceRefunds(query: ServiceRefundQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 30 });
    const search = query.search?.trim();
    const where: Prisma.ServiceRefundRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(search
        ? {
            OR: [
              { refundNumber: { contains: search, mode: "insensitive" } },
              { booking: { bookingNumber: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
              { customer: { user: { email: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceRefundRequest.findMany({
        where,
        include: serviceRefundInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.serviceRefundRequest.count({ where }),
    ]);
    return { items, total, page, limit: take };
  }

  async getServiceRefund(refundNumber: string) {
    const refund = await this.prisma.client.serviceRefundRequest.findUnique({
      where: { refundNumber },
      include: serviceRefundInclude,
    });
    if (!refund) {
      throw new NotFoundException("Service refund request not found.");
    }
    return refund;
  }

  async approveServiceRefund(actor: RequestUser, refundNumber: string, dto: ApproveServiceRefundDto) {
    const refund = await this.prisma.client.serviceRefundRequest.findUnique({ where: { refundNumber } });
    if (!refund) {
      throw new NotFoundException("Service refund request not found.");
    }
    if (refund.status !== RefundRequestStatus.PENDING_REVIEW && refund.status !== RefundRequestStatus.APPROVED) {
      throw new BadRequestException("Only pending service refunds can be approved.");
    }
    await this.prisma.client.$transaction(async (tx) => {
      await this.lockServiceRefundRequest(tx, refund.id);
      await tx.serviceRefundRequest.update({
        where: { id: refund.id },
        data: {
          status: RefundRequestStatus.APPROVED,
          approvedAt: refund.approvedAt ?? new Date(),
          reviewedAt: new Date(),
          reviewedById: actor.id,
          note: dto.note ?? refund.note,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_refund.approved",
          entityType: "service_refund_request",
          entityId: refund.id,
          oldValue: { status: refund.status },
          newValue: { status: RefundRequestStatus.APPROVED, note: dto.note ?? null },
        },
      });
    });
    return this.getServiceRefund(refundNumber);
  }

  async recordManualServiceRefund(actor: RequestUser, refundNumber: string, dto: ManualServiceRefundDto) {
    if (dto.method === RefundMethod.RAZORPAY) {
      throw new BadRequestException("Use the Razorpay initiate endpoint for Razorpay service refunds.");
    }

    await this.prisma.client.$transaction(async (tx) => {
      const refund = await tx.serviceRefundRequest.findUnique({
        where: { refundNumber },
        include: { transactions: true, servicePayment: true },
      });
      if (!refund) {
        throw new NotFoundException("Service refund request not found.");
      }
      if (!this.manualServiceRefundStatusSet().has(refund.status)) {
        throw new BadRequestException("Service refund is not ready for manual payment recording.");
      }
      await this.lockServiceRefundRequest(tx, refund.id);
      await tx.serviceRefundTransaction.create({
        data: {
          serviceRefundRequestId: refund.id,
          servicePaymentId: refund.servicePaymentId,
          provider: refund.servicePayment?.provider ?? null,
          method: dto.method,
          status: RefundTransactionStatus.SUCCESS,
          amountPaise: refund.amountPaise,
          currency: refund.currency,
          idempotencyKey: this.serviceRefundIdempotencyKey(refund.refundNumber, refund.transactions.length + 1),
          manualReference: dto.manualReference.trim(),
          paidAt: new Date(dto.paidAt),
          processedAt: new Date(),
          createdById: actor.id,
          providerResponse: {
            manualReference: dto.manualReference.trim(),
            paidAt: dto.paidAt,
            note: dto.note ?? null,
          },
        },
      });
      await this.completeServiceRefundInTransaction(tx, refund.id, actor, {
        method: dto.method,
        note: dto.note ?? "Manual service refund recorded by finance/admin.",
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_refund.manual_recorded",
          entityType: "service_refund_request",
          entityId: refund.id,
          newValue: {
            refundNumber,
            method: dto.method,
            manualReference: dto.manualReference,
            paidAt: dto.paidAt,
          },
        },
      });
    });

    return this.getServiceRefund(refundNumber);
  }

  private async cancelBooking(
    booking: ServiceBookingRecord,
    actor: RequestUser,
    reason: string,
    initiator: ServiceCancellationInitiator,
  ) {
    const nonCancellableStatuses: ServiceBookingStatus[] = [
      ServiceBookingStatus.IN_PROGRESS,
      ServiceBookingStatus.COMPLETION_SUBMITTED,
      ServiceBookingStatus.COMPLETED,
    ];
    if (nonCancellableStatuses.includes(booking.status)) {
      throw new BadRequestException("This booking can no longer be cancelled through normal cancellation.");
    }
    const outcome = this.calculateCancellationOutcome(booking, initiator);
    await this.prisma.client.$transaction(async (tx) => {
      await this.lockServiceBooking(tx, booking.id);
      const refundRequest =
        outcome.refundPaise > 0
          ? await this.createServiceRefundRequestInTransaction(tx, booking, {
              amountPaise: outcome.refundPaise,
              reason: RefundReason.SERVICE_BOOKING_CANCELLED,
              note: reason,
              actorUserId: actor.id,
            })
          : null;
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status: ServiceBookingStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancellationInitiator: initiator,
          cancelledById: actor.id,
          cancelledAt: new Date(),
          cancellationFeePaise: outcome.feePaise,
          cancellationRefundPaise: outcome.refundPaise,
          cancellationPolicySnapshot: outcome.snapshot,
        },
      });
      if (outcome.feePaise > 0) {
        await tx.sellerLedgerEntry.create({
          data: {
            sellerId: booking.sellerId,
            serviceBookingId: booking.id,
            entryType: SellerLedgerEntryType.SERVICE_CANCELLATION_FEE,
            description: `Service cancellation fee retained for ${booking.bookingNumber}`,
            creditPaise: outcome.feePaise,
            currency: booking.currency,
            referenceType: "service_booking",
            referenceId: booking.id,
            createdById: actor.id,
            metadata: outcome.snapshot,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_booking.cancelled",
          entityType: "service_booking",
          entityId: booking.id,
          oldValue: { status: booking.status },
          newValue: {
            status: ServiceBookingStatus.CANCELLED,
            reason,
            initiator,
            cancellationFeePaise: outcome.feePaise,
            cancellationRefundPaise: outcome.refundPaise,
            refundNumber: refundRequest?.refundNumber ?? null,
          },
        },
      });
    });
    const refreshed = await this.getAdminBookingOrThrow(booking.bookingNumber);
    if (refreshed.cancellationFeePaise > 0) {
      await this.createSettlementIfEligible(refreshed);
    }
    await this.notifyBooking(refreshed, "service_booking_cancelled");
    return refreshed;
  }

  private async transitionBooking(
    booking: ServiceBookingRecord,
    status: ServiceBookingStatus,
    actor: RequestUser,
    action: string,
    patch: ServiceBookingTransitionPatch = {},
  ) {
    await this.prisma.client.$transaction(async (tx) => {
      const scheduledStartAt = patch.scheduledStartAt ? new Date(patch.scheduledStartAt) : undefined;
      const effectiveScheduledStartAt = scheduledStartAt ?? booking.scheduledStartAt;
      const effectiveTechnicianId =
        patch.assignedTechnicianId !== undefined
          ? patch.assignedTechnicianId
          : booking.assignedTechnicianId ?? null;
      const movesIntoActiveSchedule =
        Boolean(effectiveScheduledStartAt) &&
        activeScheduleStatuses.includes(status) &&
        !activeScheduleStatuses.includes(booking.status);
      const shouldValidateSchedule =
        Boolean(effectiveScheduledStartAt) &&
        (Boolean(scheduledStartAt) ||
          patch.scheduledEndAt !== undefined ||
          patch.assignedTechnicianId !== undefined ||
          movesIntoActiveSchedule);
      if (shouldValidateSchedule && effectiveScheduledStartAt) {
        await this.lockSellerSchedule(tx, booking.sellerId);
        await this.ensureScheduleAvailable(
          {
            sellerId: booking.sellerId,
            listingDurationMinutes: booking.listing.serviceDurationMinutes,
            scheduledStartAt: effectiveScheduledStartAt,
            bookingId: booking.id,
            assignedTechnicianId: effectiveTechnicianId,
          },
          tx,
        );
      }
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status,
          ...(patch.providerNote !== undefined ? { providerNote: patch.providerNote?.trim() || null } : {}),
          ...(scheduledStartAt ? { scheduledStartAt } : {}),
          ...(patch.scheduledEndAt !== undefined ? { scheduledEndAt: patch.scheduledEndAt } : {}),
          ...(patch.assignedTechnicianId !== undefined ? { assignedTechnicianId: patch.assignedTechnicianId } : {}),
          ...(patch.completionNote !== undefined ? { completionNote: patch.completionNote.trim(), completionSubmittedAt: new Date() } : {}),
          ...(patch.completionImages !== undefined ? { completionImages: cleanTextArray(patch.completionImages) } : {}),
          ...(patch.completionProofKeys !== undefined ? { completionProofKeys: cleanTextArray(patch.completionProofKeys) } : {}),
          ...(patch.completionConfirmedById
            ? { completionConfirmedById: patch.completionConfirmedById, completionConfirmedAt: new Date() }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action,
          entityType: "service_booking",
          entityId: booking.id,
          oldValue: {
            status: booking.status,
            scheduledStartAt: booking.scheduledStartAt,
            scheduledEndAt: booking.scheduledEndAt,
            assignedTechnicianId: booking.assignedTechnicianId,
          },
          newValue: {
            status,
            scheduledStartAt: scheduledStartAt?.toISOString() ?? booking.scheduledStartAt?.toISOString() ?? null,
            scheduledEndAt: patch.scheduledEndAt?.toISOString() ?? booking.scheduledEndAt?.toISOString() ?? null,
            assignedTechnicianId: patch.assignedTechnicianId ?? booking.assignedTechnicianId ?? null,
          },
        },
      });
    });
    return this.getAdminBookingOrThrow(booking.bookingNumber);
  }

  private async buildSellerServiceCalendar(sellerId: string) {
    const now = new Date();
    const horizon = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const [availabilityRules, blockedWindows, technicians, bookings] = await Promise.all([
      this.prisma.client.sellerServiceAvailabilityRule.findMany({
        where: { sellerId },
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      }),
      this.prisma.client.sellerServiceBlockedWindow.findMany({
        where: {
          sellerId,
          endsAt: { gte: now },
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        take: 100,
      }),
      this.prisma.client.sellerServiceTechnician.findMany({
        where: { sellerId },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
      this.prisma.client.serviceBooking.findMany({
        where: {
          sellerId,
          status: { in: activeScheduleStatuses },
          OR: [{ scheduledStartAt: { gte: now, lte: horizon } }, { scheduledStartAt: null }],
        },
        include: serviceBookingInclude,
        orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);

    return {
      availabilityRules: availabilityRules.length ? availabilityRules : defaultServiceAvailabilityRules(),
      blockedWindows,
      technicians,
      bookings,
      diagnostics: {
        hasCustomAvailability: availabilityRules.length > 0,
        scheduledBookingCount: bookings.filter((booking) => booking.scheduledStartAt).length,
        unscheduledBookingCount: bookings.filter((booking) => !booking.scheduledStartAt).length,
      },
    };
  }

  private async lockSellerSchedule(tx: Prisma.TransactionClient, sellerId: string) {
    await tx.$queryRaw`SELECT id FROM sellers WHERE id = ${sellerId}::uuid FOR UPDATE`;
  }

  private cleanAvailabilityRules(rules: UpdateSellerServiceCalendarDto["availabilityRules"]) {
    return (rules?.length ? rules : defaultServiceAvailabilityRules()).map((rule) => {
      if (rule.startMinute >= rule.endMinute) {
        throw new BadRequestException("Availability end time must be after start time.");
      }
      return {
        dayOfWeek: rule.dayOfWeek,
        startMinute: rule.startMinute,
        endMinute: rule.endMinute,
        capacity: rule.capacity ?? 1,
        note: rule.note?.trim() || null,
        isActive: rule.isActive ?? true,
      };
    });
  }

  private cleanBlockedWindows(windows: UpdateSellerServiceCalendarDto["blockedWindows"]) {
    return (windows ?? []).map((window) => {
      const startsAt = new Date(window.startsAt);
      const endsAt = new Date(window.endsAt);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
        throw new BadRequestException("Blocked-window end time must be after start time.");
      }
      return {
        startsAt,
        endsAt,
        reason: window.reason?.trim() || null,
        isFullDay: window.isFullDay ?? false,
      };
    });
  }

  private cleanTechnicians(technicians: UpdateSellerServiceCalendarDto["technicians"]) {
    return (technicians ?? []).map((technician) => {
      const cleaned: CleanServiceTechnician = {
        name: technician.name.trim(),
        phone: technician.phone?.trim() || null,
        email: technician.email?.trim() || null,
        skills: cleanTextArray(technician.skills),
        isActive: technician.isActive ?? true,
      };
      if (technician.id) {
        cleaned.id = technician.id;
      }
      return cleaned;
    });
  }

  private async ensureExistingSchedulesCompatibleWithCalendar(
    sellerId: string,
    rules: CleanServiceAvailabilityRule[],
    blockedWindows: CleanServiceBlockedWindow[],
    technicians: CleanServiceTechnician[],
    tx: Prisma.TransactionClient,
  ) {
    const activeTechnicianIds = new Set(technicians.filter((technician) => technician.id && technician.isActive).map((technician) => technician.id as string));
    const now = new Date();
    const activeBookings = await tx.serviceBooking.findMany({
      where: {
        sellerId,
        status: { in: activeScheduleStatuses },
        scheduledStartAt: { gte: new Date(now.getTime() - 5 * 60 * 1000) },
      },
      include: { listing: true },
      orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "asc" }],
      take: 500,
    });

    for (const booking of activeBookings) {
      if (!booking.scheduledStartAt) {
        continue;
      }
      await this.ensureScheduleAvailable(
        {
          sellerId,
          listingDurationMinutes: booking.listing.serviceDurationMinutes,
          scheduledStartAt: booking.scheduledStartAt,
          bookingId: booking.id,
          assignedTechnicianId: booking.assignedTechnicianId,
        },
        tx,
        { availabilityRules: rules, blockedWindows, activeTechnicianIds },
      );
    }
  }

  private async ensureScheduleAvailable(
    input: ScheduleValidationInput,
    client: ServiceCalendarClient = this.prisma.client,
    overrides: CalendarValidationOverrides = {},
  ) {
    const now = new Date();
    if (Number.isNaN(input.scheduledStartAt.getTime())) {
      throw new BadRequestException("Scheduled visit time is invalid.");
    }
    if (input.scheduledStartAt < new Date(now.getTime() - 5 * 60 * 1000)) {
      throw new BadRequestException("Scheduled visit time cannot be in the past.");
    }

    const scheduledEndAt = this.scheduledEndAt(input.scheduledStartAt, input.listingDurationMinutes);
    const endAt = scheduledEndAt ?? new Date(input.scheduledStartAt.getTime() + 60 * 60 * 1000);

    if (input.assignedTechnicianId && overrides.activeTechnicianIds) {
      if (!overrides.activeTechnicianIds.has(input.assignedTechnicianId)) {
        throw new BadRequestException("Assigned technician is not active for this seller.");
      }
    } else if (input.assignedTechnicianId) {
      const technician = await client.sellerServiceTechnician.findFirst({
        where: { id: input.assignedTechnicianId, sellerId: input.sellerId, isActive: true },
      });
      if (!technician) {
        throw new BadRequestException("Assigned technician is not active for this seller.");
      }
    }

    const rules =
      overrides.availabilityRules?.filter((rule) => rule.dayOfWeek === input.scheduledStartAt.getDay() && rule.isActive) ??
      (await client.sellerServiceAvailabilityRule.findMany({
        where: { sellerId: input.sellerId, dayOfWeek: input.scheduledStartAt.getDay(), isActive: true },
      }));
    const effectiveRules = rules.length ? rules : defaultServiceAvailabilityRules().filter((rule) => rule.dayOfWeek === input.scheduledStartAt.getDay());
    const startMinute = input.scheduledStartAt.getHours() * 60 + input.scheduledStartAt.getMinutes();
    const endMinute = endAt.getHours() * 60 + endAt.getMinutes();
    if (endAt.toDateString() !== input.scheduledStartAt.toDateString() || endMinute <= startMinute) {
      throw new BadRequestException("Selected service slot must start and end within the same working day.");
    }
    const matchingRule = effectiveRules.find((rule) => startMinute >= rule.startMinute && endMinute <= rule.endMinute);
    if (!matchingRule) {
      throw new BadRequestException("Selected time is outside service working hours.");
    }

    const blocked = overrides.blockedWindows
      ? overrides.blockedWindows.find((window) => window.startsAt < endAt && window.endsAt > input.scheduledStartAt)
      : await client.sellerServiceBlockedWindow.findFirst({
          where: {
            sellerId: input.sellerId,
            startsAt: { lt: endAt },
            endsAt: { gt: input.scheduledStartAt },
          },
        });
    if (blocked) {
      throw new BadRequestException(blocked.reason ? `Selected time is blocked: ${blocked.reason}` : "Selected time is blocked on the service calendar.");
    }

    const overlappingBookings = await client.serviceBooking.count({
      where: {
        sellerId: input.sellerId,
        ...(input.bookingId ? { id: { not: input.bookingId } } : {}),
        status: { in: activeScheduleStatuses },
        OR: [
          {
            scheduledStartAt: { lt: endAt },
            scheduledEndAt: { gt: input.scheduledStartAt },
          },
          {
            scheduledStartAt: { gte: input.scheduledStartAt, lt: endAt },
            scheduledEndAt: null,
          },
        ],
      },
    });
    if (overlappingBookings >= matchingRule.capacity) {
      throw new BadRequestException("Selected time is already at service capacity.");
    }

    if (input.assignedTechnicianId) {
      const technicianOverlap = await client.serviceBooking.findFirst({
        where: {
          assignedTechnicianId: input.assignedTechnicianId,
          ...(input.bookingId ? { id: { not: input.bookingId } } : {}),
          status: { in: activeScheduleStatuses },
          OR: [
            {
              scheduledStartAt: { lt: endAt },
              scheduledEndAt: { gt: input.scheduledStartAt },
            },
            {
              scheduledStartAt: { gte: input.scheduledStartAt, lt: endAt },
              scheduledEndAt: null,
            },
          ],
        },
      });
      if (technicianOverlap) {
        throw new BadRequestException("Assigned technician already has another service in this time window.");
      }
    }
  }

  private scheduledEndAt(startAt: Date | null | undefined, durationMinutes?: number | null) {
    if (!startAt) {
      return null;
    }
    const minutes = durationMinutes && durationMinutes > 0 ? durationMinutes : 60;
    return new Date(startAt.getTime() + minutes * 60_000);
  }

  private normalizeCashKey(value: string | undefined) {
    const cleaned = value?.trim();
    return cleaned || null;
  }

  private defaultCashIdempotencyKey(
    booking: ServiceBookingRecord,
    dto: RecordServiceCashCollectionDto,
  ) {
    const attempt = dto.attemptNumber ?? 1;
    const purpose = dto.purpose ?? ServicePaymentPurpose.PAY_AT_VISIT;
    return `service-cash:${booking.bookingNumber}:${purpose}:${attempt}:${dto.amountPaise}`;
  }

  private async createUniqueReceivableNumber(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const value = `SRV-RCV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await tx.serviceSellerReceivable.findUnique({ where: { receivableNumber: value } });
      if (!existing) return value;
    }
    return `SRV-RCV-${Date.now()}`;
  }

  private createReceivableEvent(
    tx: Prisma.TransactionClient,
    receivableId: string,
    eventType: string,
    oldStatus: ServiceSellerReceivableStatus | null,
    newStatus: ServiceSellerReceivableStatus | null,
    input: ServiceReceivableEventInput = {},
  ) {
    return tx.serviceSellerReceivableEvent.create({
      data: {
        receivableId,
        eventType,
        oldStatus,
        newStatus,
        resolution: input.resolution ?? null,
        amountDeltaPaise: input.amountDeltaPaise ?? null,
        oldAmountDuePaise: input.oldAmountDuePaise ?? null,
        newAmountDuePaise: input.newAmountDuePaise ?? null,
        note: input.note?.trim() || null,
        actorUserId: input.actorUserId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  private cashPaymentOrThrow(booking: ServiceBookingRecord, paymentId: string) {
    const payment = booking.payments.find((item) => item.id === paymentId);
    if (!payment) {
      throw new NotFoundException("Service cash collection not found.");
    }
    if (
      payment.collectionType !== ServicePaymentCollectionType.PROVIDER_CASH ||
      payment.settlementTreatment !== ServicePaymentSettlementTreatment.PLATFORM_RECEIVABLE
    ) {
      throw new BadRequestException("This payment is not a provider cash collection.");
    }
    return payment;
  }

  private async refreshBookingPaidAmount(tx: Prisma.TransactionClient, bookingId: string) {
    const paidAggregate = await tx.servicePayment.aggregate({
      where: {
        bookingId,
        status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
      },
      _sum: { amountPaise: true },
    });
    const refundAggregate = await tx.serviceRefundRequest.aggregate({
      where: {
        bookingId,
        status: RefundRequestStatus.SUCCESS,
      },
      _sum: { amountPaise: true },
    });
    await tx.serviceBooking.update({
      where: { id: bookingId },
      data: {
        paidAmountPaise: Math.max(0, (paidAggregate._sum.amountPaise ?? 0) - (refundAggregate._sum.amountPaise ?? 0)),
      },
    });
  }

  private calculateCancellationOutcome(
    booking: ServiceBookingRecord,
    initiator: ServiceCancellationInitiator,
  ): CancellationOutcome {
    const paidAmountPaise = booking.payments
      .filter((payment) => payment.status === PaymentStatus.PAID)
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
    const refundablePlatformPaidPaise = this.refundablePlatformPaidPaise(booking);
    const providerOrAdminCancel =
      initiator === ServiceCancellationInitiator.PROVIDER ||
      initiator === ServiceCancellationInitiator.ADMIN ||
      initiator === ServiceCancellationInitiator.SYSTEM;
    const now = new Date();
    const scheduledStartAt = booking.scheduledStartAt;
    const hoursUntilVisit =
      scheduledStartAt ? (scheduledStartAt.getTime() - now.getTime()) / (60 * 60 * 1000) : null;

    let feeBasis = "no_fee";
    let feePaise = 0;
    if (!providerOrAdminCancel && refundablePlatformPaidPaise > 0) {
      if (booking.cancellationPolicy === ServiceCancellationPolicy.MODERATE) {
        const insideChargeWindow = hoursUntilVisit !== null && hoursUntilVisit <= 24;
        if (insideChargeWindow || booking.status === ServiceBookingStatus.SCHEDULED) {
          feeBasis = "moderate_24h_or_scheduled";
          feePaise = Math.max(booking.inspectionFeePaise, Math.ceil(refundablePlatformPaidPaise * 0.1));
        }
      } else if (booking.cancellationPolicy === ServiceCancellationPolicy.STRICT) {
        const acceptedOrLaterStatuses: ServiceBookingStatus[] = [
          ServiceBookingStatus.ACCEPTED,
          ServiceBookingStatus.SCHEDULED,
          ServiceBookingStatus.QUOTE_ACCEPTED,
          ServiceBookingStatus.QUOTE_SENT,
        ];
        const acceptedOrLater = acceptedOrLaterStatuses.includes(booking.status);
        if (acceptedOrLater) {
          feeBasis = "strict_after_provider_acceptance";
          feePaise = Math.max(
            booking.inspectionFeePaise,
            booking.advanceAmountPaise,
            Math.ceil(refundablePlatformPaidPaise * 0.25),
          );
        }
      }
    }

    feePaise = Math.min(refundablePlatformPaidPaise, Math.max(0, feePaise));
    const refundPaise = Math.max(0, refundablePlatformPaidPaise - feePaise);
    return {
      paidAmountPaise,
      refundablePlatformPaidPaise,
      feePaise,
      refundPaise,
      snapshot: {
        policy: booking.cancellationPolicy,
        initiator,
        bookingStatus: booking.status,
        paidAmountPaise,
        refundablePlatformPaidPaise,
        feePaise,
        refundPaise,
        feeBasis,
        scheduledStartAt: scheduledStartAt?.toISOString() ?? null,
        hoursUntilVisit: hoursUntilVisit === null ? null : Math.round(hoursUntilVisit * 100) / 100,
        calculatedAt: now.toISOString(),
      },
    };
  }

  private refundablePlatformPaidPaise(booking: Pick<ServiceBookingRecord, "payments" | "refundRequests">) {
    const paid = booking.payments
      .filter(
        (payment) =>
          (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.REFUNDED) &&
          payment.settlementTreatment === ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE &&
          payment.collectionType !== ServicePaymentCollectionType.PROVIDER_CASH,
      )
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
    const refundedOrPending = (booking.refundRequests ?? [])
      .filter((refund) => refund.status !== RefundRequestStatus.CANCELLED && refund.status !== RefundRequestStatus.FAILED)
      .reduce((sum, refund) => sum + refund.amountPaise, 0);
    return Math.max(0, paid - refundedOrPending);
  }

  private disputeRefundAmount(booking: ServiceBookingRecord, dto: ResolveServiceDisputeDto) {
    if (
      dto.resolution !== ServiceDisputeResolution.REFUND_CUSTOMER &&
      dto.resolution !== ServiceDisputeResolution.PARTIAL_REFUND
    ) {
      return 0;
    }
    const refundable = this.refundablePlatformPaidPaise(booking);
    if (refundable <= 0) {
      throw new BadRequestException("No platform-collected paid amount is available for refund.");
    }
    if (dto.resolution === ServiceDisputeResolution.PARTIAL_REFUND) {
      if (!dto.refundAmountPaise) {
        throw new BadRequestException("refundAmountPaise is required for partial refund resolution.");
      }
      if (dto.refundAmountPaise > refundable) {
        throw new BadRequestException("Partial refund cannot exceed refundable platform-paid amount.");
      }
      return dto.refundAmountPaise;
    }
    return refundable;
  }

  private async createServiceRefundRequestInTransaction(
    tx: Prisma.TransactionClient,
    booking: ServiceBookingRecord,
    input: ServiceRefundCreationInput,
  ) {
    if (input.amountPaise <= 0) {
      return null;
    }
    const latestRefunds = await tx.serviceRefundRequest.findMany({
      where: {
        bookingId: booking.id,
        status: { notIn: [RefundRequestStatus.CANCELLED, RefundRequestStatus.FAILED] },
      },
      select: { amountPaise: true },
    });
    const existingRefundedPaise = latestRefunds.reduce((sum, refund) => sum + refund.amountPaise, 0);
    const paidPayments = await tx.servicePayment.findMany({
      where: {
        bookingId: booking.id,
        status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
        settlementTreatment: ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE,
        collectionType: { not: ServicePaymentCollectionType.PROVIDER_CASH },
      },
      orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    });
    const totalPlatformPaid = paidPayments.reduce((sum, payment) => sum + payment.amountPaise, 0);
    const refundable = Math.max(0, totalPlatformPaid - existingRefundedPaise);
    if (input.amountPaise > refundable) {
      throw new BadRequestException("Refund amount exceeds refundable platform-collected service payment.");
    }
    const allocations = await this.servicePaymentRefundAllocations(
      tx,
      booking.id,
      paidPayments,
      input.amountPaise,
      input.servicePaymentId ?? null,
    );
    let firstRefund: Awaited<ReturnType<typeof tx.serviceRefundRequest.create>> | null = null;
    for (const allocation of allocations) {
      const refundNumber = await this.createUniqueServiceRefundNumber(tx);
      const refund = await tx.serviceRefundRequest.create({
        data: {
          refundNumber,
          bookingId: booking.id,
          customerId: booking.customerId,
          sellerId: booking.sellerId,
          servicePaymentId: allocation.servicePaymentId,
          status: input.status ?? RefundRequestStatus.PENDING_REVIEW,
          reason: input.reason,
          amountPaise: allocation.amountPaise,
          currency: booking.currency,
          note: input.note.trim(),
          createdById: input.actorUserId ?? null,
        },
      });
      await this.applyServiceRefundHoldInTransaction(tx, booking, allocation.amountPaise, refund.id, input.actorUserId ?? null);
      firstRefund ??= refund;
    }
    return firstRefund;
  }

  private async servicePaymentRefundAllocations(
    tx: Prisma.TransactionClient,
    bookingId: string,
    payments: Array<{ id: string; amountPaise: number }>,
    amountPaise: number,
    requestedServicePaymentId: string | null,
  ) {
    const refunds = await tx.serviceRefundRequest.groupBy({
      by: ["servicePaymentId"],
      where: {
        bookingId,
        servicePaymentId: { not: null },
        status: { notIn: [RefundRequestStatus.CANCELLED, RefundRequestStatus.FAILED] },
      },
      _sum: { amountPaise: true },
    });
    const refundedByPayment = new Map(refunds.map((refund) => [refund.servicePaymentId, refund._sum.amountPaise ?? 0]));
    const withRemaining = payments.map((payment) => ({
      id: payment.id,
      remainingPaise: Math.max(0, payment.amountPaise - (refundedByPayment.get(payment.id) ?? 0)),
    }));
    if (requestedServicePaymentId) {
      const payment = withRemaining.find((item) => item.id === requestedServicePaymentId);
      if (!payment || payment.remainingPaise < amountPaise) {
        throw new BadRequestException("Requested service payment does not have enough refundable balance.");
      }
      return [{ servicePaymentId: requestedServicePaymentId, amountPaise }];
    }

    let remaining = amountPaise;
    const allocations: Array<{ servicePaymentId: string; amountPaise: number }> = [];
    for (const payment of withRemaining) {
      if (remaining <= 0) break;
      const allocated = Math.min(payment.remainingPaise, remaining);
      if (allocated <= 0) continue;
      allocations.push({ servicePaymentId: payment.id, amountPaise: allocated });
      remaining -= allocated;
    }
    if (remaining > 0 || !allocations.length) {
      throw new BadRequestException("No refundable service payment balance is available.");
    }
    return allocations;
  }

  private async applyServiceRefundHoldInTransaction(
    tx: Prisma.TransactionClient,
    booking: ServiceBookingRecord,
    amountPaise: number,
    refundRequestId: string,
    actorUserId: string | null,
  ) {
    const settlement = await tx.serviceBookingSettlement.findUnique({
      where: { bookingId: booking.id },
      include: { payout: true },
    });
    if (!settlement) {
      return;
    }
    const adjustmentPaise = Math.min(amountPaise, Math.max(0, settlement.netPayablePaise));
    if (adjustmentPaise <= 0) {
      return;
    }
    const payoutPaid = settlement.payout?.status === SellerPayoutStatus.PAID || settlement.status === SellerSettlementStatus.PAID;
    const hasUnpaidPayout = Boolean(settlement.payoutId) && !payoutPaid;
    await tx.serviceBookingSettlement.update({
      where: { id: settlement.id },
      data: {
        refundAdjustmentPaise: settlement.refundAdjustmentPaise + adjustmentPaise,
        netPayablePaise: Math.max(0, settlement.netPayablePaise - adjustmentPaise),
        status: payoutPaid ? SellerSettlementStatus.ADJUSTED : settlement.status,
      },
    });
    if (hasUnpaidPayout && settlement.payoutId && settlement.payout) {
      await tx.sellerPayout.update({
        where: { id: settlement.payoutId },
        data: {
          refundAdjustmentPaise: { increment: adjustmentPaise },
          netPayablePaise: Math.max(0, settlement.payout.netPayablePaise - adjustmentPaise),
        },
      });
    }
    await tx.sellerLedgerEntry.create({
      data: {
        sellerId: booking.sellerId,
        serviceBookingId: booking.id,
        serviceSettlementId: settlement.id,
        payoutId: settlement.payoutId,
        entryType: payoutPaid ? SellerLedgerEntryType.SERVICE_REFUND_REVERSAL : SellerLedgerEntryType.SERVICE_REFUND_HOLD,
        description: `Service refund ${payoutPaid ? "reversal" : "hold"} for ${booking.bookingNumber}`,
        debitPaise: adjustmentPaise,
        currency: booking.currency,
        referenceType: "service_refund_request",
        referenceId: refundRequestId,
        createdById: actorUserId,
        metadata: { refundRequestId, payoutPaid },
      },
    });
    if (payoutPaid) {
      const idempotencyKey = `service-refund-reversal:${refundRequestId}`;
      const receivableNumber = await this.createUniqueReceivableNumber(tx);
      const receivable = await tx.serviceSellerReceivable.upsert({
        where: {
          sellerId_bookingId_idempotencyKey: {
            sellerId: booking.sellerId,
            bookingId: booking.id,
            idempotencyKey,
          },
        },
        create: {
          receivableNumber,
          sellerId: booking.sellerId,
          bookingId: booking.id,
          source: ServiceSellerReceivableSource.ADMIN_ADJUSTMENT,
          status: ServiceSellerReceivableStatus.OPEN,
          offsetPolicy: ServiceReceivableOffsetPolicy.AUTO_OFFSET_NEXT_PAYOUT,
          taxAccrualStatus: ServiceReceivableTaxAccrualStatus.NOT_APPLICABLE,
          waiverApprovalStatus: ServiceReceivableWaiverApprovalStatus.NOT_REQUESTED,
          amountDueToPlatformPaise: adjustmentPaise,
          currency: booking.currency,
          idempotencyKey,
          verifiedById: actorUserId,
          verifiedAt: new Date(),
          note: `Service refund reversal for already paid payout on ${booking.bookingNumber}`,
          financeSnapshot: { refundRequestId, payoutId: settlement.payoutId, adjustmentPaise },
        },
        update: {},
      });
      await this.createReceivableEvent(tx, receivable.id, "service_refund.receivable_opened", null, receivable.status, {
        ...(actorUserId ? { actorUserId } : {}),
        amountDeltaPaise: adjustmentPaise,
        newAmountDuePaise: adjustmentPaise,
        metadata: { refundRequestId, payoutId: settlement.payoutId },
      });
    }
  }

  private async completeServiceRefundInTransaction(
    tx: Prisma.TransactionClient,
    refundId: string,
    actor: RequestUser | null,
    options: { method: RefundMethod; note: string },
  ) {
    const refund = await tx.serviceRefundRequest.findUnique({
      where: { id: refundId },
      include: { booking: { include: { payments: true, refundRequests: true } }, servicePayment: true },
    });
    if (!refund) {
      throw new NotFoundException("Service refund request not found.");
    }
    if (refund.status === RefundRequestStatus.SUCCESS) {
      return refund;
    }
    await tx.serviceRefundRequest.update({
      where: { id: refund.id },
      data: {
        status: RefundRequestStatus.SUCCESS,
        method: options.method,
        reviewedAt: new Date(),
        reviewedById: actor?.id ?? null,
        note: options.note,
      },
    });

    if (refund.servicePayment) {
      const totalRefundedForPayment = await tx.serviceRefundRequest.aggregate({
        where: {
          servicePaymentId: refund.servicePayment.id,
          status: RefundRequestStatus.SUCCESS,
        },
        _sum: { amountPaise: true },
      });
      if ((totalRefundedForPayment._sum.amountPaise ?? 0) >= refund.servicePayment.amountPaise) {
        await tx.servicePayment.update({
          where: { id: refund.servicePayment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      }
    }

    const totalSuccessfulRefunds = await tx.serviceRefundRequest.aggregate({
      where: { bookingId: refund.bookingId, status: RefundRequestStatus.SUCCESS },
      _sum: { amountPaise: true },
    });
    const grossPaid = await tx.servicePayment.aggregate({
      where: {
        bookingId: refund.bookingId,
        status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
      },
      _sum: { amountPaise: true },
    });
    await tx.serviceBooking.update({
      where: { id: refund.bookingId },
      data: {
        paidAmountPaise: Math.max(0, (grossPaid._sum.amountPaise ?? 0) - (totalSuccessfulRefunds._sum.amountPaise ?? 0)),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor?.id ?? null,
        action: "service_refund.completed",
        entityType: "service_refund_request",
        entityId: refund.id,
        oldValue: { status: refund.status },
        newValue: { status: RefundRequestStatus.SUCCESS, method: options.method },
      },
    });
    return refund;
  }

  private manualServiceRefundStatusSet() {
    return new Set<RefundRequestStatus>([
      RefundRequestStatus.PENDING_REVIEW,
      RefundRequestStatus.APPROVED,
      RefundRequestStatus.FAILED,
      RefundRequestStatus.RETRY_PENDING,
    ]);
  }

  private async createUniqueServiceRefundNumber(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const value = `SRF-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await tx.serviceRefundRequest.findUnique({ where: { refundNumber: value } });
      if (!existing) return value;
    }
    return `SRF-${Date.now()}`;
  }

  private serviceRefundIdempotencyKey(refundNumber: string, attempt: number) {
    return `service-refund:${refundNumber}:${attempt}`;
  }

  private async lockServiceBooking(tx: Prisma.TransactionClient, bookingId: string) {
    await tx.$queryRaw`SELECT id FROM service_bookings WHERE id = ${bookingId}::uuid FOR UPDATE`;
  }

  private async lockServiceRefundRequest(tx: Prisma.TransactionClient, refundId: string) {
    await tx.$queryRaw`SELECT id FROM service_refund_requests WHERE id = ${refundId}::uuid FOR UPDATE`;
  }

  private serviceReceivableInclude() {
    return {
      seller: { select: { id: true, storeName: true, slug: true } },
      booking: {
        include: {
          customer: { include: { user: true } },
          listing: { include: { category: true, images: true } },
          settlement: true,
        },
      },
      servicePayment: {
        include: {
          events: { orderBy: { createdAt: "desc" as const }, take: 10 },
        },
      },
      payoutOffset: { select: { id: true, payoutNumber: true, status: true, netPayablePaise: true } },
      verifiedBy: { select: { id: true, email: true, fullName: true } },
      disputedBy: { select: { id: true, email: true, fullName: true } },
      resolvedBy: { select: { id: true, email: true, fullName: true } },
      waiverRequestedBy: { select: { id: true, email: true, fullName: true } },
      waiverApprovedBy: { select: { id: true, email: true, fullName: true } },
      events: {
        include: { actor: { select: { id: true, email: true, fullName: true } } },
        orderBy: { createdAt: "desc" as const },
      },
    } satisfies Prisma.ServiceSellerReceivableInclude;
  }

  private acceptedCashAmount(originalGrossPaise: number, dto: ResolveServiceCashReceivableDto) {
    if (dto.resolution === ServiceCashDisputeResolution.PARTIALLY_ACCEPTED) {
      if (dto.acceptedCashPaise === undefined) {
        throw new BadRequestException("acceptedCashPaise is required for partial acceptance.");
      }
      if (dto.acceptedCashPaise < 0 || dto.acceptedCashPaise > originalGrossPaise) {
        throw new BadRequestException("acceptedCashPaise must be between zero and the recorded cash amount.");
      }
      return dto.acceptedCashPaise;
    }
    if (
      dto.resolution === ServiceCashDisputeResolution.CUSTOMER_CONFIRMED ||
      dto.resolution === ServiceCashDisputeResolution.ADMIN_FORCE_CONFIRMED
    ) {
      return originalGrossPaise;
    }
    if (dto.resolution === ServiceCashDisputeResolution.REJECTED || dto.resolution === ServiceCashDisputeResolution.REOPENED_FOR_EVIDENCE) {
      return 0;
    }
    throw new BadRequestException("Unsupported cash receivable resolution.");
  }

  private async receivableResolutionPatch(
    tx: Prisma.TransactionClient,
    receivable: Prisma.ServiceSellerReceivableGetPayload<{
      include: { booking: { include: typeof serviceBookingInclude }; servicePayment: true };
    }>,
    acceptedCashPaise: number,
    resolution: ServiceCashDisputeResolution,
    actorUserId: string,
    note?: string,
  ) {
    const calculation =
      acceptedCashPaise > 0
        ? await this.financeCalculator.calculateServiceBooking(receivable.booking, acceptedCashPaise, tx)
        : null;
    const nextDue =
      calculation
        ? calculation.commissionPaise +
          calculation.gstOnCommissionPaise +
          calculation.tdsPaise +
          calculation.tcsPaise +
          calculation.platformFeePaise
        : 0;
    const oldOutstanding = this.receivableOutstanding(receivable);
    const reversalPaise = Math.max(0, receivable.amountDueToPlatformPaise - nextDue);
    const now = new Date();

    let nextPaymentStatus: PaymentStatus = PaymentStatus.PENDING;
    let nextCashStatus: ServiceCashCollectionStatus = ServiceCashCollectionStatus.REOPENED;
    let nextReceivableStatus: ServiceSellerReceivableStatus = ServiceSellerReceivableStatus.DISPUTED;
    let taxAccrualStatus = receivable.taxAccrualStatus;
    let taxAccruedAt = receivable.taxAccruedAt;
    let taxReversedAt = receivable.taxReversedAt;
    let paidAt = receivable.servicePayment?.paidAt ?? null;

    if (
      resolution === ServiceCashDisputeResolution.CUSTOMER_CONFIRMED ||
      resolution === ServiceCashDisputeResolution.ADMIN_FORCE_CONFIRMED
    ) {
      nextPaymentStatus = PaymentStatus.PAID;
      nextCashStatus = ServiceCashCollectionStatus.ADMIN_VERIFIED;
      nextReceivableStatus = ServiceSellerReceivableStatus.OPEN;
      taxAccrualStatus = ServiceReceivableTaxAccrualStatus.ACCRUED;
      taxAccruedAt = now;
      paidAt = receivable.servicePayment?.paidAt ?? now;
    } else if (resolution === ServiceCashDisputeResolution.PARTIALLY_ACCEPTED) {
      nextPaymentStatus = acceptedCashPaise > 0 ? PaymentStatus.PAID : PaymentStatus.FAILED;
      nextCashStatus = ServiceCashCollectionStatus.ADMIN_PARTIALLY_VERIFIED;
      nextReceivableStatus = nextDue > 0 ? ServiceSellerReceivableStatus.OPEN : ServiceSellerReceivableStatus.REVERSED;
      taxAccrualStatus =
        nextDue > 0 ? ServiceReceivableTaxAccrualStatus.ACCRUED : ServiceReceivableTaxAccrualStatus.REVERSED;
      taxAccruedAt = nextDue > 0 ? now : taxAccruedAt;
      taxReversedAt = nextDue > 0 ? taxReversedAt : now;
      paidAt = acceptedCashPaise > 0 ? receivable.servicePayment?.paidAt ?? now : null;
    } else if (resolution === ServiceCashDisputeResolution.REJECTED) {
      nextPaymentStatus = PaymentStatus.FAILED;
      nextCashStatus = ServiceCashCollectionStatus.REJECTED;
      nextReceivableStatus = ServiceSellerReceivableStatus.REVERSED;
      taxAccrualStatus = ServiceReceivableTaxAccrualStatus.REVERSED;
      taxReversedAt = now;
      paidAt = null;
    }

    if (receivable.servicePayment) {
      await tx.servicePayment.update({
        where: { id: receivable.servicePayment.id },
        data: {
          amountPaise:
            resolution === ServiceCashDisputeResolution.PARTIALLY_ACCEPTED ||
            resolution === ServiceCashDisputeResolution.REJECTED
              ? acceptedCashPaise
              : receivable.servicePayment.amountPaise,
          status: nextPaymentStatus,
          paidAt,
          adminCashVerifiedAt:
            nextCashStatus === ServiceCashCollectionStatus.ADMIN_VERIFIED ||
            nextCashStatus === ServiceCashCollectionStatus.ADMIN_PARTIALLY_VERIFIED
              ? now
              : receivable.servicePayment.adminCashVerifiedAt,
          cashCollectionStatus: nextCashStatus,
          cashDisputeResolution: resolution,
          cashResolutionNote: note?.trim() || null,
          events: {
            create: {
              eventType: "service_cash_collection.admin_resolved",
              oldStatus: receivable.servicePayment.status,
              newStatus: nextPaymentStatus,
              payload: { actorUserId, resolution, acceptedCashPaise, note: note ?? null },
            },
          },
        },
      });
    }

    const updated = await tx.serviceSellerReceivable.update({
      where: { id: receivable.id },
      data: {
        status: nextReceivableStatus,
        resolution,
        resolvedById: actorUserId,
        resolvedAt: now,
        resolutionNote: note?.trim() || null,
        verifiedById:
          nextReceivableStatus === ServiceSellerReceivableStatus.OPEN ? actorUserId : receivable.verifiedById,
        verifiedAt:
          nextReceivableStatus === ServiceSellerReceivableStatus.OPEN ? now : receivable.verifiedAt,
        grossCashCollectedPaise:
          resolution === ServiceCashDisputeResolution.PARTIALLY_ACCEPTED ||
          resolution === ServiceCashDisputeResolution.REJECTED
            ? acceptedCashPaise
            : receivable.grossCashCollectedPaise,
        commissionPaise: calculation?.commissionPaise ?? 0,
        gstOnCommissionPaise: calculation?.gstOnCommissionPaise ?? 0,
        tdsPaise: calculation?.tdsPaise ?? 0,
        tcsPaise: calculation?.tcsPaise ?? 0,
        platformFeePaise: calculation?.platformFeePaise ?? 0,
        amountDueToPlatformPaise: nextDue,
        reversalPaise,
        taxAccrualStatus,
        taxAccruedAt,
        taxReversedAt,
        financeSnapshot: calculation?.snapshot ?? receivable.financeSnapshot ?? Prisma.JsonNull,
      },
    });

    await this.createReceivableEvent(
      tx,
      receivable.id,
      "service_receivable.admin_resolved",
      receivable.status,
      updated.status,
      {
        actorUserId,
        resolution,
        amountDeltaPaise: nextDue - receivable.amountDueToPlatformPaise,
        oldAmountDuePaise: oldOutstanding,
        newAmountDuePaise: this.receivableOutstanding(updated),
        note,
        metadata: {
          acceptedCashPaise,
          recordedGrossCashPaise: receivable.grossCashCollectedPaise,
          servicePaymentId: receivable.servicePaymentId,
        },
      },
    );

    if (reversalPaise > 0) {
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: receivable.sellerId,
          serviceBookingId: receivable.bookingId,
          entryType: SellerLedgerEntryType.SERVICE_RECEIVABLE_REVERSED,
          description: `Service cash receivable reversal for ${receivable.receivableNumber}`,
          creditPaise: reversalPaise,
          currency: receivable.currency,
          referenceType: "service_seller_receivable",
          referenceId: receivable.id,
          metadata: { resolution, acceptedCashPaise },
          createdById: actorUserId,
        },
      });
    }

    return updated;
  }

  private receivableOutstanding(
    receivable: Pick<
      Prisma.ServiceSellerReceivableGetPayload<Record<string, never>>,
      "amountDueToPlatformPaise" | "settledPaise" | "waivedPaise" | "reversalPaise" | "offsetPaise"
    >,
  ) {
    return Math.max(
      0,
      receivable.amountDueToPlatformPaise -
        receivable.settledPaise -
        receivable.waivedPaise -
        receivable.reversalPaise -
        receivable.offsetPaise,
    );
  }

  private servicePayoutEligiblePaidPaise(booking: Pick<ServiceBookingRecord, "payments">) {
    return booking.payments
      .filter(
        (payment) =>
          (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.REFUNDED) &&
          payment.settlementTreatment === ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE &&
          payment.collectionType !== ServicePaymentCollectionType.PROVIDER_CASH,
      )
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
  }

  private async createSettlementIfEligible(booking: ServiceBookingRecord) {
    const settlementEligibleStatuses: ServiceBookingStatus[] = [
      ServiceBookingStatus.COMPLETED,
      ServiceBookingStatus.CLOSED_AFTER_INSPECTION,
      ServiceBookingStatus.CANCELLED,
    ];
    if (!settlementEligibleStatuses.includes(booking.status)) {
      return null;
    }
    const existing = await this.prisma.client.serviceBookingSettlement.findUnique({ where: { bookingId: booking.id } });
    if (existing) {
      return existing;
    }
    const grossDue =
      booking.status === ServiceBookingStatus.CLOSED_AFTER_INSPECTION
        ? booking.inspectionFeePaise
        : booking.status === ServiceBookingStatus.CANCELLED
          ? booking.cancellationFeePaise
          : booking.totalPayablePaise;
    const platformCollectedGross = Math.min(
      grossDue,
      Math.max(0, this.servicePayoutEligiblePaidPaise(booking) - this.serviceRefundCommittedPaise(booking)),
    );
    if (platformCollectedGross <= 0 || grossDue <= 0) {
      return null;
    }
    return this.prisma.client.$transaction(async (tx) => {
      const calculation = await this.financeCalculator.calculateServiceBooking(booking, platformCollectedGross, tx);
      const settlement = await tx.serviceBookingSettlement.create({
        data: {
          bookingId: booking.id,
          sellerId: booking.sellerId,
          grossAmountPaise: calculation.grossAmountPaise,
          inspectionFeeGrossPaise: calculation.inspectionFeeGrossPaise,
          commissionPaise: calculation.commissionPaise,
          gstOnCommissionPaise: calculation.gstOnCommissionPaise,
          tdsPaise: calculation.tdsPaise,
          tcsPaise: calculation.tcsPaise,
          platformFeePaise: calculation.platformFeePaise,
          refundAdjustmentPaise: calculation.refundAdjustmentPaise,
          netPayablePaise: calculation.netPayablePaise,
          status: SellerSettlementStatus.ELIGIBLE,
          currency: booking.currency,
          financeSnapshot: calculation.snapshot,
        },
      });
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: booking.sellerId,
          serviceBookingId: booking.id,
          serviceSettlementId: settlement.id,
          entryType: SellerLedgerEntryType.SERVICE_EARNING,
          description: `Service earning for ${booking.bookingNumber}`,
          creditPaise: platformCollectedGross,
          currency: booking.currency,
          referenceType: "service_booking",
          referenceId: booking.id,
        },
      });
      await this.createServiceSettlementDeductionEntries(tx, booking, settlement.id, calculation);
      await tx.auditLog.create({
        data: {
          action: "service_settlement.created",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: {
            gross: calculation.grossAmountPaise,
            commission: calculation.commissionPaise,
            net: calculation.netPayablePaise,
          },
        },
      });
      return settlement;
    });
  }

  private serviceRefundCommittedPaise(booking: Pick<ServiceBookingRecord, "refundRequests">) {
    return (booking.refundRequests ?? [])
      .filter((refund) => refund.status !== RefundRequestStatus.CANCELLED && refund.status !== RefundRequestStatus.FAILED)
      .reduce((sum, refund) => sum + refund.amountPaise, 0);
  }

  private async createServiceSettlementDeductionEntries(
    tx: Prisma.TransactionClient,
    booking: ServiceBookingRecord,
    serviceSettlementId: string,
    calculation: Awaited<ReturnType<FinanceCalculatorService["calculateServiceBooking"]>>,
  ) {
    const deductions: Array<{
      entryType: SellerLedgerEntryType;
      amountPaise: number;
      description: string;
    }> = [
      {
        entryType: SellerLedgerEntryType.SERVICE_COMMISSION,
        amountPaise: calculation.commissionPaise,
        description: `Service commission for ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.GST_ON_COMMISSION,
        amountPaise: calculation.gstOnCommissionPaise,
        description: `GST on service commission for ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.TDS_DEDUCTION,
        amountPaise: calculation.tdsPaise,
        description: `TDS deduction for service ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.TCS_DEDUCTION,
        amountPaise: calculation.tcsPaise,
        description: `TCS deduction for service ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.PLATFORM_FEE,
        amountPaise: calculation.platformFeePaise,
        description: `Service settlement fee for ${booking.bookingNumber}`,
      },
    ];

    for (const deduction of deductions) {
      if (deduction.amountPaise <= 0) {
        continue;
      }
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: booking.sellerId,
          serviceBookingId: booking.id,
          serviceSettlementId,
          entryType: deduction.entryType,
          description: deduction.description,
          debitPaise: deduction.amountPaise,
          currency: booking.currency,
          referenceType: "service_booking",
          referenceId: booking.id,
        },
      });
    }
  }

  private publicServiceWhere(query: Partial<ServiceListingQueryDto>): Prisma.ServiceListingWhereInput {
    const search = query.search?.trim();
    return {
      deletedAt: null,
      status: ServiceListingStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      seller: {
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        enabledCapabilities: { has: SellerCapability.SERVICE },
      },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private decorateServiceability<T extends ServiceListingRecord>(listing: T, query: ServiceListingQueryDto) {
    const serviceability = this.isListingServiceable(listing, query);
    return { ...listing, serviceability };
  }

  private isListingServiceable(listing: Pick<ServiceListingRecord, "areas">, location: Partial<ServiceListingQueryDto> | Record<string, unknown> | null) {
    if (!listing.areas.length) {
      return { serviceable: true, matchLevel: "GLOBAL" };
    }
    if (!location) {
      return { serviceable: false, reason: "Select your service location to check availability." };
    }
    const countryCode = stringLocation(location, "countryCode");
    const stateCode = stringLocation(location, "stateCode");
    const cityCode = stringLocation(location, "cityCode");
    const localAreaCode = stringLocation(location, "localAreaCode");
    const pincode = stringLocation(location, "pincode");
    const latitude = numberLocation(location, "latitude");
    const longitude = numberLocation(location, "longitude");

    for (const area of listing.areas.filter((item) => item.isActive)) {
      if (area.localAreaCode && localAreaCode && area.localAreaCode === localAreaCode) return { serviceable: true, matchLevel: "LOCAL_AREA" };
      if (area.pincode && pincode && area.pincode === pincode) return { serviceable: true, matchLevel: "PINCODE" };
      if (area.cityCode && cityCode && area.cityCode === cityCode) return { serviceable: true, matchLevel: "CITY" };
      if (area.stateCode && stateCode && area.stateCode === stateCode && !area.cityCode) return { serviceable: true, matchLevel: "STATE" };
      if (area.countryCode && countryCode && area.countryCode === countryCode && !area.stateCode) return { serviceable: true, matchLevel: "COUNTRY" };
      if (area.radiusKm && area.latitude && area.longitude && latitude !== null && longitude !== null) {
        const distanceKm = haversineKm(Number(area.latitude), Number(area.longitude), latitude, longitude);
        if (distanceKm <= area.radiusKm) {
          return { serviceable: true, matchLevel: "RADIUS", distanceKm: Math.round(distanceKm * 10) / 10 };
        }
      }
    }
    return { serviceable: false, reason: "This service provider does not currently serve the selected location." };
  }

  private normalizeIdempotencyKey(value: string | undefined) {
    const key = value?.trim();
    return key || null;
  }

  private findCustomerBookingByIdempotencyKey(customerId: string, idempotencyKey: string) {
    return this.prisma.client.serviceBooking.findFirst({
      where: {
        customerId,
        idempotencyKey,
      },
      include: serviceBookingInclude,
    });
  }

  private isPrismaUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private async resolveBookingAddress(customerId: string, dto: CreateServiceBookingDto) {
    if (dto.addressId) {
      const address = await this.prisma.client.customerAddress.findFirst({
        where: { id: dto.addressId, customerId },
      });
      if (!address) {
        throw new NotFoundException("Customer address not found.");
      }
      return {
        id: address.id,
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        area: address.area,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
        countryCode: address.countryCode,
        stateCode: address.stateCode,
        cityCode: address.cityCode,
        localAreaCode: address.localAreaCode,
        latitude: address.latitude ? Number(address.latitude) : null,
        longitude: address.longitude ? Number(address.longitude) : null,
      };
    }
    return dto.addressSnapshot ?? null;
  }

  private bookingPricing(listing: ServiceListingRecord, selectedPackage: ServiceListingRecord["packages"][number] | null) {
    const base = selectedPackage?.pricePaise ?? listing.basePricePaise ?? 0;
    const inspectionFeePaise = listing.paymentMode === ServicePaymentMode.INSPECTION_FEE ? listing.inspectionFeePaise : 0;
    const advanceAmountPaise = listing.paymentMode === ServicePaymentMode.ADVANCE_PAYMENT ? listing.advanceAmountPaise : 0;
    const totalPayablePaise =
      listing.pricingModel === ServicePricingModel.QUOTE_FIRST ? inspectionFeePaise : base;
    const initialPaymentPaise =
      listing.paymentMode === ServicePaymentMode.FULL_PAYMENT
        ? totalPayablePaise
        : listing.paymentMode === ServicePaymentMode.ADVANCE_PAYMENT
          ? advanceAmountPaise
          : listing.paymentMode === ServicePaymentMode.INSPECTION_FEE
            ? inspectionFeePaise
            : 0;
    return {
      subtotalPaise: base,
      inspectionFeePaise,
      advanceAmountPaise,
      totalPayablePaise,
      initialPaymentPaise,
    };
  }

  private initialPaymentPurpose(paymentMode: ServicePaymentMode) {
    if (paymentMode === ServicePaymentMode.ADVANCE_PAYMENT) return ServicePaymentPurpose.ADVANCE_PAYMENT;
    if (paymentMode === ServicePaymentMode.INSPECTION_FEE) return ServicePaymentPurpose.INSPECTION_FEE;
    if (paymentMode === ServicePaymentMode.PAY_AT_VISIT) return ServicePaymentPurpose.PAY_AT_VISIT;
    return ServicePaymentPurpose.FULL_PAYMENT;
  }

  private validateServicePricing(input: {
    pricingModel: ServicePricingModel;
    paymentMode: ServicePaymentMode;
    basePricePaise?: number | null;
    inspectionFeePaise?: number | null;
    advanceAmountPaise?: number | null;
    allowedVisitModes: ServiceVisitMode[];
  }) {
    if (input.pricingModel === ServicePricingModel.FIXED_PRICE && !input.basePricePaise) {
      throw new BadRequestException("Fixed-price services require a base price.");
    }
    if (input.paymentMode === ServicePaymentMode.INSPECTION_FEE && !input.inspectionFeePaise) {
      throw new BadRequestException("Inspection-fee services require an inspection fee.");
    }
    if (input.paymentMode === ServicePaymentMode.ADVANCE_PAYMENT && !input.advanceAmountPaise) {
      throw new BadRequestException("Advance-payment services require an advance amount.");
    }
    if (input.paymentMode === ServicePaymentMode.PAY_AT_VISIT && input.allowedVisitModes.every((mode) => mode === ServiceVisitMode.REMOTE)) {
      throw new BadRequestException("Pay-at-visit is available only for customer-location or provider-location services.");
    }
  }

  private async resolveSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({ where: { userId: actor.id } });
    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }
    return seller;
  }

  private async resolveApprovedServiceSeller(actor: RequestUser) {
    const seller = await this.resolveSeller(actor);
    if (seller.status !== SellerStatus.APPROVED || seller.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException("Seller approval is required for service operations.");
    }
    if (!seller.enabledCapabilities.includes(SellerCapability.SERVICE)) {
      throw new ForbiddenException("Service provider capability is required.");
    }
    return seller;
  }

  private async ensureActiveCategory(categoryId: string) {
    const category = await this.prisma.client.category.findFirst({
      where: { id: categoryId, status: CategoryStatus.ACTIVE, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException("Active category not found.");
    }
    return category;
  }

  private async getSellerServiceOrThrow(sellerId: string, serviceId: string) {
    const listing = await this.prisma.client.serviceListing.findFirst({
      where: { id: serviceId, sellerId, deletedAt: null },
      include: serviceListingInclude,
    });
    if (!listing) {
      throw new NotFoundException("Seller service listing not found.");
    }
    return listing;
  }

  private async getSellerBookingOrThrow(sellerId: string, bookingNumber: string) {
    const booking = await this.prisma.client.serviceBooking.findFirst({
      where: { bookingNumber, sellerId },
      include: serviceBookingInclude,
    });
    if (!booking) {
      throw new NotFoundException("Service booking not found.");
    }
    return booking;
  }

  private async getAdminBookingOrThrow(bookingNumber: string) {
    const booking = await this.prisma.client.serviceBooking.findFirst({
      where: { bookingNumber },
      include: serviceBookingInclude,
    });
    if (!booking) {
      throw new NotFoundException("Service booking not found.");
    }
    return booking;
  }

  private ensureBookingStatus(booking: ServiceBookingRecord, allowed: ServiceBookingStatus[], message: string) {
    if (!allowed.includes(booking.status)) {
      throw new BadRequestException(message);
    }
  }

  private ensureServicePaymentGate(booking: ServiceBookingRecord, action: "start" | "completion") {
    const paidPaise = booking.paidAmountPaise ?? 0;
    const acceptedQuote = booking.quotes.find((item) => item.status === ServiceQuoteStatus.ACCEPTED);
    const finalQuoteDue = acceptedQuote ? Math.max(0, acceptedQuote.totalPaise - paidPaise) : 0;
    const requiredPaise =
      booking.paymentMode === ServicePaymentMode.FULL_PAYMENT
        ? booking.totalPayablePaise
        : booking.paymentMode === ServicePaymentMode.ADVANCE_PAYMENT
          ? booking.advanceAmountPaise
          : booking.paymentMode === ServicePaymentMode.INSPECTION_FEE
            ? action === "completion" && acceptedQuote
              ? booking.totalPayablePaise
              : booking.inspectionFeePaise
            : 0;

    if (booking.paymentMode === ServicePaymentMode.PAY_AT_VISIT || requiredPaise <= 0) {
      return;
    }

    if (paidPaise >= requiredPaise) {
      return;
    }

    const shortfallPaise = Math.max(0, requiredPaise - paidPaise);
    if (booking.paymentMode === ServicePaymentMode.INSPECTION_FEE && action === "completion" && finalQuoteDue > 0) {
      throw new BadRequestException(`Final quote payment is pending. Customer must pay remaining ${this.formatPaise(finalQuoteDue, booking.currency)} before completion can be submitted.`);
    }

    const label =
      booking.paymentMode === ServicePaymentMode.FULL_PAYMENT
        ? "Full payment"
        : booking.paymentMode === ServicePaymentMode.ADVANCE_PAYMENT
          ? "Advance payment"
          : "Inspection fee";
    throw new BadRequestException(`${label} is pending. Customer must pay ${this.formatPaise(shortfallPaise, booking.currency)} more before this service can ${action === "start" ? "start" : "be completed"}.`);
  }

  private formatPaise(amountPaise: number, currency: string) {
    return `${currency} ${(amountPaise / 100).toFixed(2)}`;
  }

  private activeQuoteOrThrow(booking: ServiceBookingRecord) {
    const quote = booking.quotes.find((item) => item.status === ServiceQuoteStatus.SENT);
    if (!quote) {
      throw new NotFoundException("Active service quote not found.");
    }
    return quote;
  }

  private async expireQuote(booking: ServiceBookingRecord, quoteId: string) {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceQuote.update({
        where: { id: quoteId },
        data: { status: ServiceQuoteStatus.EXPIRED, expiredAt: new Date() },
      });
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: { status: ServiceBookingStatus.QUOTE_EXPIRED },
      });
    });
  }

  private async createUniqueServiceSlug(title: string) {
    const base = createSlug(title) || "service";
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
      const slug = `${base}${suffix}`;
      const existing = await this.prisma.client.serviceListing.findUnique({ where: { slug } });
      if (!existing) return slug;
    }
    return `${base}-${Date.now()}`;
  }

  private async createUniqueBookingNumber() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const value = `SRV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await this.prisma.client.serviceBooking.findUnique({ where: { bookingNumber: value } });
      if (!existing) return value;
    }
    return `SRV-${Date.now()}`;
  }

  private async createUniqueQuoteNumber() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const value = `SQ-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await this.prisma.client.serviceQuote.findUnique({ where: { quoteNumber: value } });
      if (!existing) return value;
    }
    return `SQ-${Date.now()}`;
  }

  private cleanImages(images: CreateServiceListingDto["images"]) {
    return (images ?? []).map((image, index) => ({
      url: image.url.trim(),
      altText: image.altText?.trim() || null,
      sortOrder: image.sortOrder ?? index,
      isPrimary: image.isPrimary ?? index === 0,
    }));
  }

  private cleanPackages(packages: CreateServiceListingDto["packages"]) {
    return (packages ?? []).map((item, index) => ({
      name: item.name.trim(),
      description: item.description?.trim() || null,
      pricePaise: item.pricePaise,
      mrpPaise: item.mrpPaise ?? null,
      durationMinutes: item.durationMinutes ?? null,
      sortOrder: item.sortOrder ?? index,
      isActive: item.isActive ?? true,
    }));
  }

  private cleanAreas(areas: CreateServiceListingDto["areas"]) {
    return (areas ?? []).map((area) => ({
      label: area.label?.trim() || null,
      countryCode: area.countryCode?.trim() || null,
      stateCode: area.stateCode?.trim() || null,
      cityCode: area.cityCode?.trim() || null,
      localAreaCode: area.localAreaCode?.trim() || null,
      pincode: area.pincode?.trim() || null,
      latitude: area.latitude ?? null,
      longitude: area.longitude ?? null,
      radiusKm: area.radiusKm ?? null,
      isActive: area.isActive ?? true,
    }));
  }

  private searchText(title: string, description: string) {
    return `${title} ${description}`.toLowerCase();
  }

  private async notifySeller(listing: ServiceListingRecord, eventCode: string, variables: Record<string, string | number | boolean>) {
    await this.notifications.notifyEvent({
      eventCode,
      recipientType: EmailRecipientType.SELLER,
      recipient: listing.seller.user.email,
      userId: listing.seller.userId,
      variables,
    });
  }

  private async notifyBooking(booking: ServiceBookingRecord, eventCode: string) {
    const variables = {
      bookingNumber: booking.bookingNumber,
      serviceTitle: booking.listing.title,
      providerName: booking.seller.storeName,
      customerName: booking.customer.displayName ?? booking.customer.user.email,
      status: booking.status,
    };
    await Promise.all([
      this.notifications.notifyEvent({
        eventCode,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: booking.customer.user.email,
        userId: booking.customer.userId,
        variables,
      }),
      this.notifications.notifyEvent({
        eventCode,
        recipientType: EmailRecipientType.SELLER,
        recipient: booking.seller.user.email,
        userId: booking.seller.userId,
        variables,
      }),
    ]);
  }

  private async recomputeServiceRatings(sellerId: string, serviceListingId: string) {
    const [listingAggregate, sellerAggregate] = await Promise.all([
      this.prisma.client.serviceReview.aggregate({
        where: { serviceListingId, isVisible: true },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.client.serviceReview.aggregate({
        where: { sellerId, isVisible: true },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    await Promise.all([
      this.prisma.client.serviceListing.update({
        where: { id: serviceListingId },
        data: {
          serviceRating: listingAggregate._avg.rating ?? null,
          serviceReviewCount: listingAggregate._count.rating,
        },
      }),
      this.prisma.client.seller.update({
        where: { id: sellerId },
        data: {
          serviceRating: sellerAggregate._avg.rating ?? null,
          serviceReviewCount: sellerAggregate._count.rating,
        },
      }),
    ]);
  }
}

function cleanTextArray(values: string[] | undefined) {
  return [...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))];
}

function defaultServiceAvailabilityRules() {
  return [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: 10 * 60,
    endMinute: 18 * 60,
    capacity: 1,
    note: null,
    isActive: true,
  }));
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stringLocation(location: Partial<ServiceListingQueryDto> | Record<string, unknown>, key: string) {
  const value = location[key as keyof typeof location];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberLocation(location: Partial<ServiceListingQueryDto> | Record<string, unknown>, key: string) {
  const value = location[key as keyof typeof location];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
