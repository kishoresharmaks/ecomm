import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  CouponAdjustmentReason,
  CouponRedemptionStatus,
  DeliveryAssignmentAttemptSource,
  DeliveryAssignmentStatus,
  DeliveryStatus,
  InventoryMovementType,
  OrderItemLifecycleStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RefundMethod,
  RefundReason,
  RefundRequestStatus,
  RefundTransactionStatus,
  RoleCode,
  ReturnRequestItemStatus,
  ReturnRequestResolution,
  ReturnRequestStatus,
  ReverseShipmentMode,
  ReverseShipmentStatus,
  SellerLedgerEntryType,
  SellerOrderStatus,
  SellerPayoutStatus,
  SellerSettlementStatus,
  StatusEventType,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
} from "../common/pagination";
import { CustomersService } from "../customers/customers.service";
import { SellerLedgerService } from "../finance/seller-ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ApproveRefundDto,
  CreateCancellationDto,
  CreateReturnRequestDto,
  InitiateRefundDto,
  ManualRefundDto,
  RefundListQueryDto,
  ReversePickupAssignmentDto,
  ReversePickupDecision,
  ReversePickupDecisionDto,
  ReversePickupListQueryDto,
  ReversePickupReleaseDto,
  ReturnListQueryDto,
  ReturnQcDto,
  ReversePickupUpdateDto,
  SellerReturnNoteDto,
  UpdateReturnStatusDto,
} from "./dto/returns.dto";
import {
  buyerRefundAmountForLine,
  prorateAllocatedPaise,
  sellerPayoutAdjustmentForLine,
} from "./return-finance";

const pendingReturnItemStatuses = [
  ReturnRequestItemStatus.PENDING_REVIEW,
  ReturnRequestItemStatus.APPROVED,
  ReturnRequestItemStatus.PICKUP_PENDING,
  ReturnRequestItemStatus.PICKED_UP,
  ReturnRequestItemStatus.RECEIVED,
  ReturnRequestItemStatus.QC_PASSED,
  ReturnRequestItemStatus.REFUND_REQUESTED,
] as const;

const returnApprovalStatuses = [
  ReturnRequestStatus.AUTO_APPROVED,
  ReturnRequestStatus.APPROVED,
  ReturnRequestStatus.PICKUP_PENDING,
  ReturnRequestStatus.PICKED_UP,
  ReturnRequestStatus.IN_TRANSIT,
  ReturnRequestStatus.RECEIVED,
  ReturnRequestStatus.QC_PASSED,
  ReturnRequestStatus.RESOLVED,
] as const;

const razorpayKeyIdSetting = "payments.razorpay.key_id";
const razorpayKeySecretSetting = "payments.razorpay.key_secret";

const refundApprovalStatusSet = new Set<RefundRequestStatus>([
  RefundRequestStatus.PENDING_REVIEW,
  RefundRequestStatus.FAILED,
  RefundRequestStatus.RETRY_PENDING,
]);

const refundInitiationStatusSet = new Set<RefundRequestStatus>([
  RefundRequestStatus.APPROVED,
  RefundRequestStatus.RETRY_PENDING,
  RefundRequestStatus.FAILED,
]);

const manualRefundStatusSet = new Set<RefundRequestStatus>([
  RefundRequestStatus.APPROVED,
  RefundRequestStatus.RETRY_PENDING,
  RefundRequestStatus.FAILED,
  RefundRequestStatus.PROCESSING,
]);

const cancellationBlockedDeliveryStatusSet = new Set<DeliveryStatus>([
  DeliveryStatus.DISPATCHED,
  DeliveryStatus.IN_TRANSIT,
]);

type ReturnOrder = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: { select: { id: true; name: true; categoryId: true; slug: true } };
        seller: { select: { id: true; storeName: true; slug: true } };
      };
    };
    sellerSplits: { include: { payout: true } };
    shipments: true;
    deliveryDetail: true;
    payments: true;
    couponRedemption: true;
    customer: { include: { user: true } };
  };
}>;

type ReturnRequestDetail = Prisma.ReturnRequestGetPayload<{
  include: typeof returnDetailInclude;
}>;

type ReversePickupAssignmentTarget = Prisma.ReturnRequestGetPayload<{
  include: typeof reversePickupAssignmentTargetInclude;
}>;

type RefundRequestDetail = Prisma.RefundRequestGetPayload<{
  include: typeof refundDetailInclude;
}>;

type ReturnNumberClient = Pick<Prisma.TransactionClient, "returnRequest" | "refundRequest">;

type ReturnSummaryReadbackInput = {
  id: string;
  requestNumber: string;
  status: ReturnRequestStatus;
  resolution: ReturnRequestResolution;
  reason: string;
  totalQuantity: number;
  requestedAmountPaise: number;
  approvedAmountPaise: number;
  currency: string;
  createdAt: Date;
  order: {
    orderNumber: string;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    deliveryStatus: DeliveryStatus;
  };
  customer: {
    displayName: string | null;
    user: {
      email: string;
      fullName: string | null;
    };
  };
  items: Array<{
    id: string;
    quantity: number;
    status: ReturnRequestItemStatus;
    sellerId: string;
    seller: {
      storeName: string;
      slug: string;
    };
    orderItem: {
      productNameSnapshot: string;
    };
  }>;
};

type TrackableAddressSnapshot = {
  fullName: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  countryCode: string | null;
  stateCode: string | null;
  cityCode: string | null;
  localAreaCode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: string | null;
  accuracyMeters: number | null;
  locationConfidenceScore: number | null;
};

type ReversePickupPartnerCandidate = {
  user: Prisma.UserGetPayload<{ include: { deliveryProfile: true } }>;
  score: number;
  workload: number;
  lastAssignmentAt: Date | null;
  area: {
    eligible: boolean;
    score: number;
    matchLabel: string;
    matchedFields: string[];
    warnings: string[];
  };
};

const returnDetailInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      paymentStatus: true,
      deliveryStatus: true,
      totalPaise: true,
      currency: true,
      createdAt: true,
      shippingAddressSnapshot: true,
    },
  },
  customer: {
    select: {
      id: true,
      displayName: true,
      user: { select: { email: true, fullName: true, phone: true } },
    },
  },
  items: {
    include: {
      orderItem: {
        select: {
          id: true,
          productNameSnapshot: true,
          variantSnapshot: true,
          quantity: true,
          activeQuantity: true,
          cancelledQuantity: true,
          returnedQuantity: true,
          refundedQuantity: true,
          replacementQuantity: true,
          lifecycleStatus: true,
          unitPricePaise: true,
          lineTotalPaise: true,
          couponDiscountPaise: true,
          currency: true,
        },
      },
      seller: { select: { id: true, storeName: true, slug: true } },
      product: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  refundRequests: {
    select: {
      id: true,
      refundNumber: true,
      status: true,
      amountPaise: true,
      currency: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  reverseShipments: {
    select: {
      id: true,
      sellerId: true,
      mode: true,
      status: true,
      assignmentStatus: true,
      awbNumber: true,
      courierName: true,
      trackingReference: true,
      proofReference: true,
      pickupProofReference: true,
      receiptProofReference: true,
      pickupNote: true,
      receivedByName: true,
      assignedAt: true,
      acceptedAt: true,
      rejectedAt: true,
      assignmentExpiresAt: true,
      assignmentNote: true,
      pickedUpAt: true,
      receivedAt: true,
      seller: {
        select: {
          id: true,
          storeName: true,
          slug: true,
          profile: { select: { contactName: true, contactPhone: true, contactEmail: true } },
          addresses: {
            select: {
              id: true,
              line1: true,
              line2: true,
              area: true,
              city: true,
              state: true,
              pincode: true,
              country: true,
              countryCode: true,
              stateCode: true,
              cityCode: true,
              localAreaCode: true,
              latitude: true,
              longitude: true,
            },
            orderBy: { createdAt: "asc" as const },
            take: 1,
          },
        },
      },
      assignedPartner: { select: { id: true, fullName: true, phone: true } },
      events: {
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          note: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" as const },
      },
      assignmentAttempts: {
        select: {
          id: true,
          source: true,
          status: true,
          note: true,
          respondedAt: true,
          createdAt: true,
          partner: { select: { id: true, fullName: true, email: true, phone: true } },
          assignedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" as const },
        take: 8,
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  notes: {
    select: {
      id: true,
      note: true,
      sellerId: true,
      createdAt: true,
      createdBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.ReturnRequestInclude;

const reversePickupAssignmentTargetInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      shippingAddressSnapshot: true,
    },
  },
  reverseShipments: {
    include: {
      seller: {
        include: {
          profile: true,
          addresses: {
            orderBy: { createdAt: "asc" as const },
            take: 1,
          },
        },
      },
      assignmentAttempts: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ReturnRequestInclude;

const refundDetailInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      orderStatus: true,
      paymentStatus: true,
      deliveryStatus: true,
      totalPaise: true,
      currency: true,
      createdAt: true,
    },
  },
  customer: {
    select: {
      id: true,
      displayName: true,
      user: { select: { email: true, fullName: true, phone: true } },
    },
  },
  payment: {
    select: {
      id: true,
      provider: true,
      method: true,
      amountPaise: true,
      currency: true,
      status: true,
      providerPaymentId: true,
    },
  },
  returnRequest: {
    select: {
      id: true,
      requestNumber: true,
      status: true,
      resolution: true,
    },
  },
  items: {
    include: {
      orderItem: {
        select: {
          id: true,
          productNameSnapshot: true,
          variantSnapshot: true,
          quantity: true,
          activeQuantity: true,
          cancelledQuantity: true,
          returnedQuantity: true,
          refundedQuantity: true,
          unitPricePaise: true,
          currency: true,
        },
      },
      seller: { select: { id: true, storeName: true, slug: true } },
      returnRequestItem: { select: { id: true, status: true, resolution: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  transactions: {
    select: {
      id: true,
      provider: true,
      method: true,
      status: true,
      amountPaise: true,
      currency: true,
      providerRefundId: true,
      manualReference: true,
      paidAt: true,
      failureReason: true,
      processedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.RefundRequestInclude;

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomersService) private readonly customers: CustomersService,
    @Inject(SellerLedgerService) private readonly sellerLedger: SellerLedgerService,
  ) {}

  async createCancellation(actor: RequestUser, orderNumber: string, dto: CreateCancellationDto) {
    const customer = await this.customers.ensureCustomerForUser(actor);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const order = await this.getReturnOrderForCustomer(tx, orderNumber, customer.id);
      this.assertOrderCanBeCancelled(order);
      await this.lockOrderGraph(tx, order);

      const requestedItems = this.resolveRequestedItems(order, dto.items);
      const allActiveBefore = this.allActiveQuantity(order.items);
      const splitBySeller = new Map(order.sellerSplits.map((split) => [split.sellerId, split.id]));
      const cancellationLines = requestedItems.map((requested) =>
        this.cancellationLine(
          requested.item,
          requested.quantity,
          this.splitIdForSeller(splitBySeller, requested.item.sellerId),
        ),
      );
      const cancelledQuantity = cancellationLines.reduce((sum, line) => sum + line.quantity, 0);
      const cancelledGrossPaise = cancellationLines.reduce((sum, line) => sum + line.grossPaise, 0);
      const buyerRefundPaise = cancellationLines.reduce(
        (sum, line) => sum + line.buyerRefundPaise,
        0,
      );
      const couponAdjustmentPaise = cancellationLines.reduce(
        (sum, line) => sum + line.couponAdjustmentPaise,
        0,
      );
      const sellerFundedCouponAdjustmentPaise = cancellationLines.reduce(
        (sum, line) => sum + line.sellerFundedCouponAdjustmentPaise,
        0,
      );
      const platformFundedCouponAdjustmentPaise = cancellationLines.reduce(
        (sum, line) => sum + line.platformFundedCouponAdjustmentPaise,
        0,
      );
      const allItemsCancelled = cancelledQuantity >= allActiveBefore;
      const paidCancellation = order.paymentStatus === PaymentStatus.PAID;
      const note = dto.note?.trim() || dto.reason?.trim() || "Customer requested cancellation.";

      for (const line of cancellationLines) {
        await tx.orderItem.update({
          where: { id: line.orderItemId },
          data: {
            activeQuantity: { decrement: line.quantity },
            retainedQuantity: { decrement: line.quantity },
            cancelledQuantity: { increment: line.quantity },
            cancelledAmountPaise: { increment: line.grossPaise },
            couponAdjustmentPaise: { increment: line.couponAdjustmentPaise },
            lifecycleStatus:
              line.activeQuantityAfter === 0
                ? OrderItemLifecycleStatus.CANCELLED
                : OrderItemLifecycleStatus.PARTIALLY_CANCELLED,
          },
        });

        await tx.productVariant.update({
          where: { id: line.productVariantId },
          data: { stockQuantity: { increment: line.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productVariantId: line.productVariantId,
            movementType: InventoryMovementType.RETURN,
            quantity: line.quantity,
            reason: "Order item cancelled",
            referenceType: "order_cancellation",
            referenceId: order.id,
            createdById: actor.id,
          },
        });
      }

      await this.applySellerSplitCancellationAdjustments(tx, order, cancellationLines, actor);
      await this.recordCouponAdjustments(tx, order, cancellationLines, actor, {
        reason: allItemsCancelled
          ? CouponAdjustmentReason.ORDER_CANCELLED
          : CouponAdjustmentReason.PARTIAL_CANCELLED,
        releaseUsage: allItemsCancelled && order.paymentStatus === PaymentStatus.PENDING,
        note,
      });

      const refundRequest =
        paidCancellation && buyerRefundPaise > 0
          ? await this.createRefundRequestForLines(tx, {
              order,
              lines: cancellationLines,
              actor,
              reason: allItemsCancelled
                ? RefundReason.ORDER_CANCELLED
                : RefundReason.ITEM_CANCELLED,
              status: RefundRequestStatus.PENDING_REVIEW,
              note,
            })
          : null;

      if (allItemsCancelled) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: OrderStatus.CANCELLED,
            deliveryStatus: DeliveryStatus.CANCELLED,
            ...(order.paymentStatus === PaymentStatus.PENDING
              ? { paymentStatus: PaymentStatus.NOT_REQUIRED }
              : {}),
          },
        });

        await tx.orderSellerSplit.updateMany({
          where: { orderId: order.id },
          data: {
            sellerStatus: SellerOrderStatus.CANCELLED,
            settlementStatus:
              order.paymentStatus === PaymentStatus.PAID
                ? SellerSettlementStatus.ADJUSTED
                : SellerSettlementStatus.CANCELLED,
            ...(order.paymentStatus === PaymentStatus.PAID ? {} : { payoutId: null }),
          },
        });

        await tx.orderShipment.updateMany({
          where: { orderId: order.id },
          data: {
            status: DeliveryStatus.CANCELLED,
            assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
          },
        });

        if (order.deliveryDetail) {
          await tx.deliveryDetail.update({
            where: { orderId: order.id },
            data: {
              status: DeliveryStatus.CANCELLED,
              assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
            },
          });
        }

        if (order.paymentStatus === PaymentStatus.PENDING) {
          await this.markPendingPaymentsNotRequired(tx, order, actor, note);
        }

        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            statusType: StatusEventType.ORDER,
            oldStatus: order.orderStatus,
            newStatus: OrderStatus.CANCELLED,
            note,
            createdById: actor.id,
          },
        });
      } else {
        await this.cancelFullyEmptySellerSplits(tx, order, cancellationLines);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.items.cancelled_by_customer",
          entityType: "order",
          entityId: order.id,
          newValue: {
            orderNumber: order.orderNumber,
            cancelledQuantity,
            cancelledGrossPaise,
            buyerRefundPaise,
            couponAdjustmentPaise,
            sellerFundedCouponAdjustmentPaise,
            platformFundedCouponAdjustmentPaise,
            refundNumber: refundRequest?.refundNumber ?? null,
            note,
          },
        },
      });

      return {
        orderNumber: order.orderNumber,
        cancelledQuantity,
        cancelledGrossPaise,
        buyerRefundPaise,
        couponAdjustmentPaise,
        sellerFundedCouponAdjustmentPaise,
        platformFundedCouponAdjustmentPaise,
        refundRequest,
        orderStatus: allItemsCancelled ? OrderStatus.CANCELLED : order.orderStatus,
      };
    });

    return {
      data: result,
    };
  }

  async createReturn(actor: RequestUser, orderNumber: string, dto: CreateReturnRequestDto) {
    const customer = await this.customers.ensureCustomerForUser(actor);

    const requestNumber = await this.createReturnRequestNumber();
    const refundNumber = await this.createRefundNumber();

    const returnRequestId = await this.prisma.client.$transaction(async (tx) => {
      const order = await this.getReturnOrderForCustomer(tx, orderNumber, customer.id);
      this.assertOrderCanBeReturned(order);
      await this.lockOrderGraph(tx, order);

      const requestedItems = this.resolveRequestedItems(order, dto.items);
      const pendingByOrderItem = await this.pendingReturnQuantityByOrderItem(tx, order.id);
      const splitBySeller = new Map(order.sellerSplits.map((split) => [split.sellerId, split.id]));
      const returnLines = requestedItems.map((requested) =>
        this.returnLine(
          requested.item,
          requested.quantity,
          pendingByOrderItem,
          this.splitIdForSeller(splitBySeller, requested.item.sellerId),
        ),
      );
      const totalQuantity = returnLines.reduce((sum, item) => sum + item.quantity, 0);
      const requestedAmountPaise = returnLines.reduce(
        (sum, item) => sum + item.buyerRefundPaise,
        0,
      );
      const couponAdjustmentPaise = returnLines.reduce(
        (sum, item) => sum + item.couponAdjustmentPaise,
        0,
      );
      const autoApproved = returnLines.every((line) => line.returnable);
      const status = autoApproved
        ? ReturnRequestStatus.AUTO_APPROVED
        : ReturnRequestStatus.PENDING_REVIEW;
      const itemStatus = autoApproved
        ? ReturnRequestItemStatus.APPROVED
        : ReturnRequestItemStatus.PENDING_REVIEW;
      const reverseShipmentMode = dto.reverseShipmentMode ?? ReverseShipmentMode.PLATFORM_PICKUP;

      const returnRequest = await tx.returnRequest.create({
        data: {
          requestNumber,
          orderId: order.id,
          customerId: customer.id,
          status,
          resolution: dto.resolution,
          reason: dto.reason,
          note: dto.note ?? null,
          autoApproved,
          totalQuantity,
          requestedAmountPaise,
          approvedAmountPaise: autoApproved ? requestedAmountPaise : 0,
          couponAdjustmentPaise,
          currency: order.currency,
          createdById: actor.id,
          ...(autoApproved ? { reviewedAt: new Date(), reviewedById: actor.id } : {}),
          items: {
            create: returnLines.map((line) => ({
              orderId: order.id,
              orderItemId: line.orderItemId,
              orderSellerSplitId: line.orderSellerSplitId,
              sellerId: line.sellerId,
              productId: line.productId,
              productVariantId: line.productVariantId,
              quantity: line.quantity,
              status: itemStatus,
              resolution: dto.resolution,
              reason: dto.reason,
              requestedRefundPaise: line.buyerRefundPaise,
              approvedRefundPaise: autoApproved ? line.buyerRefundPaise : 0,
              couponAdjustmentPaise: line.couponAdjustmentPaise,
              couponPlatformFundedAdjustmentPaise: line.platformFundedCouponAdjustmentPaise,
              couponSellerFundedAdjustmentPaise: line.sellerFundedCouponAdjustmentPaise,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      for (const line of returnLines) {
        await tx.orderItem.update({
          where: { id: line.orderItemId },
          data: {
            lifecycleStatus:
              dto.resolution === ReturnRequestResolution.REPLACEMENT
                ? OrderItemLifecycleStatus.REPLACEMENT_REQUESTED
                : OrderItemLifecycleStatus.RETURN_REQUESTED,
          },
        });
      }

      if (autoApproved) {
        await this.createReverseShipmentsForReturn(
          tx,
          returnRequest.id,
          order.id,
          reverseShipmentMode,
          returnLines,
        );

        if (this.resolutionNeedsRefund(dto.resolution) && requestedAmountPaise > 0) {
          await this.createRefundRequestFromReturnItems(tx, {
            refundNumber,
            order,
            returnRequestId: returnRequest.id,
            returnItems: returnRequest.items,
            actor,
            status: RefundRequestStatus.PENDING_REVIEW,
            note: dto.note ?? "Return request approved; refund awaits finance approval.",
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "return.request.created",
          entityType: "return_request",
          entityId: returnRequest.id,
          newValue: {
            requestNumber,
            orderNumber: order.orderNumber,
            status,
            resolution: dto.resolution,
            totalQuantity,
            requestedAmountPaise,
            autoApproved,
          },
        },
      });

      return returnRequest.id;
    });

    await this.tryAutoAssignReversePickupAfterApproval(actor, requestNumber);

    return this.getCustomerReturn(actor, requestNumberFromIdFallback(requestNumber, returnRequestId));
  }

  async listCustomerReturns(actor: RequestUser, query: ReturnListQueryDto) {
    const customer = await this.customers.ensureCustomerForUser(actor);
    const where = this.returnListWhere(query, { customerId: customer.id });
    return this.listReturnRequests(where, query);
  }

  async getCustomerReturn(actor: RequestUser, requestNumber: string) {
    const customer = await this.customers.ensureCustomerForUser(actor);
    const detail = await this.prisma.client.returnRequest.findFirst({
      where: { requestNumber, customerId: customer.id },
      include: returnDetailInclude,
    });
    if (!detail) {
      throw new NotFoundException("Return request not found.");
    }
    return this.returnDetailReadback(detail);
  }

  async listAdminReturns(query: ReturnListQueryDto) {
    return this.listReturnRequests(this.returnListWhere(query), query, { includeCustomerContact: true });
  }

  async getAdminReturn(requestNumber: string) {
    const detail = await this.getReturnDetailOrThrow(requestNumber);
    return this.returnDetailReadback(detail, { includeCustomerContact: true });
  }

  async updateReturnStatus(actor: RequestUser, requestNumber: string, dto: UpdateReturnStatusDto) {
    if (dto.status === ReturnRequestStatus.QC_PASSED || dto.status === ReturnRequestStatus.QC_FAILED) {
      throw new BadRequestException("Use the QC endpoint for quality-check decisions.");
    }

    const refundNumber = await this.createRefundNumber();
    const returnRequestId = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.returnRequest.findUnique({
        where: { requestNumber },
        include: {
          items: true,
          refundRequests: true,
          order: {
            include: {
              payments: true,
              sellerSplits: { include: { payout: true } },
            },
          },
        },
      });
      if (!existing) {
        throw new NotFoundException("Return request not found.");
      }
      await this.lockReturnRequest(tx, existing.id);

      if (dto.status === ReturnRequestStatus.APPROVED || dto.status === ReturnRequestStatus.AUTO_APPROVED) {
        await this.approveReturnInTransaction(tx, existing, actor, refundNumber, dto.note);
      } else if (
        dto.status === ReturnRequestStatus.REJECTED ||
        dto.status === ReturnRequestStatus.CANCELLED
      ) {
        await this.closeReturnInTransaction(tx, existing, actor, dto.status, dto.note);
      } else {
        await tx.returnRequest.update({
          where: { id: existing.id },
          data: {
            status: dto.status,
            reviewedAt: new Date(),
            reviewedById: actor.id,
          },
        });
      }

      await tx.returnRequestNote.create({
        data: {
          returnRequestId: existing.id,
          note: dto.note ?? `Return status changed to ${dto.status}.`,
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "return.status.updated",
          entityType: "return_request",
          entityId: existing.id,
          oldValue: { status: existing.status },
          newValue: { status: dto.status, note: dto.note ?? null },
        },
      });

      return existing.id;
    });

    if (dto.status === ReturnRequestStatus.APPROVED || dto.status === ReturnRequestStatus.AUTO_APPROVED) {
      await this.tryAutoAssignReversePickupAfterApproval(actor, requestNumber);
    }

    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: returnDetailInclude,
    });
    return this.returnDetailReadback(detail!, { deliveryPartnerId: actor.id });
  }

  async recordReturnQc(actor: RequestUser, requestNumber: string, dto: ReturnQcDto) {
    const returnRequestId = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.returnRequest.findUnique({
        where: { requestNumber },
        include: {
          items: true,
          refundRequests: true,
        },
      });
      if (!existing) {
        throw new NotFoundException("Return request not found.");
      }
      await this.lockReturnRequest(tx, existing.id);

      if (!returnApprovalStatuses.includes(existing.status as (typeof returnApprovalStatuses)[number])) {
        throw new BadRequestException("Only approved or in-progress returns can receive QC updates.");
      }

      if (dto.status === ReturnRequestStatus.QC_FAILED) {
        await tx.returnRequest.update({
          where: { id: existing.id },
          data: {
            status: ReturnRequestStatus.QC_FAILED,
            reviewedAt: new Date(),
            reviewedById: actor.id,
          },
        });
        await tx.returnRequestItem.updateMany({
          where: { returnRequestId: existing.id },
          data: {
            status: ReturnRequestItemStatus.QC_FAILED,
            qcNote: dto.note ?? null,
          },
        });
        await tx.refundRequest.updateMany({
          where: {
            returnRequestId: existing.id,
            status: { notIn: [RefundRequestStatus.SUCCESS, RefundRequestStatus.CANCELLED] },
          },
          data: {
            status: RefundRequestStatus.CANCELLED,
            reviewedAt: new Date(),
            reviewedById: actor.id,
            note: dto.note ?? "Return QC failed.",
          },
        });
      } else {
        await tx.returnRequest.update({
          where: { id: existing.id },
          data: {
            status:
              existing.resolution === ReturnRequestResolution.REPLACEMENT
                ? ReturnRequestStatus.RESOLVED
                : ReturnRequestStatus.QC_PASSED,
            reviewedAt: new Date(),
            reviewedById: actor.id,
          },
        });
        await tx.returnRequestItem.updateMany({
          where: { returnRequestId: existing.id },
          data: {
            status:
              existing.resolution === ReturnRequestResolution.REPLACEMENT
                ? ReturnRequestItemStatus.REPLACEMENT_CREATED
                : ReturnRequestItemStatus.QC_PASSED,
            qcNote: dto.note ?? null,
          },
        });
        if (this.resolutionNeedsRefund(existing.resolution)) {
          await tx.refundRequest.updateMany({
            where: {
              returnRequestId: existing.id,
              status: RefundRequestStatus.PENDING_REVIEW,
            },
            data: {
              status: RefundRequestStatus.APPROVED,
              approvedAt: new Date(),
              reviewedAt: new Date(),
              reviewedById: actor.id,
              note: dto.note ?? "Return QC passed; refund approved.",
            },
          });
        }
      }

      await tx.returnRequestNote.create({
        data: {
          returnRequestId: existing.id,
          note: dto.note ?? `QC ${dto.status === ReturnRequestStatus.QC_PASSED ? "passed" : "failed"}.`,
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "return.qc.updated",
          entityType: "return_request",
          entityId: existing.id,
          oldValue: { status: existing.status },
          newValue: { status: dto.status, note: dto.note ?? null },
        },
      });

      return existing.id;
    });

    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: returnDetailInclude,
    });
    return this.returnDetailReadback(detail!);
  }

  async listSellerReturns(actor: RequestUser, query: ReturnListQueryDto) {
    const seller = await this.resolveSeller(actor);
    return this.listReturnRequests(
      this.returnListWhere(query, {
        items: { some: { sellerId: seller.id } },
      }),
      query,
      { sellerId: seller.id },
    );
  }

  async getSellerReturn(actor: RequestUser, requestNumber: string) {
    const seller = await this.resolveSeller(actor);
    const detail = await this.prisma.client.returnRequest.findFirst({
      where: {
        requestNumber,
        items: { some: { sellerId: seller.id } },
      },
      include: returnDetailInclude,
    });
    if (!detail) {
      throw new NotFoundException("Return request not found.");
    }
    return this.returnDetailReadback(detail, { sellerId: seller.id });
  }

  async addSellerNote(actor: RequestUser, requestNumber: string, dto: SellerReturnNoteDto) {
    const seller = await this.resolveSeller(actor);
    const returnRequest = await this.prisma.client.returnRequest.findFirst({
      where: {
        requestNumber,
        items: { some: { sellerId: seller.id } },
      },
      select: { id: true },
    });
    if (!returnRequest) {
      throw new NotFoundException("Return request not found.");
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.returnRequestNote.create({
        data: {
          returnRequestId: returnRequest.id,
          sellerId: seller.id,
          note: dto.note,
          createdById: actor.id,
        },
      });
      await tx.returnRequestItem.updateMany({
        where: { returnRequestId: returnRequest.id, sellerId: seller.id },
        data: { sellerNote: dto.note },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "return.seller_note.created",
          entityType: "return_request",
          entityId: returnRequest.id,
          newValue: { sellerId: seller.id, note: dto.note },
        },
      });
    });

    return this.getSellerReturn(actor, requestNumber);
  }

  async listDeliveryReturns(actor: RequestUser, query: ReturnListQueryDto) {
    const where = this.returnListWhere(query, {
      reverseShipments: {
        some: {
          assignedPartnerUserId: actor.id,
        },
      },
    });
    return this.listReturnDetails(where, query, { deliveryPartnerId: actor.id });
  }

  async listAdminReversePickups(query: ReversePickupListQueryDto) {
    const shipmentWhere: Prisma.ReverseShipmentWhereInput = query.assignmentStatus
      ? { assignmentStatus: query.assignmentStatus }
      : {};
    return this.listReturnRequests(
      this.returnListWhere(query, {
        reverseShipments: {
          some: shipmentWhere,
        },
      }),
      query,
      { includeCustomerContact: true },
    );
  }

  async getDeliveryReturn(actor: RequestUser, requestNumber: string) {
    const detail = await this.prisma.client.returnRequest.findFirst({
      where: {
        requestNumber,
        reverseShipments: { some: { assignedPartnerUserId: actor.id } },
      },
      include: returnDetailInclude,
    });
    if (!detail) {
      throw new NotFoundException("Return pickup not found for this delivery partner.");
    }
    return this.returnDetailReadback(detail, { deliveryPartnerId: actor.id });
  }

  async autoAssignReversePickup(actor: RequestUser, requestNumber: string) {
    const detail = await this.getReversePickupAssignmentTarget(requestNumber);
    this.assertReversePickupSellerDestinations(detail);
    const selection = await this.chooseBestReversePickupPartner(detail);
    if (!selection.candidate) {
      await this.markReversePickupAutoAssignmentMiss(
        actor,
        detail.id,
        this.noReversePickupAssignmentNote(selection.diagnostics),
      );
      return this.getAdminReturn(requestNumber);
    }

    return this.setReversePickupAssignment(
      actor,
      requestNumber,
      {
        deliveryPartnerUserId: selection.candidate.user.id,
        assignmentNote: this.reversePickupAutoAssignmentNote(
          "Auto assigned for return pickup.",
          selection.candidate,
          selection.diagnostics,
        ),
      },
      DeliveryAssignmentAttemptSource.AUTO,
    );
  }

  async updateAdminReversePickupAssignment(
    actor: RequestUser,
    requestNumber: string,
    dto: ReversePickupAssignmentDto,
  ) {
    return this.setReversePickupAssignment(actor, requestNumber, dto, DeliveryAssignmentAttemptSource.MANUAL);
  }

  async releaseReversePickupAssignment(
    actor: RequestUser,
    requestNumber: string,
    dto: ReversePickupReleaseDto = {},
  ) {
    return this.setReversePickupAssignment(
      actor,
      requestNumber,
      {
        deliveryPartnerUserId: null,
        assignmentNote: dto.note ?? "Return pickup assignment released by admin.",
      },
      DeliveryAssignmentAttemptSource.MANUAL,
    );
  }

  async respondReversePickupAssignment(
    actor: RequestUser,
    requestNumber: string,
    dto: ReversePickupDecisionDto,
  ) {
    const accepting = dto.decision === ReversePickupDecision.ACCEPT;
    const now = new Date();
    const returnRequestId = await this.prisma.client.$transaction(async (tx) => {
      const returnRequest = await tx.returnRequest.findUnique({
        where: { requestNumber },
        include: { reverseShipments: true },
      });
      if (!returnRequest) {
        throw new NotFoundException("Return pickup not found.");
      }
      const assignedShipments = returnRequest.reverseShipments.filter(
        (shipment) => shipment.assignedPartnerUserId === actor.id,
      );
      if (!assignedShipments.length) {
        throw new ForbiddenException("Return pickup is not assigned to this delivery partner.");
      }
      if (assignedShipments.some((shipment) => shipment.assignmentStatus !== DeliveryAssignmentStatus.ASSIGNED)) {
        throw new BadRequestException("Only newly assigned return pickups can be accepted or rejected.");
      }
      if (
        assignedShipments.some(
          (shipment) => shipment.assignmentExpiresAt && shipment.assignmentExpiresAt.getTime() <= now.getTime(),
        )
      ) {
        await this.releaseReversePickupShipmentsInTransaction(
          tx,
          returnRequest.id,
          assignedShipments.map((shipment) => shipment.id),
          actor,
          "Return pickup assignment expired before partner response.",
          DeliveryAssignmentStatus.CANCELLED,
        );
        throw new BadRequestException("This return pickup assignment expired. It is back in the admin queue.");
      }

      if (accepting) {
        await tx.reverseShipment.updateMany({
          where: { id: { in: assignedShipments.map((shipment) => shipment.id) } },
          data: {
            assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
            acceptedAt: now,
            rejectedAt: null,
            assignmentExpiresAt: null,
            assignmentNote: dto.note ?? "Return pickup accepted by delivery partner.",
          },
        });
        await tx.reverseShipmentAssignmentAttempt.updateMany({
          where: {
            returnRequestId: returnRequest.id,
            partnerUserId: actor.id,
            status: DeliveryAssignmentStatus.ASSIGNED,
          },
          data: {
            status: DeliveryAssignmentStatus.ACCEPTED,
            respondedAt: now,
            note: dto.note ?? "Accepted by delivery partner.",
          },
        });
      } else {
        await this.releaseReversePickupShipmentsInTransaction(
          tx,
          returnRequest.id,
          assignedShipments.map((shipment) => shipment.id),
          actor,
          dto.note ?? "Return pickup rejected by delivery partner.",
          DeliveryAssignmentStatus.REJECTED,
        );
      }

      for (const shipment of assignedShipments) {
        await tx.reverseShipmentEvent.create({
          data: {
            reverseShipmentId: shipment.id,
            oldStatus: shipment.status,
            newStatus: accepting ? ReverseShipmentStatus.ASSIGNED : ReverseShipmentStatus.REQUESTED,
            note: dto.note ?? (accepting ? "Pickup assignment accepted." : "Pickup assignment rejected."),
            createdById: actor.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: accepting ? "return.reverse_pickup.accepted" : "return.reverse_pickup.rejected",
          entityType: "return_request",
          entityId: returnRequest.id,
          newValue: {
            requestNumber,
            partnerUserId: actor.id,
            note: dto.note ?? null,
          },
        },
      });

      return returnRequest.id;
    });

    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: returnDetailInclude,
    });
    return this.returnDetailReadback(detail!, { deliveryPartnerId: actor.id });
  }

  async updateReversePickup(actor: RequestUser, requestNumber: string, dto: ReversePickupUpdateDto) {
    const returnRequestId = await this.prisma.client.$transaction(async (tx) => {
      const returnRequest = await tx.returnRequest.findUnique({
        where: { requestNumber },
        include: {
          reverseShipments: true,
        },
      });
      if (!returnRequest) {
        throw new NotFoundException("Return request not found.");
      }
      const assignedShipments = returnRequest.reverseShipments.filter(
        (item) => item.assignedPartnerUserId === actor.id,
      );
      if (!assignedShipments.length) {
        throw new ForbiddenException("Return pickup is not assigned to this delivery partner.");
      }
      if (assignedShipments.some((shipment) => shipment.assignmentStatus !== DeliveryAssignmentStatus.ACCEPTED)) {
        throw new BadRequestException("Accept the return pickup assignment before updating pickup progress.");
      }

      const proofReference = dto.pickupProofReference ?? dto.proofReference;
      if (dto.status === ReverseShipmentStatus.PICKED_UP && !proofReference?.trim()) {
        throw new BadRequestException("Pickup proof is required before marking the return picked up.");
      }
      if (dto.status === ReverseShipmentStatus.RECEIVED && assignedShipments.length > 1) {
        throw new BadRequestException("Receive each seller package separately from the shipment receipt action.");
      }

      if (dto.status === ReverseShipmentStatus.IN_TRANSIT) {
        const invalid = assignedShipments.some(
          (shipment) => shipment.status !== ReverseShipmentStatus.PICKED_UP && shipment.status !== ReverseShipmentStatus.IN_TRANSIT,
        );
        if (invalid) {
          throw new BadRequestException("Mark the return picked up before moving it in transit.");
        }
      }

      const targetShipments =
        dto.status === ReverseShipmentStatus.RECEIVED ? [assignedShipments[0]!] : assignedShipments;
      const now = new Date();
      for (const shipment of targetShipments) {
        await tx.reverseShipment.update({
          where: { id: shipment.id },
          data: this.reversePickupUpdateData(shipment, dto, now),
        });
        await tx.reverseShipmentEvent.create({
          data: {
            reverseShipmentId: shipment.id,
            oldStatus: shipment.status,
            newStatus: dto.status,
            note: dto.note ?? null,
            createdById: actor.id,
          },
        });
      }

      if (dto.status === ReverseShipmentStatus.PICKED_UP) {
        await tx.returnRequest.update({
          where: { id: returnRequest.id },
          data: { status: ReturnRequestStatus.PICKED_UP },
        });
        await tx.returnRequestItem.updateMany({
          where: { returnRequestId: returnRequest.id },
          data: { status: ReturnRequestItemStatus.PICKED_UP },
        });
      }
      if (dto.status === ReverseShipmentStatus.IN_TRANSIT) {
        await tx.returnRequest.update({
          where: { id: returnRequest.id },
          data: { status: ReturnRequestStatus.IN_TRANSIT },
        });
      }
      if (dto.status === ReverseShipmentStatus.RECEIVED) {
        await this.applyReverseShipmentReceiptStatus(tx, returnRequest.id, targetShipments[0]!.sellerId);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "return.reverse_pickup.updated",
          entityType: "return_request",
          entityId: returnRequest.id,
          newValue: { status: dto.status, note: dto.note ?? null },
        },
      });

      return returnRequest.id;
    });

    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: returnDetailInclude,
    });
    return this.returnDetailReadback(detail!, { deliveryPartnerId: actor.id });
  }

  async updateReverseShipmentReceipt(
    actor: RequestUser,
    requestNumber: string,
    shipmentId: string,
    dto: ReversePickupUpdateDto,
  ) {
    const returnRequestId = await this.prisma.client.$transaction(async (tx) => {
      const returnRequest = await tx.returnRequest.findUnique({
        where: { requestNumber },
        include: { reverseShipments: true },
      });
      if (!returnRequest) {
        throw new NotFoundException("Return request not found.");
      }
      const shipment = returnRequest.reverseShipments.find((item) => item.id === shipmentId);
      if (!shipment || shipment.assignedPartnerUserId !== actor.id) {
        throw new ForbiddenException("Return seller package is not assigned to this delivery partner.");
      }
      if (shipment.assignmentStatus !== DeliveryAssignmentStatus.ACCEPTED) {
        throw new BadRequestException("Accept the return pickup assignment before recording seller receipt.");
      }
      if (shipment.status !== ReverseShipmentStatus.PICKED_UP && shipment.status !== ReverseShipmentStatus.IN_TRANSIT) {
        throw new BadRequestException("Only picked-up return packages can be received by the seller store.");
      }
      const receiptProof = dto.receiptProofReference ?? dto.proofReference;
      if (!receiptProof?.trim()) {
        throw new BadRequestException("Seller receipt proof is required.");
      }
      if (!dto.receivedByName?.trim()) {
        throw new BadRequestException("Receiver name is required when the seller store receives a return.");
      }

      const now = new Date();
      await tx.reverseShipment.update({
        where: { id: shipment.id },
        data: {
          status: ReverseShipmentStatus.RECEIVED,
          awbNumber: dto.awbNumber ?? shipment.awbNumber,
          courierName: dto.courierName ?? shipment.courierName,
          trackingReference: dto.trackingReference ?? shipment.trackingReference,
          proofReference: dto.proofReference ?? shipment.proofReference,
          receiptProofReference: receiptProof,
          pickupNote: dto.note ?? shipment.pickupNote,
          receivedByName: dto.receivedByName,
          receivedAt: now,
        },
      });
      await tx.reverseShipmentEvent.create({
        data: {
          reverseShipmentId: shipment.id,
          oldStatus: shipment.status,
          newStatus: ReverseShipmentStatus.RECEIVED,
          note: dto.note ?? null,
          createdById: actor.id,
        },
      });
      await this.applyReverseShipmentReceiptStatus(tx, returnRequest.id, shipment.sellerId);

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "return.reverse_pickup.received",
          entityType: "return_request",
          entityId: returnRequest.id,
          oldValue: { status: shipment.status },
          newValue: {
            status: ReverseShipmentStatus.RECEIVED,
            sellerId: shipment.sellerId,
            receivedByName: dto.receivedByName,
            note: dto.note ?? null,
          },
        },
      });

      return returnRequest.id;
    });

    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: returnDetailInclude,
    });
    return this.returnDetailReadback(detail!);
  }

  async listAdminRefunds(query: RefundListQueryDto) {
    const where = this.refundListWhere(query);
    const { take, cursor } = cursorPaginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 50,
    });
    const cursorWhere = createdAtCursorWhere(cursor) as Prisma.RefundRequestWhereInput | undefined;
    const items = await this.prisma.client.refundRequest.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      select: {
        id: true,
        refundNumber: true,
        status: true,
        reason: true,
        method: true,
        amountPaise: true,
        currency: true,
        createdAt: true,
        order: { select: { orderNumber: true, paymentStatus: true } },
        customer: {
          select: { displayName: true, user: { select: { email: true, fullName: true } } },
        },
      },
      orderBy: createdAtCursorOrderBy(),
      take: take + 1,
    });
    const page = cursorPageFromItems(items, take);
    return {
      ...page,
      limit: take,
      items: page.items.map((item) => ({
        id: item.id,
        refundNumber: item.refundNumber,
        status: item.status,
        reason: item.reason,
        method: item.method,
        amountPaise: item.amountPaise,
        currency: item.currency,
        createdAt: item.createdAt,
        orderNumber: item.order.orderNumber,
        paymentStatus: item.order.paymentStatus,
        customerName: item.customer.user.fullName ?? item.customer.displayName,
        customerEmail: item.customer.user.email,
      })),
    };
  }

  async getAdminRefund(refundNumber: string) {
    const detail = await this.getRefundDetailOrThrow(refundNumber);
    return this.refundDetailReadback(detail);
  }

  async approveRefund(actor: RequestUser, refundNumber: string, dto: ApproveRefundDto) {
    const refundId = await this.prisma.client.$transaction(async (tx) => {
      const refund = await tx.refundRequest.findUnique({ where: { refundNumber } });
      if (!refund) {
        throw new NotFoundException("Refund request not found.");
      }
      if (!refundApprovalStatusSet.has(refund.status)) {
        throw new BadRequestException("Refund is not waiting for approval.");
      }
      await tx.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: RefundRequestStatus.APPROVED,
          approvedAt: new Date(),
          reviewedAt: new Date(),
          reviewedById: actor.id,
          note: dto.note ?? refund.note,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "refund.approved",
          entityType: "refund_request",
          entityId: refund.id,
          oldValue: { status: refund.status },
          newValue: { status: RefundRequestStatus.APPROVED, note: dto.note ?? null },
        },
      });
      return refund.id;
    });

    const detail = await this.prisma.client.refundRequest.findUnique({
      where: { id: refundId },
      include: refundDetailInclude,
    });
    return this.refundDetailReadback(detail!);
  }

  async initiateRefund(actor: RequestUser, refundNumber: string, dto: InitiateRefundDto) {
    const refund = await this.getRefundDetailOrThrow(refundNumber);
    if (!refundInitiationStatusSet.has(refund.status)) {
      throw new BadRequestException("Refund must be approved before initiation.");
    }

    const method = dto.method ?? this.defaultRefundMethod(refund);
    if (method !== RefundMethod.RAZORPAY) {
      throw new BadRequestException("Use manual-record for offline or manual refunds.");
    }
    if (!refund.payment?.providerPaymentId || refund.payment.provider !== PaymentProvider.RAZORPAY) {
      throw new BadRequestException("Razorpay refund requires a captured Razorpay payment id.");
    }

    const transaction = await this.prisma.client.$transaction(async (tx) => {
      await this.lockRefundRequest(tx, refund.id);
      const attemptCount = await tx.refundTransaction.count({
        where: { refundRequestId: refund.id },
      });
      const idempotencyKey = this.refundIdempotencyKey(refund.refundNumber, attemptCount + 1);

      const transaction = await tx.refundTransaction.create({
        data: {
          refundRequestId: refund.id,
          paymentId: refund.paymentId,
          provider: PaymentProvider.RAZORPAY,
          method: RefundMethod.RAZORPAY,
          status: RefundTransactionStatus.PROCESSING,
          amountPaise: refund.amountPaise,
          currency: refund.currency,
          idempotencyKey,
          createdById: actor.id,
        },
      });
      await tx.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: RefundRequestStatus.PROCESSING,
          method: RefundMethod.RAZORPAY,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          note: dto.note ?? refund.note,
        },
      });
      return transaction;
    });

    const providerResult = await this.createRazorpayRefund({
      paymentId: refund.payment.providerPaymentId,
      amountPaise: refund.amountPaise,
      idempotencyKey: transaction.idempotencyKey,
      refundNumber: refund.refundNumber,
    });

    const nextTransactionStatus = this.razorpayRefundTransactionStatus(providerResult.status);
    const providerRefundId = typeof providerResult.id === "string" ? providerResult.id : null;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.refundTransaction.update({
        where: { id: transaction.id },
        data: {
          status: nextTransactionStatus,
          providerRefundId,
          rawResponse: providerResult as Prisma.InputJsonValue,
          processedAt:
            nextTransactionStatus === RefundTransactionStatus.SUCCESS ? new Date() : null,
          failureReason:
            nextTransactionStatus === RefundTransactionStatus.FAILED
              ? this.providerFailureReason(providerResult)
              : null,
        },
      });

      if (nextTransactionStatus === RefundTransactionStatus.SUCCESS) {
        await this.completeRefundInTransaction(tx, refund.id, actor, {
          method: RefundMethod.RAZORPAY,
          note: dto.note ?? "Razorpay refund processed.",
        });
      } else if (nextTransactionStatus === RefundTransactionStatus.FAILED) {
        await tx.refundRequest.update({
          where: { id: refund.id },
          data: {
            status: RefundRequestStatus.RETRY_PENDING,
            note: this.providerFailureReason(providerResult),
          },
        });
      }
    });

    return this.getAdminRefund(refundNumber);
  }

  async retryRefund(actor: RequestUser, refundNumber: string, dto: InitiateRefundDto) {
    return this.initiateRefund(actor, refundNumber, dto);
  }

  async recordManualRefund(actor: RequestUser, refundNumber: string, dto: ManualRefundDto) {
    if (dto.method === RefundMethod.RAZORPAY) {
      throw new BadRequestException("Use the initiate endpoint for Razorpay refunds.");
    }

    const refundId = await this.prisma.client.$transaction(async (tx) => {
      const refund = await tx.refundRequest.findUnique({
        where: { refundNumber },
        include: {
          payment: true,
          items: true,
        },
      });
      if (!refund) {
        throw new NotFoundException("Refund request not found.");
      }
      if (!manualRefundStatusSet.has(refund.status)) {
        throw new BadRequestException("Refund is not ready for manual payment recording.");
      }

      const idempotencyKey = this.refundIdempotencyKey(
        refund.refundNumber,
        (await tx.refundTransaction.count({ where: { refundRequestId: refund.id } })) + 1,
      );
      await tx.refundTransaction.create({
        data: {
          refundRequestId: refund.id,
          paymentId: refund.paymentId,
          provider: refund.payment?.provider ?? null,
          method: dto.method,
          status: RefundTransactionStatus.SUCCESS,
          amountPaise: refund.amountPaise,
          currency: refund.currency,
          idempotencyKey,
          manualReference: dto.manualReference,
          paidAt: new Date(dto.paidAt),
          processedAt: new Date(),
          createdById: actor.id,
        },
      });

      await this.completeRefundInTransaction(tx, refund.id, actor, {
        method: dto.method,
        note: dto.note ?? "Manual refund recorded by finance/admin.",
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "refund.manual_recorded",
          entityType: "refund_request",
          entityId: refund.id,
          newValue: {
            refundNumber,
            method: dto.method,
            manualReference: dto.manualReference,
            paidAt: dto.paidAt,
          },
        },
      });

      return refund.id;
    });

    const detail = await this.prisma.client.refundRequest.findUnique({
      where: { id: refundId },
      include: refundDetailInclude,
    });
    return this.refundDetailReadback(detail!);
  }

  async handleRazorpayRefundWebhook(payload: Record<string, unknown>, eventId?: string) {
    const refundEntity = this.extractRazorpayRefundEntity(payload);
    if (!refundEntity?.id) {
      return { handled: false };
    }

    const lookup: Prisma.RefundTransactionWhereInput[] = [
      { provider: PaymentProvider.RAZORPAY, providerRefundId: refundEntity.id },
      ...(refundEntity.paymentId
        ? [
            {
              provider: PaymentProvider.RAZORPAY,
              refundRequest: {
                payment: {
                  providerPaymentId: refundEntity.paymentId,
                },
              },
              status: {
                in: [
                  RefundTransactionStatus.INITIATED,
                  RefundTransactionStatus.PROCESSING,
                ],
              },
            } satisfies Prisma.RefundTransactionWhereInput,
          ]
        : []),
    ];
    const transaction = await this.prisma.client.refundTransaction.findFirst({
      where: { OR: lookup },
      include: { refundRequest: true },
      orderBy: { createdAt: "desc" },
    });
    if (!transaction) {
      return { handled: false };
    }

    const razorpayEventId = eventId?.trim();

    // Step 1: Claim the event atomically — reject duplicates
    if (razorpayEventId) {
      try {
        await this.prisma.client.razorpayWebhookEvent.create({
          data: {
            provider: 'razorpay',
            providerEventId: razorpayEventId,
            eventType: 'refund.processed',
            status: 'PROCESSING',
          },
        });
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && (e as { code?: unknown }).code === 'P2002') {
          // Duplicate event — already processed or in progress
          this.logger.warn(`Duplicate refund webhook event skipped: ${razorpayEventId}`);
          return { handled: true, received: true, duplicate: true };
        }
        throw e;
      }
    }

    // Step 2: Lock the refund request row before any side effects
    const claimed = await this.prisma.client.refundRequest.updateMany({
      where: {
        id: transaction.refundRequestId,
        status: { not: RefundRequestStatus.SUCCESS },
      },
      data: { status: RefundRequestStatus.PROCESSING },
    });

    if (claimed.count === 0) {
      this.logger.warn(`Refund already completed, skipping: ${transaction.refundRequestId}`);
      if (razorpayEventId) {
        await this.prisma.client.razorpayWebhookEvent.update({
          where: { provider_providerEventId: { provider: 'razorpay', providerEventId: razorpayEventId } },
          data: { status: 'DONE', processedAt: new Date() },
        });
      }
      return { handled: true, received: true, alreadyComplete: true };
    }

    // Step 3: Validate amount/currency BEFORE calling completeRefundInTransaction()
    if (refundEntity.amount !== transaction.amountPaise) {
      this.logger.error(
        `Refund amount mismatch: webhook=${refundEntity.amount} internal=${transaction.amountPaise}`
      );
      if (razorpayEventId) {
        await this.prisma.client.razorpayWebhookEvent.update({
          where: { provider_providerEventId: { provider: 'razorpay', providerEventId: razorpayEventId } },
          data: { status: 'FAILED', processedAt: new Date() },
        });
      }
      throw new Error('Refund amount mismatch — aborting');
    }

    const nextStatus = this.razorpayRefundTransactionStatus(refundEntity.status);
    try {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.refundTransaction.update({
          where: { id: transaction.id },
          data: {
            status: nextStatus,
            providerRefundId: refundEntity.id,
            rawResponse: {
              ...payload,
              ...(eventId ? { razorpayEventId: eventId } : {}),
            } as Prisma.InputJsonValue,
            processedAt:
              nextStatus === RefundTransactionStatus.SUCCESS ? new Date() : transaction.processedAt,
            failureReason:
              nextStatus === RefundTransactionStatus.FAILED
                ? this.providerFailureReason(refundEntity.raw)
                : transaction.failureReason,
          },
        });

        if (nextStatus === RefundTransactionStatus.SUCCESS) {
          await this.completeRefundInTransaction(tx, transaction.refundRequestId, null, {
            method: RefundMethod.RAZORPAY,
            note: "Razorpay refund webhook confirmed refund success.",
          });
        } else if (nextStatus === RefundTransactionStatus.FAILED) {
          await tx.refundRequest.update({
            where: { id: transaction.refundRequestId },
            data: {
              status: RefundRequestStatus.RETRY_PENDING,
              note: this.providerFailureReason(refundEntity.raw),
            },
          });
        } else {
          await tx.refundRequest.update({
            where: { id: transaction.refundRequestId },
            data: { status: RefundRequestStatus.PROCESSING },
          });
        }
      });
    } catch (error) {
      if (razorpayEventId) {
        await this.prisma.client.razorpayWebhookEvent.update({
          where: {
            provider_providerEventId: {
              provider: "razorpay",
              providerEventId: razorpayEventId,
            },
          },
          data: { status: "FAILED", processedAt: new Date() },
        });
      }
      throw error;
    }

    // Step 4: Mark event DONE after completeRefundInTransaction() succeeds
    if (razorpayEventId) {
      await this.prisma.client.razorpayWebhookEvent.update({
        where: {
          provider_providerEventId: {
            provider: "razorpay",
            providerEventId: razorpayEventId,
          },
        },
        data: { status: "DONE", processedAt: new Date() },
      });
    }

    return { handled: true, refundNumber: transaction.refundRequest.refundNumber };
  }

  private async getReturnOrderForCustomer(
    tx: Prisma.TransactionClient,
    orderNumber: string,
    customerId: string,
  ) {
    const order = await tx.order.findFirst({
      where: { orderNumber, customerId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, categoryId: true, slug: true } },
            seller: { select: { id: true, storeName: true, slug: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        sellerSplits: { include: { payout: true } },
        shipments: true,
        deliveryDetail: true,
        payments: true,
        couponRedemption: true,
        customer: { include: { user: true } },
      },
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    return order;
  }

  private assertOrderCanBeCancelled(order: ReturnOrder) {
    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException("Order is already cancelled.");
    }
    if (order.orderStatus === OrderStatus.DELIVERED || order.deliveryStatus === DeliveryStatus.DELIVERED) {
      throw new BadRequestException("Delivered orders must use the return flow.");
    }
    if (cancellationBlockedDeliveryStatusSet.has(order.deliveryStatus)) {
      throw new BadRequestException("Order has already left the store. Use the return flow after delivery.");
    }
  }

  private assertOrderCanBeReturned(order: ReturnOrder) {
    if (order.orderStatus !== OrderStatus.DELIVERED && order.deliveryStatus !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException("Returns are available only after delivery.");
    }
    if (order.paymentStatus !== PaymentStatus.PAID && order.paymentStatus !== PaymentStatus.NOT_REQUIRED) {
      throw new BadRequestException("Returns are available only after payment is completed or not required.");
    }
  }

  private async lockOrderGraph(tx: Prisma.TransactionClient, order: ReturnOrder) {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id}::uuid FOR UPDATE`;
    if (order.items.length) {
      await tx.$queryRaw`SELECT id FROM order_items WHERE order_id = ${order.id}::uuid FOR UPDATE`;
    }
    if (order.sellerSplits.length) {
      await tx.$queryRaw`SELECT id FROM order_seller_splits WHERE order_id = ${order.id}::uuid FOR UPDATE`;
    }
    if (order.payments.length) {
      await tx.$queryRaw`SELECT id FROM payments WHERE order_id = ${order.id}::uuid FOR UPDATE`;
    }
  }

  private resolveRequestedItems(order: ReturnOrder, requestedItems?: { orderItemId: string; quantity: number }[]) {
    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    const inputs =
      requestedItems && requestedItems.length
        ? requestedItems
        : order.items
            .filter((item) => this.activeQuantity(item) > 0)
            .map((item) => ({ orderItemId: item.id, quantity: this.activeQuantity(item) }));

    const seen = new Set<string>();
    return inputs.map((input) => {
      if (seen.has(input.orderItemId)) {
        throw new BadRequestException("Duplicate order item in request.");
      }
      seen.add(input.orderItemId);
      const item = itemMap.get(input.orderItemId);
      if (!item) {
        throw new BadRequestException("Selected item does not belong to this order.");
      }
      const activeQuantity = this.activeQuantity(item);
      if (input.quantity > activeQuantity) {
        throw new BadRequestException("Selected quantity is greater than available active quantity.");
      }
      return { item, quantity: input.quantity };
    });
  }

  private cancellationLine(
    item: ReturnOrder["items"][number],
    quantity: number,
    orderSellerSplitId: string,
  ) {
    const alreadyAffectedQuantity = item.cancelledQuantity + item.returnedQuantity;
    const grossPaise = item.unitPricePaise * quantity;
    const couponAdjustmentPaise = prorateAllocatedPaise({
      totalAllocationPaise: item.couponDiscountPaise,
      originalQuantity: item.quantity,
      affectedQuantity: quantity,
      alreadyAffectedQuantity,
    });
    const platformFundedCouponAdjustmentPaise = prorateAllocatedPaise({
      totalAllocationPaise: item.couponPlatformFundedDiscountPaise,
      originalQuantity: item.quantity,
      affectedQuantity: quantity,
      alreadyAffectedQuantity,
    });
    const sellerFundedCouponAdjustmentPaise = prorateAllocatedPaise({
      totalAllocationPaise: item.couponSellerFundedDiscountPaise,
      originalQuantity: item.quantity,
      affectedQuantity: quantity,
      alreadyAffectedQuantity,
    });
    const activeQuantityAfter = this.activeQuantity(item) - quantity;

    return {
      orderItemId: item.id,
      orderSellerSplitId,
      sellerId: item.sellerId,
      productId: item.productId,
      productVariantId: item.productVariantId,
      quantity,
      grossPaise,
      couponAdjustmentPaise,
      platformFundedCouponAdjustmentPaise,
      sellerFundedCouponAdjustmentPaise,
      buyerRefundPaise: buyerRefundAmountForLine({
        grossAmountPaise: grossPaise,
        couponAdjustmentPaise,
      }),
      sellerPayoutAdjustmentPaise: sellerPayoutAdjustmentForLine({
        grossAmountPaise: grossPaise,
        sellerFundedCouponAdjustmentPaise,
      }),
      activeQuantityAfter,
    };
  }

  private returnLine(
    item: ReturnOrder["items"][number],
    quantity: number,
    pendingByOrderItem: Map<string, number>,
    orderSellerSplitId: string,
  ) {
    const pendingQuantity = pendingByOrderItem.get(item.id) ?? 0;
    const availableQuantity = this.activeQuantity(item) - item.returnedQuantity - pendingQuantity;
    if (quantity > availableQuantity) {
      throw new BadRequestException("Selected quantity is already returned or under return review.");
    }
    const line = this.cancellationLine(item, quantity, orderSellerSplitId);
    return {
      ...line,
      returnable: this.itemPolicyAllowsReturn(item.returnPolicySnapshot),
    };
  }

  private splitIdForSeller(splitBySeller: Map<string, string>, sellerId: string) {
    const splitId = splitBySeller.get(sellerId);
    if (!splitId) {
      throw new BadRequestException("Seller split is missing for selected order item.");
    }
    return splitId;
  }

  private async applySellerSplitCancellationAdjustments(
    tx: Prisma.TransactionClient,
    order: ReturnOrder,
    lines: ReturnType<ReturnsService["cancellationLine"]>[],
    actor: RequestUser | null,
  ) {
    const splitBySeller = new Map(order.sellerSplits.map((split) => [split.sellerId, split]));
    const grouped = this.groupLinesBySeller(lines);

    for (const [sellerId, sellerLines] of grouped) {
      const split = splitBySeller.get(sellerId);
      if (!split) {
        throw new BadRequestException("Seller split is missing for cancelled item.");
      }
      const refundAdjustmentPaise = sellerLines.reduce(
        (sum, line) => sum + line.sellerPayoutAdjustmentPaise,
        0,
      );
      const couponAdjustmentPaise = sellerLines.reduce(
        (sum, line) => sum + line.sellerFundedCouponAdjustmentPaise,
        0,
      );

      await tx.orderSellerSplit.update({
        where: { id: split.id },
        data: {
          refundAdjustmentPaise: { decrement: refundAdjustmentPaise },
          couponAdjustmentPaise: { increment: couponAdjustmentPaise },
          ...(split.payout?.status === SellerPayoutStatus.PAID
            ? { settlementStatus: SellerSettlementStatus.ADJUSTED }
            : {}),
        },
      });

      if (split.payout?.status === SellerPayoutStatus.PAID) {
        await this.createSellerRefundLedgerAdjustment(tx, {
          splitId: split.id,
          sellerId,
          orderId: order.id,
          payoutId: split.payoutId,
          amountPaise: refundAdjustmentPaise,
          actor,
          referenceId: `cancellation:${order.orderNumber}:${sellerId}`,
          description: `Cancellation adjustment for order ${order.orderNumber}`,
        });
      }
    }
  }

  private async cancelFullyEmptySellerSplits(
    tx: Prisma.TransactionClient,
    order: ReturnOrder,
    lines: ReturnType<ReturnsService["cancellationLine"]>[],
  ) {
    const affectedSellerIds = new Set(lines.map((line) => line.sellerId));
    for (const sellerId of affectedSellerIds) {
      const sellerItems = order.items.filter((item) => item.sellerId === sellerId);
      const lineByItem = new Map(lines.map((line) => [line.orderItemId, line]));
      const hasRemaining = sellerItems.some((item) => {
        const line = lineByItem.get(item.id);
        return this.activeQuantity(item) - (line?.quantity ?? 0) > 0;
      });
      if (!hasRemaining) {
        await tx.orderSellerSplit.updateMany({
          where: { orderId: order.id, sellerId },
          data: {
            sellerStatus: SellerOrderStatus.CANCELLED,
            settlementStatus:
              order.paymentStatus === PaymentStatus.PAID
                ? SellerSettlementStatus.ADJUSTED
                : SellerSettlementStatus.CANCELLED,
            ...(order.paymentStatus === PaymentStatus.PAID ? {} : { payoutId: null }),
          },
        });
        await tx.orderShipment.updateMany({
          where: { orderId: order.id, sellerId },
          data: {
            status: DeliveryStatus.CANCELLED,
            assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
          },
        });
      }
    }
  }

  private async recordCouponAdjustments(
    tx: Prisma.TransactionClient,
    order: ReturnOrder,
    lines: ReturnType<ReturnsService["cancellationLine"]>[],
    actor: RequestUser,
    options: {
      reason: CouponAdjustmentReason;
      releaseUsage: boolean;
      note: string;
    },
  ) {
    const totalCoupon = lines.reduce((sum, line) => sum + line.couponAdjustmentPaise, 0);
    if (!order.couponRedemption || totalCoupon <= 0) {
      return;
    }

    for (const line of lines) {
      if (line.couponAdjustmentPaise <= 0) {
        continue;
      }
      await tx.couponRedemptionAdjustment.create({
        data: {
          couponRedemptionId: order.couponRedemption.id,
          orderId: order.id,
          orderItemId: line.orderItemId,
          orderSellerSplitId:
            order.sellerSplits.find((split) => split.sellerId === line.sellerId)?.id ?? null,
          reason: options.reason,
          discountReversedPaise: line.couponAdjustmentPaise,
          merchandiseDiscountReversedPaise: line.couponAdjustmentPaise,
          shippingDiscountReversedPaise: 0,
          note: options.note,
          createdById: actor?.id ?? null,
        },
      });
    }

    await tx.couponRedemption.update({
      where: { id: order.couponRedemption.id },
      data: {
        status: options.releaseUsage
          ? CouponRedemptionStatus.FULLY_REVERSED
          : CouponRedemptionStatus.PARTIALLY_ADJUSTED,
        adjustmentPaise: { increment: totalCoupon },
        ...(options.releaseUsage ? { reversedAt: new Date() } : {}),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        couponAdjustmentPaise: { increment: totalCoupon },
      },
    });

    if (options.releaseUsage) {
      await tx.couponUsageCounter.updateMany({
        where: { couponId: order.couponRedemption.couponId, usedCount: { gt: 0 } },
        data: {
          usedCount: { decrement: 1 },
          discountPaise: { decrement: Math.min(totalCoupon, order.couponRedemption.discountPaise) },
          platformFundedDiscountPaise: {
            decrement: Math.min(
              lines.reduce((sum, line) => sum + line.platformFundedCouponAdjustmentPaise, 0),
              order.couponRedemption.platformFundedDiscountPaise,
            ),
          },
          sellerFundedDiscountPaise: {
            decrement: Math.min(
              lines.reduce((sum, line) => sum + line.sellerFundedCouponAdjustmentPaise, 0),
              order.couponRedemption.sellerFundedDiscountPaise,
            ),
          },
          version: { increment: 1 },
        },
      });
      await tx.coupon.updateMany({
        where: { id: order.couponRedemption.couponId, redeemedCount: { gt: 0 } },
        data: { redeemedCount: { decrement: 1 } },
      });
    }
  }

  private async markPendingPaymentsNotRequired(
    tx: Prisma.TransactionClient,
    order: ReturnOrder,
    actor: RequestUser,
    note: string,
  ) {
    for (const payment of order.payments.filter((item) => item.status === PaymentStatus.PENDING)) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.NOT_REQUIRED },
      });
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType: "order.cancelled",
          oldStatus: payment.status,
          newStatus: PaymentStatus.NOT_REQUIRED,
          payload: {
            orderNumber: order.orderNumber,
            note,
            actorId: actor.id,
          },
        },
      });
    }
  }

  private async createRefundRequestForLines(
    tx: Prisma.TransactionClient,
    input: {
      order: ReturnOrder;
      lines: ReturnType<ReturnsService["cancellationLine"]>[];
      actor: RequestUser;
      reason: RefundReason;
      status: RefundRequestStatus;
      note: string;
    },
  ) {
    const amountPaise = input.lines.reduce((sum, line) => sum + line.buyerRefundPaise, 0);
    const couponAdjustmentPaise = input.lines.reduce(
      (sum, line) => sum + line.couponAdjustmentPaise,
      0,
    );
    const sellerFundedCouponAdjustmentPaise = input.lines.reduce(
      (sum, line) => sum + line.sellerFundedCouponAdjustmentPaise,
      0,
    );
    const platformFundedCouponAdjustmentPaise = input.lines.reduce(
      (sum, line) => sum + line.platformFundedCouponAdjustmentPaise,
      0,
    );
    const payment = this.refundablePayment(input.order);
    const refundNumber = await this.createRefundNumber(tx);

    return tx.refundRequest.create({
      data: {
        refundNumber,
        orderId: input.order.id,
        customerId: input.order.customerId,
        paymentId: payment?.id ?? null,
        status: input.status,
        reason: input.reason,
        amountPaise,
        couponAdjustmentPaise,
        sellerFundedCouponAdjustmentPaise,
        platformFundedCouponAdjustmentPaise,
        currency: input.order.currency,
        note: input.note,
        createdById: input.actor.id,
        ...(input.status === RefundRequestStatus.APPROVED
          ? { approvedAt: new Date(), reviewedAt: new Date(), reviewedById: input.actor.id }
          : {}),
        items: {
          create: input.lines.map((line) => ({
            orderItemId: line.orderItemId,
            orderSellerSplitId:
              input.order.sellerSplits.find((split) => split.sellerId === line.sellerId)?.id ??
              line.orderSellerSplitId,
            sellerId: line.sellerId,
            quantity: line.quantity,
            amountPaise: line.buyerRefundPaise,
            couponAdjustmentPaise: line.couponAdjustmentPaise,
            sellerFundedCouponAdjustmentPaise: line.sellerFundedCouponAdjustmentPaise,
            platformFundedCouponAdjustmentPaise: line.platformFundedCouponAdjustmentPaise,
          })),
        },
      },
    });
  }

  private async createRefundRequestFromReturnItems(
    tx: Prisma.TransactionClient,
    input: {
      refundNumber: string;
      order: ReturnOrder | { id: string; customerId: string; currency: string; payments: unknown[] };
      returnRequestId: string;
      returnItems: Array<{
        id: string;
        orderItemId: string;
        orderSellerSplitId: string;
        sellerId: string;
        quantity: number;
        approvedRefundPaise: number;
        couponAdjustmentPaise: number;
        couponSellerFundedAdjustmentPaise: number;
        couponPlatformFundedAdjustmentPaise: number;
      }>;
      actor: RequestUser;
      status: RefundRequestStatus;
      note: string;
    },
  ) {
    const amountPaise = input.returnItems.reduce((sum, item) => sum + item.approvedRefundPaise, 0);
    const couponAdjustmentPaise = input.returnItems.reduce(
      (sum, item) => sum + item.couponAdjustmentPaise,
      0,
    );
    const sellerFundedCouponAdjustmentPaise = input.returnItems.reduce(
      (sum, item) => sum + item.couponSellerFundedAdjustmentPaise,
      0,
    );
    const platformFundedCouponAdjustmentPaise = input.returnItems.reduce(
      (sum, item) => sum + item.couponPlatformFundedAdjustmentPaise,
      0,
    );
    const payment = "payments" in input.order ? this.refundablePayment(input.order as ReturnOrder) : null;

    if (amountPaise <= 0) {
      return null;
    }

    const refund = await tx.refundRequest.create({
      data: {
        refundNumber: input.refundNumber,
        orderId: input.order.id,
        customerId: input.order.customerId,
        paymentId: payment?.id ?? null,
        returnRequestId: input.returnRequestId,
        status: input.status,
        reason:
          input.returnItems.some((item) => item.approvedRefundPaise > 0) &&
          input.returnItems.length > 1
            ? RefundReason.RETURN_PARTIAL_REFUND
            : RefundReason.RETURN_REFUND,
        amountPaise,
        couponAdjustmentPaise,
        sellerFundedCouponAdjustmentPaise,
        platformFundedCouponAdjustmentPaise,
        currency: input.order.currency,
        note: input.note,
        createdById: input.actor.id,
        items: {
          create: input.returnItems.map((item) => ({
            returnRequestItemId: item.id,
            orderItemId: item.orderItemId,
            orderSellerSplitId: item.orderSellerSplitId,
            sellerId: item.sellerId,
            quantity: item.quantity,
            amountPaise: item.approvedRefundPaise,
            couponAdjustmentPaise: item.couponAdjustmentPaise,
            sellerFundedCouponAdjustmentPaise: item.couponSellerFundedAdjustmentPaise,
            platformFundedCouponAdjustmentPaise: item.couponPlatformFundedAdjustmentPaise,
          })),
        },
      },
    });

    await tx.returnRequestItem.updateMany({
      where: { id: { in: input.returnItems.map((item) => item.id) } },
      data: { status: ReturnRequestItemStatus.REFUND_REQUESTED },
    });

    return refund;
  }

  private async approveReturnInTransaction(
    tx: Prisma.TransactionClient,
    existing: Prisma.ReturnRequestGetPayload<{
      include: { items: true; refundRequests: true; order: { include: { payments: true; sellerSplits: { include: { payout: true } } } } };
    }>,
    actor: RequestUser,
    refundNumber: string,
    note?: string,
  ) {
    if (existing.status !== ReturnRequestStatus.PENDING_REVIEW) {
      throw new BadRequestException("Only pending returns can be approved.");
    }
    const approvedAmountPaise = existing.items.reduce(
      (sum, item) => sum + item.requestedRefundPaise,
      0,
    );
    await tx.returnRequest.update({
      where: { id: existing.id },
      data: {
        status: ReturnRequestStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: actor.id,
        approvedAmountPaise,
      },
    });
    await tx.returnRequestItem.updateMany({
      where: { returnRequestId: existing.id },
      data: {
        status: ReturnRequestItemStatus.APPROVED,
      },
    });
    for (const item of existing.items) {
      await tx.returnRequestItem.update({
        where: { id: item.id },
        data: { approvedRefundPaise: item.requestedRefundPaise },
      });
    }
    await this.createReverseShipmentsForReturn(
      tx,
      existing.id,
      existing.orderId,
      ReverseShipmentMode.PLATFORM_PICKUP,
      existing.items.map((item) => ({
        sellerId: item.sellerId,
      })),
    );
    if (this.resolutionNeedsRefund(existing.resolution) && approvedAmountPaise > 0) {
      await this.createRefundRequestFromReturnItems(tx, {
        refundNumber,
        order: existing.order as never,
        returnRequestId: existing.id,
        returnItems: existing.items.map((item) => ({
          ...item,
          approvedRefundPaise: item.requestedRefundPaise,
        })),
        actor,
        status: RefundRequestStatus.PENDING_REVIEW,
        note: note ?? "Return approved; refund awaits finance approval.",
      });
    }
  }

  private async closeReturnInTransaction(
    tx: Prisma.TransactionClient,
    existing: Prisma.ReturnRequestGetPayload<{
      include: { items: true; refundRequests: true; order: { include: { payments: true; sellerSplits: { include: { payout: true } } } } };
    }>,
    actor: RequestUser,
    status: ReturnRequestStatus,
    note?: string,
  ) {
    await tx.returnRequest.update({
      where: { id: existing.id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedById: actor.id,
      },
    });
    await tx.returnRequestItem.updateMany({
      where: { returnRequestId: existing.id },
      data: { status: ReturnRequestItemStatus.REJECTED },
    });
    await tx.refundRequest.updateMany({
      where: {
        returnRequestId: existing.id,
        status: { notIn: [RefundRequestStatus.SUCCESS, RefundRequestStatus.CANCELLED] },
      },
      data: {
        status: RefundRequestStatus.CANCELLED,
        note: note ?? "Return request was rejected or cancelled.",
      },
    });
  }

  private async createReverseShipmentsForReturn(
    tx: Prisma.TransactionClient,
    returnRequestId: string,
    orderId: string,
    mode: ReverseShipmentMode,
    lines: Array<{ sellerId: string }>,
  ) {
    const sellerIds = Array.from(new Set(lines.map((line) => line.sellerId)));
    const existing = await tx.reverseShipment.findMany({
      where: { returnRequestId },
      select: { sellerId: true },
    });
    const existingSellerIds = new Set(existing.map((item) => item.sellerId));

    for (const sellerId of sellerIds) {
      if (existingSellerIds.has(sellerId)) {
        continue;
      }
      await tx.reverseShipment.create({
        data: {
          returnRequestId,
          orderId,
          sellerId,
          mode,
          status: ReverseShipmentStatus.REQUESTED,
        },
      });
    }
  }

  private async pendingReturnQuantityByOrderItem(tx: Prisma.TransactionClient, orderId: string) {
    const rows = await tx.returnRequestItem.groupBy({
      by: ["orderItemId"],
      where: {
        orderId,
        status: { in: [...pendingReturnItemStatuses] },
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
  }

  private resolutionNeedsRefund(resolution: ReturnRequestResolution) {
    return (
      resolution === ReturnRequestResolution.REFUND ||
      resolution === ReturnRequestResolution.PARTIAL_REFUND
    );
  }

  private async completeRefundInTransaction(
    tx: Prisma.TransactionClient,
    refundId: string,
    actor: RequestUser | null,
    options: { method: RefundMethod; note: string },
  ) {
    const refund = await tx.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        order: { include: { items: true, sellerSplits: { include: { payout: true } } } },
        items: true,
      },
    });
    if (!refund) {
      throw new NotFoundException("Refund request not found.");
    }
    if (refund.status === RefundRequestStatus.SUCCESS) {
      return refund;
    }

    const splitById = new Map(refund.order.sellerSplits.map((split) => [split.id, split]));
    for (const item of refund.items) {
      const isReturnRefund = Boolean(item.returnRequestItemId);
      const activeItem = refund.order.items.find((orderItem) => orderItem.id === item.orderItemId);
      const split = splitById.get(item.orderSellerSplitId);
      const sellerPayoutAdjustmentPaise =
        item.amountPaise + item.platformFundedCouponAdjustmentPaise;

      await tx.orderItem.update({
        where: { id: item.orderItemId },
        data: {
          refundedQuantity: { increment: item.quantity },
          refundedAmountPaise: { increment: item.amountPaise },
          ...(isReturnRefund
            ? {
                activeQuantity: { decrement: item.quantity },
                retainedQuantity: { decrement: item.quantity },
                returnedQuantity: { increment: item.quantity },
                returnedAmountPaise: { increment: item.amountPaise },
              }
            : {}),
          lifecycleStatus:
            activeItem && item.quantity >= this.activeQuantity(activeItem)
              ? OrderItemLifecycleStatus.REFUNDED
              : OrderItemLifecycleStatus.PARTIALLY_REFUNDED,
        },
      });

      if (isReturnRefund) {
        await tx.returnRequestItem.update({
          where: { id: item.returnRequestItemId! },
          data: { status: ReturnRequestItemStatus.CLOSED },
        });
        await tx.orderSellerSplit.update({
          where: { id: item.orderSellerSplitId },
          data: {
            refundAdjustmentPaise: { decrement: sellerPayoutAdjustmentPaise },
            couponAdjustmentPaise: { increment: item.sellerFundedCouponAdjustmentPaise },
            ...(split?.payout?.status === SellerPayoutStatus.PAID
              ? { settlementStatus: SellerSettlementStatus.ADJUSTED }
              : {}),
          },
        });
        if (split?.payout?.status === SellerPayoutStatus.PAID) {
          await this.createSellerRefundLedgerAdjustment(tx, {
            splitId: split.id,
            sellerId: item.sellerId,
            orderId: refund.orderId,
            payoutId: split.payoutId,
            amountPaise: sellerPayoutAdjustmentPaise,
            actor,
            referenceId: `refund:${refund.refundNumber}:${item.id}`,
            description: `Refund adjustment ${refund.refundNumber}`,
          });
        }
      }
    }

    const updated = await tx.refundRequest.update({
      where: { id: refund.id },
      data: {
        status: RefundRequestStatus.SUCCESS,
        method: options.method,
        reviewedAt: new Date(),
        reviewedById: actor?.id ?? null,
        note: options.note,
      },
    });

    if (refund.returnRequestId) {
      await tx.returnRequest.update({
        where: { id: refund.returnRequestId },
        data: { status: ReturnRequestStatus.RESOLVED },
      });
    }

    const remainingActiveQuantity = refund.order.items.reduce(
      (sum, item) =>
        sum +
        Math.max(
          this.activeQuantity(item) -
            refund.items
              .filter((refundItem) => refundItem.orderItemId === item.id && refundItem.returnRequestItemId)
              .reduce((itemSum, refundItem) => itemSum + refundItem.quantity, 0),
          0,
        ),
      0,
    );
    if (remainingActiveQuantity === 0 && refund.order.paymentStatus === PaymentStatus.PAID) {
      await tx.order.update({
        where: { id: refund.orderId },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: refund.orderId,
          statusType: StatusEventType.PAYMENT,
          oldStatus: PaymentStatus.PAID,
          newStatus: PaymentStatus.REFUNDED,
          note: options.note,
          createdById: actor?.id ?? null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: actor?.id ?? null,
        action: "refund.completed",
        entityType: "refund_request",
        entityId: refund.id,
        oldValue: { status: refund.status },
        newValue: { status: RefundRequestStatus.SUCCESS, method: options.method },
      },
    });

    return updated;
  }

  private async createSellerRefundLedgerAdjustment(
    tx: Prisma.TransactionClient,
    input: {
      splitId: string;
      sellerId: string;
      orderId: string;
      payoutId: string | null;
      amountPaise: number;
      actor: RequestUser | null;
      referenceId: string;
      description: string;
    },
  ) {
    if (input.amountPaise <= 0) {
      return;
    }
    const existing = await tx.sellerLedgerEntry.findFirst({
      where: {
        orderSellerSplitId: input.splitId,
        entryType: SellerLedgerEntryType.REFUND_ADJUSTMENT,
        referenceId: input.referenceId,
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    await this.sellerLedger.createEntry(tx, {
      sellerId: input.sellerId,
      orderId: input.orderId,
      orderSellerSplitId: input.splitId,
      payoutId: input.payoutId,
      entryType: SellerLedgerEntryType.REFUND_ADJUSTMENT,
      description: input.description,
      debitPaise: input.amountPaise,
      referenceType: "refund",
      referenceId: input.referenceId,
      ...(input.actor?.id ? { createdById: input.actor.id } : {}),
    });
  }

  private returnListWhere(
    query: ReturnListQueryDto,
    extra: Prisma.ReturnRequestWhereInput = {},
  ): Prisma.ReturnRequestWhereInput {
    const search = query.search?.trim();
    return {
      ...extra,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { requestNumber: { contains: search, mode: "insensitive" } },
              { order: { orderNumber: { contains: search, mode: "insensitive" } } },
              { customer: { user: { email: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
  }

  private refundListWhere(query: RefundListQueryDto): Prisma.RefundRequestWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { refundNumber: { contains: search, mode: "insensitive" } },
              { order: { orderNumber: { contains: search, mode: "insensitive" } } },
              { customer: { user: { email: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
  }

  private async listReturnDetails(
    where: Prisma.ReturnRequestWhereInput,
    query: ReturnListQueryDto,
    options: { deliveryPartnerId?: string } = {},
  ) {
    const { take, cursor } = cursorPaginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 50,
    });
    const cursorWhere = createdAtCursorWhere(cursor) as Prisma.ReturnRequestWhereInput | undefined;
    const items = await this.prisma.client.returnRequest.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      include: returnDetailInclude,
      orderBy: createdAtCursorOrderBy(),
      take: take + 1,
    });
    const page = cursorPageFromItems(items, take);
    return {
      ...page,
      limit: take,
      items: page.items.map((item) =>
        this.returnDetailReadback(
          item,
          options.deliveryPartnerId ? { deliveryPartnerId: options.deliveryPartnerId } : {},
        ),
      ),
    };
  }

  private async getReversePickupAssignmentTarget(requestNumber: string) {
    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { requestNumber },
      include: reversePickupAssignmentTargetInclude,
    });
    if (!detail) {
      throw new NotFoundException("Return request not found.");
    }
    if (!detail.reverseShipments.length) {
      throw new BadRequestException("Reverse pickup is created after the return is approved.");
    }
    if (
      detail.status === ReturnRequestStatus.REJECTED ||
      detail.status === ReturnRequestStatus.CANCELLED ||
      detail.status === ReturnRequestStatus.RESOLVED
    ) {
      throw new BadRequestException("Closed return requests cannot be assigned for pickup.");
    }
    return detail;
  }

  private async tryAutoAssignReversePickupAfterApproval(actor: RequestUser, requestNumber: string) {
    try {
      const target = await this.getReversePickupAssignmentTarget(requestNumber);
      this.assertReversePickupSellerDestinations(target);
      if (
        target.reverseShipments.some(
          (shipment) =>
            shipment.assignedPartnerUserId &&
            (shipment.assignmentStatus === DeliveryAssignmentStatus.ASSIGNED ||
              shipment.assignmentStatus === DeliveryAssignmentStatus.ACCEPTED),
        )
      ) {
        return;
      }
      const selection = await this.chooseBestReversePickupPartner(target);
      if (!selection.candidate) {
        await this.markReversePickupAutoAssignmentMiss(
          actor,
          target.id,
          this.noReversePickupAssignmentNote(selection.diagnostics),
        );
        return;
      }
      await this.setReversePickupAssignment(
        actor,
        requestNumber,
        {
          deliveryPartnerUserId: selection.candidate.user.id,
          assignmentNote: this.reversePickupAutoAssignmentNote(
            "Auto assigned after return approval.",
            selection.candidate,
            selection.diagnostics,
          ),
        },
        DeliveryAssignmentAttemptSource.AUTO,
      );
    } catch (error) {
      const request = await this.prisma.client.returnRequest.findUnique({
        where: { requestNumber },
        select: { id: true },
      });
      if (request) {
        await this.prisma.client.returnRequestNote.create({
          data: {
            returnRequestId: request.id,
            note: `Reverse pickup auto-assignment needs admin review: ${error instanceof Error ? error.message : "assignment failed"}`,
            createdById: actor.id,
          },
        }).catch(() => undefined);
      }
    }
  }

  private async setReversePickupAssignment(
    actor: RequestUser,
    requestNumber: string,
    dto: ReversePickupAssignmentDto,
    source: DeliveryAssignmentAttemptSource,
  ) {
    const target = await this.getReversePickupAssignmentTarget(requestNumber);
    const partnerUserId = dto.deliveryPartnerUserId ?? null;
    const isUnassign = !partnerUserId;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    this.assertReversePickupAssignable(target, isUnassign);
    if (!isUnassign) {
      this.assertReversePickupSellerDestinations(target);
    }

    const returnRequestId = await this.prisma.client.$transaction(async (tx) => {
      if (partnerUserId) {
        await this.assertDeliveryPartnerUser(tx, partnerUserId);
      }

      const activeShipmentIds = target.reverseShipments.map((shipment) => shipment.id);
      await tx.reverseShipmentAssignmentAttempt.updateMany({
        where: {
          returnRequestId: target.id,
          status: DeliveryAssignmentStatus.ASSIGNED,
        },
        data: {
          status: DeliveryAssignmentStatus.CANCELLED,
          respondedAt: now,
          note: isUnassign
            ? (dto.assignmentNote ?? "Return pickup unassigned.")
            : (dto.assignmentNote ?? "Return pickup reassigned."),
        },
      });

      await tx.reverseShipment.updateMany({
        where: { id: { in: activeShipmentIds } },
        data: {
          assignedPartnerUserId: partnerUserId,
          assignmentStatus: isUnassign
            ? DeliveryAssignmentStatus.UNASSIGNED
            : DeliveryAssignmentStatus.ASSIGNED,
          status: isUnassign ? ReverseShipmentStatus.REQUESTED : ReverseShipmentStatus.ASSIGNED,
          assignedAt: isUnassign ? null : now,
          acceptedAt: null,
          rejectedAt: null,
          assignmentExpiresAt: isUnassign ? null : expiresAt,
          assignmentNote:
            dto.assignmentNote ??
            (isUnassign ? "Return pickup unassigned." : "Return pickup assigned."),
        },
      });

      if (partnerUserId) {
        for (const shipment of target.reverseShipments) {
          await tx.reverseShipmentAssignmentAttempt.create({
            data: {
              returnRequestId: target.id,
              reverseShipmentId: shipment.id,
              partnerUserId,
              source,
              status: DeliveryAssignmentStatus.ASSIGNED,
              note:
                dto.assignmentNote ??
                (source === DeliveryAssignmentAttemptSource.AUTO
                  ? "Auto assigned by return operations."
                  : "Assigned by admin."),
              assignedById: actor.id,
            },
          });
        }
      }

      for (const shipment of target.reverseShipments) {
        await tx.reverseShipmentEvent.create({
          data: {
            reverseShipmentId: shipment.id,
            oldStatus: shipment.status,
            newStatus: isUnassign ? ReverseShipmentStatus.REQUESTED : ReverseShipmentStatus.ASSIGNED,
            note:
              dto.assignmentNote ??
              (isUnassign ? "Return pickup assignment released." : "Return pickup assigned."),
            createdById: actor.id,
          },
        });
      }

      if (!isUnassign) {
        await tx.returnRequest.update({
          where: { id: target.id },
          data: { status: ReturnRequestStatus.PICKUP_PENDING },
        });
        await tx.returnRequestItem.updateMany({
          where: { returnRequestId: target.id, status: ReturnRequestItemStatus.APPROVED },
          data: { status: ReturnRequestItemStatus.PICKUP_PENDING },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: isUnassign
            ? "return.reverse_pickup.unassigned"
            : "return.reverse_pickup.assigned",
          entityType: "return_request",
          entityId: target.id,
          oldValue: {
            assignedPartnerUserIds: Array.from(
              new Set(target.reverseShipments.map((shipment) => shipment.assignedPartnerUserId).filter(Boolean)),
            ),
          },
          newValue: {
            requestNumber,
            deliveryPartnerUserId: partnerUserId,
            assignmentStatus: isUnassign
              ? DeliveryAssignmentStatus.UNASSIGNED
              : DeliveryAssignmentStatus.ASSIGNED,
            source,
            expiresAt: isUnassign ? null : expiresAt,
            note: dto.assignmentNote ?? null,
          },
        },
      });

      return target.id;
    });

    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: returnDetailInclude,
    });
    return this.returnDetailReadback(detail!, { includeCustomerContact: true });
  }

  private assertReversePickupAssignable(target: ReversePickupAssignmentTarget, isUnassign: boolean) {
    const lockedStatuses = new Set<ReverseShipmentStatus>([
      ReverseShipmentStatus.PICKED_UP,
      ReverseShipmentStatus.IN_TRANSIT,
      ReverseShipmentStatus.RECEIVED,
    ]);
    const afterPickup = target.reverseShipments.some((shipment) => lockedStatuses.has(shipment.status));
    if (afterPickup) {
      throw new BadRequestException(
        isUnassign
          ? "Picked-up return packages cannot be unassigned."
          : "Picked-up return packages cannot be reassigned through normal assignment.",
      );
    }
  }

  private assertReversePickupSellerDestinations(target: ReversePickupAssignmentTarget) {
    const missing = target.reverseShipments.filter((shipment) => !shipment.seller.addresses.length);
    if (missing.length) {
      throw new BadRequestException(
        `Seller store address missing for ${missing.map((shipment) => shipment.seller.storeName).join(", ")}.`,
      );
    }
  }

  private async markReversePickupAutoAssignmentMiss(
    actor: RequestUser,
    returnRequestId: string,
    note: string,
  ) {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.reverseShipment.updateMany({
        where: { returnRequestId },
        data: {
          assignedPartnerUserId: null,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
          status: ReverseShipmentStatus.REQUESTED,
          assignedAt: null,
          acceptedAt: null,
          rejectedAt: null,
          assignmentExpiresAt: null,
          assignmentNote: note,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "return.reverse_pickup.auto_no_match",
          entityType: "return_request",
          entityId: returnRequestId,
          newValue: { note },
        },
      });
    });
  }

  private async releaseReversePickupShipmentsInTransaction(
    tx: Prisma.TransactionClient,
    returnRequestId: string,
    shipmentIds: string[],
    actor: RequestUser,
    note: string,
    attemptStatus: DeliveryAssignmentStatus,
  ) {
    await tx.reverseShipment.updateMany({
      where: { id: { in: shipmentIds } },
      data: {
        assignedPartnerUserId: null,
        assignmentStatus:
          attemptStatus === DeliveryAssignmentStatus.REJECTED
            ? DeliveryAssignmentStatus.REJECTED
            : DeliveryAssignmentStatus.UNASSIGNED,
        status: ReverseShipmentStatus.REQUESTED,
        assignedAt: null,
        acceptedAt: null,
        rejectedAt: new Date(),
        assignmentExpiresAt: null,
        assignmentNote: note,
      },
    });
    await tx.reverseShipmentAssignmentAttempt.updateMany({
      where: {
        returnRequestId,
        reverseShipmentId: { in: shipmentIds },
        status: DeliveryAssignmentStatus.ASSIGNED,
      },
      data: {
        status: attemptStatus,
        respondedAt: new Date(),
        note,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "return.reverse_pickup.released",
        entityType: "return_request",
        entityId: returnRequestId,
        newValue: { shipmentIds, status: attemptStatus, note },
      },
    });
  }

  private reversePickupUpdateData(
    shipment: { awbNumber: string | null; courierName: string | null; trackingReference: string | null; proofReference: string | null; pickupNote: string | null },
    dto: ReversePickupUpdateDto,
    now: Date,
  ): Prisma.ReverseShipmentUpdateInput {
    const pickupProofReference = dto.pickupProofReference ?? dto.proofReference;
    const data: Prisma.ReverseShipmentUpdateInput = {
      status: dto.status,
      awbNumber: dto.awbNumber ?? shipment.awbNumber,
      courierName: dto.courierName ?? shipment.courierName,
      trackingReference: dto.trackingReference ?? shipment.trackingReference,
      proofReference: dto.proofReference ?? shipment.proofReference,
      pickupNote: dto.note ?? shipment.pickupNote,
      ...(dto.status === ReverseShipmentStatus.PICKED_UP ? { pickedUpAt: now } : {}),
      ...(dto.status === ReverseShipmentStatus.RECEIVED ? { receivedAt: now } : {}),
    };
    if (dto.status === ReverseShipmentStatus.PICKED_UP && pickupProofReference) {
      data.pickupProofReference = pickupProofReference;
    }
    return data;
  }

  private async applyReverseShipmentReceiptStatus(
    tx: Prisma.TransactionClient,
    returnRequestId: string,
    sellerId: string,
  ) {
    await tx.returnRequestItem.updateMany({
      where: { returnRequestId, sellerId },
      data: { status: ReturnRequestItemStatus.RECEIVED },
    });
    const remaining = await tx.reverseShipment.count({
      where: {
        returnRequestId,
        status: { notIn: [ReverseShipmentStatus.RECEIVED, ReverseShipmentStatus.CANCELLED] },
      },
    });
    if (remaining === 0) {
      await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: { status: ReturnRequestStatus.RECEIVED },
      });
    }
  }

  private async assertDeliveryPartnerUser(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { code: RoleCode.DELIVERY_PARTNER } } },
        deliveryProfile: { is: { isAvailable: true } },
      },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException("Select an active and available delivery partner.");
    }
  }

  private async chooseBestReversePickupPartner(target: ReversePickupAssignmentTarget) {
    const address = this.readShippingAddressSnapshot(target.order.shippingAddressSnapshot);
    const rejectedPartnerIds = await this.rejectedReversePickupPartnerIds(target.id);
    const partners = await this.prisma.client.user.findMany({
      where: this.reversePickupPartnerCandidateWhere(address, rejectedPartnerIds),
      include: { deliveryProfile: true },
      orderBy: [{ createdAt: "asc" }],
    });
    let skippedUnavailable = 0;
    const metrics = await this.reversePickupPartnerAssignmentMetrics(partners.map((partner) => partner.id));

    const candidates = partners.map((user) => {
      const area = this.deliveryPartnerServiceAreaScore(user.deliveryProfile, address);
      if (!area.eligible) {
        skippedUnavailable += 1;
        return null;
      }
      return {
        user,
        score: area.score,
        workload: metrics.workload.get(user.id) ?? 0,
        lastAssignmentAt: metrics.lastAssignmentAt.get(user.id) ?? null,
        area,
      };
    });
    const eligibleCandidates = candidates.filter(
      (candidate): candidate is ReversePickupPartnerCandidate => Boolean(candidate),
    );
    const candidate =
      eligibleCandidates.sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (left.workload !== right.workload) return left.workload - right.workload;
        const leftLast = left.lastAssignmentAt?.getTime() ?? 0;
        const rightLast = right.lastAssignmentAt?.getTime() ?? 0;
        if (leftLast !== rightLast) return leftLast - rightLast;
        return left.user.createdAt.getTime() - right.user.createdAt.getTime();
      })[0] ?? null;

    return {
      candidate,
      diagnostics: {
        partnersChecked: partners.length,
        skippedUnavailable,
        skippedRejected: rejectedPartnerIds.size,
        eligibleCandidates: eligibleCandidates.length,
      },
    };
  }

  private async rejectedReversePickupPartnerIds(returnRequestId: string) {
    const attempts = await this.prisma.client.reverseShipmentAssignmentAttempt.findMany({
      where: { returnRequestId, status: DeliveryAssignmentStatus.REJECTED },
      select: { partnerUserId: true },
      distinct: ["partnerUserId"],
    });
    return new Set(attempts.map((attempt) => attempt.partnerUserId));
  }

  private async reversePickupPartnerAssignmentMetrics(partnerIds: string[]) {
    const workload = new Map<string, number>();
    const lastAssignmentAt = new Map<string, Date>();
    if (!partnerIds.length) {
      return { workload, lastAssignmentAt };
    }
    const [deliveryWorkloadRows, reverseWorkloadRows, deliveryLastRows, reverseLastRows] =
      await Promise.all([
        this.prisma.client.orderShipment.groupBy({
          by: ["deliveryPartnerUserId"],
          where: {
            deliveryPartnerUserId: { in: partnerIds },
            assignmentStatus: { in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED] },
            status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
          },
          _count: { id: true },
        }),
        this.prisma.client.reverseShipment.groupBy({
          by: ["assignedPartnerUserId"],
          where: {
            assignedPartnerUserId: { in: partnerIds },
            assignmentStatus: { in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED] },
            status: { notIn: [ReverseShipmentStatus.RECEIVED, ReverseShipmentStatus.CANCELLED] },
          },
          _count: { id: true },
        }),
        this.prisma.client.deliveryAssignmentAttempt.groupBy({
          by: ["partnerUserId"],
          where: {
            partnerUserId: { in: partnerIds },
            status: { in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED] },
          },
          _max: { createdAt: true },
        }),
        this.prisma.client.reverseShipmentAssignmentAttempt.groupBy({
          by: ["partnerUserId"],
          where: {
            partnerUserId: { in: partnerIds },
            status: { in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED] },
          },
          _max: { createdAt: true },
        }),
      ]);

    deliveryWorkloadRows.forEach((row) => {
      if (row.deliveryPartnerUserId) {
        workload.set(row.deliveryPartnerUserId, (workload.get(row.deliveryPartnerUserId) ?? 0) + row._count.id);
      }
    });
    reverseWorkloadRows.forEach((row) => {
      if (row.assignedPartnerUserId) {
        workload.set(row.assignedPartnerUserId, (workload.get(row.assignedPartnerUserId) ?? 0) + row._count.id);
      }
    });
    [...deliveryLastRows, ...reverseLastRows].forEach((row) => {
      if (row._max.createdAt) {
        const existing = lastAssignmentAt.get(row.partnerUserId);
        if (!existing || row._max.createdAt.getTime() > existing.getTime()) {
          lastAssignmentAt.set(row.partnerUserId, row._max.createdAt);
        }
      }
    });
    return { workload, lastAssignmentAt };
  }

  private reversePickupPartnerCandidateWhere(
    address: TrackableAddressSnapshot | null,
    rejectedPartnerIds: Set<string>,
  ): Prisma.UserWhereInput {
    const profileAnd: Prisma.DeliveryPartnerProfileWhereInput[] = [{ isAvailable: true }];
    if (address?.countryCode) {
      profileAnd.push({ OR: [{ serviceCountryCode: null }, { serviceCountryCode: address.countryCode }] });
    }
    if (address?.stateCode) {
      profileAnd.push({ OR: [{ serviceStateCode: null }, { serviceStateCode: address.stateCode }] });
    }
    const serviceAreaOr: Prisma.DeliveryPartnerProfileWhereInput[] = [];
    if (address?.localAreaCode) serviceAreaOr.push({ serviceLocalAreaCodes: { has: address.localAreaCode } });
    if (address?.pincode) serviceAreaOr.push({ servicePincodes: { has: address.pincode } });
    if (address?.cityCode) serviceAreaOr.push({ serviceCityCode: address.cityCode });
    if (address?.stateCode) serviceAreaOr.push({ serviceStateCode: address.stateCode });
    if (address?.countryCode) serviceAreaOr.push({ serviceCountryCode: address.countryCode });
    serviceAreaOr.push({
      serviceCityCode: null,
      servicePincodes: { isEmpty: true },
      serviceLocalAreaCodes: { isEmpty: true },
    });
    profileAnd.push({ OR: serviceAreaOr });

    return {
      ...(rejectedPartnerIds.size ? { id: { notIn: Array.from(rejectedPartnerIds) } } : {}),
      status: UserStatus.ACTIVE,
      userRoles: { some: { role: { code: RoleCode.DELIVERY_PARTNER } } },
      deliveryProfile: { is: { AND: profileAnd } },
    };
  }

  private deliveryPartnerServiceAreaScore(
    profile: {
      isAvailable: boolean;
      serviceCountryCode: string | null;
      serviceStateCode: string | null;
      serviceCityCode: string | null;
      servicePincodes: string[];
      serviceLocalAreaCodes: string[];
    } | null,
    address: TrackableAddressSnapshot | null,
  ) {
    if (!profile?.isAvailable) {
      return { eligible: false, score: 0, matchLabel: "unavailable", matchedFields: [], warnings: ["Partner profile is inactive or unavailable"] };
    }
    let score = 5;
    const matchedFields: string[] = [];
    const warnings: string[] = [];
    this.scoreConfiguredCode(profile.serviceCountryCode, address?.countryCode, "country", 5, matchedFields, warnings, (points) => { score += points; });
    this.scoreConfiguredCode(profile.serviceStateCode, address?.stateCode, "state", 10, matchedFields, warnings, (points) => { score += points; });
    this.scoreConfiguredCode(profile.serviceCityCode, address?.cityCode, "city", 40, matchedFields, warnings, (points) => { score += points; });
    this.scoreConfiguredArray(profile.servicePincodes, address?.pincode, "pincode", 30, matchedFields, warnings, (points) => { score += points; });
    this.scoreConfiguredArray(profile.serviceLocalAreaCodes, address?.localAreaCode, "local area", 35, matchedFields, warnings, (points) => { score += points; });
    return { eligible: true, score, matchLabel: this.serviceAreaMatchLabel(matchedFields), matchedFields, warnings };
  }

  private scoreConfiguredCode(
    configured: string | null | undefined,
    actual: string | null | undefined,
    label: string,
    points: number,
    matchedFields: string[],
    warnings: string[],
    addScore: (points: number) => void,
  ) {
    if (!configured) return;
    if (actual && configured.trim().toUpperCase() === actual.trim().toUpperCase()) {
      matchedFields.push(label);
      addScore(points);
      return;
    }
    warnings.push(actual ? `outside configured ${label}` : `missing ${label} on pickup address`);
  }

  private scoreConfiguredArray(
    configured: string[],
    actual: string | null | undefined,
    label: string,
    points: number,
    matchedFields: string[],
    warnings: string[],
    addScore: (points: number) => void,
  ) {
    if (!configured.length) return;
    if (actual && configured.some((value) => value.trim().toUpperCase() === actual.trim().toUpperCase())) {
      matchedFields.push(label);
      addScore(points);
      return;
    }
    warnings.push(actual ? `outside configured ${label}` : `missing ${label} on pickup address`);
  }

  private serviceAreaMatchLabel(matchedFields: string[]) {
    if (matchedFields.includes("local area")) return "local area";
    if (matchedFields.includes("pincode")) return "pincode";
    if (matchedFields.includes("city")) return "city";
    if (matchedFields.includes("state")) return "state fallback";
    if (matchedFields.includes("country")) return "country fallback";
    return "broad fallback";
  }

  private reversePickupAutoAssignmentNote(
    note: string,
    candidate: ReversePickupPartnerCandidate,
    diagnostics: { skippedRejected: number },
  ) {
    const parts = [
      note,
      `Matched ${candidate.area.matchLabel}.`,
      `Workload ${candidate.workload}.`,
    ];
    if (diagnostics.skippedRejected > 0) {
      parts.push(`${diagnostics.skippedRejected} rejected partner(s) skipped.`);
    }
    if (candidate.area.warnings.length) {
      parts.push(`Review route: ${candidate.area.warnings.join("; ")}.`);
    }
    return parts.join(" ");
  }

  private noReversePickupAssignmentNote(diagnostics: {
    partnersChecked: number;
    skippedUnavailable: number;
    skippedRejected: number;
    eligibleCandidates: number;
  }) {
    const parts = [
      "No eligible delivery partner found for return pickup auto-assignment.",
      `${diagnostics.partnersChecked} active delivery partner user(s) checked.`,
    ];
    if (diagnostics.skippedUnavailable > 0) {
      parts.push(`${diagnostics.skippedUnavailable} missing an active available delivery profile.`);
    }
    if (diagnostics.skippedRejected > 0) {
      parts.push(`${diagnostics.skippedRejected} previously rejected partner(s) skipped.`);
    }
    if (diagnostics.eligibleCandidates === 0) {
      parts.push("Admin can assign a partner manually after checking route coverage.");
    }
    return parts.join(" ");
  }

  private async listReturnRequests(
    where: Prisma.ReturnRequestWhereInput,
    query: ReturnListQueryDto,
    options: { sellerId?: string; includeCustomerContact?: boolean } = {},
  ) {
    const { take, cursor } = cursorPaginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 50,
    });
    const cursorWhere = createdAtCursorWhere(cursor) as Prisma.ReturnRequestWhereInput | undefined;
    const items = await this.prisma.client.returnRequest.findMany({
      where: cursorWhere ? { AND: [where, cursorWhere] } : where,
      select: {
        id: true,
        requestNumber: true,
        status: true,
        resolution: true,
        reason: true,
        totalQuantity: true,
        requestedAmountPaise: true,
        approvedAmountPaise: true,
        currency: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            orderStatus: true,
            paymentStatus: true,
            deliveryStatus: true,
          },
        },
        customer: {
          select: {
            displayName: true,
            user: { select: { email: true, fullName: true } },
          },
        },
        items: {
          ...(options.sellerId ? { where: { sellerId: options.sellerId } } : {}),
          select: {
            id: true,
            quantity: true,
            status: true,
            sellerId: true,
            seller: { select: { storeName: true, slug: true } },
            orderItem: { select: { productNameSnapshot: true } },
          },
        },
      },
      orderBy: createdAtCursorOrderBy(),
      take: take + 1,
    });
    const page = cursorPageFromItems(items, take);
    return {
      ...page,
      limit: take,
      items: page.items.map((item) =>
        this.returnSummaryReadback(item, {
          includeCustomerContact: options.includeCustomerContact ?? false,
        }),
      ),
    };
  }

  private returnSummaryReadback(
    request: ReturnSummaryReadbackInput,
    options: { includeCustomerContact?: boolean } = {},
  ) {
    return {
      id: request.id,
      requestNumber: request.requestNumber,
      status: request.status,
      resolution: request.resolution,
      reason: request.reason,
      totalQuantity: request.totalQuantity,
      requestedAmountPaise: request.requestedAmountPaise,
      approvedAmountPaise: request.approvedAmountPaise,
      currency: request.currency,
      createdAt: request.createdAt,
      order: request.order,
      customerName: request.customer.user.fullName ?? request.customer.displayName,
      ...(options.includeCustomerContact ? { customerEmail: request.customer.user.email } : {}),
      items: request.items.map((item) => ({
        id: item.id,
        productName: item.orderItem.productNameSnapshot,
        quantity: item.quantity,
        status: item.status,
        sellerId: item.sellerId,
        sellerName: item.seller.storeName,
      })),
    };
  }

  private returnDetailReadback(
    detail: ReturnRequestDetail,
    options: { sellerId?: string; includeCustomerContact?: boolean; deliveryPartnerId?: string } = {},
  ) {
    const items = options.sellerId
      ? detail.items.filter((item) => item.sellerId === options.sellerId)
      : detail.items;
    const reverseShipments = detail.reverseShipments.filter((shipment) => {
      if (options.sellerId && shipment.sellerId !== options.sellerId) return false;
      if (options.deliveryPartnerId && shipment.assignedPartner?.id !== options.deliveryPartnerId) return false;
      return true;
    });
    return {
      id: detail.id,
      requestNumber: detail.requestNumber,
      status: detail.status,
      resolution: detail.resolution,
      reason: detail.reason,
      note: detail.note,
      autoApproved: detail.autoApproved,
      totalQuantity: detail.totalQuantity,
      requestedAmountPaise: detail.requestedAmountPaise,
      approvedAmountPaise: detail.approvedAmountPaise,
      couponAdjustmentPaise: detail.couponAdjustmentPaise,
      currency: detail.currency,
      requestedAt: detail.requestedAt,
      reviewedAt: detail.reviewedAt,
      createdAt: detail.createdAt,
      order: detail.order,
      pickupAddress: this.readShippingAddressSnapshot(detail.order.shippingAddressSnapshot),
      customer: options.includeCustomerContact || options.deliveryPartnerId
        ? {
            id: detail.customer.id,
            name: detail.customer.user.fullName ?? detail.customer.displayName,
            ...(options.includeCustomerContact ? { email: detail.customer.user.email } : {}),
            phone: detail.customer.user.phone,
          }
        : {
            id: detail.customer.id,
            name: detail.customer.user.fullName ?? detail.customer.displayName,
          },
      items: items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        productName: item.orderItem.productNameSnapshot,
        product: item.product,
        seller: item.seller,
        variantSnapshot: item.orderItem.variantSnapshot,
        quantity: item.quantity,
        status: item.status,
        resolution: item.resolution,
        reason: item.reason,
        requestedRefundPaise: item.requestedRefundPaise,
        approvedRefundPaise: item.approvedRefundPaise,
        couponAdjustmentPaise: item.couponAdjustmentPaise,
        qcNote: item.qcNote,
        sellerNote: item.sellerNote,
      })),
      reverseShipments: reverseShipments.map((shipment) => ({
        id: shipment.id,
        sellerId: shipment.sellerId,
        mode: shipment.mode,
        status: shipment.status,
        assignmentStatus: shipment.assignmentStatus,
        awbNumber: shipment.awbNumber,
        courierName: shipment.courierName,
        trackingReference: shipment.trackingReference,
        proofReference: shipment.proofReference,
        pickupProofReference: shipment.pickupProofReference,
        receiptProofReference: shipment.receiptProofReference,
        pickupNote: shipment.pickupNote,
        receivedByName: shipment.receivedByName,
        assignedAt: shipment.assignedAt,
        acceptedAt: shipment.acceptedAt,
        rejectedAt: shipment.rejectedAt,
        assignmentExpiresAt: shipment.assignmentExpiresAt,
        assignmentNote: shipment.assignmentNote,
        pickedUpAt: shipment.pickedUpAt,
        receivedAt: shipment.receivedAt,
        seller: {
          id: shipment.seller.id,
          storeName: shipment.seller.storeName,
          slug: shipment.seller.slug,
          contactName: shipment.seller.profile?.contactName ?? null,
          contactPhone: shipment.seller.profile?.contactPhone ?? null,
          destinationAddress: shipment.seller.addresses[0]
            ? {
                line1: shipment.seller.addresses[0].line1,
                line2: shipment.seller.addresses[0].line2,
                area: shipment.seller.addresses[0].area,
                city: shipment.seller.addresses[0].city,
                state: shipment.seller.addresses[0].state,
                pincode: shipment.seller.addresses[0].pincode,
                country: shipment.seller.addresses[0].country,
                countryCode: shipment.seller.addresses[0].countryCode,
                stateCode: shipment.seller.addresses[0].stateCode,
                cityCode: shipment.seller.addresses[0].cityCode,
                localAreaCode: shipment.seller.addresses[0].localAreaCode,
                latitude: this.readSnapshotNumber(shipment.seller.addresses[0].latitude),
                longitude: this.readSnapshotNumber(shipment.seller.addresses[0].longitude),
              }
            : null,
        },
        assignedPartner: shipment.assignedPartner,
        events: shipment.events,
        assignmentAttempts: shipment.assignmentAttempts,
      })),
      refunds: detail.refundRequests,
      notes: detail.notes.filter((note) => (options.sellerId ? !note.sellerId || note.sellerId === options.sellerId : true)),
    };
  }

  private refundDetailReadback(detail: RefundRequestDetail) {
    return {
      id: detail.id,
      refundNumber: detail.refundNumber,
      status: detail.status,
      reason: detail.reason,
      method: detail.method,
      amountPaise: detail.amountPaise,
      couponAdjustmentPaise: detail.couponAdjustmentPaise,
      sellerFundedCouponAdjustmentPaise: detail.sellerFundedCouponAdjustmentPaise,
      platformFundedCouponAdjustmentPaise: detail.platformFundedCouponAdjustmentPaise,
      currency: detail.currency,
      note: detail.note,
      approvedAt: detail.approvedAt,
      reviewedAt: detail.reviewedAt,
      createdAt: detail.createdAt,
      order: detail.order,
      customer: {
        id: detail.customer.id,
        name: detail.customer.user.fullName ?? detail.customer.displayName,
        email: detail.customer.user.email,
        phone: detail.customer.user.phone,
      },
      payment: detail.payment,
      returnRequest: detail.returnRequest,
      items: detail.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        productName: item.orderItem.productNameSnapshot,
        seller: item.seller,
        quantity: item.quantity,
        amountPaise: item.amountPaise,
        couponAdjustmentPaise: item.couponAdjustmentPaise,
        sellerFundedCouponAdjustmentPaise: item.sellerFundedCouponAdjustmentPaise,
        platformFundedCouponAdjustmentPaise: item.platformFundedCouponAdjustmentPaise,
        returnRequestItem: item.returnRequestItem,
      })),
      transactions: detail.transactions,
    };
  }

  private async getReturnDetailOrThrow(requestNumber: string) {
    const detail = await this.prisma.client.returnRequest.findUnique({
      where: { requestNumber },
      include: returnDetailInclude,
    });
    if (!detail) {
      throw new NotFoundException("Return request not found.");
    }
    return detail;
  }

  private async getRefundDetailOrThrow(refundNumber: string) {
    const detail = await this.prisma.client.refundRequest.findUnique({
      where: { refundNumber },
      include: refundDetailInclude,
    });
    if (!detail) {
      throw new NotFoundException("Refund request not found.");
    }
    return detail;
  }

  private async resolveSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      select: { id: true, storeName: true },
    });
    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }
    return seller;
  }

  private readShippingAddressSnapshot(value: Prisma.JsonValue | null): TrackableAddressSnapshot | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    return {
      fullName: this.readSnapshotString(record.fullName),
      phone: this.readSnapshotString(record.phone),
      line1: this.readSnapshotString(record.line1),
      line2: this.readSnapshotString(record.line2),
      area: this.readSnapshotString(record.area),
      city: this.readSnapshotString(record.city),
      state: this.readSnapshotString(record.state),
      pincode: this.readSnapshotString(record.pincode),
      country: this.readSnapshotString(record.country),
      countryCode: this.readSnapshotString(record.countryCode),
      stateCode: this.readSnapshotString(record.stateCode),
      cityCode: this.readSnapshotString(record.cityCode),
      localAreaCode: this.readSnapshotString(record.localAreaCode),
      latitude: this.readSnapshotNumber(record.latitude),
      longitude: this.readSnapshotNumber(record.longitude),
      locationSource: this.readSnapshotString(record.locationSource),
      accuracyMeters: this.readSnapshotNumber(record.accuracyMeters),
      locationConfidenceScore: this.readSnapshotNumber(record.locationConfidenceScore),
    };
  }

  private readSnapshotString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private readSnapshotNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (value && typeof value === "object" && "toString" in value) {
      const parsed = Number(value.toString());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private activeQuantity(item: { activeQuantity: number; quantity: number; cancelledQuantity: number }) {
    if (item.activeQuantity > 0 || item.cancelledQuantity > 0) {
      return item.activeQuantity;
    }
    return item.quantity;
  }

  private allActiveQuantity(items: Array<{ activeQuantity: number; quantity: number; cancelledQuantity: number }>) {
    return items.reduce((sum, item) => sum + this.activeQuantity(item), 0);
  }

  private groupLinesBySeller<T extends { sellerId: string }>(lines: T[]) {
    const grouped = new Map<string, T[]>();
    for (const line of lines) {
      const existing = grouped.get(line.sellerId) ?? [];
      existing.push(line);
      grouped.set(line.sellerId, existing);
    }
    return grouped;
  }

  private itemPolicyAllowsReturn(snapshot: Prisma.JsonValue | null) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return true;
    }
    const snapshotRecord = snapshot as Record<string, unknown>;
    const value = snapshotRecord.returnEligibility ?? snapshotRecord.returnPolicy;
    return typeof value === "string" ? !value.toLowerCase().includes("non-return") : true;
  }

  private refundablePayment(order: ReturnOrder) {
    return (
      order.payments.find(
        (payment) =>
          payment.status === PaymentStatus.PAID &&
          payment.provider === PaymentProvider.RAZORPAY &&
          payment.providerPaymentId,
      ) ??
      order.payments.find((payment) => payment.status === PaymentStatus.PAID) ??
      null
    );
  }

  private defaultRefundMethod(refund: RefundRequestDetail) {
    if (refund.payment?.provider === PaymentProvider.RAZORPAY && refund.payment.providerPaymentId) {
      return RefundMethod.RAZORPAY;
    }
    if (refund.payment?.provider === PaymentProvider.COD) {
      return RefundMethod.COD_CASH;
    }
    if (refund.payment?.provider === PaymentProvider.BANK_TRANSFER) {
      return RefundMethod.BANK_TRANSFER;
    }
    return RefundMethod.MANUAL;
  }

  private async createReturnRequestNumber(client: ReturnNumberClient = this.prisma.client) {
    const dateKey = this.dateKey();
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate = `1HI-RET-${dateKey}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const existing = await client.returnRequest.findUnique({
        where: { requestNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    throw new BadRequestException("Could not generate a return request number.");
  }

  private async createRefundNumber(client: ReturnNumberClient = this.prisma.client) {
    const dateKey = this.dateKey();
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate = `1HI-RFD-${dateKey}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const existing = await client.refundRequest.findUnique({
        where: { refundNumber: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    throw new BadRequestException("Could not generate a refund number.");
  }

  private dateKey(date = new Date()) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }

  private refundIdempotencyKey(refundNumber: string, attempt: number) {
    return createHash("sha256").update(`${refundNumber}:${attempt}`).digest("hex");
  }

  private async createRazorpayRefund(input: {
    paymentId: string;
    amountPaise: number;
    idempotencyKey: string;
    refundNumber: string;
  }) {
    const { keyId, keySecret } = await this.razorpayKeys();
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          "X-Razorpay-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          amount: input.amountPaise,
          speed: "normal",
          notes: {
            refundNumber: input.refundNumber,
            platform: "1HandIndia",
          },
        }),
      },
    );

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ...body,
        status: "failed",
        errorStatusCode: response.status,
      };
    }
    return body;
  }

  private async razorpayKeys() {
    const settings = await this.prisma.client.setting.findMany({
      where: { key: { in: [razorpayKeyIdSetting, razorpayKeySecretSetting] } },
      select: { key: true, value: true },
    });
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const keyId = this.stringSetting(settingMap.get(razorpayKeyIdSetting), process.env.RAZORPAY_KEY_ID ?? "");
    const keySecret = this.stringSetting(settingMap.get(razorpayKeySecretSetting), process.env.RAZORPAY_KEY_SECRET ?? "");
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException("Razorpay refund keys are not configured.");
    }
    return { keyId, keySecret };
  }

  private stringSetting(value: Prisma.JsonValue | undefined, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private razorpayRefundTransactionStatus(status: unknown) {
    const normalized = typeof status === "string" ? status.toLowerCase() : "";
    if (normalized === "processed") {
      return RefundTransactionStatus.SUCCESS;
    }
    if (normalized === "failed") {
      return RefundTransactionStatus.FAILED;
    }
    return RefundTransactionStatus.PROCESSING;
  }

  private providerFailureReason(response: Record<string, unknown>) {
    const error = response.error;
    if (error && typeof error === "object" && !Array.isArray(error)) {
      const description = (error as Record<string, unknown>).description;
      if (typeof description === "string" && description.trim()) {
        return description.trim();
      }
    }
    return "Refund provider did not complete the refund.";
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private extractRazorpayRefundEntity(payload: Record<string, unknown>) {
    const payloadRecord = payload.payload;
    if (!payloadRecord || typeof payloadRecord !== "object" || Array.isArray(payloadRecord)) {
      return null;
    }
    const refundWrapper = (payloadRecord as Record<string, unknown>).refund;
    if (!refundWrapper || typeof refundWrapper !== "object" || Array.isArray(refundWrapper)) {
      return null;
    }
    const entity = (refundWrapper as Record<string, unknown>).entity;
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
      return null;
    }
    const refund = entity as Record<string, unknown>;
    return {
      id: typeof refund.id === "string" ? refund.id : null,
      paymentId: typeof refund.payment_id === "string" ? refund.payment_id : null,
      status: refund.status,
      amount: typeof refund.amount === "number" ? refund.amount : null,
      raw: refund,
    };
  }

  private async lockReturnRequest(tx: Prisma.TransactionClient, returnRequestId: string) {
    await tx.$queryRaw`SELECT id FROM return_requests WHERE id = ${returnRequestId}::uuid FOR UPDATE`;
  }

  private async lockRefundRequest(tx: Prisma.TransactionClient, refundRequestId: string) {
    await tx.$queryRaw`SELECT id FROM refund_requests WHERE id = ${refundRequestId}::uuid FOR UPDATE`;
  }
}

function requestNumberFromIdFallback(requestNumber: string, _returnRequestId: string) {
  return requestNumber;
}
