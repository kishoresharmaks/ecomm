import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  ApprovalStatus,
  B2BEnquiryStatus,
  B2BOrderStatus,
  EmailRecipientType,
  Prisma,
  ProductStatus,
  RoleCode,
  SellerStatus,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
} from "../common/pagination";
import { LocationsService } from "../locations/locations.service";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { SellerSubscriptionsService } from "../sellers/seller-subscriptions.service";
import { CreateB2BEnquiryDto } from "./dto/b2b-enquiry.dto";
import {
  B2BOrderQueryDto,
  SubmitB2BPurchaseOrderDto,
  UpdateB2BOrderStatusDto,
} from "./dto/b2b-order.dto";
import { B2BEnquiryQueryDto } from "./dto/b2b-query.dto";
import { CreateB2BResponseDto } from "./dto/b2b-response.dto";
import { UpdateB2BEnquiryStatusDto } from "./dto/b2b-status.dto";
import {
  BusinessBuyerQueryDto,
  UpdateBusinessBuyerStatusDto,
} from "./dto/business-buyer-query.dto";
import {
  CreateBusinessBuyerAddressDto,
  UpdateBusinessBuyerAddressDto,
} from "./dto/business-buyer-address.dto";
import {
  UpdateBusinessBuyerProfileDto,
  UpsertBusinessBuyerProfileDto,
} from "./dto/business-buyer-profile.dto";

