import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  ApprovalStatus,
  B2BAdminAction,
  B2BAuditActorType,
  B2BEnquiryStatus,
  B2BOrderStatus,
  B2BPaymentMethod,
  B2BPaymentStatus,
  B2BProofStatus,
  EmailRecipientType,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  PushNotificationType,
  ProductStatus,
  RoleCode,
  SellerStatus,
  SellerSettlementStatus,
  UserStatus,
} from "@indihub/database";
import { Buffer } from "node:buffer";
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
import { ExpoPushService } from "../notifications/expo-push.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { SellerSubscriptionsService } from "../sellers/seller-subscriptions.service";
import {
  StorageService,
  type B2BPaymentProofDocumentAccess,
  type B2BProformaInvoiceDocumentAccess,
  type B2BPurchaseOrderDocumentAccess,
  type B2BTaxInvoiceDocumentAccess,
} from "../storage/storage.service";
import { safeStorageFolderSegment } from "../storage/storage-image";
import { CreateB2BEnquiryDto } from "./dto/b2b-enquiry.dto";
import {
  B2BEnquiryDetailQueryDto,
  SendB2BMessageDto,
} from "./dto/b2b-message.dto";
import {
  B2BAdminReasonDto,
  B2BOrderQueryDto,
  B2BPaymentProofQueryDto,
  CreateB2BPurchaseOrderUploadRequestDto,
  ExtendB2BPaymentDueDateDto,
  IssueB2BRefundDto,
  RecordB2BManualPaymentDto,
  RejectB2BPaymentProofDto,
  SubmitB2BPurchaseOrderDto,
  SubmitB2BPaymentProofDto,
  UpdateB2BOrderStatusDto,
  VerifyB2BPaymentProofDto,
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
  paymentProofs: {
    include: {
      submittedBy: true,
      reviewedBy: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  proformaRevisions: {
    include: {
      generatedBy: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  adminAuditLogs: {
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
  B2BEnquiryStatus.NEGOTIATING,
]);

const responseAllowedB2BStatuses = new Set<B2BEnquiryStatus>([
  B2BEnquiryStatus.SUBMITTED,
  B2BEnquiryStatus.IN_REVIEW,
  B2BEnquiryStatus.RESPONDED,
  B2BEnquiryStatus.NEGOTIATING,
]);

const messageAllowedB2BStatuses = new Set<B2BEnquiryStatus>([
  B2BEnquiryStatus.RESPONDED,
  B2BEnquiryStatus.NEGOTIATING,
]);

const counterpartyVisibleB2BPaymentStatuses = new Set<B2BPaymentStatus>([
  B2BPaymentStatus.PAID,
  B2BPaymentStatus.NOT_REQUIRED,
]);

const buyerConfirmableB2BStatuses = new Set<B2BEnquiryStatus>([
  B2BEnquiryStatus.RESPONDED,
  B2BEnquiryStatus.NEGOTIATING,
]);

const adminB2BStatusTransitions: Partial<Record<B2BEnquiryStatus, B2BEnquiryStatus[]>> = {
  [B2BEnquiryStatus.SUBMITTED]: [
    B2BEnquiryStatus.IN_REVIEW,
    B2BEnquiryStatus.CLOSED,
    B2BEnquiryStatus.CANCELLED,
  ],
  [B2BEnquiryStatus.IN_REVIEW]: [B2BEnquiryStatus.CLOSED, B2BEnquiryStatus.CANCELLED],
  [B2BEnquiryStatus.RESPONDED]: [
    B2BEnquiryStatus.NEGOTIATING,
    B2BEnquiryStatus.IN_REVIEW,
    B2BEnquiryStatus.CLOSED,
    B2BEnquiryStatus.CANCELLED,
  ],
  [B2BEnquiryStatus.NEGOTIATING]: [
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
const b2bPurchaseOrderScanStatus = "NOT_SCANNED" as const;
const b2bMessageNotificationThrottleMinutes = 10;
const defaultB2BCommissionRateBps = 200;
const defaultB2BPaymentDueDays = 7;
const b2bCommissionSettingKey = "b2b.commission.rate_bps";
const b2bFulfilmentPaymentStatuses = new Set<B2BPaymentStatus>([
  B2BPaymentStatus.PAID,
  B2BPaymentStatus.NOT_REQUIRED,
]);
const b2bPaymentTerminalStatuses = new Set<B2BPaymentStatus>([
  B2BPaymentStatus.PAID,
  B2BPaymentStatus.NOT_REQUIRED,
  B2BPaymentStatus.REFUNDED,
]);

type B2BRealtimeBroadcaster = (event: B2BRealtimeEvent) => void;

export type B2BRealtimeMessageEvent = {
  type: "MESSAGE";
  enquiryId: string;
  data: {
    id: string;
    senderUserId: string;
    senderName: string;
    senderRole: "BUYER" | "SELLER" | "ADMIN";
    message: string;
    createdAt: string;
  };
};

export type B2BRealtimeStatusChangedEvent = {
  type: "STATUS_CHANGED";
  enquiryId: string;
  data: {
    previousStatus: B2BEnquiryStatus;
    newStatus: B2BEnquiryStatus;
  };
};

export type B2BRealtimeQuotationAddedEvent = {
  type: "QUOTATION_ADDED";
  enquiryId: string;
  data: {
    responseId: string;
    totalAmountPaise: number | null;
    currency: string;
    createdAt: string;
  };
};

export type B2BRealtimeEvent =
  | B2BRealtimeMessageEvent
  | B2BRealtimeStatusChangedEvent
  | B2BRealtimeQuotationAddedEvent;

export type UploadedB2BPurchaseOrderFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class B2BService {
  private broadcaster: B2BRealtimeBroadcaster | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocationsService) private readonly locationsService: LocationsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ExpoPushService) private readonly expoPush: ExpoPushService,
    @Inject(StorageService) private readonly storageService: StorageService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
    @Optional()
    @Inject(SellerSubscriptionsService)
    private readonly sellerSubscriptions?: SellerSubscriptionsService,
  ) {}

  setBroadcaster(broadcaster: B2BRealtimeBroadcaster) {
    this.broadcaster = broadcaster;
  }

  async canAccessEnquiryRoom(actor: RequestUser, enquiryId: string) {
    if (actor.roles.includes(RoleCode.ADMIN)) {
      return Boolean(
        await this.prisma.client.b2BEnquiry.findUnique({
          where: { id: enquiryId },
          select: { id: true },
        }),
      );
    }

    if (actor.roles.includes(RoleCode.SELLER)) {
      const seller = await this.prisma.client.seller.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      return Boolean(
        seller &&
          (await this.prisma.client.b2BEnquiry.findFirst({
            where: { id: enquiryId, sellerId: seller.id },
            select: { id: true },
          })),
      );
    }

    if (actor.roles.includes(RoleCode.BUSINESS_BUYER)) {
      const businessBuyer = await this.prisma.client.businessBuyer.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      return Boolean(
        businessBuyer &&
          (await this.prisma.client.b2BEnquiry.findFirst({
            where: { id: enquiryId, businessBuyerId: businessBuyer.id },
            select: { id: true },
          })),
      );
    }

    return false;
  }

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
    const idempotencyKey = this.normalizeIdempotencyKey(dto.idempotencyKey);
    const existingIdempotentEnquiry = idempotencyKey
      ? await this.findB2BEnquiryByIdempotencyKey(businessBuyer.id, idempotencyKey)
      : null;
    if (existingIdempotentEnquiry) {
      return existingIdempotentEnquiry;
    }

    const resolved = await this.resolveProductAndSeller(dto);

    let createdNew = true;
    const createdEnquiry = await this.prisma.client.b2BEnquiry.create({
      data: {
        businessBuyerId: businessBuyer.id,
        idempotencyKey,
        productId: resolved.productId,
        sellerId: resolved.sellerId,
        quantity: dto.quantity,
        message: dto.message,
        status: B2BEnquiryStatus.SUBMITTED,
      },
    }).catch(async (error: unknown) => {
      if (idempotencyKey && this.isUniqueConstraintError(error)) {
        const recovered = await this.findB2BEnquiryByIdempotencyKey(businessBuyer.id, idempotencyKey);
        if (recovered) {
          createdNew = false;
          return recovered;
        }
      }
      throw error;
    });
    const enquiry = await this.getEnquiryOrThrow({ id: createdEnquiry.id });

    if (!createdNew) {
      return enquiry;
    }

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
      enquiry.seller
        ? this.expoPush.notifySeller({
            sellerId: enquiry.seller.id,
            templateCode: "SELLER_B2B_ENQUIRY_PUSH",
            eventCode: "seller.b2b.enquiry.received",
            title: "New B2B enquiry",
            body: `${enquiry.businessBuyer.companyName} requested ${enquiry.quantity} units.`,
            data: {
              type: "seller_b2b_enquiry",
              enquiryId: enquiry.id,
              href: `/b2b-enquiries/${enquiry.id}`,
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
    return this.maskB2BEnquiryPageForBuyer(
      await this.listEnquiries(
        { ...this.enquiryWhere(query), businessBuyerId: businessBuyer.id },
        query,
      ),
    );
  }

  async getMyEnquiry(actor: RequestUser, enquiryId: string) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.maskB2BEnquiryForBuyer(await this.getEnquiryOrThrow({
      id: enquiryId,
      businessBuyerId: businessBuyer.id,
    }));
  }

  async getMyEnquiryDetail(
    actor: RequestUser,
    enquiryId: string,
    query: B2BEnquiryDetailQueryDto,
  ) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.maskB2BEnquiryForBuyer(
      await this.getEnquiryDetailOrThrow(
        {
          id: enquiryId,
          businessBuyerId: businessBuyer.id,
        },
        query,
      ),
    );
  }

  async cancelMyEnquiry(actor: RequestUser, enquiryId: string) {
    const enquiry = await this.getMyEnquiry(actor, enquiryId);

    if (!buyerCancellableB2BStatuses.has(enquiry.status)) {
      throw new BadRequestException(
        "Only submitted, in-review, responded, or negotiating enquiries can be cancelled by the buyer.",
      );
    }

    return this.updateEnquiryStatusInternal(
      actor,
      enquiry.id,
      B2BEnquiryStatus.CANCELLED,
      "Business buyer cancelled enquiry.",
    );
  }

  async confirmMyEnquiry(actor: RequestUser, enquiryId: string, responseId?: string) {
    const enquiry = await this.getMyEnquiry(actor, enquiryId);

    if (!buyerConfirmableB2BStatuses.has(enquiry.status)) {
      throw new BadRequestException(
        "A quotation response is required before the buyer can confirm this enquiry.",
      );
    }

    if (!enquiry.responses.length) {
      throw new BadRequestException(
        "At least one seller or admin response is required before confirmation.",
      );
    }

    const latestResponse = this.latestResponse(enquiry.responses);
    if (responseId && latestResponse?.id !== responseId) {
      throw new ConflictException("A newer quotation exists. Please confirm the latest quotation.");
    }

    const updated = await this.updateEnquiryStatusInternal(
      actor,
      enquiry.id,
      B2BEnquiryStatus.BUYER_CONFIRMED,
      "Business buyer confirmed the quotation for admin approval.",
    );
    await this.notifyB2BQuotationConfirmed(updated);
    return updated;
  }

  async listSellerEnquiries(actor: RequestUser, query: B2BEnquiryQueryDto) {
    const seller = await this.resolveSeller(actor);
    return this.maskB2BEnquiryPageForSeller(
      await this.listEnquiries({ ...this.enquiryWhere(query), sellerId: seller.id }, query),
    );
  }

  async getSellerEnquiry(actor: RequestUser, enquiryId: string) {
    const seller = await this.resolveSeller(actor);
    return this.maskB2BEnquiryForSeller(
      await this.getEnquiryDetailOrThrow(
        {
          id: enquiryId,
          sellerId: seller.id,
        },
        {},
      ),
    );
  }

  async getSellerEnquiryDetail(
    actor: RequestUser,
    enquiryId: string,
    query: B2BEnquiryDetailQueryDto,
  ) {
    const seller = await this.resolveSeller(actor);
    return this.maskB2BEnquiryForSeller(
      await this.getEnquiryDetailOrThrow(
        {
          id: enquiryId,
          sellerId: seller.id,
        },
        query,
      ),
    );
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

  async sendMessageAsBuyer(actor: RequestUser, enquiryId: string, dto: SendB2BMessageDto) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    const enquiry = await this.getEnquiryOrThrow({
      id: enquiryId,
      businessBuyerId: businessBuyer.id,
    });

    return this.createMessage(actor, enquiry, dto, "buyer");
  }

  async sendMessageAsSeller(actor: RequestUser, enquiryId: string, dto: SendB2BMessageDto) {
    const seller = await this.resolveApprovedSeller(actor);
    await this.sellerSubscriptions?.ensureCanUseSellerB2B(seller.id);
    const enquiry = await this.getEnquiryOrThrow({
      id: enquiryId,
      sellerId: seller.id,
    });

    return this.createMessage(actor, enquiry, dto, "seller");
  }

  async listAdminEnquiries(query: B2BEnquiryQueryDto) {
    return this.listEnquiries(this.enquiryWhere(query), query);
  }

  async getAdminEnquiry(enquiryId: string) {
    return this.getEnquiryDetailOrThrow({ id: enquiryId }, {});
  }

  async getAdminEnquiryDetail(enquiryId: string, query: B2BEnquiryDetailQueryDto) {
    return this.getEnquiryDetailOrThrow({ id: enquiryId }, query);
  }

  async respondAsAdmin(actor: RequestUser, enquiryId: string, dto: CreateB2BResponseDto) {
    await this.getAdminEnquiry(enquiryId);
    return this.createResponse(actor, enquiryId, dto, "admin");
  }

  async sendMessageAsAdmin(actor: RequestUser, enquiryId: string, dto: SendB2BMessageDto) {
    const enquiry = await this.getEnquiryOrThrow({ id: enquiryId });
    return this.createMessage(actor, enquiry, dto, "admin");
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

  async getAdminB2BAnalytics(query: { from?: string; to?: string }) {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      throw new BadRequestException("Use valid ISO date values for from and to.");
    }
    const createdAt: Prisma.DateTimeFilter = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
    const enquiryWhere: Prisma.B2BEnquiryWhereInput = {
      ...(from || to ? { createdAt } : {}),
    };
    const orderWhere: Prisma.B2BOrderWhereInput = {
      ...(from || to ? { createdAt } : {}),
    };

    const [
      totalEnquiries,
      confirmedOrders,
      orderAggregate,
      messagesByEnquiry,
      statusRows,
      offPlatformRiskCount,
      topBuyerOrders,
      topSellerOrders,
    ] = await Promise.all([
      this.prisma.client.b2BEnquiry.count({ where: enquiryWhere }),
      this.prisma.client.b2BOrder.count({ where: orderWhere }),
      this.prisma.client.b2BOrder.aggregate({
        where: orderWhere,
        _avg: { subtotalPaise: true },
        _sum: { commissionAmountPaise: true, subtotalPaise: true },
      }),
      this.prisma.client.b2BEnquiryMessage.groupBy({
        by: ["enquiryId"],
        where: from || to ? { enquiry: enquiryWhere } : {},
        _count: { id: true },
      }),
      this.prisma.client.b2BEnquiry.groupBy({
        by: ["status"],
        where: enquiryWhere,
        _count: { id: true },
      }),
      this.prisma.client.b2BEnquiry.count({
        where: {
          ...enquiryWhere,
          status: B2BEnquiryStatus.CANCELLED,
          messages: { some: {} },
          b2bOrder: null,
        },
      }),
      this.prisma.client.b2BOrder.groupBy({
        by: ["businessBuyerId"],
        where: orderWhere,
        _sum: { subtotalPaise: true },
        _count: { id: true },
        orderBy: { _sum: { subtotalPaise: "desc" } },
        take: 10,
      }),
      this.prisma.client.b2BOrder.groupBy({
        by: ["sellerId"],
        where: { ...orderWhere, sellerId: { not: null } },
        _sum: { subtotalPaise: true },
        _count: { id: true },
        orderBy: { _sum: { subtotalPaise: "desc" } },
        take: 10,
      }),
    ]);

    const [buyers, sellers] = await Promise.all([
      topBuyerOrders.length
        ? this.prisma.client.businessBuyer.findMany({
            where: { id: { in: topBuyerOrders.map((row) => row.businessBuyerId) } },
            include: { user: true },
          })
        : Promise.resolve([]),
      topSellerOrders.length
        ? this.prisma.client.seller.findMany({
            where: {
              id: {
                in: topSellerOrders
                  .map((row) => row.sellerId)
                  .filter((sellerId): sellerId is string => Boolean(sellerId)),
              },
            },
            include: { user: true },
          })
        : Promise.resolve([]),
    ]);

    const buyersById = new Map(buyers.map((buyer) => [buyer.id, buyer]));
    const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
    const totalMessageCount = messagesByEnquiry.reduce((sum, row) => sum + row._count.id, 0);
    const enquiriesByStatus = Object.values(B2BEnquiryStatus).reduce(
      (accumulator, status) => ({ ...accumulator, [status]: 0 }),
      {} as Record<B2BEnquiryStatus, number>,
    );
    for (const row of statusRows) {
      enquiriesByStatus[row.status] = row._count.id;
    }

    return {
      totalEnquiries,
      confirmedOrders,
      conversionRate: totalEnquiries ? confirmedOrders / totalEnquiries : 0,
      averageOrderValuePaise: Math.round(Number(orderAggregate._avg.subtotalPaise ?? 0)),
      totalCommissionEarnedPaise: orderAggregate._sum.commissionAmountPaise ?? 0,
      totalConfirmedOrderValuePaise: orderAggregate._sum.subtotalPaise ?? 0,
      averageNegotiationMessages: messagesByEnquiry.length
        ? totalMessageCount / messagesByEnquiry.length
        : 0,
      offPlatformRiskCount,
      enquiriesByStatus,
      topBuyers: topBuyerOrders.map((row) => {
        const buyer = buyersById.get(row.businessBuyerId);
        return {
          id: row.businessBuyerId,
          companyName: buyer?.companyName ?? "Business buyer",
          email: buyer?.user.email ?? null,
          confirmedOrderValuePaise: row._sum.subtotalPaise ?? 0,
          orderCount: row._count.id,
        };
      }),
      topSellers: topSellerOrders.map((row) => {
        const seller = row.sellerId ? sellersById.get(row.sellerId) : null;
        return {
          id: row.sellerId,
          storeName: seller?.storeName ?? "Seller",
          email: seller?.user.email ?? null,
          confirmedOrderValuePaise: row._sum.subtotalPaise ?? 0,
          orderCount: row._count.id,
        };
      }),
    };
  }

  async listMyB2BOrders(actor: RequestUser, query: B2BOrderQueryDto) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.maskB2BOrderPageForBuyer(
      await this.withB2BOrderPaymentInstructions(
        await this.listB2BOrders({ ...this.b2bOrderWhere(query), businessBuyerId: businessBuyer.id }, query),
      ),
    );
  }

  async getMyB2BOrder(actor: RequestUser, orderNumber: string) {
    const businessBuyer = await this.getBusinessBuyerForUserOrThrow(actor.id);
    return this.maskB2BOrderForBuyer(
      await this.withB2BOrderPaymentInstructions(
        await this.getB2BOrderOrThrow({
          orderNumber: this.normalizeB2BOrderNumber(orderNumber),
          businessBuyerId: businessBuyer.id,
        }),
      ),
    );
  }

  async createMyPurchaseOrderUploadRequest(
    actor: RequestUser,
    orderNumber: string,
    dto: CreateB2BPurchaseOrderUploadRequestDto,
  ) {
    const order = await this.getMyB2BOrder(actor, orderNumber);
    this.assertBuyerCanEditPurchaseOrder(order.status);

    return this.storageService.createB2BPurchaseOrderUploadRequest(
      {
        businessBuyerId: order.businessBuyerId,
        orderNumber: order.orderNumber,
        actorUserId: actor.id,
      },
      {
        fileName: dto.fileName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
      },
    );
  }

  async uploadMyPurchaseOrderFile(
    actor: RequestUser,
    orderNumber: string,
    file: UploadedB2BPurchaseOrderFile | undefined,
  ) {
    const order = await this.getMyB2BOrder(actor, orderNumber);
    this.assertBuyerCanEditPurchaseOrder(order.status);
    const upload = await this.storageService.saveLocalB2BPurchaseOrder(
      {
        businessBuyerId: order.businessBuyerId,
        orderNumber: order.orderNumber,
        actorUserId: actor.id,
      },
      file,
    );

    return {
      ...upload,
      scanStatus: b2bPurchaseOrderScanStatus,
      orphanCleanupAfterHours: 24,
    };
  }

  async getMyPurchaseOrderDocumentAccess(
    actor: RequestUser,
    orderNumber: string,
  ): Promise<B2BPurchaseOrderDocumentAccess> {
    const order = await this.getMyB2BOrder(actor, orderNumber);
    return this.purchaseOrderDocumentAccessForOrder(order.purchaseOrderFileKey);
  }

  async getMyProformaInvoiceDocumentAccess(
    actor: RequestUser,
    orderNumber: string,
  ): Promise<B2BProformaInvoiceDocumentAccess> {
    const order = await this.getMyB2BOrder(actor, orderNumber);
    return this.proformaInvoiceDocumentAccessForOrder(order);
  }

  async getMyTaxInvoiceDocumentAccess(
    actor: RequestUser,
    orderNumber: string,
  ): Promise<B2BTaxInvoiceDocumentAccess> {
    const order = await this.getMyB2BOrder(actor, orderNumber);
    return this.taxInvoiceDocumentAccessForOrder(order, actor);
  }

  async submitPurchaseOrder(actor: RequestUser, orderNumber: string, dto: SubmitB2BPurchaseOrderDto) {
    const existing = await this.getMyB2BOrder(actor, orderNumber);

    this.assertBuyerCanEditPurchaseOrder(existing.status);
    const purchaseOrderFileKey = dto.purchaseOrderFileKey?.trim() || existing.purchaseOrderFileKey;
    if (!purchaseOrderFileKey) {
      throw new BadRequestException("Upload a purchase order file before submitting PO details.");
    }
    await this.assertB2BPurchaseOrderFileKeyForOrder(actor, existing, purchaseOrderFileKey);
    const previousPurchaseOrderFileKey = existing.purchaseOrderFileKey ?? null;
    const note = dto.note?.trim() || null;

    const submitted = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          status: B2BOrderStatus.PO_SUBMITTED,
          purchaseOrderNumber: dto.purchaseOrderNumber.trim(),
          purchaseOrderFileKey,
          purchaseOrderNote: note,
          purchaseOrderSubmittedAt: new Date(),
        },
      });

      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: updated.id,
          actorUserId: actor.id,
          status: updated.status,
          note: note || "Business buyer submitted purchase order details.",
          payload: {
            purchaseOrderNumber: updated.purchaseOrderNumber,
            previousPurchaseOrderFileKey,
            purchaseOrderFileKey: updated.purchaseOrderFileKey,
            scanStatus: b2bPurchaseOrderScanStatus,
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
            previousPurchaseOrderFileKey,
            purchaseOrderFileKey: updated.purchaseOrderFileKey,
            scanStatus: b2bPurchaseOrderScanStatus,
          },
        },
      });

      return updated;
    });

    const submittedOrder = await this.getB2BOrderOrThrow({ id: submitted.id });
    await this.notifyB2BPurchaseOrderSubmitted(submittedOrder);
    return this.getB2BOrderOrThrow({ id: submitted.id });
  }

  async submitMyB2BPaymentProof(actor: RequestUser, orderNumber: string, dto: SubmitB2BPaymentProofDto) {
    const existing = await this.getMyB2BOrder(actor, orderNumber);
    const referenceNumber = dto.referenceNumber.trim();
    const proofFileKey = dto.proofFileKey.trim();
    const currency = dto.currency.trim().toUpperCase();

    this.assertB2BOrderCanAcceptPayment(existing);
    if (dto.method !== B2BPaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException("Buyer payment proof currently supports bank transfer only.");
    }
    if (currency !== existing.currency) {
      throw new BadRequestException("Currency does not match order currency.");
    }
    await this.assertB2BPaymentProofFileKeyForOrder(actor, existing, proofFileKey);
    await this.assertB2BReferenceAvailable(referenceNumber);

    const overpaymentAmountPaise = Math.max(
      0,
      existing.paidAmountPaise + dto.amountPaise - existing.buyerPayableAmountPaise,
    );

    const proof = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.b2BPaymentProof.create({
        data: {
          b2bOrderId: existing.id,
          method: B2BPaymentMethod.BANK_TRANSFER,
          amountPaise: dto.amountPaise,
          currency,
          overpaymentAmountPaise,
          referenceNumber,
          proofFileKey,
          submittedByUserId: actor.id,
        },
      });

      await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          paymentStatus: B2BPaymentStatus.SUBMITTED_FOR_VERIFICATION,
          paymentMethod: B2BPaymentMethod.BANK_TRANSFER,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "b2b.payment_proof.submitted",
          entityType: "b2b_order",
          entityId: existing.id,
          oldValue: this.b2bOrderAuditValue(existing),
          newValue: {
            orderNumber: existing.orderNumber,
            proofId: created.id,
            paymentStatus: B2BPaymentStatus.SUBMITTED_FOR_VERIFICATION,
            method: created.method,
            amountPaise: created.amountPaise,
            referenceNumber: created.referenceNumber,
            overpaymentAmountPaise: created.overpaymentAmountPaise,
          },
        },
      });

      return created;
    });

    await this.notifyB2BPaymentSubmitted(existing, proof);
    return this.getB2BOrderOrThrow({ id: existing.id });
  }

  async listSellerB2BOrders(actor: RequestUser, query: B2BOrderQueryDto) {
    const seller = await this.resolveSeller(actor);
    return this.maskB2BOrderPageForSeller(
      await this.withB2BOrderPaymentInstructions(
        await this.listB2BOrders({ ...this.b2bOrderWhere(query), sellerId: seller.id }, query),
      ),
    );
  }

  async getSellerB2BOrder(actor: RequestUser, orderNumber: string) {
    const seller = await this.resolveSeller(actor);
    return this.maskB2BOrderForSeller(
      await this.withB2BOrderPaymentInstructions(
        await this.getB2BOrderOrThrow({
          orderNumber: this.normalizeB2BOrderNumber(orderNumber),
          sellerId: seller.id,
        }),
      ),
    );
  }

  async getSellerPurchaseOrderDocumentAccess(
    actor: RequestUser,
    orderNumber: string,
  ): Promise<B2BPurchaseOrderDocumentAccess> {
    const order = await this.getSellerB2BOrder(actor, orderNumber);
    return this.purchaseOrderDocumentAccessForOrder(order.purchaseOrderFileKey);
  }

  async getSellerProformaInvoiceDocumentAccess(
    actor: RequestUser,
    orderNumber: string,
  ): Promise<B2BProformaInvoiceDocumentAccess> {
    const order = await this.getSellerB2BOrder(actor, orderNumber);
    return this.proformaInvoiceDocumentAccessForOrder(order);
  }

  async getSellerTaxInvoiceDocumentAccess(
    actor: RequestUser,
    orderNumber: string,
  ): Promise<B2BTaxInvoiceDocumentAccess> {
    const order = await this.getSellerB2BOrder(actor, orderNumber);
    return this.taxInvoiceDocumentAccessForOrder(order, actor);
  }

  async listAdminB2BOrders(query: B2BOrderQueryDto) {
    return this.withB2BOrderPaymentInstructions(
      await this.listB2BOrders(this.b2bOrderWhere(query), query),
    );
  }

  async getAdminB2BOrder(orderNumber: string) {
    return this.withB2BOrderPaymentInstructions(
      await this.getB2BOrderOrThrow({ orderNumber: this.normalizeB2BOrderNumber(orderNumber) }),
    );
  }

  async getAdminPurchaseOrderDocumentAccess(
    orderNumber: string,
  ): Promise<B2BPurchaseOrderDocumentAccess> {
    const order = await this.getAdminB2BOrder(orderNumber);
    return this.purchaseOrderDocumentAccessForOrder(order.purchaseOrderFileKey);
  }

  async getAdminProformaInvoiceDocumentAccess(
    orderNumber: string,
  ): Promise<B2BProformaInvoiceDocumentAccess> {
    const order = await this.getAdminB2BOrder(orderNumber);
    return this.proformaInvoiceDocumentAccessForOrder(order);
  }

  async getAdminTaxInvoiceDocumentAccess(
    actor: RequestUser,
    orderNumber: string,
  ): Promise<B2BTaxInvoiceDocumentAccess> {
    const order = await this.getAdminB2BOrder(orderNumber);
    return this.taxInvoiceDocumentAccessForOrder(order, actor);
  }

  async getAdminPaymentProofDocumentAccess(proofId: string): Promise<B2BPaymentProofDocumentAccess> {
    const proof = await this.getB2BPaymentProofOrThrow(proofId);
    if (!proof.proofFileKey) {
      throw new NotFoundException("Payment proof file is not attached.");
    }
    return this.storageService.b2bPaymentProofDocumentAccess(proof.proofFileKey);
  }

  async listAdminB2BProformaRevisions(orderNumber: string) {
    const order = await this.getAdminB2BOrder(orderNumber);
    return order.proformaRevisions;
  }

  async listAdminB2BPaymentProofs(query: B2BPaymentProofQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const submittedAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom) {
      submittedAt.gte = new Date(query.dateFrom);
    }
    if (query.dateTo) {
      submittedAt.lte = new Date(query.dateTo);
    }
    const where: Prisma.B2BPaymentProofWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.dateFrom || query.dateTo ? { submittedAt } : {}),
    };

    const items = await this.prisma.client.b2BPaymentProof.findMany({
      where,
      include: {
        submittedBy: true,
        reviewedBy: true,
        order: {
          include: {
            businessBuyer: { include: { user: true } },
            seller: { include: { user: true } },
            product: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      skip,
      take,
    });
    const total = await this.prisma.client.b2BPaymentProof.count({ where });

    return { items, total, page, limit: take };
  }

  async verifyB2BPaymentProofAsAdmin(actor: RequestUser, proofId: string, dto: VerifyB2BPaymentProofDto) {
    const proof = await this.getB2BPaymentProofOrThrow(proofId);
    if (proof.status !== B2BProofStatus.SUBMITTED) {
      throw new BadRequestException("Only submitted payment proofs can be verified.");
    }
    await this.assertB2BReferenceAvailable(proof.referenceNumber, proof.id);

    const updatedOrderId = await this.prisma.client.$transaction(async (tx) => {
      const currentProof = await tx.b2BPaymentProof.findUnique({
        where: { id: proof.id },
        include: { order: true },
      });
      if (!currentProof || currentProof.status !== B2BProofStatus.SUBMITTED) {
        throw new BadRequestException("Payment proof is no longer awaiting verification.");
      }

      const now = new Date();
      const paidAmountPaise = currentProof.order.paidAmountPaise + currentProof.amountPaise;
      const paymentStatus =
        paidAmountPaise >= currentProof.order.buyerPayableAmountPaise
          ? B2BPaymentStatus.PAID
          : B2BPaymentStatus.PARTIALLY_PAID;
      const shouldUnlock = this.canUnlockB2BFulfilment({
        status: currentProof.order.status,
        paymentStatus,
      });

      await tx.b2BPaymentProof.update({
        where: { id: currentProof.id },
        data: {
          status: B2BProofStatus.VERIFIED,
          reviewedByUserId: actor.id,
          reviewedAt: now,
          note: dto.note?.trim() || null,
        },
      });

      const updatedOrder = await tx.b2BOrder.update({
        where: { id: currentProof.order.id },
        data: {
          paidAmountPaise,
          paymentStatus,
          paymentMethod: currentProof.method,
          ...(paymentStatus === B2BPaymentStatus.PAID
            ? {
                paidAt: now,
                paymentVerifiedById: actor.id,
                paymentVerifiedAt: now,
              }
            : {}),
          ...(shouldUnlock
            ? {
                status: B2BOrderStatus.IN_FULFILMENT,
                fulfilmentUnlockedById: actor.id,
                fulfilmentUnlockedAt: now,
                fulfilmentUnlockNote: "Payment verified and PO accepted.",
              }
            : {}),
        },
      });

      if (shouldUnlock) {
        await tx.b2BOrderEvent.create({
          data: {
            b2bOrderId: updatedOrder.id,
            actorUserId: actor.id,
            status: B2BOrderStatus.IN_FULFILMENT,
            note: "Payment verified and PO accepted; fulfilment unlocked.",
          },
        });
      }

      await this.createB2BAdminAuditLog(tx, {
        orderId: currentProof.order.id,
        actor,
        actorType: B2BAuditActorType.FINANCE,
        action: B2BAdminAction.VERIFY_PAYMENT_PROOF,
        reason: dto.note?.trim() || "Payment proof verified.",
        beforeSnapshot: {
          proofStatus: currentProof.status,
          paymentStatus: currentProof.order.paymentStatus,
          paidAmountPaise: currentProof.order.paidAmountPaise,
        },
        afterSnapshot: {
          proofStatus: B2BProofStatus.VERIFIED,
          status: updatedOrder.status,
          paymentStatus: updatedOrder.paymentStatus,
          paidAmountPaise: updatedOrder.paidAmountPaise,
          fulfilmentUnlockedAt: updatedOrder.fulfilmentUnlockedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "b2b.payment_proof.verified",
          entityType: "b2b_order",
          entityId: currentProof.order.id,
          oldValue: this.b2bOrderAuditValue(currentProof.order),
          newValue: {
            ...this.b2bOrderAuditValue(updatedOrder),
            proofId: currentProof.id,
            note: dto.note,
          },
        },
      });

      return currentProof.order.id;
    });

    const order = await this.getB2BOrderOrThrow({ id: updatedOrderId });
    await this.notifyB2BPaymentVerified(order);
    return order;
  }

  async rejectB2BPaymentProofAsAdmin(actor: RequestUser, proofId: string, dto: RejectB2BPaymentProofDto) {
    const reason = dto.rejectionReason.trim();
    const proof = await this.getB2BPaymentProofOrThrow(proofId);
    if (proof.status !== B2BProofStatus.SUBMITTED) {
      throw new BadRequestException("Only submitted payment proofs can be rejected.");
    }

    const updatedOrderId = await this.prisma.client.$transaction(async (tx) => {
      const currentProof = await tx.b2BPaymentProof.findUnique({
        where: { id: proof.id },
        include: { order: true },
      });
      if (!currentProof || currentProof.status !== B2BProofStatus.SUBMITTED) {
        throw new BadRequestException("Payment proof is no longer awaiting verification.");
      }

      const now = new Date();
      const nextPaymentStatus = this.paymentStatusAfterProofRejection(currentProof.order, now);

      await tx.b2BPaymentProof.update({
        where: { id: currentProof.id },
        data: {
          status: B2BProofStatus.REJECTED,
          reviewedByUserId: actor.id,
          reviewedAt: now,
          rejectionReason: reason,
        },
      });

      const updatedOrder = await tx.b2BOrder.update({
        where: { id: currentProof.order.id },
        data: {
          paymentStatus: nextPaymentStatus,
          ...(nextPaymentStatus === B2BPaymentStatus.OVERDUE && !currentProof.order.paymentOverdueAt
            ? { paymentOverdueAt: now }
            : {}),
        },
      });

      await this.createB2BAdminAuditLog(tx, {
        orderId: currentProof.order.id,
        actor,
        actorType: B2BAuditActorType.FINANCE,
        action: B2BAdminAction.REJECT_PAYMENT_PROOF,
        reason,
        beforeSnapshot: {
          proofStatus: currentProof.status,
          paymentStatus: currentProof.order.paymentStatus,
        },
        afterSnapshot: {
          proofStatus: B2BProofStatus.REJECTED,
          paymentStatus: updatedOrder.paymentStatus,
          rejectionReason: reason,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "b2b.payment_proof.rejected",
          entityType: "b2b_order",
          entityId: currentProof.order.id,
          oldValue: this.b2bOrderAuditValue(currentProof.order),
          newValue: {
            ...this.b2bOrderAuditValue(updatedOrder),
            proofId: currentProof.id,
            rejectionReason: reason,
          },
        },
      });

      return currentProof.order.id;
    });

    const order = await this.getB2BOrderOrThrow({ id: updatedOrderId });
    await this.notifyB2BPaymentRejected(order, reason);
    return order;
  }

  async recordB2BManualPaymentAsAdmin(
    actor: RequestUser,
    orderNumber: string,
    dto: RecordB2BManualPaymentDto,
  ) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    this.assertB2BOrderCanAcceptPayment(existing);
    await this.assertB2BReferenceAvailable(dto.referenceNumber.trim());

    const updatedOrderId = await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      const paidAmountPaise = existing.paidAmountPaise + dto.amountPaise;
      const paymentStatus =
        paidAmountPaise >= existing.buyerPayableAmountPaise
          ? B2BPaymentStatus.PAID
          : B2BPaymentStatus.PARTIALLY_PAID;
      const shouldUnlock = this.canUnlockB2BFulfilment({
        status: existing.status,
        paymentStatus,
      });

      const proof = await tx.b2BPaymentProof.create({
        data: {
          b2bOrderId: existing.id,
          method: B2BPaymentMethod.MANUAL,
          amountPaise: dto.amountPaise,
          currency: existing.currency,
          overpaymentAmountPaise: Math.max(0, paidAmountPaise - existing.buyerPayableAmountPaise),
          referenceNumber: dto.referenceNumber.trim(),
          submittedByUserId: actor.id,
          submittedAt: now,
          status: B2BProofStatus.VERIFIED,
          reviewedByUserId: actor.id,
          reviewedAt: now,
          note: dto.note?.trim() || null,
        },
      });

      const updatedOrder = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          paidAmountPaise,
          paymentStatus,
          paymentMethod: B2BPaymentMethod.MANUAL,
          ...(paymentStatus === B2BPaymentStatus.PAID
            ? {
                paidAt: now,
                paymentVerifiedById: actor.id,
                paymentVerifiedAt: now,
              }
            : {}),
          ...(shouldUnlock
            ? {
                status: B2BOrderStatus.IN_FULFILMENT,
                fulfilmentUnlockedById: actor.id,
                fulfilmentUnlockedAt: now,
                fulfilmentUnlockNote: "Manual payment recorded and PO accepted.",
              }
            : {}),
        },
      });

      if (shouldUnlock) {
        await tx.b2BOrderEvent.create({
          data: {
            b2bOrderId: updatedOrder.id,
            actorUserId: actor.id,
            status: B2BOrderStatus.IN_FULFILMENT,
            note: "Manual payment recorded and PO accepted; fulfilment unlocked.",
          },
        });
      }

      await this.createB2BAdminAuditLog(tx, {
        orderId: existing.id,
        actor,
        actorType: B2BAuditActorType.FINANCE,
        action: B2BAdminAction.RECORD_MANUAL_PAYMENT,
        reason: dto.reason.trim(),
        beforeSnapshot: {
          paymentStatus: existing.paymentStatus,
          paidAmountPaise: existing.paidAmountPaise,
        },
        afterSnapshot: {
          proofId: proof.id,
          status: updatedOrder.status,
          paymentStatus: updatedOrder.paymentStatus,
          paidAmountPaise: updatedOrder.paidAmountPaise,
        },
      });

      return existing.id;
    });

    const order = await this.getB2BOrderOrThrow({ id: updatedOrderId });
    if (order.status === B2BOrderStatus.IN_FULFILMENT) {
      await this.notifyB2BFulfilmentUnlocked(order, "Manual payment recorded and PO accepted.");
    }
    return order;
  }

  async extendB2BPaymentDueDateAsAdmin(
    actor: RequestUser,
    orderNumber: string,
    dto: ExtendB2BPaymentDueDateDto,
  ) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    const newDueAt = new Date(dto.newDueAt);
    if (Number.isNaN(newDueAt.getTime())) {
      throw new BadRequestException("newDueAt must be a valid ISO timestamp.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const hasSubmittedProof = await tx.b2BPaymentProof.count({
        where: { b2bOrderId: existing.id, status: B2BProofStatus.SUBMITTED },
      });
      const nextPaymentStatus =
        existing.paymentStatus === B2BPaymentStatus.OVERDUE && hasSubmittedProof > 0
          ? B2BPaymentStatus.SUBMITTED_FOR_VERIFICATION
          : existing.paymentStatus;
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          paymentDueAt: newDueAt,
          paymentStatus: nextPaymentStatus,
          ...(nextPaymentStatus !== B2BPaymentStatus.OVERDUE ? { paymentOverdueAt: null } : {}),
        },
      });

      await this.createB2BAdminAuditLog(tx, {
        orderId: existing.id,
        actor,
        actorType: B2BAuditActorType.ADMIN,
        action: B2BAdminAction.EXTEND_PAYMENT_DUE_DATE,
        reason: dto.reason.trim(),
        beforeSnapshot: {
          paymentDueAt: existing.paymentDueAt.toISOString(),
          paymentStatus: existing.paymentStatus,
        },
        afterSnapshot: {
          paymentDueAt: updated.paymentDueAt.toISOString(),
          paymentStatus: updated.paymentStatus,
        },
      });

      return updated;
    });

    return this.getB2BOrderOrThrow({ id: updated.id });
  }

  async setB2BPaymentNotRequiredAsAdmin(actor: RequestUser, orderNumber: string, dto: B2BAdminReasonDto) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      const shouldUnlock = this.canUnlockB2BFulfilment({
        status: existing.status,
        paymentStatus: B2BPaymentStatus.NOT_REQUIRED,
      });
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          paymentStatus: B2BPaymentStatus.NOT_REQUIRED,
          paymentMethod: B2BPaymentMethod.MANUAL,
          paymentVerifiedById: actor.id,
          paymentVerifiedAt: now,
          ...(shouldUnlock
            ? {
                status: B2BOrderStatus.IN_FULFILMENT,
                fulfilmentUnlockedById: actor.id,
                fulfilmentUnlockedAt: now,
                fulfilmentUnlockNote: dto.reason.trim(),
              }
            : {}),
        },
      });

      if (shouldUnlock) {
        await tx.b2BOrderEvent.create({
          data: {
            b2bOrderId: updated.id,
            actorUserId: actor.id,
            status: B2BOrderStatus.IN_FULFILMENT,
            note: "Payment marked not required and PO accepted; fulfilment unlocked.",
          },
        });
      }

      await this.createB2BAdminAuditLog(tx, {
        orderId: existing.id,
        actor,
        actorType: B2BAuditActorType.ADMIN,
        action: B2BAdminAction.SET_NOT_REQUIRED,
        reason: dto.reason.trim(),
        beforeSnapshot: { paymentStatus: existing.paymentStatus },
        afterSnapshot: {
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          fulfilmentUnlockedAt: updated.fulfilmentUnlockedAt,
        },
      });

      return updated;
    });

    const refreshed = await this.getB2BOrderOrThrow({ id: updated.id });
    await this.notifyB2BPaymentNotRequired(refreshed, dto.reason.trim());
    if (refreshed.status === B2BOrderStatus.IN_FULFILMENT) {
      await this.notifyB2BFulfilmentUnlocked(refreshed, dto.reason.trim());
    }
    return refreshed;
  }

  async unlockB2BFulfilmentAsAdmin(actor: RequestUser, orderNumber: string, dto: B2BAdminReasonDto) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    if (existing.status !== B2BOrderStatus.PO_ACCEPTED) {
      throw new BadRequestException("PO must be accepted before fulfilment can be unlocked.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          status: B2BOrderStatus.IN_FULFILMENT,
          fulfilmentUnlockedById: actor.id,
          fulfilmentUnlockedAt: now,
          fulfilmentUnlockNote: dto.reason.trim(),
        },
      });

      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: existing.id,
          actorUserId: actor.id,
          status: B2BOrderStatus.IN_FULFILMENT,
          note: dto.reason.trim(),
        },
      });

      await this.createB2BAdminAuditLog(tx, {
        orderId: existing.id,
        actor,
        actorType: B2BAuditActorType.ADMIN,
        action: B2BAdminAction.UNLOCK_FULFILMENT,
        reason: dto.reason.trim(),
        beforeSnapshot: {
          status: existing.status,
          paymentStatus: existing.paymentStatus,
        },
        afterSnapshot: {
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          fulfilmentUnlockedAt: updated.fulfilmentUnlockedAt,
        },
      });

      return updated;
    });

    return this.getB2BOrderOrThrow({ id: updated.id });
  }

  async cancelB2BOrderAsAdmin(actor: RequestUser, orderNumber: string, dto: B2BAdminReasonDto) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    if (existing.status === B2BOrderStatus.CANCELLED) {
      throw new BadRequestException("B2B order is already cancelled.");
    }
    if (existing.status === B2BOrderStatus.FULFILLED) {
      throw new BadRequestException("Fulfilled B2B orders cannot be cancelled from this endpoint.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: { status: B2BOrderStatus.CANCELLED },
      });

      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: updated.id,
          actorUserId: actor.id,
          status: updated.status,
          note: dto.reason.trim(),
        },
      });

      await this.createB2BAdminAuditLog(tx, {
        orderId: existing.id,
        actor,
        actorType: B2BAuditActorType.ADMIN,
        action: B2BAdminAction.CANCEL_OVERDUE_ORDER,
        reason: dto.reason.trim(),
        beforeSnapshot: {
          status: existing.status,
          paymentStatus: existing.paymentStatus,
        },
        afterSnapshot: {
          status: updated.status,
          paymentStatus: updated.paymentStatus,
        },
      });

      return updated;
    });

    return this.getB2BOrderOrThrow({ id: updated.id });
  }

  async issueB2BRefundAsAdmin(actor: RequestUser, orderNumber: string, dto: IssueB2BRefundDto) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    if (existing.paidAmountPaise <= 0) {
      throw new BadRequestException("This B2B order has no verified payment to refund.");
    }
    if (dto.amountPaise > existing.paidAmountPaise) {
      throw new BadRequestException("Refund amount cannot exceed the verified paid amount.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const nextPaidAmountPaise = Math.max(0, existing.paidAmountPaise - dto.amountPaise);
      const nextPaymentStatus =
        nextPaidAmountPaise === 0 ? B2BPaymentStatus.REFUNDED : existing.paymentStatus;
      const refundProof = await tx.b2BPaymentProof.create({
        data: {
          b2bOrderId: existing.id,
          method: existing.paymentMethod ?? B2BPaymentMethod.MANUAL,
          amountPaise: -dto.amountPaise,
          currency: existing.currency,
          referenceNumber: `B2B-REFUND-${existing.orderNumber}-${Date.now()}`,
          submittedByUserId: actor.id,
          submittedAt: new Date(),
          status: B2BProofStatus.VERIFIED,
          reviewedByUserId: actor.id,
          reviewedAt: new Date(),
          note: dto.reason.trim(),
        },
      });

      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          paidAmountPaise: nextPaidAmountPaise,
          paymentStatus: nextPaymentStatus,
        },
      });

      await this.createB2BAdminAuditLog(tx, {
        orderId: existing.id,
        actor,
        actorType: B2BAuditActorType.FINANCE,
        action: B2BAdminAction.ISSUE_REFUND,
        reason: dto.reason.trim(),
        beforeSnapshot: {
          paymentStatus: existing.paymentStatus,
          paidAmountPaise: existing.paidAmountPaise,
        },
        afterSnapshot: {
          proofId: refundProof.id,
          paymentStatus: updated.paymentStatus,
          paidAmountPaise: updated.paidAmountPaise,
          refundAmountPaise: dto.amountPaise,
        },
      });

      return updated;
    });

    return this.getB2BOrderOrThrow({ id: updated.id });
  }

  async regenerateB2BProformaAsAdmin(actor: RequestUser, orderNumber: string, dto: B2BAdminReasonDto) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    const beforeSnapshot = {
      proformaInvoiceFileKey: existing.proformaInvoiceFileKey,
      proformaIssuedAt: existing.proformaIssuedAt.toISOString(),
      proformaExpiresAt: existing.proformaExpiresAt?.toISOString() ?? null,
    };

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 15 * 24 * 60 * 60 * 1000);
    const fileKey = await this.generateAndStoreB2BProformaInvoice(
      {
        ...existing,
        proformaIssuedAt: issuedAt,
        proformaExpiresAt: expiresAt,
      },
      actor,
      dto.reason.trim(),
    );

    const updated = await this.prisma.client.$transaction(async (tx) => {
      if (existing.proformaInvoiceFileKey) {
        await tx.b2BProformaInvoiceRevision.create({
          data: {
            b2bOrderId: existing.id,
            invoiceNumber: existing.proformaInvoiceNumber,
            fileKey: existing.proformaInvoiceFileKey,
            issuedAt: existing.proformaIssuedAt,
            expiresAt: existing.proformaExpiresAt,
            generatedByUserId: actor.id,
            reason: dto.reason.trim(),
          },
        });
      }

      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          proformaInvoiceFileKey: fileKey,
          proformaIssuedAt: issuedAt,
          proformaExpiresAt: expiresAt,
        },
      });

      await this.createB2BAdminAuditLog(tx, {
        orderId: existing.id,
        actor,
        actorType: B2BAuditActorType.ADMIN,
        action: B2BAdminAction.REGENERATE_PROFORMA,
        reason: dto.reason.trim(),
        beforeSnapshot,
        afterSnapshot: {
          proformaInvoiceFileKey: updated.proformaInvoiceFileKey,
          proformaIssuedAt: updated.proformaIssuedAt.toISOString(),
          proformaExpiresAt: updated.proformaExpiresAt?.toISOString() ?? null,
        },
      });

      return updated;
    });

    return this.getB2BOrderOrThrow({ id: updated.id });
  }

  async updateB2BOrderStatusAsAdmin(actor: RequestUser, orderNumber: string, dto: UpdateB2BOrderStatusDto) {
    const existing = await this.getAdminB2BOrder(orderNumber);
    this.assertB2BOrderStatusTransition(existing.status, dto.status);
    if (dto.status === B2BOrderStatus.IN_FULFILMENT && !this.canUnlockB2BFulfilment(existing)) {
      throw new BadRequestException(
        "Fulfilment requires PO accepted and payment status PAID or NOT_REQUIRED. Use admin unlock with a reason for an override.",
      );
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      const shouldUnlockAfterPoAccepted = this.canUnlockB2BFulfilment({
        status: dto.status,
        paymentStatus: existing.paymentStatus,
      });
      const updated = await tx.b2BOrder.update({
        where: { id: existing.id },
        data: {
          status: shouldUnlockAfterPoAccepted ? B2BOrderStatus.IN_FULFILMENT : dto.status,
          ...(dto.status === B2BOrderStatus.PO_ACCEPTED ? { purchaseOrderAcceptedAt: now } : {}),
          ...(dto.status === B2BOrderStatus.IN_FULFILMENT || shouldUnlockAfterPoAccepted
            ? {
                fulfilmentUnlockedAt: existing.fulfilmentUnlockedAt ?? now,
                fulfilmentUnlockNote: existing.fulfilmentUnlockNote ?? "PO accepted and payment cleared.",
              }
            : {}),
          ...(dto.status === B2BOrderStatus.FULFILLED ? { fulfilledAt: now } : {}),
          ...(dto.status === B2BOrderStatus.FULFILLED && existing.paymentStatus === B2BPaymentStatus.PAID
            ? {
                settlementStatus: SellerSettlementStatus.ELIGIBLE,
                settlementEligibleAt: existing.settlementEligibleAt ?? now,
              }
            : {}),
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

      if (updated.status === B2BOrderStatus.FULFILLED) {
        await tx.auditLog.create({
          data: {
            actor: { connect: { id: actor.id } },
            action: "b2b.payout.eligible",
            entityType: "b2b_order",
            entityId: updated.id,
            oldValue: {
              settlementStatus: existing.settlementStatus,
              status: existing.status,
              paymentStatus: existing.paymentStatus,
            },
            newValue: {
              settlementStatus: updated.settlementStatus,
              sellerPayoutAmountPaise: updated.sellerPayoutAmountPaise,
            },
          },
        });
      }

      return updated;
    });

    const refreshed = await this.getB2BOrderOrThrow({ id: updated.id });
    if (dto.status === B2BOrderStatus.PO_ACCEPTED) {
      await this.notifyB2BPurchaseOrderAccepted(refreshed);
    }
    if (refreshed.status === B2BOrderStatus.IN_FULFILMENT && existing.status === B2BOrderStatus.PO_SUBMITTED) {
      await this.notifyB2BFulfilmentUnlocked(refreshed, "PO accepted and payment cleared.");
    }
    if (updated.status === B2BOrderStatus.FULFILLED) {
      await this.notifyB2BOrderFulfilled(refreshed);
      await this.notifyB2BPayoutEligible(refreshed);
    }
    return this.withB2BOrderPaymentInstructions(refreshed);
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

  private maskB2BEnquiryPageForBuyer<T extends { items: unknown[] }>(page: T) {
    return {
      ...page,
      items: page.items.map((item) => this.maskB2BEnquiryForBuyer(item)),
    };
  }

  private maskB2BEnquiryPageForSeller<T extends { items: unknown[] }>(page: T) {
    return {
      ...page,
      items: page.items.map((item) => this.maskB2BEnquiryForSeller(item)),
    };
  }

  private maskB2BOrderPageForBuyer<T extends { items: unknown[] }>(page: T) {
    return {
      ...page,
      items: page.items.map((item) => this.maskB2BOrderForBuyer(item)),
    };
  }

  private maskB2BOrderPageForSeller<T extends { items: unknown[] }>(page: T) {
    return {
      ...page,
      items: page.items.map((item) => this.maskB2BOrderForSeller(item)),
    };
  }

  private maskB2BEnquiryForBuyer<T>(enquiry: T): T {
    const value = enquiry as T & {
      seller?: Record<string, unknown> | null;
      b2bOrder?: { paymentStatus?: B2BPaymentStatus | null } | null;
      responses?: unknown;
    };
    if (this.canViewB2BCounterpartyDetails(value.b2bOrder)) {
      return enquiry;
    }

    return {
      ...value,
      seller: this.maskSellerForBuyer(value.seller),
      responses: this.maskB2BResponseResponders(value),
      b2bOrder: value.b2bOrder ? this.maskB2BOrderForBuyer(value.b2bOrder) : value.b2bOrder,
    } as T;
  }

  private maskB2BEnquiryForSeller<T>(enquiry: T): T {
    const value = enquiry as T & {
      businessBuyer?: Record<string, unknown> | null;
      b2bOrder?: { paymentStatus?: B2BPaymentStatus | null } | null;
      responses?: unknown;
    };
    if (this.canViewB2BCounterpartyDetails(value.b2bOrder)) {
      return enquiry;
    }

    return {
      ...value,
      businessBuyer: this.maskBusinessBuyerForSeller(value.businessBuyer),
      responses: this.maskB2BResponseResponders(value),
      b2bOrder: value.b2bOrder ? this.maskB2BOrderForSeller(value.b2bOrder) : value.b2bOrder,
    } as T;
  }

  private maskB2BOrderForBuyer<T>(order: T): T {
    const value = order as T & {
      seller?: Record<string, unknown> | null;
      enquiry?: Record<string, unknown> | null;
      paymentStatus?: B2BPaymentStatus | null;
    };
    if (this.canViewB2BCounterpartyDetails(value)) {
      return order;
    }

    return {
      ...value,
      seller: this.maskSellerForBuyer(value.seller),
      enquiry: value.enquiry
        ? {
            ...value.enquiry,
            seller: this.maskSellerForBuyer((value.enquiry as { seller?: Record<string, unknown> | null }).seller),
            responses: this.maskB2BResponseResponders(value.enquiry),
          }
        : value.enquiry,
    } as T;
  }

  private maskB2BOrderForSeller<T>(order: T): T {
    const value = order as T & {
      businessBuyer?: Record<string, unknown> | null;
      enquiry?: Record<string, unknown> | null;
      paymentStatus?: B2BPaymentStatus | null;
    };
    if (this.canViewB2BCounterpartyDetails(value)) {
      return order;
    }

    return {
      ...value,
      businessBuyer: this.maskBusinessBuyerForSeller(value.businessBuyer),
      enquiry: value.enquiry
        ? {
            ...value.enquiry,
            businessBuyer: this.maskBusinessBuyerForSeller(
              (value.enquiry as { businessBuyer?: Record<string, unknown> | null }).businessBuyer,
            ),
            responses: this.maskB2BResponseResponders(value.enquiry),
          }
        : value.enquiry,
    } as T;
  }

  private canViewB2BCounterpartyDetails(value?: { paymentStatus?: B2BPaymentStatus | null } | null) {
    return Boolean(value?.paymentStatus && counterpartyVisibleB2BPaymentStatuses.has(value.paymentStatus));
  }

  private maskSellerForBuyer(seller?: Record<string, unknown> | null) {
    if (!seller) {
      return seller;
    }
    const profile = seller.profile && typeof seller.profile === "object"
      ? (seller.profile as Record<string, unknown>)
      : null;

    return {
      id: seller.id,
      storeName: seller.storeName,
      status: seller.status,
      approvalStatus: seller.approvalStatus,
      profile: profile
        ? {
            logoUrl: profile.logoUrl ?? null,
          }
        : null,
      addresses: [],
      user: null,
      gstNumber: null,
      commissionType: seller.commissionType,
      commissionValue: seller.commissionValue,
    };
  }

  private maskBusinessBuyerForSeller(buyer?: Record<string, unknown> | null) {
    if (!buyer) {
      return buyer;
    }

    return {
      id: buyer.id,
      companyName: buyer.companyName,
      contactName: buyer.contactName,
      status: buyer.status,
      gstNumber: null,
      contactPhone: null,
      user: null,
      addresses: [],
    };
  }

  private maskB2BResponseResponders(value: { responses?: unknown }) {
    if (!Array.isArray(value.responses)) {
      return value.responses;
    }

    return value.responses.map((response) => {
      if (!response || typeof response !== "object") {
        return response;
      }
      return {
        ...(response as Record<string, unknown>),
        responder: null,
      };
    });
  }

  private async withB2BOrderPaymentInstructions<T extends { buyerPayableAmountPaise?: number | null }>(
    order: T,
  ): Promise<T & { paymentInstructions: { bankTransfer: Awaited<ReturnType<PaymentsService["b2bBankTransferInstructions"]>> } }>;
  private async withB2BOrderPaymentInstructions<
    T extends { items: Array<{ buyerPayableAmountPaise?: number | null }> },
  >(
    page: T,
  ): Promise<
    Omit<T, "items"> & {
      items: Array<
        T["items"][number] & {
          paymentInstructions: { bankTransfer: Awaited<ReturnType<PaymentsService["b2bBankTransferInstructions"]>> };
        }
      >;
    }
  >;
  private async withB2BOrderPaymentInstructions(
    value:
      | { buyerPayableAmountPaise?: number | null }
      | { items: Array<{ buyerPayableAmountPaise?: number | null }> },
  ) {
    if ("items" in value) {
      return {
        ...value,
        items: await Promise.all(
          value.items.map((order) => this.withB2BOrderPaymentInstructions(order)),
        ),
      };
    }

    return {
      ...value,
      paymentInstructions: {
        bankTransfer: await this.paymentsService.b2bBankTransferInstructions(
          value.buyerPayableAmountPaise ?? 0,
        ),
      },
    };
  }

  private async getEnquiryDetailOrThrow(
    where: Prisma.B2BEnquiryWhereInput,
    query: B2BEnquiryDetailQueryDto,
  ) {
    const enquiry = await this.getEnquiryOrThrow(where);
    const messagePage = await this.messagePage(enquiry.id, query);

    return {
      ...enquiry,
      messages: messagePage,
    };
  }

  async createMyPaymentProofUploadRequest(
    actor: RequestUser,
    orderNumber: string,
    dto: CreateB2BPurchaseOrderUploadRequestDto,
  ) {
    const order = await this.getMyB2BOrder(actor, orderNumber);
    this.assertB2BOrderCanAcceptPayment(order);

    return this.storageService.createB2BPaymentProofUploadRequest(
      {
        businessBuyerId: order.businessBuyerId,
        orderNumber: order.orderNumber,
        actorUserId: actor.id,
      },
      {
        fileName: dto.fileName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
      },
    );
  }

  async uploadMyPaymentProofFile(
    actor: RequestUser,
    orderNumber: string,
    file: UploadedB2BPurchaseOrderFile | undefined,
  ) {
    const order = await this.getMyB2BOrder(actor, orderNumber);
    this.assertB2BOrderCanAcceptPayment(order);
    const upload = await this.storageService.saveLocalB2BPaymentProof(
      {
        businessBuyerId: order.businessBuyerId,
        orderNumber: order.orderNumber,
        actorUserId: actor.id,
      },
      file,
    );

    return {
      ...upload,
      scanStatus: b2bPurchaseOrderScanStatus,
      orphanCleanupAfterHours: 24,
    };
  }

  private async messagePage(enquiryId: string, query: B2BEnquiryDetailQueryDto) {
    const take = Math.min(Math.max(query.messageLimit ?? 50, 1), 100);
    const cursor = query.messageCursor ? new Date(query.messageCursor) : null;
    if (cursor && Number.isNaN(cursor.getTime())) {
      throw new BadRequestException("messageCursor must be a valid ISO timestamp.");
    }
    const where: Prisma.B2BEnquiryMessageWhereInput = {
      enquiryId,
      ...(cursor ? { createdAt: { lt: cursor } } : {}),
    };
    const items = await this.prisma.client.b2BEnquiryMessage.findMany({
      where,
      include: { sender: true },
      orderBy: { createdAt: "desc" },
      take: take + 1,
    });
    const hasNextPage = items.length > take;
    const pageItems = hasNextPage ? items.slice(0, take) : items;
    const oldest = pageItems[pageItems.length - 1];

    return {
      items: pageItems,
      nextCursor: hasNextPage && oldest ? oldest.createdAt.toISOString() : null,
    };
  }

  private b2bOrderWhere(query: B2BOrderQueryDto): Prisma.B2BOrderWhereInput {
    const search = query.search?.trim();
    const status = this.normalizeB2BOrderStatus(query.status);

    return {
      ...(status ? { status } : {}),
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

  private normalizeB2BOrderStatus(status?: B2BOrderStatus | "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED") {
    if (status === "PENDING") {
      return B2BOrderStatus.PROFORMA_ISSUED;
    }
    if (status === "PROCESSING" || status === "SHIPPED") {
      return B2BOrderStatus.IN_FULFILMENT;
    }
    if (status === "DELIVERED") {
      return B2BOrderStatus.FULFILLED;
    }
    return status;
  }

  private enquiryWhere(query: B2BEnquiryQueryDto): Prisma.B2BEnquiryWhereInput {
    const search = query.search?.trim();
    const status = this.normalizeEnquiryStatus(query.status);

    return {
      ...(status ? { status } : {}),
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

  private normalizeEnquiryStatus(status?: B2BEnquiryStatus | "PENDING") {
    return status === "PENDING" ? B2BEnquiryStatus.SUBMITTED : status;
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
          status:
            existing.status === B2BEnquiryStatus.NEGOTIATING
              ? B2BEnquiryStatus.NEGOTIATING
              : B2BEnquiryStatus.RESPONDED,
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
    this.emitQuotationAdded(enquiry.id, {
      responseId: response.id,
      totalAmountPaise:
        response.quotedPricePaise === null || response.quotedPricePaise === undefined
          ? null
          : response.quotedPricePaise * enquiry.quantity,
      currency: "INR",
      createdAt: response.createdAt.toISOString(),
    });
    if (existing.status !== enquiry.status) {
      this.emitStatusChanged(enquiry.id, existing.status, enquiry.status);
    }
    await this.notifyB2BQuotation(enquiry, response, source);

    return enquiry;
  }

  private async createMessage(
    actor: RequestUser,
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
    dto: SendB2BMessageDto,
    source: "admin" | "buyer" | "seller",
  ) {
    const message = dto.message.trim();
    if (!message) {
      throw new BadRequestException("Message is required.");
    }
    if (!messageAllowedB2BStatuses.has(enquiry.status)) {
      throw new ForbiddenException("Messages can only be sent while the enquiry is open for negotiation.");
    }

    const previousStatus = enquiry.status;
    const result = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.b2BEnquiryMessage.create({
        data: {
          enquiryId: enquiry.id,
          senderUserId: actor.id,
          message,
        },
        include: {
          sender: true,
        },
      });

      const nextStatus =
        enquiry.status === B2BEnquiryStatus.RESPONDED
          ? B2BEnquiryStatus.NEGOTIATING
          : enquiry.status;
      if (nextStatus !== enquiry.status) {
        await tx.b2BEnquiry.update({
          where: { id: enquiry.id },
          data: { status: nextStatus },
        });
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: `b2b.enquiry.message_${source}`,
          entityType: "b2b_enquiry",
          entityId: enquiry.id,
          newValue: {
            messageId: created.id,
            previousStatus,
            status: nextStatus,
          },
        },
      });

      return { created, nextStatus };
    });

    this.emitMessage(enquiry.id, result.created, this.senderRole(source));
    if (result.nextStatus !== previousStatus) {
      this.emitStatusChanged(enquiry.id, previousStatus, result.nextStatus);
    }

    const refreshed = await this.getEnquiryOrThrow({ id: enquiry.id });
    await this.notifyB2BMessage(refreshed, result.created, source);

    return {
      id: result.created.id,
      enquiryId: result.created.enquiryId,
      senderUserId: result.created.senderUserId,
      sender: result.created.sender,
      message: result.created.message,
      createdAt: result.created.createdAt,
      updatedAt: result.created.updatedAt,
    };
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

    this.emitStatusChanged(enquiry.id, existing.status, enquiry.status);
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
        (buyerConfirmableB2BStatuses.has(current) &&
          next === B2BEnquiryStatus.BUYER_CONFIRMED) ||
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

  private normalizeIdempotencyKey(value: string | undefined) {
    const key = value?.trim();
    return key || null;
  }

  private findB2BEnquiryByIdempotencyKey(businessBuyerId: string, idempotencyKey: string) {
    return this.prisma.client.b2BEnquiry.findFirst({
      where: {
        businessBuyerId,
        idempotencyKey,
      },
      include: enquiryInclude,
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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
    const commissionRateBps = await this.resolveB2BCommissionRateBps(enquiry);
    const commissionAmountPaise =
      subtotalPaise === null ? 0 : Math.floor((subtotalPaise * commissionRateBps) / 10_000);
    const sellerPayoutAmountPaise =
      subtotalPaise === null ? 0 : Math.max(0, subtotalPaise - commissionAmountPaise);
    const buyerPayableAmountPaise = subtotalPaise ?? 0;
    const orderNumber = await this.createUniqueB2BOrderNumber();
    const proformaInvoiceNumber = await this.createUniqueProformaInvoiceNumber();
    const proformaExpiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const paymentDueAt = new Date(Date.now() + defaultB2BPaymentDueDays * 24 * 60 * 60 * 1000);

    const createdOrder = await this.prisma.client.$transaction(async (tx) => {
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
          commissionRateBps,
          commissionAmountPaise,
          sellerPayoutAmountPaise,
          currency: "INR",
          paymentStatus: B2BPaymentStatus.PENDING,
          buyerPayableAmountPaise,
          paymentDueAt,
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
            buyerPayableAmountPaise,
            commissionRateBps,
            commissionAmountPaise,
            sellerPayoutAmountPaise,
            paymentTerms: "Bank transfer or finance-recorded manual payment; PO acceptance and cleared payment required before fulfilment.",
            paymentDueAt: paymentDueAt.toISOString(),
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
            paymentDueAt: b2bOrder.paymentDueAt.toISOString(),
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

    const hydratedOrder = await this.getB2BOrderOrThrow({ id: createdOrder.id });
    const fileKey = await this.generateAndStoreB2BProformaInvoice(
      hydratedOrder,
      null,
      "System generated at order creation.",
    );
    const orderWithProforma = await this.prisma.client.b2BOrder.update({
      where: { id: createdOrder.id },
      data: { proformaInvoiceFileKey: fileKey },
    });
    const notifiedOrder = await this.getB2BOrderOrThrow({ id: orderWithProforma.id });
    await this.notifyB2BOrderCreated(notifiedOrder);
    return notifiedOrder;
  }

  private async generateAndStoreB2BProformaInvoice(
    order: {
      id: string;
      orderNumber: string;
      businessBuyerId: string;
      proformaInvoiceNumber: string;
      proformaIssuedAt: Date;
      proformaExpiresAt?: Date | null;
      paymentDueAt: Date;
      quantity: number;
      unitPricePaise?: number | null;
      subtotalPaise?: number | null;
      buyerPayableAmountPaise: number;
      commissionRateBps: number;
      commissionAmountPaise: number;
      sellerPayoutAmountPaise: number;
      currency: string;
      product?: { name?: string | null } | null;
      seller?: { storeName?: string | null; gstNumber?: string | null } | null;
      businessBuyer?: { companyName?: string | null; gstNumber?: string | null } | null;
    },
    actor: RequestUser | null,
    reason: string,
  ) {
    const lines = [
      "1HandIndia Proforma Invoice",
      "This is not a tax invoice.",
      `Proforma No: ${order.proformaInvoiceNumber}`,
      `Order No: ${order.orderNumber}`,
      `Issued: ${this.proformaDate(order.proformaIssuedAt)}`,
      `Expires: ${this.proformaDate(order.proformaExpiresAt)}`,
      `Payment Due: ${this.proformaDate(order.paymentDueAt)}`,
      "",
      `Buyer: ${order.businessBuyer?.companyName ?? "Business buyer"}`,
      `Buyer GSTIN: ${order.businessBuyer?.gstNumber ?? "Not provided"}`,
      `Seller: ${order.seller?.storeName ?? "Seller"}`,
      `Seller GSTIN: ${order.seller?.gstNumber ?? "Not provided"}`,
      "",
      `Line item: ${order.product?.name ?? order.seller?.storeName ?? "B2B procurement"}`,
      `Quantity: ${order.quantity}`,
      `Unit price: ${this.moneyForPdf(order.unitPricePaise ?? 0, order.currency)}`,
      `Subtotal: ${this.moneyForPdf(order.subtotalPaise ?? order.buyerPayableAmountPaise, order.currency)}`,
      `Buyer payable: ${this.moneyForPdf(order.buyerPayableAmountPaise, order.currency)}`,
      "",
      `Platform commission: ${order.commissionRateBps} bps / ${this.moneyForPdf(order.commissionAmountPaise, order.currency)}`,
      `Seller payout after commission: ${this.moneyForPdf(order.sellerPayoutAmountPaise, order.currency)}`,
      "",
      "Bank transfer details are shown in the B2B order payment section.",
      `Generated reason: ${reason}`,
    ];
    const pdf = this.simplePdf(lines);
    const upload = await this.storageService.saveB2BProformaInvoicePdf(
      {
        businessBuyerId: order.businessBuyerId,
        orderNumber: order.orderNumber,
        actorUserId: actor?.id ?? null,
      },
      { fileName: `${order.proformaInvoiceNumber}.pdf` },
      pdf,
    );

    return upload.assetKey;
  }

  private async generateAndStoreB2BTaxInvoice(
    order: {
      orderNumber: string;
      businessBuyerId: string;
      taxInvoiceNumber: string;
      taxInvoiceIssuedAt: Date;
      fulfilledAt?: Date | null;
      paidAt?: Date | null;
      paidAmountPaise: number;
      buyerPayableAmountPaise: number;
      quantity: number;
      unitPricePaise?: number | null;
      subtotalPaise?: number | null;
      commissionRateBps: number;
      commissionAmountPaise: number;
      sellerPayoutAmountPaise: number;
      currency: string;
      purchaseOrderNumber?: string | null;
      product?: { name?: string | null } | null;
      businessBuyer?: { companyName?: string | null; gstNumber?: string | null } | null;
      seller?: { storeName?: string | null; gstNumber?: string | null } | null;
    },
    actor: RequestUser | null,
  ) {
    const lines = [
      "1HandIndia Final Tax Invoice",
      "Server generated B2B tax invoice.",
      `Invoice No: ${order.taxInvoiceNumber}`,
      `Order No: ${order.orderNumber}`,
      `Issued: ${this.proformaDate(order.taxInvoiceIssuedAt)}`,
      `Fulfilled: ${this.proformaDate(order.fulfilledAt)}`,
      `Paid: ${this.proformaDate(order.paidAt)}`,
      `Purchase Order: ${order.purchaseOrderNumber ?? "Not provided"}`,
      "",
      `Buyer: ${order.businessBuyer?.companyName ?? "Business buyer"}`,
      `Buyer GSTIN: ${order.businessBuyer?.gstNumber ?? "Not provided"}`,
      `Seller: ${order.seller?.storeName ?? "Seller"}`,
      `Seller GSTIN: ${order.seller?.gstNumber ?? "Not provided"}`,
      "",
      `Line item: ${order.product?.name ?? order.seller?.storeName ?? "B2B procurement"}`,
      `Quantity: ${order.quantity}`,
      `Unit price: ${this.moneyForPdf(order.unitPricePaise ?? 0, order.currency)}`,
      `Subtotal: ${this.moneyForPdf(order.subtotalPaise ?? order.buyerPayableAmountPaise, order.currency)}`,
      `Buyer payable: ${this.moneyForPdf(order.buyerPayableAmountPaise, order.currency)}`,
      `Paid amount: ${this.moneyForPdf(order.paidAmountPaise, order.currency)}`,
      "",
      `Platform commission deducted from seller: ${order.commissionRateBps} bps / ${this.moneyForPdf(
        order.commissionAmountPaise,
        order.currency,
      )}`,
      `Seller payout after commission: ${this.moneyForPdf(order.sellerPayoutAmountPaise, order.currency)}`,
    ];
    const pdf = this.simplePdf(lines);
    const upload = await this.storageService.saveB2BTaxInvoicePdf(
      {
        businessBuyerId: order.businessBuyerId,
        orderNumber: order.orderNumber,
        actorUserId: actor?.id ?? null,
      },
      { fileName: `${order.taxInvoiceNumber}.pdf` },
      pdf,
    );

    return upload.assetKey;
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

  private latestResponse<T extends { createdAt: Date }>(responses: T[]) {
    return [...responses].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
  }

  private async resolveB2BCommissionRateBps(
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
  ) {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key: b2bCommissionSettingKey },
      select: { value: true },
    });
    const raw = setting?.value;
    const configured =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim()
          ? Number(raw.trim())
          : Number.NaN;
    const fallback = enquiry.seller?.commissionValue ?? defaultB2BCommissionRateBps;
    const value = Number.isFinite(configured) ? configured : fallback;

    return Math.max(0, Math.min(10_000, Math.round(value)));
  }

  private emitMessage(
    enquiryId: string,
    message: {
      id: string;
      senderUserId: string;
      message: string;
      createdAt: Date;
      sender?: { fullName?: string | null; email?: string | null } | null;
    },
    senderRole: B2BRealtimeMessageEvent["data"]["senderRole"],
  ) {
    this.broadcaster?.({
      type: "MESSAGE",
      enquiryId,
      data: {
        id: message.id,
        senderUserId: message.senderUserId,
        senderName: message.sender?.fullName ?? message.sender?.email ?? "1HandIndia",
        senderRole,
        message: message.message,
        createdAt: message.createdAt.toISOString(),
      },
    });
  }

  private emitStatusChanged(
    enquiryId: string,
    previousStatus: B2BEnquiryStatus,
    newStatus: B2BEnquiryStatus,
  ) {
    this.broadcaster?.({
      type: "STATUS_CHANGED",
      enquiryId,
      data: { previousStatus, newStatus },
    });
  }

  private emitQuotationAdded(
    enquiryId: string,
    data: B2BRealtimeQuotationAddedEvent["data"],
  ) {
    this.broadcaster?.({
      type: "QUOTATION_ADDED",
      enquiryId,
      data,
    });
  }

  private senderRole(source: "admin" | "buyer" | "seller"): B2BRealtimeMessageEvent["data"]["senderRole"] {
    if (source === "admin") {
      return "ADMIN";
    }
    return source === "seller" ? "SELLER" : "BUYER";
  }

  private async getB2BPaymentProofOrThrow(proofId: string) {
    const proof = await this.prisma.client.b2BPaymentProof.findUnique({
      where: { id: proofId },
      include: {
        order: true,
        submittedBy: true,
        reviewedBy: true,
      },
    });

    if (!proof) {
      throw new NotFoundException("B2B payment proof not found.");
    }

    return proof;
  }

  private assertB2BOrderCanAcceptPayment(order: {
    status: B2BOrderStatus;
    paymentStatus: B2BPaymentStatus;
  }) {
    if (order.status === B2BOrderStatus.CANCELLED || order.status === B2BOrderStatus.FULFILLED) {
      throw new BadRequestException("Payment cannot be changed for this B2B order.");
    }
    if (b2bPaymentTerminalStatuses.has(order.paymentStatus)) {
      throw new BadRequestException("Payment is already complete for this order.");
    }
  }

  private canUnlockB2BFulfilment(order: {
    status: B2BOrderStatus;
    paymentStatus: B2BPaymentStatus;
  }) {
    return order.status === B2BOrderStatus.PO_ACCEPTED && b2bFulfilmentPaymentStatuses.has(order.paymentStatus);
  }

  private paymentStatusAfterProofRejection(
    order: {
      paidAmountPaise: number;
      paymentDueAt: Date;
    },
    now: Date,
  ) {
    if (order.paidAmountPaise > 0) {
      return B2BPaymentStatus.PARTIALLY_PAID;
    }
    return now > order.paymentDueAt ? B2BPaymentStatus.OVERDUE : B2BPaymentStatus.PENDING;
  }

  private async assertB2BReferenceAvailable(referenceNumber: string | null | undefined, currentProofId?: string) {
    const normalized = referenceNumber?.trim();
    if (!normalized) {
      return;
    }
    const existing = await this.prisma.client.b2BPaymentProof.findFirst({
      where: {
        referenceNumber: normalized,
        status: B2BProofStatus.VERIFIED,
        ...(currentProofId ? { id: { not: currentProofId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("This reference number is already linked to a verified payment.");
    }
  }

  private async assertB2BPaymentProofFileKeyForOrder(
    actor: RequestUser,
    order: {
      businessBuyerId: string;
      orderNumber: string;
    },
    fileKey: string,
  ) {
    const expectedPrefix = `1handindia/b2b/payment-proofs/${safeStorageFolderSegment(
      order.businessBuyerId,
    )}/${safeStorageFolderSegment(order.orderNumber)}/`;
    const legacyExpectedPrefix = `indihub/b2b/payment-proofs/${safeStorageFolderSegment(
      order.businessBuyerId,
    )}/${safeStorageFolderSegment(order.orderNumber)}/`;
    const normalized = fileKey.trim().replaceAll("\\", "/").replace(/^\/+/, "");

    if (
      (!normalized.startsWith(expectedPrefix) && !normalized.startsWith(legacyExpectedPrefix)) ||
      normalized.includes("..") ||
      normalized.includes("://")
    ) {
      throw new BadRequestException("Payment proof file key does not belong to this B2B order.");
    }

    await this.assertPrivateUploadOwnership({
      actor,
      businessBuyerId: order.businessBuyerId,
      assetKey: normalized,
      uploadKind: "B2B_PAYMENT_PROOF",
      errorMessage: "Invalid proof file.",
    });
  }

  private async createB2BAdminAuditLog(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      actor?: RequestUser | null;
      actorType: B2BAuditActorType;
      action: B2BAdminAction;
      reason: string;
      beforeSnapshot?: Prisma.InputJsonValue;
      afterSnapshot?: Prisma.InputJsonValue;
    },
  ) {
    await tx.b2BAdminAuditLog.create({
      data: {
        b2bOrderId: input.orderId,
        actorId: input.actor?.id ?? null,
        actorType: input.actorType,
        action: input.action,
        reason: input.reason.trim(),
        beforeSnapshot: input.beforeSnapshot ?? Prisma.JsonNull,
        afterSnapshot: input.afterSnapshot ?? Prisma.JsonNull,
      },
    });
  }

  private async notifyB2BPaymentSubmitted(
    order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>,
    proof: { id: string; amountPaise: number; referenceNumber?: string | null; overpaymentAmountPaise?: number | null },
  ) {
    await Promise.all([
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.B2B_PAYMENT_PROOF_SUBMITTED_ADMIN, {
        companyName: order.businessBuyer.companyName,
        orderNumber: order.orderNumber,
        amountPaise: proof.amountPaise,
        referenceNumber: proof.referenceNumber ?? "",
        proofId: proof.id,
      }),
      (proof.overpaymentAmountPaise ?? 0) > 0
        ? this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.B2B_PAYMENT_OVERPAYMENT_ADMIN, {
            companyName: order.businessBuyer.companyName,
            orderNumber: order.orderNumber,
            amountPaise: proof.amountPaise,
            overpaymentAmountPaise: proof.overpaymentAmountPaise ?? 0,
            referenceNumber: proof.referenceNumber ?? "",
          })
        : Promise.resolve(),
    ]);
  }

  private async notifyB2BPaymentVerified(order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>) {
    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.B2B_PAYMENT_VERIFIED_BUYER,
        recipientType: EmailRecipientType.BUSINESS_BUYER,
        recipient: order.businessBuyer.user.email,
        userId: order.businessBuyer.userId,
        variables: {
          companyName: order.businessBuyer.companyName,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          buyerPayableAmountPaise: order.buyerPayableAmountPaise,
          note: "Finance verified the B2B payment.",
        },
      }),
      order.seller?.user.email
        ? this.notifications.notifyEvent({
            eventCode: EMAIL_TRIGGER_EVENTS.B2B_PAYMENT_VERIFIED_SELLER,
            recipientType: EmailRecipientType.SELLER,
            recipient: order.seller.user.email,
            userId: order.seller.userId,
            variables: {
              sellerName: order.seller.storeName,
              companyName: order.businessBuyer.companyName,
              orderNumber: order.orderNumber,
              paymentStatus: order.paymentStatus,
              sellerPayoutAmountPaise: order.sellerPayoutAmountPaise,
              note: "Payment is verified for this B2B order.",
            },
          })
        : Promise.resolve(),
      order.status === B2BOrderStatus.IN_FULFILMENT
        ? this.notifyB2BFulfilmentUnlocked(order, "Payment verified and PO accepted.")
        : Promise.resolve(),
    ]);
  }

  private async notifyB2BPaymentRejected(
    order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>,
    rejectionReason: string,
  ) {
    await this.notifications.notifyEvent({
      eventCode: EMAIL_TRIGGER_EVENTS.B2B_PAYMENT_REJECTED_BUYER,
      recipientType: EmailRecipientType.BUSINESS_BUYER,
      recipient: order.businessBuyer.user.email,
      userId: order.businessBuyer.userId,
      variables: {
        companyName: order.businessBuyer.companyName,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        note: rejectionReason,
      },
    });
  }

  private async notifyB2BOrderCreated(order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>) {
    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.B2B_ORDER_PROFORMA_BUYER,
        recipientType: EmailRecipientType.BUSINESS_BUYER,
        recipient: order.businessBuyer.user.email,
        userId: order.businessBuyer.userId,
        variables: {
          companyName: order.businessBuyer.companyName,
          orderNumber: order.orderNumber,
          proformaInvoiceNumber: order.proformaInvoiceNumber,
          paymentDueAt: order.paymentDueAt.toISOString(),
          buyerPayableAmountPaise: order.buyerPayableAmountPaise,
        },
      }),
      order.seller?.user.email
        ? this.notifications.notifyEvent({
            eventCode: EMAIL_TRIGGER_EVENTS.B2B_ORDER_PROFORMA_SELLER,
            recipientType: EmailRecipientType.SELLER,
            recipient: order.seller.user.email,
            userId: order.seller.userId,
            variables: {
              sellerName: order.seller.storeName,
              companyName: order.businessBuyer.companyName,
              orderNumber: order.orderNumber,
              proformaInvoiceNumber: order.proformaInvoiceNumber,
              sellerPayoutAmountPaise: order.sellerPayoutAmountPaise,
            },
          })
        : Promise.resolve(),
    ]);
  }

  private async notifyB2BPurchaseOrderSubmitted(order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>) {
    await this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.B2B_PURCHASE_ORDER_SUBMITTED_ADMIN, {
      companyName: order.businessBuyer.companyName,
      orderNumber: order.orderNumber,
      purchaseOrderNumber: order.purchaseOrderNumber ?? "",
    });
  }

  private async notifyB2BPurchaseOrderAccepted(order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>) {
    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.B2B_PURCHASE_ORDER_ACCEPTED_BUYER,
        recipientType: EmailRecipientType.BUSINESS_BUYER,
        recipient: order.businessBuyer.user.email,
        userId: order.businessBuyer.userId,
        variables: {
          companyName: order.businessBuyer.companyName,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          note: "Purchase order accepted by admin.",
        },
      }),
      order.seller?.user.email
        ? this.notifications.notifyEvent({
            eventCode: EMAIL_TRIGGER_EVENTS.B2B_PURCHASE_ORDER_ACCEPTED_SELLER,
            recipientType: EmailRecipientType.SELLER,
            recipient: order.seller.user.email,
            userId: order.seller.userId,
            variables: {
              sellerName: order.seller.storeName,
              companyName: order.businessBuyer.companyName,
              orderNumber: order.orderNumber,
              orderStatus: order.status,
              note: "Purchase order accepted by admin.",
            },
          })
        : Promise.resolve(),
    ]);
  }

  private async notifyB2BFulfilmentUnlocked(
    order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>,
    note: string,
  ) {
    if (!order.seller?.user.email) {
      return;
    }
    await this.notifications.notifyEvent({
      eventCode: EMAIL_TRIGGER_EVENTS.B2B_FULFILMENT_UNLOCKED_SELLER,
      recipientType: EmailRecipientType.SELLER,
      recipient: order.seller.user.email,
      userId: order.seller.userId,
      variables: {
        sellerName: order.seller.storeName,
        companyName: order.businessBuyer.companyName,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        note,
      },
    });
  }

  private async notifyB2BPaymentNotRequired(order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>, note: string) {
    if (!order.seller?.user.email) {
      return;
    }
    await this.notifications.notifyEvent({
      eventCode: EMAIL_TRIGGER_EVENTS.B2B_PAYMENT_NOT_REQUIRED_SELLER,
      recipientType: EmailRecipientType.SELLER,
      recipient: order.seller.user.email,
      userId: order.seller.userId,
      variables: {
        sellerName: order.seller.storeName,
        companyName: order.businessBuyer.companyName,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        note,
      },
    });
  }

  private async notifyB2BOrderFulfilled(order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>) {
    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.B2B_ORDER_FULFILLED_BUYER,
        recipientType: EmailRecipientType.BUSINESS_BUYER,
        recipient: order.businessBuyer.user.email,
        userId: order.businessBuyer.userId,
        variables: {
          companyName: order.businessBuyer.companyName,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          note: "Seller marked the B2B order fulfilled.",
        },
      }),
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.B2B_ORDER_FULFILLED_ADMIN, {
        companyName: order.businessBuyer.companyName,
        sellerName: order.seller?.storeName ?? "",
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        buyerPayableAmountPaise: order.buyerPayableAmountPaise,
      }),
    ]);
  }

  private async notifyB2BPayoutEligible(order: Awaited<ReturnType<B2BService["getB2BOrderOrThrow"]>>) {
    if (!order.seller?.user.email || order.paymentStatus !== B2BPaymentStatus.PAID) {
      return;
    }
    await this.notifications.notifyEvent({
      eventCode: EMAIL_TRIGGER_EVENTS.B2B_PAYOUT_ELIGIBLE_SELLER,
      recipientType: EmailRecipientType.SELLER,
      recipient: order.seller.user.email,
      userId: order.seller.userId,
      variables: {
        sellerName: order.seller.storeName,
        companyName: order.businessBuyer.companyName,
        orderNumber: order.orderNumber,
        sellerPayoutAmountPaise: order.sellerPayoutAmountPaise,
        commissionAmountPaise: order.commissionAmountPaise,
      },
    });
  }

  private async notifyB2BQuotation(
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
    response: {
      id: string;
      quotedPricePaise?: number | null;
      responseMessage: string;
    },
    source: "admin" | "seller",
  ) {
    await Promise.all([
      this.notifications.notifyEvent({
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
      }),
      this.notifyBuyerPush(enquiry, {
        templateCode: "B2B_ENQUIRY_RESPONSE_PUSH",
        eventCode: "b2b.enquiry.quotation_added",
        title: `New quotation on enquiry ${this.shortEnquiryId(enquiry.id)}`,
        body: response.responseMessage.slice(0, 120),
        sourceId: `${enquiry.id}:quotation:${response.id}`,
        data: {
          screen: "B2BEnquiryDetail",
          enquiryId: enquiry.id,
        },
      }),
    ]);
  }

  private async notifyB2BQuotationConfirmed(
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
  ) {
    if (!enquiry.seller?.user.email) {
      return;
    }
    const selectedResponse = this.latestResponse(enquiry.responses);
    await this.notifications.notifyEvent({
      eventCode: EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_CONFIRMED_SELLER,
      recipientType: EmailRecipientType.SELLER,
      recipient: enquiry.seller.user.email,
      userId: enquiry.seller.userId,
      variables: {
        sellerName: enquiry.seller.storeName,
        companyName: enquiry.businessBuyer.companyName,
        enquiryId: enquiry.id,
        quotedPricePaise: selectedResponse?.quotedPricePaise ?? "",
        quantity: enquiry.quantity,
      },
    });
  }

  private async notifyB2BMessage(
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
    message: {
      id: string;
      senderUserId: string;
      message: string;
      sender?: { fullName?: string | null; email?: string | null } | null;
    },
    source: "admin" | "buyer" | "seller",
  ) {
    const preview = message.message.slice(0, 200);
    const senderName = message.sender?.fullName ?? message.sender?.email ?? "1HandIndia";

    if (source === "buyer" || source === "admin") {
      await this.notifySellerB2BMessage(enquiry, senderName, preview, message.id);
    }

    if (source === "seller" || source === "admin") {
      await this.notifyBuyerB2BMessage(enquiry, senderName, preview, message.id);
    }
  }

  private async notifySellerB2BMessage(
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
    senderName: string,
    preview: string,
    messageId: string,
  ) {
    if (!enquiry.seller?.user.email) {
      return;
    }
    const throttled = await this.hasRecentB2BMessageNotification(
      enquiry.id,
      enquiry.seller.userId,
      EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_MESSAGE_SELLER,
    );
    if (throttled) {
      return;
    }

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_MESSAGE_SELLER,
        recipientType: EmailRecipientType.SELLER,
        recipient: enquiry.seller.user.email,
        userId: enquiry.seller.userId,
        variables: {
          sellerName: enquiry.seller.storeName,
          companyName: enquiry.businessBuyer.companyName,
          enquiryId: enquiry.id,
          senderName,
          messagePreview: preview,
        },
      }),
      this.expoPush.notifySeller({
        sellerId: enquiry.seller.id,
        templateCode: "SELLER_B2B_MESSAGE_PUSH",
        eventCode: "seller.b2b.enquiry.message",
        title: `New message on ${this.shortEnquiryId(enquiry.id)}`,
        body: `${senderName}: ${preview}`,
        data: {
          type: "seller_b2b_enquiry_message",
          enquiryId: enquiry.id,
          messageId,
          href: `/b2b-enquiries/${enquiry.id}`,
        },
      }),
    ]);
  }

  private async notifyBuyerB2BMessage(
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
    senderName: string,
    preview: string,
    messageId: string,
  ) {
    const throttled = await this.hasRecentB2BMessageNotification(
      enquiry.id,
      enquiry.businessBuyer.userId,
      EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_MESSAGE_BUYER,
    );
    if (throttled) {
      return;
    }

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.B2B_ENQUIRY_MESSAGE_BUYER,
        recipientType: EmailRecipientType.BUSINESS_BUYER,
        recipient: enquiry.businessBuyer.user.email,
        userId: enquiry.businessBuyer.userId,
        variables: {
          companyName: enquiry.businessBuyer.companyName,
          enquiryId: enquiry.id,
          senderName,
          messagePreview: preview,
        },
      }),
      this.notifyBuyerPush(enquiry, {
        templateCode: "B2B_ENQUIRY_MESSAGE_PUSH",
        eventCode: "b2b.enquiry.message",
        title: `New message on enquiry ${this.shortEnquiryId(enquiry.id)}`,
        body: `${senderName}: ${preview}`,
        sourceId: `${enquiry.id}:message:${messageId}`,
        data: {
          screen: "B2BEnquiryDetail",
          enquiryId: enquiry.id,
          messageId,
        },
      }),
    ]);
  }

  private async notifyBuyerPush(
    enquiry: Awaited<ReturnType<B2BService["getEnquiryOrThrow"]>>,
    input: {
      templateCode: string;
      eventCode: string;
      title: string;
      body: string;
      sourceId: string;
      data: Record<string, string>;
    },
  ) {
    const customer = await this.prisma.client.customer.findUnique({
      where: { userId: enquiry.businessBuyer.userId },
      select: { id: true },
    });
    if (!customer) {
      return null;
    }

    return this.expoPush.notifyCustomer({
      customerId: customer.id,
      type: PushNotificationType.B2B_ENQUIRY_MESSAGE,
      templateCode: input.templateCode,
      eventCode: input.eventCode,
      title: input.title,
      body: input.body,
      href: `/b2b/enquiries/${enquiry.id}`,
      sourceType: "b2b_enquiry",
      sourceId: input.sourceId,
      data: input.data,
    });
  }

  private async hasRecentB2BMessageNotification(
    enquiryId: string,
    userId: string,
    eventCode: string,
  ) {
    const recentSince = new Date(
      Date.now() - b2bMessageNotificationThrottleMinutes * 60 * 1000,
    );
    const recent = await this.prisma.client.notificationLog.findMany({
      where: {
        channel: NotificationChannel.EMAIL,
        eventCode,
        userId,
        createdAt: { gte: recentSince },
        status: {
          in: [NotificationStatus.PENDING, NotificationStatus.SENT],
        },
      },
      select: { id: true, variables: true },
      take: 20,
    });

    return recent.some((log) => {
      const variables = log.variables;
      return (
        typeof variables === "object" &&
        variables !== null &&
        !Array.isArray(variables) &&
        "enquiryId" in variables &&
        variables.enquiryId === enquiryId
      );
    });
  }

  private shortEnquiryId(enquiryId: string) {
    return `#${enquiryId.slice(0, 8).toUpperCase()}`;
  }

  private async createUniqueB2BOrderNumber() {
    return this.createUniqueB2BNumber("1HI-B2B", "orderNumber");
  }

  private async createUniqueProformaInvoiceNumber() {
    return this.createUniqueB2BNumber("1HI-PFI", "proformaInvoiceNumber");
  }

  private async createUniqueTaxInvoiceNumber() {
    return this.createUniqueB2BNumber("1HI-TI", "taxInvoiceNumber");
  }

  private async createUniqueB2BNumber(
    prefix: string,
    field: "orderNumber" | "proformaInvoiceNumber" | "taxInvoiceNumber",
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

  private assertBuyerCanEditPurchaseOrder(status: B2BOrderStatus) {
    if (!buyerEditableB2BOrderStatuses.has(status)) {
      throw new BadRequestException(
        "Purchase order can only be uploaded or replaced before admin acceptance.",
      );
    }
  }

  private async purchaseOrderDocumentAccessForOrder(
    purchaseOrderFileKey: string | null | undefined,
  ) {
    if (!purchaseOrderFileKey) {
      throw new NotFoundException("Purchase order file is not attached yet.");
    }

    return this.storageService.b2bPurchaseOrderDocumentAccess(purchaseOrderFileKey);
  }

  private async proformaInvoiceDocumentAccessForOrder(order: {
    id: string;
    proformaInvoiceFileKey?: string | null;
    orderNumber: string;
    businessBuyerId: string;
    proformaInvoiceNumber: string;
    proformaIssuedAt: Date;
    proformaExpiresAt?: Date | null;
    paymentDueAt: Date;
    quantity: number;
    unitPricePaise?: number | null;
    subtotalPaise?: number | null;
    buyerPayableAmountPaise: number;
    commissionRateBps: number;
    commissionAmountPaise: number;
    sellerPayoutAmountPaise: number;
    currency: string;
    product?: { name?: string | null } | null;
    seller?: { storeName?: string | null } | null;
    businessBuyer?: { companyName?: string | null; gstNumber?: string | null } | null;
  }) {
    let fileKey = order.proformaInvoiceFileKey;
    if (!fileKey) {
      fileKey = await this.generateAndStoreB2BProformaInvoice(
        order,
        null,
        "System generated missing proforma file.",
      );
      await this.prisma.client.b2BOrder.update({
        where: { id: order.id },
        data: { proformaInvoiceFileKey: fileKey },
      });
    }

    return this.storageService.b2bProformaInvoiceDocumentAccess(fileKey);
  }

  private async taxInvoiceDocumentAccessForOrder(
    order: {
      id: string;
      status: B2BOrderStatus;
      taxInvoiceNumber?: string | null;
      taxInvoiceIssuedAt?: Date | null;
      taxInvoiceFileKey?: string | null;
      orderNumber: string;
      businessBuyerId: string;
      fulfilledAt?: Date | null;
      paidAt?: Date | null;
      paidAmountPaise: number;
      buyerPayableAmountPaise: number;
      quantity: number;
      unitPricePaise?: number | null;
      subtotalPaise?: number | null;
      commissionRateBps: number;
      commissionAmountPaise: number;
      sellerPayoutAmountPaise: number;
      currency: string;
      purchaseOrderNumber?: string | null;
      product?: { name?: string | null } | null;
      seller?: { storeName?: string | null; gstNumber?: string | null } | null;
      businessBuyer?: { companyName?: string | null; gstNumber?: string | null } | null;
    },
    actor: RequestUser | null,
  ) {
    if (order.status !== B2BOrderStatus.FULFILLED) {
      throw new BadRequestException("Final tax invoice is available after fulfilment.");
    }

    const existingFileKey = order.taxInvoiceFileKey;
    if (!existingFileKey) {
      const issuedAt = new Date();
      const taxInvoiceNumber = order.taxInvoiceNumber ?? (await this.createUniqueTaxInvoiceNumber());
      const generatedFileKey = await this.generateAndStoreB2BTaxInvoice(
        {
          ...order,
          taxInvoiceNumber,
          taxInvoiceIssuedAt: order.taxInvoiceIssuedAt ?? issuedAt,
        },
        actor,
      );
      await this.prisma.client.$transaction(async (tx) => {
        await tx.b2BOrder.update({
          where: { id: order.id },
          data: {
            taxInvoiceNumber,
            taxInvoiceIssuedAt: order.taxInvoiceIssuedAt ?? issuedAt,
            taxInvoiceFileKey: generatedFileKey,
          },
        });
        await tx.b2BOrderEvent.create({
          data: {
            b2bOrderId: order.id,
            actorUserId: actor?.id ?? null,
            status: B2BOrderStatus.FULFILLED,
            note: "Final tax invoice generated.",
            payload: {
              taxInvoiceNumber,
              taxInvoiceFileKey: generatedFileKey,
            },
          },
        });
      });

      return this.storageService.b2bTaxInvoiceDocumentAccess(generatedFileKey);
    }

    return this.storageService.b2bTaxInvoiceDocumentAccess(existingFileKey);
  }

  private async assertPrivateUploadOwnership(input: {
    actor: RequestUser;
    businessBuyerId: string;
    assetKey: string;
    uploadKind: string;
    errorMessage: string;
  }) {
    const upload = await this.prisma.client.privateUpload.findUnique({
      where: { assetKey: input.assetKey },
      select: {
        actorUserId: true,
        uploadKind: true,
        deletedAt: true,
      },
    });

    if (
      !upload ||
      upload.deletedAt ||
      upload.uploadKind !== input.uploadKind ||
      (upload.actorUserId !== input.actor.id && upload.actorUserId !== input.businessBuyerId)
    ) {
      throw new BadRequestException(input.errorMessage);
    }
  }

  private async assertB2BPurchaseOrderFileKeyForOrder(
    actor: RequestUser,
    order: {
      businessBuyerId: string;
      orderNumber: string;
    },
    fileKey: string,
  ) {
    const expectedPrefix = `1handindia/b2b/purchase-orders/${safeStorageFolderSegment(
      order.businessBuyerId,
    )}/${safeStorageFolderSegment(order.orderNumber)}/`;
    const legacyExpectedPrefix = `indihub/b2b/purchase-orders/${safeStorageFolderSegment(
      order.businessBuyerId,
    )}/${safeStorageFolderSegment(order.orderNumber)}/`;
    const normalized = fileKey.trim().replaceAll("\\", "/").replace(/^\/+/, "");

    if (
      (!normalized.startsWith(expectedPrefix) && !normalized.startsWith(legacyExpectedPrefix)) ||
      normalized.includes("..") ||
      normalized.includes("://")
    ) {
      throw new BadRequestException("Purchase order file key does not belong to this B2B order.");
    }

    await this.assertPrivateUploadOwnership({
      actor,
      businessBuyerId: order.businessBuyerId,
      assetKey: normalized,
      uploadKind: "B2B_PURCHASE_ORDER",
      errorMessage: "Invalid purchase order file.",
    });
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
    proformaInvoiceFileKey?: string | null;
    purchaseOrderNumber?: string | null;
    purchaseOrderFileKey?: string | null;
    quantity: number;
    unitPricePaise?: number | null;
    subtotalPaise?: number | null;
    buyerPayableAmountPaise?: number | null;
    paymentStatus?: B2BPaymentStatus;
    paymentMethod?: B2BPaymentMethod | null;
    paidAmountPaise?: number | null;
    paymentDueAt?: Date | string | null;
    paymentOverdueAt?: Date | string | null;
    fulfilmentUnlockedAt?: Date | string | null;
    payoutId?: string | null;
    settlementStatus?: SellerSettlementStatus | null;
    settlementEligibleAt?: Date | string | null;
    settledAt?: Date | string | null;
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
      proformaInvoiceFileKey: order.proformaInvoiceFileKey ?? null,
      purchaseOrderNumber: order.purchaseOrderNumber ?? null,
      purchaseOrderFileKey: order.purchaseOrderFileKey ?? null,
      quantity: order.quantity,
      unitPricePaise: order.unitPricePaise ?? null,
      subtotalPaise: order.subtotalPaise ?? null,
      buyerPayableAmountPaise: order.buyerPayableAmountPaise ?? null,
      paymentStatus: order.paymentStatus ?? null,
      paymentMethod: order.paymentMethod ?? null,
      paidAmountPaise: order.paidAmountPaise ?? null,
      paymentDueAt: this.auditDate(order.paymentDueAt),
      paymentOverdueAt: this.auditDate(order.paymentOverdueAt),
      fulfilmentUnlockedAt: this.auditDate(order.fulfilmentUnlockedAt),
      payoutId: order.payoutId ?? null,
      settlementStatus: order.settlementStatus ?? null,
      settlementEligibleAt: this.auditDate(order.settlementEligibleAt),
      settledAt: this.auditDate(order.settledAt),
    };
  }

  private auditDate(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }
    return value instanceof Date ? value.toISOString() : value;
  }

  private proformaDate(value: Date | string | null | undefined) {
    if (!value) {
      return "Not set";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }
    return date.toISOString().slice(0, 10);
  }

  private moneyForPdf(amountPaise: number, currency: string) {
    return `${currency} ${(amountPaise / 100).toFixed(2)}`;
  }

  private simplePdf(lines: string[]) {
    const pageContent = [
      "BT",
      "/F1 12 Tf",
      "50 790 Td",
      "16 TL",
      ...lines.flatMap((line, index) => [
        index === 0 ? "/F1 18 Tf" : index === 1 ? "/F1 10 Tf" : index === 2 ? "/F1 12 Tf" : "",
        `(${this.pdfText(line)}) Tj`,
        "T*",
      ]).filter(Boolean),
      "ET",
    ].join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(pageContent, "utf8")} >>\nstream\n${pageContent}\nendstream`,
    ];
    const chunks = ["%PDF-1.4\n"];
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
      chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
    });

    const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
    chunks.push(`xref\n0 ${objects.length + 1}\n`);
    chunks.push("0000000000 65535 f \n");
    offsets.slice(1).forEach((offset) => {
      chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
    });
    chunks.push(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    );

    return Buffer.from(chunks.join(""), "utf8");
  }

  private pdfText(value: string) {
    return value.replace(/[\\()]/g, (character) => `\\${character}`).replace(/[^\x20-\x7E]/g, "?");
  }
}
