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
  SellerCapability,
  SellerLedgerEntryType,
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
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AdminServiceApprovalDto,
  CancelServiceBookingDto,
  CompletionSubmitDto,
  CreateServiceBookingDto,
  CreateServiceListingDto,
  CreateServiceReviewDto,
  RaiseServiceDisputeDto,
  RecordServicePaymentDto,
  ResolveServiceDisputeDto,
  SellerServiceBookingActionDto,
  SendServiceQuoteDto,
  ServiceListingQueryDto,
  ServiceReviewReplyDto,
  UpdateSellerCapabilitiesDto,
  UpdateServiceListingDto,
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
  quotes: {
    include: { lineItems: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] } },
    orderBy: { createdAt: "desc" as const },
  },
  payments: { orderBy: { createdAt: "desc" as const } },
  disputes: { orderBy: { createdAt: "desc" as const } },
  settlement: true,
  reviews: { include: { reply: true }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ServiceBookingInclude;

type ServiceBookingRecord = Prisma.ServiceBookingGetPayload<{ include: typeof serviceBookingInclude }>;
type ServiceListingRecord = Prisma.ServiceListingGetPayload<{ include: typeof serviceListingInclude }>;
type ServiceBookingTransitionPatch = {
  providerNote?: string;
  scheduledStartAt?: string;
  completionNote?: string;
  completionImages?: string[];
  completionConfirmedById?: string;
};

@Injectable()
export class ServiceMarketplaceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
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
    const scheduledEndAt =
      scheduledStartAt && listing.serviceDurationMinutes
        ? new Date(scheduledStartAt.getTime() + listing.serviceDurationMinutes * 60_000)
        : null;

    let createdNew = true;
    const booking = await this.prisma.client.$transaction(async (tx) => {
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

  async sellerAcceptBooking(actor: RequestUser, bookingNumber: string, dto: SellerServiceBookingActionDto) {
    const seller = await this.resolveApprovedServiceSeller(actor);
    const booking = await this.getSellerBookingOrThrow(seller.id, bookingNumber);
    this.ensureBookingStatus(booking, [ServiceBookingStatus.REQUESTED], "Only requested bookings can be accepted.");
    const nextStatus =
      booking.listing.pricingModel === ServicePricingModel.QUOTE_FIRST
        ? ServiceBookingStatus.ACCEPTED
        : dto.scheduledStartAt || booking.scheduledStartAt
          ? ServiceBookingStatus.SCHEDULED
          : ServiceBookingStatus.ACCEPTED;

    const patch: ServiceBookingTransitionPatch = {};
    if (dto.note !== undefined) {
      patch.providerNote = dto.note;
    }
    if (dto.scheduledStartAt !== undefined) {
      patch.scheduledStartAt = dto.scheduledStartAt;
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
        data: { status: ServiceQuoteStatus.WITHDRAWN },
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

  async customerAcceptQuote(actor: RequestUser, bookingNumber: string) {
    const booking = await this.getCustomerBooking(actor, bookingNumber);
    const quote = this.activeQuoteOrThrow(booking);
    if (quote.expiresAt < new Date()) {
      await this.expireQuote(booking, quote.id);
      throw new BadRequestException("This quote has expired. Please request a new quote.");
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceQuote.update({ where: { id: quote.id }, data: { status: ServiceQuoteStatus.ACCEPTED, acceptedAt: new Date() } });
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status: ServiceBookingStatus.QUOTE_ACCEPTED,
          subtotalPaise: quote.totalPaise,
          totalPayablePaise: quote.totalPaise,
          payments: {
            create: {
              sellerId: booking.sellerId,
              provider: booking.paymentMode === ServicePaymentMode.PAY_AT_VISIT ? PaymentProvider.MANUAL : PaymentProvider.RAZORPAY,
              purpose: ServicePaymentPurpose.FINAL_QUOTE,
              amountPaise: quote.totalPaise,
              currency: booking.currency,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_quote.accepted",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { quoteId: quote.id, totalPaise: quote.totalPaise },
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
    const updated = await this.transitionBooking(booking, ServiceBookingStatus.IN_PROGRESS, actor, "service_booking.in_progress");
    await this.notifyBooking(updated, "service_booking_in_progress");
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
    const patch: ServiceBookingTransitionPatch = { completionNote: dto.completionNote };
    if (dto.completionImages !== undefined) {
      patch.completionImages = dto.completionImages;
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
    const nextStatus =
      dto.resolution === ServiceDisputeResolution.COMPLETE_BOOKING ||
      dto.resolution === ServiceDisputeResolution.RELEASE_TO_PROVIDER
        ? ServiceBookingStatus.COMPLETED
        : ServiceBookingStatus.CANCELLED_AFTER_DISPUTE;

    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceDispute.update({
        where: { id: disputeId },
        data: {
          resolution: dto.resolution,
          adminNote: dto.adminNote,
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
          newValue: { disputeId, resolution: dto.resolution, adminNote: dto.adminNote, nextStatus },
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
    const status = dto.markPaid ? PaymentStatus.PAID : PaymentStatus.PENDING;
    const payment = await this.prisma.client.$transaction(async (tx) => {
      const payment = await tx.servicePayment.create({
        data: {
          bookingId: booking.id,
          sellerId: booking.sellerId,
          provider: dto.provider,
          purpose: dto.purpose,
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
        await tx.serviceBooking.update({
          where: { id: booking.id },
          data: { paidAmountPaise: { increment: dto.amountPaise } },
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
    return payment;
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
    const updated = await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status: ServiceBookingStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancellationInitiator: initiator,
          cancelledById: actor.id,
          cancelledAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "service_booking.cancelled",
          entityType: "service_booking",
          entityId: booking.id,
          oldValue: { status: booking.status },
          newValue: { status: ServiceBookingStatus.CANCELLED, reason, initiator },
        },
      });
    });
    void updated;
    const refreshed = await this.getAdminBookingOrThrow(booking.bookingNumber);
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
      await tx.serviceBooking.update({
        where: { id: booking.id },
        data: {
          status,
          ...(patch.providerNote !== undefined ? { providerNote: patch.providerNote?.trim() || null } : {}),
          ...(scheduledStartAt ? { scheduledStartAt } : {}),
          ...(patch.completionNote !== undefined ? { completionNote: patch.completionNote.trim(), completionSubmittedAt: new Date() } : {}),
          ...(patch.completionImages !== undefined ? { completionImages: cleanTextArray(patch.completionImages) } : {}),
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
          oldValue: { status: booking.status },
          newValue: { status },
        },
      });
    });
    return this.getAdminBookingOrThrow(booking.bookingNumber);
  }

  private async createSettlementIfEligible(booking: ServiceBookingRecord) {
    const settlementEligibleStatuses: ServiceBookingStatus[] = [
      ServiceBookingStatus.COMPLETED,
      ServiceBookingStatus.CLOSED_AFTER_INSPECTION,
    ];
    if (!settlementEligibleStatuses.includes(booking.status)) {
      return null;
    }
    const existing = await this.prisma.client.serviceBookingSettlement.findUnique({ where: { bookingId: booking.id } });
    if (existing) {
      return existing;
    }
    const gross = booking.status === ServiceBookingStatus.CLOSED_AFTER_INSPECTION ? booking.inspectionFeePaise : booking.totalPayablePaise;
    const commission = Math.floor(gross * 500 / 10_000);
    const net = Math.max(0, gross - commission);
    return this.prisma.client.$transaction(async (tx) => {
      const settlement = await tx.serviceBookingSettlement.create({
        data: {
          bookingId: booking.id,
          sellerId: booking.sellerId,
          grossAmountPaise: gross,
          inspectionFeeGrossPaise: booking.inspectionFeePaise,
          commissionPaise: commission,
          netPayablePaise: net,
          status: SellerSettlementStatus.ELIGIBLE,
          currency: booking.currency,
          financeSnapshot: {
            commissionRateBps: 500,
            bookingStatus: booking.status,
            paymentMode: booking.paymentMode,
          },
        },
      });
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: booking.sellerId,
          serviceBookingId: booking.id,
          serviceSettlementId: settlement.id,
          entryType: SellerLedgerEntryType.SERVICE_EARNING,
          description: `Service earning for ${booking.bookingNumber}`,
          creditPaise: gross,
          currency: booking.currency,
          referenceType: "service_booking",
          referenceId: booking.id,
        },
      });
      if (commission > 0) {
        await tx.sellerLedgerEntry.create({
          data: {
            sellerId: booking.sellerId,
            serviceBookingId: booking.id,
            serviceSettlementId: settlement.id,
            entryType: SellerLedgerEntryType.SERVICE_COMMISSION,
            description: `Service commission for ${booking.bookingNumber}`,
            debitPaise: commission,
            currency: booking.currency,
            referenceType: "service_booking",
            referenceId: booking.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          action: "service_settlement.created",
          entityType: "service_booking",
          entityId: booking.id,
          newValue: { gross, commission, net },
        },
      });
      return settlement;
    });
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