const enquiryInclude = {
  businessBuyer: {
    include: {
      user: true,
      addresses: true,
    },
  },
  product: {
    include: {
      images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
      variants: { orderBy: { createdAt: "asc" as const } },
    },
  },
  seller: {
    include: {
      user: true,
      profile: true,
      addresses: true,
    },
  },
  responses: {
    include: {
      responder: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  b2bOrder: {
    include: {
      selectedResponse: {
        include: {
          responder: true,
        },
      },
      events: {
        include: {
          actor: true,
        },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
};

const b2bOrderInclude = {
  businessBuyer: {
    include: {
      user: true,
      addresses: true,
    },
  },
  seller: {
    include: {
      user: true,
      profile: true,
      addresses: true,
    },
  },
  product: {
    include: {
      images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
      variants: { orderBy: { createdAt: "asc" as const } },
    },
  },
  selectedResponse: {
    include: {
      responder: true,
    },
  },
  enquiry: {
    include: {
      responses: {
        include: {
          responder: true,
        },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
  events: {
    include: {
      actor: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
};

const buyerCancellableB2BStatuses = new Set<B2BEnquiryStatus>([
  B2BEnquiryStatus.SUBMITTED,
  B2BEnquiryStatus.IN_REVIEW,
  B2BEnquiryStatus.RESPONDED,
]);

const responseAllowedB2BStatuses = new Set<B2BEnquiryStatus>([
  B2BEnquiryStatus.SUBMITTED,
  B2BEnquiryStatus.IN_REVIEW,
  B2BEnquiryStatus.RESPONDED,
]);

const adminB2BStatusTransitions: Partial<Record<B2BEnquiryStatus, B2BEnquiryStatus[]>> = {
  [B2BEnquiryStatus.SUBMITTED]: [
    B2BEnquiryStatus.IN_REVIEW,
    B2BEnquiryStatus.CLOSED,
    B2BEnquiryStatus.CANCELLED,
  ],
  [B2BEnquiryStatus.IN_REVIEW]: [B2BEnquiryStatus.CLOSED, B2BEnquiryStatus.CANCELLED],
  [B2BEnquiryStatus.RESPONDED]: [
    B2BEnquiryStatus.IN_REVIEW,
    B2BEnquiryStatus.CLOSED,
    B2BEnquiryStatus.CANCELLED,
  ],
  [B2BEnquiryStatus.BUYER_CONFIRMED]: [
    B2BEnquiryStatus.ADMIN_APPROVED,
    B2BEnquiryStatus.CLOSED,
    B2BEnquiryStatus.CANCELLED,
  ],
  [B2BEnquiryStatus.ADMIN_APPROVED]: [
    B2BEnquiryStatus.FINALISED,
    B2BEnquiryStatus.CLOSED,
    B2BEnquiryStatus.CANCELLED,
  ],
};

const adminB2BOrderStatusTransitions: Partial<Record<B2BOrderStatus, B2BOrderStatus[]>> = {
  [B2BOrderStatus.PROFORMA_ISSUED]: [B2BOrderStatus.CANCELLED],
  [B2BOrderStatus.PO_SUBMITTED]: [B2BOrderStatus.PO_ACCEPTED, B2BOrderStatus.CANCELLED],
  [B2BOrderStatus.PO_ACCEPTED]: [B2BOrderStatus.IN_FULFILMENT, B2BOrderStatus.CANCELLED],
  [B2BOrderStatus.IN_FULFILMENT]: [B2BOrderStatus.FULFILLED, B2BOrderStatus.CANCELLED],
};

const buyerEditableB2BOrderStatuses = new Set<B2BOrderStatus>([
  B2BOrderStatus.PROFORMA_ISSUED,
  B2BOrderStatus.PO_SUBMITTED,
]);

const terminalB2BOrderStatuses = new Set<B2BOrderStatus>([
  B2BOrderStatus.FULFILLED,
  B2BOrderStatus.CANCELLED,
]);

@Injectable()
export class B2BService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocationsService) private readonly locationsService: LocationsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Optional()
    @Inject(SellerSubscriptionsService)
    private readonly sellerSubscriptions?: SellerSubscriptionsService,
  ) {}

  async getProfile(actor: RequestUser) {
    return this.getBusinessBuyerForUserOrThrow(actor.id);
  }

  async upsertProfile(
    actor: RequestUser,
    dto: UpsertBusinessBuyerProfileDto | UpdateBusinessBuyerProfileDto,
  ) {
    const existing = await this.prisma.client.businessBuyer.findUnique({
      where: { userId: actor.id },
    });

    if (!existing && (!dto.companyName || !dto.contactName || !dto.contactPhone)) {
      throw new BadRequestException("Company name, contact name, and contact phone are required.");
    }

    const businessBuyerId = await this.prisma.client.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { code: RoleCode.BUSINESS_BUYER },
        update: {},
        create: {
          code: RoleCode.BUSINESS_BUYER,
          name: "Business Buyer",
          description: "B2B buyer account for enquiries.",
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: actor.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: actor.id,
          roleId: role.id,
        },
      });

      await tx.user.update({
        where: { id: actor.id },
        data: {
          ...(dto.contactName !== undefined ? { fullName: dto.contactName } : {}),
          ...(dto.contactPhone !== undefined ? { phone: dto.contactPhone } : {}),
        },
      });

      const businessBuyer = await tx.businessBuyer.upsert({
        where: { userId: actor.id },
        update: {
          ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
          ...(dto.gstNumber !== undefined ? { gstNumber: dto.gstNumber ?? null } : {}),
          ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
          ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
          status: UserStatus.ACTIVE,
        },
        create: {
          userId: actor.id,
          companyName: dto.companyName as string,
          gstNumber: dto.gstNumber ?? null,
          contactName: dto.contactName as string,
          contactPhone: dto.contactPhone as string,
          status: UserStatus.ACTIVE,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: existing ? "b2b.profile.updated" : "b2b.profile.created",
          entityType: "business_buyer",
          entityId: businessBuyer.id,
          newValue: this.businessBuyerAuditValue(businessBuyer),
        },
      });

      return businessBuyer.id;
    });

    return this.prisma.client.businessBuyer.findUniqueOrThrow({
      where: { id: businessBuyerId },
      include: {
        user: true,
        addresses: true,
      },
    });
  }

  async listAddresses(actor: RequestUser) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);

    return this.prisma.client.businessBuyerAddress.findMany({
      where: { businessBuyerId: businessBuyer.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAddress(actor: RequestUser, dto: CreateBusinessBuyerAddressDto) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    const location = await this.locationsService.resolveAddressLocation(dto);

    const address = await this.prisma.client.businessBuyerAddress.create({
      data: {
        businessBuyerId: businessBuyer.id,
        line1: dto.line1,
        line2: dto.line2 ?? null,
        area: location.area,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        country: location.country,
        countryCode: location.countryCode,
        stateCode: location.stateCode,
        cityCode: location.cityCode,
        localAreaCode: location.localAreaCode,
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "b2b.address.created",
        entityType: "business_buyer_address",
        entityId: address.id,
        newValue: address,
      },
    });

    return address;
  }

  async updateAddress(actor: RequestUser, addressId: string, dto: UpdateBusinessBuyerAddressDto) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    const existing = await this.getAddressForBuyerOrThrow(businessBuyer.id, addressId);
    const location =
      dto.countryCode !== undefined ||
      dto.stateCode !== undefined ||
      dto.cityCode !== undefined ||
      dto.localAreaCode !== undefined ||
      dto.country !== undefined ||
      dto.state !== undefined ||
      dto.city !== undefined ||
      dto.area !== undefined ||
      dto.pincode !== undefined
        ? await this.locationsService.resolveAddressLocation({
            countryCode: dto.countryCode ?? existing.countryCode,
            stateCode: dto.stateCode ?? existing.stateCode,
            cityCode: dto.cityCode ?? existing.cityCode,
            localAreaCode: dto.localAreaCode ?? existing.localAreaCode,
            country: dto.country ?? existing.country,
            state: dto.state ?? existing.state,
            city: dto.city ?? existing.city,
            area: dto.area ?? existing.area,
            pincode: dto.pincode ?? existing.pincode,
          })
        : null;

    const address = await this.prisma.client.businessBuyerAddress.update({
      where: { id: addressId },
      data: {
        ...(dto.line1 !== undefined ? { line1: dto.line1 } : {}),
        ...(dto.line2 !== undefined ? { line2: dto.line2 ?? null } : {}),
        ...(location
          ? {
              area: location.area,
              city: location.city,
              state: location.state,
              pincode: location.pincode,
              country: location.country,
              countryCode: location.countryCode,
              stateCode: location.stateCode,
              cityCode: location.cityCode,
              localAreaCode: location.localAreaCode,
            }
          : {}),
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "b2b.address.updated",
        entityType: "business_buyer_address",
        entityId: address.id,
        oldValue: existing,
        newValue: address,
      },
    });

    return address;
  }

  async deleteAddress(actor: RequestUser, addressId: string) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    const existing = await this.getAddressForBuyerOrThrow(businessBuyer.id, addressId);

    await this.prisma.client.businessBuyerAddress.delete({
      where: { id: addressId },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "b2b.address.deleted",
        entityType: "business_buyer_address",
        entityId: addressId,
        oldValue: existing,
      },
    });

    return { deleted: true };
  }

  async createEnquiry(actor: RequestUser, dto: CreateB2BEnquiryDto) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    const resolved = await this.resolveProductAndSeller(dto);

    const createdEnquiry = await this.prisma.client.b2BEnquiry.create({
      data: {
        businessBuyerId: businessBuyer.id,
        productId: resolved.productId,
        sellerId: resolved.sellerId,
        quantity: dto.quantity,
        message: dto.message,
        status: B2BEnquiryStatus.SUBMITTED,
      },
    });
    const enquiry = await this.getEnquiryOrThrow({ id: createdEnquiry.id });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "b2b.enquiry.submitted",
        entityType: "b2b_enquiry",
        entityId: enquiry.id,
        newValue: this.enquiryAuditValue(enquiry),
      },
    });

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_SUBMITTED_BUYER,
        recipientType: EmailRecipientType.BUSINESS_BUYER,
        recipient: enquiry.businessBuyer.user.email,
        userId: enquiry.businessBuyer.userId,
        variables: {
          companyName: enquiry.businessBuyer.companyName,
          enquiryId: enquiry.id,
          quantity: enquiry.quantity,
        },
      }),
      enquiry.seller?.user.email
        ? this.notifications.notifyEvent({
            eventCode: EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_SUBMITTED_SELLER,
            recipientType: EmailRecipientType.SELLER,
            recipient: enquiry.seller.user.email,
            userId: enquiry.seller.userId,
            variables: {
              companyName: enquiry.businessBuyer.companyName,
              sellerName: enquiry.seller.storeName,
              enquiryId: enquiry.id,
              quantity: enquiry.quantity,
            },
          })
        : Promise.resolve(null),
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_SUBMITTED_ADMIN, {
        companyName: enquiry.businessBuyer.companyName,
        enquiryId: enquiry.id,
        quantity: enquiry.quantity,
      }),
    ]);

    return enquiry;
  }

  async listMyEnquiries(actor: RequestUser, query: B2BEnquiryQueryDto) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.listEnquiries(
      { ...this.enquiryWhere(query), businessBuyerId: businessBuyer.id },
      query,
    );
  }

  async getMyEnquiry(actor: RequestUser, enquiryId: string) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.getEnquiryOrThrow({
      id: enquiryId,
      businessBuyerId: businessBuyer.id,
    });
  }

  async cancelMyEnquiry(actor: RequestUser, enquiryId: string) {
    const enquiry = await this.getMyEnquiry(actor, enquiryId);

    if (!buyerCancellableB2BStatuses.has(enquiry.status)) {
      throw new BadRequestException(
        "Only submitted, in-review, or responded enquiries can be cancelled by the buyer.",
      );
    }

    return this.updateEnquiryStatusInternal(
      actor,
      enquiry.id,
      B2BEnquiryStatus.CANCELLED,
      "Business buyer cancelled enquiry.",
    );
  }

  async confirmMyEnquiry(actor: RequestUser, enquiryId: string) {
    const enquiry = await this.getMyEnquiry(actor, enquiryId);

    if (enquiry.status !== B2BEnquiryStatus.RESPONDED) {
      throw new BadRequestException(
        "A quotation response is required before the buyer can confirm this enquiry.",
      );
    }

    if (!enquiry.responses.length) {
      throw new BadRequestException(
        "At least one seller or admin response is required before confirmation.",
      );
    }

    return this.updateEnquiryStatusInternal(
      actor,
      enquiry.id,
      B2BEnquiryStatus.BUYER_CONFIRMED,
      "Business buyer confirmed the quotation for admin approval.",
    );
  }

  async listSellerEnquiries(actor: RequestUser, query: B2BEnquiryQueryDto) {
    const seller = await this.resolveSeller(actor);
    return this.listEnquiries({ ...this.enquiryWhere(query), sellerId: seller.id }, query);
  }

  async getSellerEnquiry(actor: RequestUser, enquiryId: string) {
    const seller = await this.resolveSeller(actor);
    return this.getEnquiryOrThrow({
      id: enquiryId,
      sellerId: seller.id,
    });
  }

  async respondAsSeller(actor: RequestUser, enquiryId: string, dto: CreateB2BResponseDto) {
    const seller = await this.resolveApprovedSeller(actor);
    await this.sellerSubscriptions?.ensureCanUseSellerB2B(seller.id);
    await this.getEnquiryOrThrow({
      id: enquiryId,
      sellerId: seller.id,
    });
    return this.createResponse(actor, enquiryId, dto, "seller");
  }

  async listAdminEnquiries(query: B2BEnquiryQueryDto) {
    return this.listEnquiries(this.enquiryWhere(query), query);
  }

  async getAdminEnquiry(enquiryId: string) {
    return this.getEnquiryOrThrow({ id: enquiryId });
  }

  async respondAsAdmin(actor: RequestUser, enquiryId: string, dto: CreateB2BResponseDto) {
    await this.getAdminEnquiry(enquiryId);
    return this.createResponse(actor, enquiryId, dto, "admin");
  }

  async updateStatusAsAdmin(actor: RequestUser, enquiryId: string, dto: UpdateB2BEnquiryStatusDto) {
    return this.updateEnquiryStatusInternal(actor, enquiryId, dto.status, dto.note, "admin");
  }

  async approveConfirmedEnquiry(actor: RequestUser, enquiryId: string) {
    return this.updateEnquiryStatusInternal(
      actor,
      enquiryId,
      B2BEnquiryStatus.ADMIN_APPROVED,
      "Admin approved the buyer-confirmed B2B enquiry.",
      "admin",
    );
  }

  async finaliseEnquiry(actor: RequestUser, enquiryId: string) {
    const enquiry = await this.updateEnquiryStatusInternal(
      actor,
      enquiryId,
      B2BEnquiryStatus.FINALISED,
      "Admin finalised the B2B enquiry and issued a proforma invoice for PO processing.",
      "admin",
    );
    await this.createB2BOrderForFinalisedEnquiry(actor, enquiry.id);
    return this.getEnquiryOrThrow({ id: enquiry.id });
  }

  async listMyB2BOrders(actor: RequestUser, query: B2BOrderQueryDto) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.listB2BOrders({ ...this.b2bOrderWhere(query), businessBuyerId: businessBuyer.id }, query);
  }

  async getMyB2BOrder(actor: RequestUser, orderNumber: string) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.getB2BOrderOrThrow({
      orderNumber: this.normalizeB2BOrderNumber(orderNumber),
      businessBuyerId: businessBuyer.id,
    });
  }

  async submitPurchaseOrder(actor: RequestUser, orderNumber: string, dto: SubmitB2BPurchaseOrderDto) {
    const existing = await this.getMyB2BOrder(actor, orderNumber);

    if (!buyerEditableB2BOrderStatuses.has(existing.status)) {
      throw new BadRequestException("Purchase order can only be submitted before admin acceptance.");
    }

    const submitted = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          status: B2BOrderStatus.PO_SUBMITTED,
          purchaseOrderNumber: dto.purchaseOrderNumber.trim(),
          purchaseOrderFileKey: dto.purchaseOrderFileKey?.trim() || null,
          purchaseOrderNote: dto.note?.trim() || null,
          purchaseOrderSubmittedAt: new Date(),
        },
      });

      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: updated.id,
          actorUserId: actor.id,
          status: updated.status,
          note: dto.note?.trim() || "Business buyer submitted purchase order details.",
          payload: {
            purchaseOrderNumber: updated.purchaseOrderNumber,
            purchaseOrderFileKey: updated.purchaseOrderFileKey,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "b2b.order.purchase_order_submitted",
          entityType: "b2b_order",
          entityId: updated.id,
          oldValue: this.b2bOrderAuditValue(existing),
          newValue: {
            status: updated.status,
            orderNumber: updated.orderNumber,
            purchaseOrderNumber: updated.purchaseOrderNumber,
            purchaseOrderFileKey: updated.purchaseOrderFileKey,
          },
        },
      });

      return updated;
    });

    return this.getB2BOrderOrThrow({ id: submitted.id });
  }

  async listSellerB2BOrders(actor: RequestUser, query: B2BOrderQueryDto) {
    const seller = await this.resolveSeller(actor);
    return this.listB2BOrders({ ...this.b2bOrderWhere(query), sellerId: seller.id }, query);
  }

  async getSellerB2BOrder(actor: RequestUser, orderNumber: string) {
    const seller = await this.resolveSeller(actor);
    return this.getB2BOrderOrThrow({
      orderNumber: this.normalizeB2BOrderNumber(orderNumber),
      sellerId: seller.id,
    });
  }

  async listAdminB2BOrders(query: B2BOrderQueryDto) {
    return this.listB2BOrders(this.b2bOrderWhere(query), query);
  }

  async getAdminB2BOrder(orderNumber: string) {
    return this.getB2BOrderOrThrow({ orderNumber: this.normalizeB2BOrderNumber(orderNumber) });
  }

  async updateB2BOrderStatusAsAdmin(actor: RequestUser, orderNumber: string, dto: UpdateB2BOrderStatusDto) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    this.assertB2BOrderStatusTransition(existing.status, dto.status);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          ...(dto.status === B2BOrderStatus.PO_ACCEPTED ? { purchaseOrderAcceptedAt: now } : {}),
          ...(dto.status === B2BOrderStatus.FULFILLED ? { fulfilledAt: now } : {}),
        },
      });

      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: updated.id,
          actorUserId: actor.id,
          status: updated.status,
          note: dto.note?.trim() || `Admin moved B2B order to ${this.statusForMessage(updated.status)}.`,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "b2b.order.status_updated",
          entityType: "b2b_order",
          entityId: updated.id,
          oldValue: this.b2bOrderAuditValue(existing),
          newValue: {
            ...this.b2bOrderAuditValue(updated),
            note: dto.note,
          },
        },
      });

      return updated;
    });

    return this.getB2BOrderOrThrow({ id: updated.id });
  }

  async listAdminBusinessBuyers(query: BusinessBuyerQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.BusinessBuyerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: "insensitive" } },
              { gstNumber: { contains: search, mode: "insensitive" } },
              { contactName: { contains: search, mode: "insensitive" } },
              { user: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query);
      const cursorWhere = createdAtCursorWhere(cursor) as
        | Prisma.BusinessBuyerWhereInput
        | undefined;
      const items = await this.prisma.client.businessBuyer.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: {
          user: true,
          addresses: true,
          _count: {
            select: { enquiries: true },
          },
        },
        orderBy: createdAtCursorOrderBy(),
        take: take + 1,
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = paginationFromQuery(query);
    const items = await this.prisma.client.businessBuyer.findMany({
      where,
      include: {
        user: true,
        addresses: true,
        _count: {
          select: { enquiries: true },
        },
      },
      orderBy: createdAtCursorOrderBy(),
      skip,
      take,
    });
    const total = await this.prisma.client.businessBuyer.count({ where });

    return { items, total, page, limit: take };
  }

  async getAdminBusinessBuyer(businessBuyerId: string) {
    const businessBuyer = await this.prisma.client.businessBuyer.findUnique({
      where: { id: businessBuyerId },
      include: {
        user: true,
        addresses: true,
        enquiries: {
          include: {
            product: true,
            seller: true,
            responses: true,
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
      },
    });

    if (!businessBuyer) {
      throw new NotFoundException("Business buyer not found.");
    }

    return businessBuyer;
  }

  async updateBusinessBuyerStatus(
    actor: RequestUser,
    businessBuyerId: string,
    dto: UpdateBusinessBuyerStatusDto,
  ) {
    const existing = await this.getAdminBusinessBuyer(businessBuyerId);
    const businessBuyer = await this.prisma.client.businessBuyer.update({
      where: { id: businessBuyerId },
      data: {
        status: dto.status,
        user: {
          update: {
            status: dto.status,
          },
        },
      },
      include: {
        user: true,
        addresses: true,
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.business_buyer.status_updated",
        entityType: "business_buyer",
        entityId: businessBuyer.id,
        oldValue: { status: existing.status },
        newValue: { status: businessBuyer.status, note: dto.note },
      },
    });

    return businessBuyer;
  }

  private async listEnquiries(where: Prisma.B2BEnquiryWhereInput, query: B2BEnquiryQueryDto) {
    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query);
      const cursorWhere = createdAtCursorWhere(cursor) as Prisma.B2BEnquiryWhereInput | undefined;
      const items = await this.prisma.client.b2BEnquiry.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: enquiryInclude,
        orderBy: createdAtCursorOrderBy(),
        take: take + 1,
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = paginationFromQuery(query);

    const items = await this.prisma.client.b2BEnquiry.findMany({
      where,
      include: enquiryInclude,
      orderBy: createdAtCursorOrderBy(),
      skip,
      take,
    });
    const total = await this.prisma.client.b2BEnquiry.count({ where });

    return { items, total, page, limit: take };
  }

  private async listB2BOrders(where: Prisma.B2BOrderWhereInput, query: B2BOrderQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const items = await this.prisma.client.b2BOrder.findMany({
      where,
      include: b2bOrderInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    const total = await this.prisma.client.b2BOrder.count({ where });

    return { items, total, page, limit: take };
  }

  private b2bOrderWhere(query: B2BOrderQueryDto): Prisma.B2BOrderWhereInput {
    const search = query.search?.trim();

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { proformaInvoiceNumber: { contains: search, mode: "insensitive" } },
              { purchaseOrderNumber: { contains: search, mode: "insensitive" } },
              { businessBuyer: { companyName: { contains: search, mode: "insensitive" } } },
              { product: { name: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private enquiryWhere(query: B2BEnquiryQueryDto): Prisma.B2BEnquiryWhereInput {
    const search = query.search?.trim();

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: "insensitive" } },
              { businessBuyer: { companyName: { contains: search, mode: "insensitive" } } },
              { product: { name: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private async createResponse(
    actor: RequestUser,
    enquiryId: string,
    dto: CreateB2BResponseDto,
    source: "admin" | "seller",
  ) {
    const existing = await this.getEnquiryOrThrow({ id: enquiryId });

    if (!responseAllowedB2BStatuses.has(existing.status)) {
      throw new BadRequestException(
        "Responses can only be added before buyer confirmation or enquiry closure.",
      );
    }

    const response = await this.prisma.client.$transaction(async (tx) => {
      const response = await tx.b2BEnquiryResponse.create({
        data: {
          enquiryId,
          responderUserId: actor.id,
          responseMessage: dto.responseMessage,
          quotedPricePaise: dto.quotedPricePaise ?? null,
        },
      });

      const enquiry = await tx.b2BEnquiry.update({
        where: { id: enquiryId },
        data: {
          status: B2BEnquiryStatus.RESPONDED,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action:
            source === "admin"
              ? "b2b.enquiry.admin_response_added"
              : "b2b.enquiry.seller_response_added",
          entityType: "b2b_enquiry",
          entityId: enquiry.id,
          newValue: {
            status: enquiry.status,
            responseId: response.id,
            quotedPricePaise: response.quotedPricePaise,
          },
        },
      });

      return response;
    });

    const enquiry = await this.getEnquiryOrThrow({ id: enquiryId });
    await this.notifications.notifyEvent({
      eventCode: EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_RESPONSE_BUYER,
      recipientType: EmailRecipientType.BUSINESS_BUYER,
      recipient: enquiry.businessBuyer.user.email,
      userId: enquiry.businessBuyer.userId,
      variables: {
        companyName: enquiry.businessBuyer.companyName,
        enquiryId: enquiry.id,
        responseSource: source,
        quotedPricePaise: response.quotedPricePaise ?? "",
      },
    });

    return enquiry;
  }

  private async updateEnquiryStatusInternal(
    actor: RequestUser,
    enquiryId: string,
    status: B2BEnquiryStatus,
    note?: string,
    actorType: "admin" | "buyer" = "buyer",
  ) {
    const existing = await this.getEnquiryOrThrow({ id: enquiryId });

    this.assertB2BStatusTransition(existing.status, status, actorType);

    const updatedEnquiry = await this.prisma.client.b2BEnquiry.update({
      where: { id: enquiryId },
      data: { status },
    });
    const enquiry = await this.getEnquiryOrThrow({ id: updatedEnquiry.id });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "b2b.enquiry.status_updated",
        entityType: "b2b_enquiry",
        entityId: enquiry.id,
        oldValue: this.enquiryAuditValue(existing),
        newValue: {
          ...this.enquiryAuditValue(enquiry),
          note,
        },
      },
    });

    return enquiry;
  }

  private assertB2BStatusTransition(
    current: B2BEnquiryStatus,
    next: B2BEnquiryStatus,
    actorType: "admin" | "buyer",
  ) {
    if (current === next) {
      throw new BadRequestException(`B2B enquiry is already ${this.statusForMessage(current)}.`);
    }

    if (actorType === "buyer") {
      const buyerAllowed =
        (current === B2BEnquiryStatus.RESPONDED && next === B2BEnquiryStatus.BUYER_CONFIRMED) ||
        (buyerCancellableB2BStatuses.has(current) && next === B2BEnquiryStatus.CANCELLED);

      if (!buyerAllowed) {
        throw new BadRequestException(
          "This buyer action is not allowed for the current B2B enquiry status.",
        );
      }

      return;
    }

    const allowed = adminB2BStatusTransitions[current] ?? [];

    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `B2B enquiry cannot move from ${this.statusForMessage(current)} to ${this.statusForMessage(next)}.`,
      );
    }
  }

  private assertB2BOrderStatusTransition(current: B2BOrderStatus, next: B2BOrderStatus) {
    if (terminalB2BOrderStatuses.has(current)) {
      throw new BadRequestException(`B2B order is already ${this.statusForMessage(current)}.`);
    }

    if (current === next) {
      throw new BadRequestException(`B2B order is already ${this.statusForMessage(current)}.`);
    }

    const allowed = adminB2BOrderStatusTransitions[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `B2B order cannot move from ${this.statusForMessage(current)} to ${this.statusForMessage(next)}.`,
      );
    }
  }

  private statusForMessage(status: string) {
    return status.replace(/_/g, " ").toLowerCase();
  }

  private async getEnquiryOrThrow(where: Prisma.B2BEnquiryWhereInput) {
    const enquiry = await this.prisma.client.b2BEnquiry.findFirst({
      where,
      include: enquiryInclude,
    });

    if (!enquiry) {
      throw new NotFoundException("B2B enquiry not found.");
    }

    return enquiry;
  }

  private async getB2BOrderOrThrow(where: Prisma.B2BOrderWhereInput) {
    const b2bOrder = await this.prisma.client.b2BOrder.findFirst({
      where,
      include: b2bOrderInclude,
    });

    if (!b2bOrder) {
      throw new NotFoundException("B2B order not found.");
    }

    return b2bOrder;
  }

  private async createB2BOrderForFinalisedEnquiry(actor: RequestUser, enquiryId: string) {
    const existingOrder = await this.prisma.client.b2BOrder.findUnique({
      where: { enquiryId },
    });

    if (existingOrder) {
      return existingOrder;
    }

    const enquiry = await this.getEnquiryOrThrow({ id: enquiryId });
    if (enquiry.status !== B2BEnquiryStatus.FINALISED) {
      throw new BadRequestException("B2B enquiry must be finalised before proforma order creation.");
    }

    const selectedResponse = this.selectResponseForB2BOrder(enquiry.responses);
    const unitPricePaise = selectedResponse?.quotedPricePaise ?? null;
    const subtotalPaise = unitPricePaise === null ? null : unitPricePaise * enquiry.quantity;
    const orderNumber = await this.createUniqueB2BOrderNumber();
    const proformaInvoiceNumber = await this.createUniqueProformaInvoiceNumber();
    const proformaExpiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    return this.prisma.client.$transaction(async (tx) => {
      const b2bOrder = await tx.b2BOrder.create({
        data: {
          orderNumber,
          enquiryId: enquiry.id,
          businessBuyerId: enquiry.businessBuyerId,
          sellerId: enquiry.sellerId,
          productId: enquiry.productId,
          selectedResponseId: selectedResponse?.id ?? null,
          status: B2BOrderStatus.PROFORMA_ISSUED,
          proformaInvoiceNumber,
          proformaExpiresAt,
          quantity: enquiry.quantity,
          unitPricePaise,
          subtotalPaise,
          currency: "INR",
          createdByUserId: actor.id,
          termsSnapshot: {
            source: "B2B_ENQUIRY_FINALISED",
            enquiryId: enquiry.id,
            buyerCompanyName: enquiry.businessBuyer.companyName,
            sellerStoreName: enquiry.seller?.storeName ?? null,
            productName: enquiry.product?.name ?? null,
            selectedResponseId: selectedResponse?.id ?? null,
            selectedResponseMessage: selectedResponse?.responseMessage ?? null,
            quotedPricePaise: selectedResponse?.quotedPricePaise ?? null,
            quantity: enquiry.quantity,
            subtotalPaise,
            paymentTerms: "Offline B2B settlement; purchase order required before fulfilment.",
            validityDays: 15,
          },
        },
      });

      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: b2bOrder.id,
          actorUserId: actor.id,
          status: b2bOrder.status,
          note: "Proforma invoice issued after admin finalisation.",
          payload: {
            orderNumber: b2bOrder.orderNumber,
            proformaInvoiceNumber: b2bOrder.proformaInvoiceNumber,
            proformaExpiresAt: b2bOrder.proformaExpiresAt?.toISOString(),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "b2b.order.proforma_issued",
          entityType: "b2b_order",
          entityId: b2bOrder.id,
          newValue: this.b2bOrderAuditValue(b2bOrder),
        },
      });

      return b2bOrder;
    });
  }

  private async resolveProductAndSeller(dto: CreateB2BEnquiryDto) {
    if (dto.productId) {
      const product = await this.prisma.client.product.findFirst({
        where: {
          id: dto.productId,
          status: ProductStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
          deletedAt: null,
          seller: {
            status: SellerStatus.APPROVED,
            approvalStatus: ApprovalStatus.APPROVED,
          },
        },
      });

      if (!product) {
        throw new NotFoundException("Active approved product not found.");
      }

      if (dto.sellerId && dto.sellerId !== product.sellerId) {
        throw new BadRequestException("Seller does not match the selected product.");
      }

      return { productId: product.id, sellerId: product.sellerId };
    }

    if (dto.sellerId) {
      const seller = await this.prisma.client.seller.findFirst({
        where: {
          id: dto.sellerId,
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
        },
      });

      if (!seller) {
        throw new NotFoundException("Approved seller not found.");
      }

      return { productId: null, sellerId: seller.id };
    }

    return { productId: null, sellerId: null };
  }

  private selectResponseForB2BOrder(
    responses: Array<{
      id: string;
      quotedPricePaise?: number | null;
      responseMessage: string;
      createdAt: Date;
    }>,
  ) {
    // No explicit quote selection exists yet, so use the newest priced response as the commercial source.
    return responses.find((response) => response.quotedPricePaise !== null && response.quotedPricePaise !== undefined)
      ?? responses[0]
      ?? null;
  }

  private async createUniqueB2BOrderNumber() {
    return this.createUniqueB2BNumber("1HI-B2B", "orderNumber");
  }

  private async createUniqueProformaInvoiceNumber() {
    return this.createUniqueB2BNumber("1HI-PFI", "proformaInvoiceNumber");
  }

  private async createUniqueB2BNumber(
    prefix: string,
    field: "orderNumber" | "proformaInvoiceNumber",
  ) {
    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `${prefix}-${dateKey}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const existing = await this.prisma.client.b2BOrder.findFirst({
        where: { [field]: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException("Unable to create a unique B2B commercial number. Try again.");
  }

  private normalizeB2BOrderNumber(orderNumber: string) {
    return orderNumber.trim().toUpperCase();
  }

  private async getBusinessBuyerForUserOrThrow(userId: string) {
    const businessBuyer = await this.prisma.client.businessBuyer.findUnique({
      where: { userId },
      include: {
        user: true,
        addresses: true,
      },
    });

    if (!businessBuyer) {
      throw new NotFoundException("Business buyer profile is required.");
    }

    return businessBuyer;
  }

  private async getAddressForBuyerOrThrow(businessBuyerId: string, addressId: string) {
    const address = await this.prisma.client.businessBuyerAddress.findFirst({
      where: {
        id: addressId,
        businessBuyerId,
      },
    });

    if (!address) {
      throw new ForbiddenException("Address does not belong to this business buyer.");
    }

    return address;
  }

  private async resolveSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
    });

    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }

    return seller;
  }

  private async resolveApprovedSeller(actor: RequestUser) {
    const seller = await this.resolveSeller(actor);

    if (
      seller.status !== SellerStatus.APPROVED ||
      seller.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new ForbiddenException(
        "Seller approval is required before responding to B2B enquiries.",
      );
    }

    return seller;
  }

  private businessBuyerAuditValue(businessBuyer: {
    id: string;
    companyName: string;
    gstNumber?: string | null;
    contactName: string;
    contactPhone: string;
    status: UserStatus;
  }) {
    return {
      id: businessBuyer.id,
      companyName: businessBuyer.companyName,
      gstNumber: businessBuyer.gstNumber ?? null,
      contactName: businessBuyer.contactName,
      contactPhone: businessBuyer.contactPhone,
      status: businessBuyer.status,
    };
  }

  private enquiryAuditValue(enquiry: {
    id: string;
    businessBuyerId: string;
    productId?: string | null;
    sellerId?: string | null;
    quantity: number;
    status: B2BEnquiryStatus;
  }) {
    return {
      id: enquiry.id,
      businessBuyerId: enquiry.businessBuyerId,
      productId: enquiry.productId ?? null,
      sellerId: enquiry.sellerId ?? null,
      quantity: enquiry.quantity,
      status: enquiry.status,
    };
  }

  private b2bOrderAuditValue(order: {
    id: string;
    orderNumber: string;
    enquiryId: string;
    businessBuyerId: string;
    sellerId?: string | null;
    productId?: string | null;
    selectedResponseId?: string | null;
    status: B2BOrderStatus;
    proformaInvoiceNumber: string;
    purchaseOrderNumber?: string | null;
    quantity: number;
    unitPricePaise?: number | null;
    subtotalPaise?: number | null;
  }) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      enquiryId: order.enquiryId,
      businessBuyerId: order.businessBuyerId,
      sellerId: order.sellerId ?? null,
      productId: order.productId ?? null,
      selectedResponseId: order.selectedResponseId ?? null,
      status: order.status,
      proformaInvoiceNumber: order.proformaInvoiceNumber,
      purchaseOrderNumber: order.purchaseOrderNumber ?? null,
      quantity: order.quantity,
      unitPricePaise: order.unitPricePaise ?? null,
      subtotalPaise: order.subtotalPaise ?? null,
    };
  }
}
