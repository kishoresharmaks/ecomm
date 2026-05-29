import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalStatus,
  CartStatus,
  CheckoutStatus,
  DeliveryAssignmentAttemptSource,
  CodCollectionStatus,
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryRoutingFailureReason,
  DeliveryStatus,
  EmailRecipientType,
  InventoryMovementType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductListingMode,
  ProductStatus,
  RoleCode,
  SellerStatus,
  SellerOrderStatus,
  SellerSettlementStatus,
  StatusEventType,
  UserStatus,
  VariantStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { CheckoutPricingService } from "../checkout/checkout-pricing.service";
import { DeliveryRoutingService } from "../checkout/delivery-routing.service";
import { CheckoutDeliveryPreference } from "../checkout/dto/delivery-routing.dto";
import { paginationFromQuery } from "../common/pagination";
import { CustomersService } from "../customers/customers.service";
import { SellerLedgerService } from "../finance/seller-ledger.service";
import { LocationsService } from "../locations/locations.service";
import { MarketService } from "../market/market.service";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import {
  CheckoutPaymentMethod,
  CheckoutShippingAddressDto,
  PlaceOrderDto,
} from "./dto/checkout.dto";
import { CodVerificationDecision, CodVerificationDto } from "./dto/cod-verification.dto";
import {
  CreateDeliveryAttemptDto,
  DeliveryAssignmentDecision,
  DeliveryAssignmentDecisionDto,
  DeliveryOperationsQueryDto,
  DeliveryPartnerQueryDto,
  UpdateDeliveryAssignmentDto,
  UpdateOwnDeliveryPartnerProfileDto,
} from "./dto/delivery-operations.dto";
import { UpdateDeliveryDto } from "./dto/delivery-update.dto";
import { OrderQueryDto } from "./dto/order-query.dto";
import { UpdateOrderStatusDto, UpdateSellerOrderStatusDto } from "./dto/order-status.dto";
import { TrackOrderDto } from "./dto/track-order.dto";

const orderInclude = {
  customer: {
    include: {
      user: true,
    },
  },
  items: {
    include: {
      seller: true,
      product: {
        include: {
          images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
        },
      },
      productVariant: true,
    },
  },
  sellerSplits: {
    include: {
      seller: {
        include: {
          user: true,
        },
      },
      shipment: {
        include: {
          deliveryPartner: {
            include: {
              deliveryProfile: true,
            },
          },
          codCollectedBy: true,
          codVerifiedBy: true,
          courierShipment: true,
          courierCodRemittance: true,
        },
      },
    },
  },
  shipments: {
    include: {
      seller: {
        include: {
          user: true,
        },
      },
      orderSellerSplit: true,
      deliveryPartner: {
        include: {
          deliveryProfile: true,
        },
      },
      codCollectedBy: true,
      codVerifiedBy: true,
      courierShipment: true,
      courierCodRemittance: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  deliveryDetail: {
    include: {
      deliveryPartner: {
        include: {
          deliveryProfile: true,
        },
      },
      codCollectedBy: true,
      codVerifiedBy: true,
      attempts: {
        include: {
          createdBy: true,
        },
        orderBy: { createdAt: "desc" as const },
      },
      events: {
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    include: {
      events: true,
    },
  },
  statusEvents: {
    orderBy: { createdAt: "desc" as const },
  },
};

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type DeliveryPartnerWithProfile = Prisma.UserGetPayload<{
  include: { deliveryProfile: true };
}>;

type DeliveryPartnerServiceAreaScore = {
  eligible: boolean;
  score: number;
  matchLabel: string;
  matchedFields: string[];
  warnings: string[];
};

type DeliveryPartnerAssignmentCandidate = {
  user: DeliveryPartnerWithProfile;
  score: number;
  workload: number;
  codExposurePaise: number;
  codLimitPaise: number;
  lastAssignmentAt: Date | null;
  area: DeliveryPartnerServiceAreaScore;
};

type DeliveryPartnerAssignmentDiagnostics = {
  partnersChecked: number;
  skippedUnavailable: number;
  skippedCodLimit: number;
  skippedRejected: number;
  eligibleCandidates: number;
  codAmountPaise: number;
};

type DeliveryPartnerAssignmentMetrics = {
  workload: Map<string, number>;
  codExposurePaise: Map<string, number>;
  lastAssignmentAt: Map<string, Date>;
};

const deliveryTrackingReferencePrefix = "1HI-DEL";
const deliveryTrackingReferenceWidth = 6;
const defaultCodCashLimitPaise = 500000;
const deliveryCodCashLimitSettingKey = "delivery.defaultCodCashLimitPaise";

const sellerStatusRank = {
  [SellerOrderStatus.PENDING]: 0,
  [SellerOrderStatus.ACCEPTED]: 1,
  [SellerOrderStatus.PROCESSING]: 2,
  [SellerOrderStatus.DISPATCHED]: 3,
  [SellerOrderStatus.DELIVERED]: 4,
  [SellerOrderStatus.CANCELLED]: 5,
} satisfies Record<SellerOrderStatus, number>;

const deliveryStatusRank = {
  [DeliveryStatus.NOT_ASSIGNED]: 0,
  [DeliveryStatus.PENDING]: 1,
  [DeliveryStatus.PACKED]: 2,
  [DeliveryStatus.DISPATCHED]: 3,
  [DeliveryStatus.IN_TRANSIT]: 4,
  [DeliveryStatus.DELIVERED]: 5,
  [DeliveryStatus.CANCELLED]: 6,
} satisfies Record<DeliveryStatus, number>;

const orderStatusRank = {
  [OrderStatus.PLACED]: 0,
  [OrderStatus.CONFIRMED]: 1,
  [OrderStatus.PROCESSING]: 2,
  [OrderStatus.SHIPPED]: 3,
  [OrderStatus.DELIVERED]: 4,
  [OrderStatus.CANCELLED]: 5,
} satisfies Record<OrderStatus, number>;

const dispatchedSellerStatuses = new Set<SellerOrderStatus>([
  SellerOrderStatus.DISPATCHED,
  SellerOrderStatus.DELIVERED,
]);
const dispatchedDeliveryStatuses = new Set<DeliveryStatus>([
  DeliveryStatus.DISPATCHED,
  DeliveryStatus.IN_TRANSIT,
  DeliveryStatus.DELIVERED,
]);
const dispatchedOrderStatuses = new Set<OrderStatus>([OrderStatus.SHIPPED, OrderStatus.DELIVERED]);
const dispatchedCustomerCancellationMessage =
  "This order has already been dispatched. Please contact support for cancellation or refund help.";
const dispatchedSellerCancellationMessage =
  "This seller package has already been dispatched. Contact admin to handle return or refund.";

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
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CheckoutPricingService) private readonly checkoutPricing: CheckoutPricingService,
    @Inject(DeliveryRoutingService) private readonly deliveryRouting: DeliveryRoutingService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
    @Inject(SellerLedgerService) private readonly sellerLedgerService: SellerLedgerService,
    @Inject(LocationsService) private readonly locationsService: LocationsService,
    @Inject(MarketService) private readonly marketService: MarketService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {}

  async placeOrder(actor: RequestUser, dto: PlaceOrderDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const cart = await this.prisma.client.cart.findFirst({
      where: {
        customerId: customer.id,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: true,
      },
    });

    if (!cart?.items.length) {
      throw new BadRequestException("Cart is empty.");
    }

    const shippingAddressSnapshot = await this.resolveShippingAddressSnapshot(customer.id, dto);
    const buyerCountryCode = dto.buyerCountryCode ?? shippingAddressSnapshot.countryCode ?? "IN";
    const market = await this.marketService.buildCheckoutSnapshot(buyerCountryCode);
    const orderNumber = await this.createOrderNumber();
    const payment = this.resolvePayment(dto.paymentMethod);
    const deliveryPreference = this.resolveCheckoutDeliveryPreference(dto);

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const cartClaim = await tx.cart.updateMany({
        where: {
          id: cart.id,
          customerId: customer.id,
          status: CartStatus.ACTIVE,
        },
        data: {
          status: CartStatus.CHECKED_OUT,
        },
      });

      if (cartClaim.count !== 1) {
        throw new BadRequestException(
          "This cart is already checked out. Refresh the cart before placing another order.",
        );
      }

      const validatedItems = [];

      for (const item of cart.items) {
        const variant = await tx.productVariant.findFirst({
          where: {
            id: item.productVariantId,
            status: VariantStatus.ACTIVE,
            product: {
              status: ProductStatus.ACTIVE,
              approvalStatus: ApprovalStatus.APPROVED,
              deletedAt: null,
              seller: {
                status: SellerStatus.APPROVED,
                approvalStatus: ApprovalStatus.APPROVED,
              },
            },
          },
        });

        if (!variant) {
          throw new BadRequestException("One or more cart items are no longer available.");
        }

        const product = await tx.product.findUniqueOrThrow({
          where: { id: variant.productId },
        });

        if (product.listingMode === ProductListingMode.ENQUIRY_ONLY) {
          throw new BadRequestException(
            `${product.name} is enquiry-only and cannot be checked out.`,
          );
        }

        if (item.quantity > variant.stockQuantity) {
          throw new BadRequestException(`Insufficient stock for ${product.name}.`);
        }

        validatedItems.push({ item, variant, product });
      }

      const subtotalPaise = validatedItems.reduce(
        (total, { item, variant }) => total + item.quantity * variant.pricePaise,
        0,
      );
      const charges = await this.checkoutPricing.calculateCharges(subtotalPaise, tx, {
        ...(dto.deliveryPreference !== undefined || dto.deliveryMode === undefined
          ? { deliveryPreference }
          : {}),
        ...(dto.deliveryMode !== undefined ? { deliveryMode: dto.deliveryMode } : {}),
        address: shippingAddressSnapshot,
        paymentMethod: dto.paymentMethod,
      });
      const { shippingPaise, platformFeePaise, totalPaise } = charges;
      const resolvedDeliveryMode =
        charges.deliveryRouting?.deliveryMode ??
        dto.deliveryMode ??
        DeliveryMode.LOCAL_DELIVERY_PARTNER;
      const buyerSubtotalMinor = this.marketService.convertMinorUnits(subtotalPaise, market);
      const buyerShippingMinor = this.marketService.convertMinorUnits(shippingPaise, market);
      const buyerPlatformFeeMinor = this.marketService.convertMinorUnits(platformFeePaise, market);
      const buyerTotalMinor = buyerSubtotalMinor + buyerShippingMinor + buyerPlatformFeeMinor;
      const checkoutPaymentMethod = await this.paymentsService.checkoutMethodSnapshot(
        dto.paymentMethod,
        totalPaise,
        tx,
      );
      if (!checkoutPaymentMethod.enabled) {
        throw new BadRequestException(
          `${checkoutPaymentMethod.label} is not available for checkout. ${checkoutPaymentMethod.note}`,
        );
      }
      const paymentRawResponse = this.checkoutPaymentRawResponse(
        checkoutPaymentMethod,
        dto.paymentReference,
      );

      const checkout = await tx.checkoutSession.create({
        data: {
          customerId: customer.id,
          cartId: cart.id,
          status: CheckoutStatus.COMPLETED,
          shippingAddressSnapshot,
          paymentMethod: dto.paymentMethod,
          deliveryMode: resolvedDeliveryMode,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          orderStatus: OrderStatus.PLACED,
          paymentStatus: payment.status,
          deliveryStatus: DeliveryStatus.PENDING,
          subtotalPaise,
          shippingPaise,
          platformFeePaise,
          totalPaise,
          currency: market.baseCurrency,
          baseCurrency: market.baseCurrency,
          buyerCountryCode: market.countryCode,
          buyerCurrency: market.currency,
          buyerSubtotalMinor,
          buyerShippingMinor,
          buyerPlatformFeeMinor,
          buyerTotalMinor,
          fxRate: new Prisma.Decimal(market.rate),
          fxProvider: market.provider,
          fxRateFetchedAt: market.fetchedAt,
          fxSnapshot: {
            provider: market.provider,
            baseCurrency: market.baseCurrency,
            buyerCurrency: market.currency,
            buyerCountryCode: market.countryCode,
            rate: market.rate,
            fetchedAt: market.fetchedAt.toISOString(),
            expiresAt: market.expiresAt.toISOString(),
            isStale: market.isStale,
          },
          checkoutFeeSnapshot: charges.snapshot,
          shippingAddressSnapshot,
        },
      });

      const sellerTotals = new Map<string, number>();

      for (const { item, variant, product } of validatedItems) {
        const lineTotalPaise = item.quantity * variant.pricePaise;
        sellerTotals.set(
          product.sellerId,
          (sellerTotals.get(product.sellerId) ?? 0) + lineTotalPaise,
        );

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            sellerId: product.sellerId,
            productId: product.id,
            productVariantId: variant.id,
            productNameSnapshot: product.name,
            variantSnapshot: {
              sku: variant.sku,
              variantName: variant.variantName,
            },
            quantity: item.quantity,
            unitPricePaise: variant.pricePaise,
            lineTotalPaise,
            currency: variant.currency,
          },
        });

        const stockUpdate = await tx.productVariant.updateMany({
          where: {
            id: variant.id,
            stockQuantity: {
              gte: item.quantity,
            },
          },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });

        if (stockUpdate.count !== 1) {
          throw new BadRequestException(`Insufficient stock for ${product.name}.`);
        }

        await tx.inventoryMovement.create({
          data: {
            productVariantId: variant.id,
            movementType: InventoryMovementType.SALE,
            quantity: item.quantity,
            reason: "Order placed",
            referenceType: "order",
            referenceId: order.id,
            createdById: actor.id,
          },
        });
      }

      const sellerShippingShares = this.allocateMinorAmountByKey(shippingPaise, sellerTotals);
      let shipmentSequence = 1;
      for (const [sellerId, sellerSubtotalPaise] of sellerTotals.entries()) {
        const sellerSplit = await tx.orderSellerSplit.create({
          data: {
            orderId: order.id,
            sellerId,
            sellerSubtotalPaise,
            commissionPaise: 0,
            settlementStatus: SellerSettlementStatus.NOT_ELIGIBLE,
            sellerStatus: SellerOrderStatus.PENDING,
          },
        });

        await tx.orderShipment.upsert({
          where: { orderSellerSplitId: sellerSplit.id },
          update: {},
          create: {
            shipmentNumber: this.createShipmentNumber(order.orderNumber, shipmentSequence),
            orderId: order.id,
            orderSellerSplitId: sellerSplit.id,
            sellerId,
            subtotalPaise: sellerSubtotalPaise,
            shippingPaise: sellerShippingShares.get(sellerId) ?? 0,
            codSurchargePaise: 0,
            deliveryMode: resolvedDeliveryMode,
            status: DeliveryStatus.PENDING,
            deliveryNote: dto.customerNote ?? null,
            courierProviderCode: charges.deliveryRouting?.courierProviderCode ?? null,
            routingFailed: charges.deliveryRouting?.routingFailed ?? false,
            routingFailureReason: charges.deliveryRouting?.routingFailureReason ?? null,
            routingFailureNote: charges.deliveryRouting?.routingFailureNote ?? null,
            routedAt: charges.deliveryRouting ? new Date() : null,
            shippingChargeSnapshot: charges.deliveryRouting?.shippingSnapshot ?? Prisma.JsonNull,
            codSurchargeSnapshot: charges.deliveryRouting?.codSurchargeSnapshot ?? Prisma.JsonNull,
            assignmentNote:
              charges.deliveryRouting?.routingFailureNote ??
              (charges.deliveryRouting?.recommendedPartnerUserId
                ? "Local delivery route selected. Partner will be assigned after this seller package is packed."
                : null),
          },
        });
        shipmentSequence += 1;
      }

      await tx.deliveryDetail.create({
        data: {
          orderId: order.id,
          deliveryMode: resolvedDeliveryMode,
          status: DeliveryStatus.PENDING,
          deliveryNote: dto.customerNote ?? null,
          courierProviderCode: charges.deliveryRouting?.courierProviderCode ?? null,
          routingFailed: charges.deliveryRouting?.routingFailed ?? false,
          routingFailureReason: charges.deliveryRouting?.routingFailureReason ?? null,
          routingFailureNote: charges.deliveryRouting?.routingFailureNote ?? null,
          routedAt: charges.deliveryRouting ? new Date() : null,
          shippingChargeSnapshot: charges.deliveryRouting?.shippingSnapshot ?? Prisma.JsonNull,
          codSurchargeSnapshot: charges.deliveryRouting?.codSurchargeSnapshot ?? Prisma.JsonNull,
          assignmentNote:
            charges.deliveryRouting?.routingFailureNote ??
            (charges.deliveryRouting?.recommendedPartnerUserId
              ? "Local delivery route selected. Partner will be assigned after packing."
              : null),
        },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: payment.provider,
          method: dto.paymentMethod,
          amountPaise: buyerTotalMinor,
          currency: market.currency,
          status: payment.status,
          ...(paymentRawResponse ? { rawResponse: paymentRawResponse } : {}),
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          statusType: StatusEventType.ORDER,
          newStatus: OrderStatus.PLACED,
          note: `Checkout ${checkout.id} completed.`,
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.placed",
          entityType: "order",
          entityId: order.id,
          newValue: {
            orderNumber: order.orderNumber,
            subtotalPaise,
            shippingPaise,
            platformFeePaise,
            totalPaise,
            buyerCurrency: market.currency,
            buyerPlatformFeeMinor,
            buyerTotalMinor,
            fxRate: market.rate,
            paymentMethod: dto.paymentMethod,
            deliveryPreference,
            deliveryMode: resolvedDeliveryMode,
            deliveryRouting: charges.deliveryRouting?.routingSnapshot ?? null,
          },
        },
      });

      return order.id;
    });

    const order = await this.getOrderByIdOrThrow(orderId);
    await this.notifyOrderPlaced(order);
    return order;
  }

  async listCustomerOrders(actor: RequestUser, query: OrderQueryDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    return this.listOrders({ ...this.orderQueryWhere(query), customerId: customer.id }, query);
  }

  async getCustomerOrder(actor: RequestUser, orderNumber: string) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const order = await this.prisma.client.order.findFirst({
      where: {
        orderNumber,
        customerId: customer.id,
      },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return order;
  }

  async trackPublicOrder(dto: TrackOrderDto) {
    const orderNumber = dto.orderNumber.trim().toUpperCase();
    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber },
      include: orderInclude,
    });

    if (!order || !this.orderContactMatches(order, dto.contact)) {
      throw new NotFoundException("Order not found for the provided details.");
    }

    const shippingAddress = this.readShippingAddressSnapshot(order.shippingAddressSnapshot);

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      subtotalPaise: order.subtotalPaise,
      shippingPaise: order.shippingPaise,
      platformFeePaise: order.platformFeePaise,
      totalPaise: order.totalPaise,
      currency: order.currency,
      buyerCountryCode: order.buyerCountryCode,
      buyerCurrency: order.buyerCurrency,
      buyerSubtotalMinor: order.buyerSubtotalMinor,
      buyerShippingMinor: order.buyerShippingMinor,
      buyerPlatformFeeMinor: order.buyerPlatformFeeMinor,
      buyerTotalMinor: order.buyerTotalMinor,
      fxRate: order.fxRate?.toString() ?? null,
      fxProvider: order.fxProvider,
      fxRateFetchedAt: order.fxRateFetchedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippingLocation: shippingAddress
        ? {
            city: shippingAddress.city,
            state: shippingAddress.state,
            pincode: shippingAddress.pincode,
            country: shippingAddress.country,
            countryCode: shippingAddress.countryCode,
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        productNameSnapshot: item.productNameSnapshot,
        variantSnapshot: item.variantSnapshot,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        lineTotalPaise: item.lineTotalPaise,
        currency: item.currency,
        product: item.product
          ? {
              name: item.product.name,
              slug: item.product.slug,
              imageUrl: item.product.images[0]?.url ?? null,
            }
          : null,
        seller: item.seller
          ? {
              storeName: item.seller.storeName,
              slug: item.seller.slug,
            }
          : null,
      })),
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        sellerId: shipment.sellerId,
        seller: shipment.seller
          ? {
              storeName: shipment.seller.storeName,
              slug: shipment.seller.slug,
            }
          : null,
        subtotalPaise: shipment.subtotalPaise,
        shippingPaise: shipment.shippingPaise,
        deliveryMode: shipment.deliveryMode,
        status: shipment.status,
        assignmentStatus: shipment.assignmentStatus,
        estimatedDeliveryDate: shipment.estimatedDeliveryDate,
        deliveryNote: shipment.deliveryNote,
        codCollectionStatus: shipment.codCollectionStatus,
        codCollectedAmountPaise: shipment.codCollectedAmountPaise,
        codCollectedAt: shipment.codCollectedAt,
        codVerifiedAt: shipment.codVerifiedAt,
      })),
      deliveryDetail: order.deliveryDetail
        ? {
            deliveryMode: order.deliveryDetail.deliveryMode,
            partnerName: null,
            partnerPhone: null,
            trackingReference: null,
            estimatedDeliveryDate: order.deliveryDetail.estimatedDeliveryDate,
            deliveryNote: order.deliveryDetail.deliveryNote,
            assignmentStatus: order.deliveryDetail.assignmentStatus,
            assignedAt: order.deliveryDetail.assignedAt,
            acceptedAt: order.deliveryDetail.acceptedAt,
            status: order.deliveryDetail.status,
            codCollectionStatus: order.deliveryDetail.codCollectionStatus,
            codCollectedAmountPaise: order.deliveryDetail.codCollectedAmountPaise,
            codCollectedAt: order.deliveryDetail.codCollectedAt,
            codCollectionNote: order.deliveryDetail.codCollectionNote,
            codVerifiedAt: order.deliveryDetail.codVerifiedAt,
            codVerificationNote: order.deliveryDetail.codVerificationNote,
            events: order.deliveryDetail.events.map((event) => ({
              id: event.id,
              oldStatus: event.oldStatus,
              newStatus: event.newStatus,
              note: event.note,
              createdAt: event.createdAt,
            })),
          }
        : null,
      customerDeliveryTimeline: this.customerDeliveryTimeline(order),
      statusEvents: order.statusEvents.map((event) => ({
        id: event.id,
        statusType: event.statusType,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        note: event.note,
        createdAt: event.createdAt,
      })),
    };
  }

  async cancelCustomerOrder(actor: RequestUser, orderNumber: string, dto: CancelOrderDto) {
    const existing = await this.getCustomerOrder(actor, orderNumber);

    if (existing.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException("Order is already cancelled.");
    }

    if (
      existing.orderStatus === OrderStatus.DELIVERED ||
      existing.deliveryStatus === DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestException("Delivered orders cannot be cancelled from customer account.");
    }

    this.assertCustomerCancellationAllowed(existing);

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      for (const item of existing.items) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId,
            movementType: InventoryMovementType.RETURN,
            quantity: item.quantity,
            reason: "Order cancelled",
            referenceType: "order",
            referenceId: existing.id,
            createdById: actor.id,
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: existing.id },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          deliveryStatus: DeliveryStatus.CANCELLED,
          ...(existing.paymentStatus === PaymentStatus.PENDING
            ? { paymentStatus: PaymentStatus.NOT_REQUIRED }
            : {}),
        },
      });

      await tx.orderSellerSplit.updateMany({
        where: { orderId: existing.id },
        data: {
          sellerStatus: SellerOrderStatus.CANCELLED,
          settlementStatus: SellerSettlementStatus.CANCELLED,
          payoutId: null,
        },
      });

      await tx.orderShipment.updateMany({
        where: { orderId: existing.id },
        data: {
          status: DeliveryStatus.CANCELLED,
          assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
        },
      });

      if (existing.deliveryDetail) {
        await tx.deliveryDetail.update({
          where: { orderId: existing.id },
          data: { status: DeliveryStatus.CANCELLED },
        });
      }

      if (existing.paymentStatus === PaymentStatus.PENDING) {
        for (const payment of existing.payments.filter(
          (item) => item.status === PaymentStatus.PENDING,
        )) {
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
                orderNumber: existing.orderNumber,
                note: dto.note ?? "Customer cancelled order.",
              },
            },
          });
        }
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: existing.id,
          statusType: StatusEventType.ORDER,
          oldStatus: existing.orderStatus,
          newStatus: OrderStatus.CANCELLED,
          note: dto.note ?? "Customer cancelled order.",
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.cancelled_by_customer",
          entityType: "order",
          entityId: existing.id,
          oldValue: {
            orderStatus: existing.orderStatus,
            paymentStatus: existing.paymentStatus,
            deliveryStatus: existing.deliveryStatus,
          },
          newValue: {
            orderStatus: updatedOrder.orderStatus,
            paymentStatus: updatedOrder.paymentStatus,
            deliveryStatus: updatedOrder.deliveryStatus,
            note: dto.note,
          },
        },
      });

      return existing.id;
    });

    const order = await this.getOrderByIdOrThrow(orderId);
    await this.notifyCustomerOrderStatus(order, OrderStatus.CANCELLED, dto.note);
    return order;
  }

  async listAdminOrders(query: OrderQueryDto) {
    return this.listOrders(this.orderQueryWhere(query), query);
  }

  async getAdminOrder(orderNumber: string) {
    return this.getOrderByNumberOrThrow(orderNumber);
  }

  async listDeliveryPartners(query: DeliveryPartnerQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 50 });
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      userRoles: {
        some: {
          role: {
            code: RoleCode.DELIVERY_PARTNER,
          },
        },
      },
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { fullName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.isAvailable !== undefined || query.cityCode || query.pincode || query.localAreaCode
        ? {
            deliveryProfile: {
              is: {
                ...(query.isAvailable !== undefined ? { isAvailable: query.isAvailable } : {}),
                ...(query.cityCode ? { serviceCityCode: query.cityCode } : {}),
                ...(query.pincode ? { servicePincodes: { has: query.pincode } } : {}),
                ...(query.localAreaCode
                  ? { serviceLocalAreaCodes: { has: query.localAreaCode } }
                  : {}),
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        include: {
          deliveryProfile: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { fullName: "asc" }, { email: "asc" }],
        skip,
        take,
      }),
      this.prisma.client.user.count({ where }),
    ]);

    const decorated = await Promise.all(items.map((user) => this.toDeliveryPartnerSummary(user)));

    return {
      items: decorated,
      total,
      page,
      limit: take,
    };
  }

  async getDeliveryPartnerProfile(actor: RequestUser) {
    const user = await this.getDeliveryPartnerUserOrThrow(actor.id);
    return this.toDeliveryPartnerSelfProfile(user);
  }

  async updateOwnDeliveryPartnerProfile(
    actor: RequestUser,
    dto: UpdateOwnDeliveryPartnerProfileDto,
  ) {
    const user = await this.getDeliveryPartnerUserOrThrow(actor.id);
    const profileData = this.ownDeliveryPartnerProfileData(dto);

    await this.prisma.client.$transaction(async (tx) => {
      const profile = await tx.deliveryPartnerProfile.upsert({
        where: { userId: actor.id },
        update: profileData,
        create: {
          userId: actor.id,
          phone: user.phone,
          isAvailable: true,
          ...profileData,
        },
      });

      if (dto.phone !== undefined && dto.phone !== user.phone) {
        await tx.user.update({
          where: { id: actor.id },
          data: { phone: dto.phone || null },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "delivery_partner.profile_updated",
          entityType: "user",
          entityId: actor.id,
          ...(user.deliveryProfile
            ? { oldValue: this.deliveryPartnerProfileAuditValue(user.deliveryProfile) }
            : {}),
          newValue: this.deliveryPartnerProfileAuditValue(profile),
        },
      });
    });

    return this.getDeliveryPartnerProfile(actor);
  }

  async listUnassignedDeliveryOrders(query: DeliveryOperationsQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 50 });
    const assignmentStatuses = query.assignmentStatus
      ? [query.assignmentStatus]
      : [DeliveryAssignmentStatus.UNASSIGNED, DeliveryAssignmentStatus.REJECTED];
    const where: Prisma.OrderWhereInput = {
      deliveryStatus: {
        in: [DeliveryStatus.PACKED, DeliveryStatus.PENDING],
      },
      deliveryDetail: {
        is: {
          assignmentStatus: {
            in: assignmentStatuses,
          },
        },
      },
      ...(query.search
        ? {
            OR: [{ orderNumber: { contains: query.search, mode: "insensitive" } }],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.client.order.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit: take,
    };
  }

  async getDeliveryCodHandoverReport() {
    const partners = await this.prisma.client.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              code: RoleCode.DELIVERY_PARTNER,
            },
          },
        },
      },
      include: {
        deliveryProfile: true,
      },
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
    });

    const rows = await Promise.all(
      partners.map(async (partner) => {
        const [collected, verified, rejected, pendingExposure] = await Promise.all([
          this.sumPartnerCodCollections(partner.id, CodCollectionStatus.COLLECTED),
          this.sumPartnerCodCollections(partner.id, CodCollectionStatus.VERIFIED),
          this.sumPartnerCodCollections(partner.id, CodCollectionStatus.REJECTED),
          this.pendingPartnerCodExposure(partner.id),
        ]);

        return {
          partner: this.deliveryPartnerIdentity(partner),
          codCashLimitPaise: partner.deliveryProfile?.codCashLimitPaise ?? null,
          collectedAmountPaise: collected,
          verifiedAmountPaise: verified,
          rejectedAmountPaise: rejected,
          pendingAmountPaise: pendingExposure,
        };
      }),
    );

    return {
      items: rows,
      totals: rows.reduce(
        (total, row) => ({
          collectedAmountPaise: total.collectedAmountPaise + row.collectedAmountPaise,
          verifiedAmountPaise: total.verifiedAmountPaise + row.verifiedAmountPaise,
          rejectedAmountPaise: total.rejectedAmountPaise + row.rejectedAmountPaise,
          pendingAmountPaise: total.pendingAmountPaise + row.pendingAmountPaise,
        }),
        {
          collectedAmountPaise: 0,
          verifiedAmountPaise: 0,
          rejectedAmountPaise: 0,
          pendingAmountPaise: 0,
        },
      ),
    };
  }

  async autoAssignDeliveryPartner(actor: RequestUser, orderNumber: string) {
    const order = await this.getOrderByNumberOrThrow(orderNumber);
    if (
      order.deliveryStatus !== DeliveryStatus.PACKED &&
      order.deliveryDetail?.status !== DeliveryStatus.PACKED
    ) {
      throw new BadRequestException("Auto assignment is available after the order is packed.");
    }
    if (order.deliveryDetail?.deliveryMode !== DeliveryMode.LOCAL_DELIVERY_PARTNER) {
      throw new BadRequestException(
        "Auto assignment is only available for Local Delivery Partner mode.",
      );
    }

    return this.autoAssignPackedDelivery(order, actor, "Auto assigned by admin.");
  }

  async updateAdminDeliveryAssignment(
    actor: RequestUser,
    orderNumber: string,
    dto: UpdateDeliveryAssignmentDto,
    options: { source?: DeliveryAssignmentAttemptSource } = {},
  ) {
    const order = await this.getOrderByNumberOrThrow(orderNumber);
    const delivery = order.deliveryDetail;
    const partnerUserId = dto.deliveryPartnerUserId ?? null;
    const isUnassign = !partnerUserId;
    const now = new Date();

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      if (partnerUserId) {
        await this.assertDeliveryPartnerUser(tx, partnerUserId);
      }

      const shouldRecordNewAttempt =
        Boolean(partnerUserId) &&
        (partnerUserId !== delivery?.deliveryPartnerUserId ||
          (delivery?.assignmentStatus !== DeliveryAssignmentStatus.ASSIGNED &&
            delivery?.assignmentStatus !== DeliveryAssignmentStatus.ACCEPTED));
      const previousPartnerUserId =
        delivery?.deliveryPartnerUserId && delivery.deliveryPartnerUserId !== partnerUserId
          ? delivery.deliveryPartnerUserId
          : null;
      if (previousPartnerUserId) {
        await tx.deliveryAssignmentAttempt.updateMany({
          where: {
            orderId: order.id,
            partnerUserId: previousPartnerUserId,
            status: DeliveryAssignmentStatus.ASSIGNED,
          },
          data: {
            status: DeliveryAssignmentStatus.CANCELLED,
            respondedAt: now,
            note: isUnassign
              ? (dto.assignmentNote ?? "Delivery partner unassigned.")
              : (dto.assignmentNote ?? "Delivery partner reassigned."),
          },
        });
      }

      const nextTrackingReference =
        !isUnassign && !delivery?.trackingReference
          ? await this.createDeliveryTrackingReference(tx)
          : undefined;
      const currentStatus = delivery?.status ?? order.deliveryStatus ?? DeliveryStatus.PENDING;
      const updatedDelivery = await tx.deliveryDetail.upsert({
        where: { orderId: order.id },
        update: {
          ...(!isUnassign ? { deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER } : {}),
          deliveryPartnerUserId: partnerUserId,
          assignmentStatus: isUnassign
            ? DeliveryAssignmentStatus.UNASSIGNED
            : DeliveryAssignmentStatus.ASSIGNED,
          assignedAt: isUnassign ? null : now,
          acceptedAt: null,
          rejectedAt: null,
          assignmentNote: dto.assignmentNote ?? null,
          ...(nextTrackingReference ? { trackingReference: nextTrackingReference } : {}),
        },
        create: {
          orderId: order.id,
          deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
          status: currentStatus,
          deliveryPartnerUserId: partnerUserId,
          assignmentStatus: isUnassign
            ? DeliveryAssignmentStatus.UNASSIGNED
            : DeliveryAssignmentStatus.ASSIGNED,
          assignedAt: isUnassign ? null : now,
          assignmentNote: dto.assignmentNote ?? null,
          trackingReference: nextTrackingReference ?? null,
        },
      });

      await tx.orderShipment.updateMany({
        where: {
          orderId: order.id,
          status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
        },
        data: {
          ...(!isUnassign ? { deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER } : {}),
          deliveryPartnerUserId: partnerUserId,
          assignmentStatus: isUnassign
            ? DeliveryAssignmentStatus.UNASSIGNED
            : DeliveryAssignmentStatus.ASSIGNED,
          assignedAt: isUnassign ? null : now,
          acceptedAt: null,
          rejectedAt: null,
          assignmentNote: dto.assignmentNote ?? null,
        },
      });

      await tx.deliveryEvent.create({
        data: {
          deliveryDetailId: updatedDelivery.id,
          oldStatus: delivery?.status ?? null,
          newStatus: updatedDelivery.status,
          note:
            dto.assignmentNote ??
            (isUnassign ? "Delivery partner unassigned." : "Delivery partner assigned."),
          updatedById: actor.id,
        },
      });

      if (partnerUserId && shouldRecordNewAttempt) {
        await tx.deliveryAssignmentAttempt.create({
          data: {
            orderId: order.id,
            deliveryDetailId: updatedDelivery.id,
            partnerUserId,
            source: options.source ?? DeliveryAssignmentAttemptSource.MANUAL,
            status: DeliveryAssignmentStatus.ASSIGNED,
            note:
              dto.assignmentNote ??
              (options.source === DeliveryAssignmentAttemptSource.AUTO
                ? "Auto assigned by delivery operations."
                : "Assigned by admin."),
            assignedById: actor.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: isUnassign
            ? "order.delivery_partner.unassigned"
            : "order.delivery_partner.assigned",
          entityType: "order",
          entityId: order.id,
          ...(delivery ? { oldValue: this.deliveryAuditValue(delivery) } : {}),
          newValue: {
            ...this.deliveryAuditValue(updatedDelivery),
            assignmentNote: dto.assignmentNote ?? null,
          },
        },
      });

      return order.id;
    });

    const updated = await this.getOrderByIdOrThrow(orderId);
    if (!isUnassign) {
      await this.notifyDeliveryPartnerAssigned(updated, dto.assignmentNote);
    }
    return updated;
  }

  async respondDeliveryAssignment(
    actor: RequestUser,
    orderNumber: string,
    dto: DeliveryAssignmentDecisionDto,
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: {
        orderNumber,
        deliveryDetail: {
          is: {
            deliveryPartnerUserId: actor.id,
          },
        },
      },
      include: orderInclude,
    });

    if (!order?.deliveryDetail) {
      throw new NotFoundException("Assigned delivery order not found.");
    }

    if (order.deliveryDetail.assignmentStatus !== DeliveryAssignmentStatus.ASSIGNED) {
      throw new BadRequestException(
        "Only pending delivery assignments can be accepted or rejected.",
      );
    }

    const accepting = dto.decision === DeliveryAssignmentDecision.ACCEPT;
    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const respondedAt = new Date();
      const deliveryUpdate = await tx.deliveryDetail.updateMany({
        where: {
          id: order.deliveryDetail!.id,
          deliveryPartnerUserId: actor.id,
          assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
        },
        data: accepting
          ? {
              assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
              acceptedAt: respondedAt,
              rejectedAt: null,
              assignmentNote: dto.note ?? order.deliveryDetail!.assignmentNote,
            }
          : {
              deliveryPartnerUserId: null,
              assignmentStatus: DeliveryAssignmentStatus.REJECTED,
              rejectedAt: respondedAt,
              acceptedAt: null,
              assignmentNote: dto.note ?? "Rejected by delivery partner.",
            },
      });
      if (deliveryUpdate.count !== 1) {
        throw new BadRequestException("Assignment changed. Refresh the delivery and try again.");
      }
      const updated = await tx.deliveryDetail.findUniqueOrThrow({
        where: { id: order.deliveryDetail!.id },
      });
      const attemptStatus = accepting
        ? DeliveryAssignmentStatus.ACCEPTED
        : DeliveryAssignmentStatus.REJECTED;
      const attemptUpdate = await tx.deliveryAssignmentAttempt.updateMany({
        where: {
          orderId: order.id,
          partnerUserId: actor.id,
          status: DeliveryAssignmentStatus.ASSIGNED,
        },
        data: {
          status: attemptStatus,
          respondedAt,
          note: dto.note ?? (accepting ? "Assignment accepted." : "Assignment rejected."),
        },
      });
      if (attemptUpdate.count === 0) {
        await tx.deliveryAssignmentAttempt.create({
          data: {
            orderId: order.id,
            deliveryDetailId: updated.id,
            partnerUserId: actor.id,
            source: DeliveryAssignmentAttemptSource.MANUAL,
            status: attemptStatus,
            note: dto.note ?? (accepting ? "Assignment accepted." : "Assignment rejected."),
            respondedAt,
          },
        });
      }

      await tx.orderShipment.updateMany({
        where: {
          orderId: order.id,
          deliveryPartnerUserId: actor.id,
          assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
          status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
        },
        data: accepting
          ? {
              assignmentStatus: DeliveryAssignmentStatus.ACCEPTED,
              acceptedAt: respondedAt,
              rejectedAt: null,
              assignmentNote: dto.note ?? order.deliveryDetail!.assignmentNote,
            }
          : {
              deliveryPartnerUserId: null,
              assignmentStatus: DeliveryAssignmentStatus.REJECTED,
              rejectedAt: respondedAt,
              acceptedAt: null,
              assignmentNote: dto.note ?? "Rejected by delivery partner.",
            },
      });

      await tx.deliveryEvent.create({
        data: {
          deliveryDetailId: updated.id,
          oldStatus: order.deliveryDetail!.status,
          newStatus: updated.status,
          note: dto.note ?? (accepting ? "Assignment accepted." : "Assignment rejected."),
          updatedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: accepting
            ? "order.delivery_assignment.accepted"
            : "order.delivery_assignment.rejected",
          entityType: "order",
          entityId: order.id,
          oldValue: this.deliveryAuditValue(order.deliveryDetail!),
          newValue: this.deliveryAuditValue(updated),
        },
      });

      return order.id;
    });

    const updatedOrder = await this.getOrderByIdOrThrow(orderId);
    await this.notifyDeliveryAssignmentDecision(updatedOrder, actor, accepting, dto.note);
    return this.toDeliveryPartnerOrder(updatedOrder);
  }

  async createDeliveryAttempt(
    actor: RequestUser,
    orderNumber: string,
    dto: CreateDeliveryAttemptDto,
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: {
        orderNumber,
        deliveryDetail: {
          is: {
            deliveryPartnerUserId: actor.id,
          },
        },
      },
      include: orderInclude,
    });

    if (!order?.deliveryDetail) {
      throw new NotFoundException("Assigned delivery order not found.");
    }

    if (order.deliveryDetail.assignmentStatus !== DeliveryAssignmentStatus.ACCEPTED) {
      throw new BadRequestException("Accept the delivery assignment before recording attempts.");
    }

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const attemptedAt = dto.attemptedAt ? new Date(dto.attemptedAt) : new Date();
      const nextAttemptDate = dto.nextAttemptDate ? new Date(dto.nextAttemptDate) : null;
      const attempt = await tx.deliveryAttempt.create({
        data: {
          deliveryDetailId: order.deliveryDetail!.id,
          reason: dto.reason,
          note: dto.note ?? null,
          attemptedAt,
          nextAttemptDate,
          createdById: actor.id,
        },
      });

      await tx.deliveryEvent.create({
        data: {
          deliveryDetailId: order.deliveryDetail!.id,
          oldStatus: order.deliveryDetail!.status,
          newStatus: order.deliveryDetail!.status,
          note: dto.note ?? `Delivery attempt recorded: ${dto.reason}.`,
          updatedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.delivery_attempt.created",
          entityType: "order",
          entityId: order.id,
          newValue: {
            attemptId: attempt.id,
            reason: dto.reason,
            note: dto.note ?? null,
            attemptedAt: attemptedAt.toISOString(),
            nextAttemptDate: nextAttemptDate?.toISOString() ?? null,
          },
        },
      });

      return order.id;
    });

    const updated = await this.getOrderByIdOrThrow(orderId);
    return this.toDeliveryPartnerOrder(updated);
  }

  async listDeliveryPartnerOrders(actor: RequestUser, query: OrderQueryDto) {
    const result = await this.listOrders(
      {
        ...this.orderQueryWhere(query),
        deliveryDetail: {
          is: {
            deliveryPartnerUserId: actor.id,
          },
        },
      },
      query,
    );

    return {
      ...result,
      items: result.items.map((order) => this.toDeliveryPartnerOrder(order)),
    };
  }

  async getDeliveryPartnerOrder(actor: RequestUser, orderNumber: string) {
    const order = await this.prisma.client.order.findFirst({
      where: {
        orderNumber,
        deliveryDetail: {
          is: {
            deliveryPartnerUserId: actor.id,
          },
        },
      },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Assigned delivery order not found.");
    }

    return this.toDeliveryPartnerOrder(order);
  }

  updateDeliveryPartnerDelivery(actor: RequestUser, orderNumber: string, dto: UpdateDeliveryDto) {
    return this.updateDelivery(actor, orderNumber, dto, {
      sellerOnly: false,
      deliveryPartnerOnly: true,
    });
  }

  async updateAdminOrderStatus(actor: RequestUser, orderNumber: string, dto: UpdateOrderStatusDto) {
    const existing = await this.getOrderByNumberOrThrow(orderNumber);

    if (!dto.orderStatus && !dto.paymentStatus) {
      throw new BadRequestException("At least one status must be provided.");
    }

    const isCancellingOrder =
      dto.orderStatus === OrderStatus.CANCELLED && dto.orderStatus !== existing.orderStatus;
    const paymentStatusToApply =
      dto.paymentStatus ??
      (isCancellingOrder && existing.paymentStatus === PaymentStatus.PENDING
        ? PaymentStatus.NOT_REQUIRED
        : undefined);
    const nextOrderStatus = dto.orderStatus ?? existing.orderStatus;
    const nextPaymentStatus = paymentStatusToApply ?? existing.paymentStatus;

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: existing.id },
        data: {
          ...(dto.orderStatus ? { orderStatus: dto.orderStatus } : {}),
          ...(paymentStatusToApply ? { paymentStatus: paymentStatusToApply } : {}),
          ...(isCancellingOrder ? { deliveryStatus: DeliveryStatus.CANCELLED } : {}),
        },
      });

      if (dto.orderStatus && dto.orderStatus !== existing.orderStatus) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: existing.id,
            statusType: StatusEventType.ORDER,
            oldStatus: existing.orderStatus,
            newStatus: dto.orderStatus,
            note: dto.note ?? null,
            createdById: actor.id,
          },
        });
      }

      if (paymentStatusToApply && paymentStatusToApply !== existing.paymentStatus) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: existing.id,
            statusType: StatusEventType.PAYMENT,
            oldStatus: existing.paymentStatus,
            newStatus: paymentStatusToApply,
            note: dto.note ?? null,
            createdById: actor.id,
          },
        });

        const paymentsToUpdate =
          paymentStatusToApply === PaymentStatus.NOT_REQUIRED
            ? existing.payments.filter((payment) => payment.status === PaymentStatus.PENDING)
            : existing.payments.slice(0, 1);
        for (const payment of paymentsToUpdate) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: paymentStatusToApply },
          });

          await tx.paymentEvent.create({
            data: {
              paymentId: payment.id,
              eventType: dto.paymentStatus ? "admin.payment_status.updated" : "order.cancelled",
              oldStatus: payment.status,
              newStatus: paymentStatusToApply,
              payload: {
                orderNumber: existing.orderNumber,
                note: dto.note ?? null,
              },
            },
          });
        }
      }

      if (
        nextOrderStatus === OrderStatus.DELIVERED &&
        (nextPaymentStatus === PaymentStatus.PAID ||
          nextPaymentStatus === PaymentStatus.NOT_REQUIRED)
      ) {
        await tx.orderSellerSplit.updateMany({
          where: {
            orderId: existing.id,
            sellerStatus: { not: SellerOrderStatus.CANCELLED },
            payoutId: null,
          },
          data: {
            settlementStatus: SellerSettlementStatus.ELIGIBLE,
            settlementEligibleAt: new Date(),
          },
        });
      }

      if (isCancellingOrder) {
        if (
          existing.orderStatus !== OrderStatus.DELIVERED &&
          existing.deliveryStatus !== DeliveryStatus.DELIVERED
        ) {
          for (const item of existing.items) {
            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: {
                stockQuantity: {
                  increment: item.quantity,
                },
              },
            });

            await tx.inventoryMovement.create({
              data: {
                productVariantId: item.productVariantId,
                movementType: InventoryMovementType.RETURN,
                quantity: item.quantity,
                reason: "Order cancelled by admin",
                referenceType: "order",
                referenceId: existing.id,
                createdById: actor.id,
              },
            });
          }
        }

        await tx.orderSellerSplit.updateMany({
          where: { orderId: existing.id },
          data: {
            sellerStatus: SellerOrderStatus.CANCELLED,
          },
        });

        await tx.orderShipment.updateMany({
          where: { orderId: existing.id },
          data: {
            status: DeliveryStatus.CANCELLED,
            assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
          },
        });

        if (existing.deliveryDetail) {
          await tx.deliveryDetail.update({
            where: { orderId: existing.id },
            data: {
              status: DeliveryStatus.CANCELLED,
              assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
            },
          });
        }

        await this.sellerLedgerService.recordRefundAdjustmentForOrder(
          tx,
          existing.id,
          actor,
          dto.note ?? "Order cancelled by admin.",
        );
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.status.updated",
          entityType: "order",
          entityId: existing.id,
          oldValue: {
            orderStatus: existing.orderStatus,
            paymentStatus: existing.paymentStatus,
          },
          newValue: {
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            deliveryStatus: order.deliveryStatus,
            note: dto.note,
          },
        },
      });

      return existing.id;
    });

    const order = await this.getOrderByIdOrThrow(orderId);
    if (dto.orderStatus && dto.orderStatus !== existing.orderStatus) {
      await this.notifyCustomerOrderStatus(order, dto.orderStatus, dto.note);
    }

    if (paymentStatusToApply && paymentStatusToApply !== existing.paymentStatus) {
      await this.notifyCustomerPaymentStatus(order, paymentStatusToApply, dto.note);
    }

    return order;
  }

  async verifyCodCollection(actor: RequestUser, orderNumber: string, dto: CodVerificationDto) {
    const existing = await this.getOrderByNumberOrThrow(orderNumber);
    const delivery = existing.deliveryDetail;
    const codPayment = this.findCodPayment(existing);

    if (!codPayment) {
      throw new BadRequestException("This order does not have a COD payment record.");
    }

    if (!delivery) {
      throw new BadRequestException(
        "Delivery details are required before verifying COD collection.",
      );
    }

    if (delivery.codCollectionStatus !== CodCollectionStatus.COLLECTED) {
      throw new BadRequestException("COD must be marked collected before admin verification.");
    }

    if (
      existing.paymentStatus !== PaymentStatus.PENDING ||
      codPayment.status !== PaymentStatus.PENDING
    ) {
      throw new BadRequestException(
        "Only pending COD payments can be verified from COD collection.",
      );
    }

    const expectedAmountPaise = codPayment.amountPaise;
    const collectedAmountPaise = delivery.codCollectedAmountPaise ?? 0;

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      if (dto.decision === CodVerificationDecision.REJECT) {
        const updated = await tx.deliveryDetail.updateMany({
          where: {
            id: delivery.id,
            codCollectionStatus: CodCollectionStatus.COLLECTED,
          },
          data: {
            codCollectionStatus: CodCollectionStatus.REJECTED,
            codVerifiedAt: new Date(),
            codVerifiedById: actor.id,
            codVerificationNote: dto.note ?? "COD collection rejected by admin.",
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException("COD collection changed. Refresh the order and try again.");
        }

        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: "order.cod_collection.rejected",
            entityType: "order",
            entityId: existing.id,
            oldValue: this.deliveryAuditValue(delivery),
            newValue: {
              orderNumber: existing.orderNumber,
              collectedAmountPaise,
              expectedAmountPaise,
              note: dto.note ?? null,
            },
          },
        });

        return existing.id;
      }

      if (collectedAmountPaise !== expectedAmountPaise) {
        throw new BadRequestException(
          "Collected COD amount does not match the pending COD payment amount.",
        );
      }

      const updated = await tx.deliveryDetail.updateMany({
        where: {
          id: delivery.id,
          codCollectionStatus: CodCollectionStatus.COLLECTED,
        },
        data: {
          codCollectionStatus: CodCollectionStatus.VERIFIED,
          codVerifiedAt: new Date(),
          codVerifiedById: actor.id,
          codVerificationNote: dto.note ?? "COD cash verified by admin.",
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException("COD collection changed. Refresh the order and try again.");
      }

      const paidOrder = await tx.order.updateMany({
        where: { id: existing.id, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: PaymentStatus.PAID },
      });
      if (paidOrder.count !== 1) {
        throw new BadRequestException(
          "Order payment status changed. Refresh the order and try again.",
        );
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: existing.id,
          statusType: StatusEventType.PAYMENT,
          oldStatus: existing.paymentStatus,
          newStatus: PaymentStatus.PAID,
          note: dto.note ?? "COD cash verified by admin.",
          createdById: actor.id,
        },
      });

      const paidPayment = await tx.payment.updateMany({
        where: { id: codPayment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.PAID },
      });
      if (paidPayment.count !== 1) {
        throw new BadRequestException(
          "COD payment status changed. Refresh the order and try again.",
        );
      }

      await tx.paymentEvent.create({
        data: {
          paymentId: codPayment.id,
          eventType: "admin.cod_collection.verified",
          oldStatus: codPayment.status,
          newStatus: PaymentStatus.PAID,
          payload: {
            orderNumber: existing.orderNumber,
            collectedAmountPaise,
            expectedAmountPaise,
            note: dto.note ?? null,
          },
        },
      });

      if (existing.orderStatus === OrderStatus.DELIVERED) {
        await this.markSellerSplitsSettlementEligible(tx, existing.id);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.cod_collection.verified",
          entityType: "order",
          entityId: existing.id,
          oldValue: {
            paymentStatus: existing.paymentStatus,
            delivery: this.deliveryAuditValue(delivery),
          },
          newValue: {
            paymentStatus: PaymentStatus.PAID,
            collectedAmountPaise,
            expectedAmountPaise,
            note: dto.note ?? null,
          },
        },
      });

      return existing.id;
    });

    const order = await this.getOrderByIdOrThrow(orderId);
    if (dto.decision === CodVerificationDecision.VERIFY) {
      await this.notifyCustomerPaymentStatus(
        order,
        PaymentStatus.PAID,
        dto.note ?? "COD cash verified by admin.",
      );
    }

    return order;
  }

  async listSellerOrders(actor: RequestUser, query: OrderQueryDto) {
    const seller = await this.resolveSeller(actor);
    const result = await this.listOrders(
      {
        ...this.orderQueryWhere(query),
        sellerSplits: {
          some: {
            sellerId: seller.id,
          },
        },
      },
      query,
    );

    return {
      ...result,
      items: result.items.map((order) => this.filterOrderForSeller(order, seller.id)),
    };
  }

  async getSellerOrder(actor: RequestUser, orderNumber: string) {
    const seller = await this.resolveSeller(actor);
    const order = await this.prisma.client.order.findFirst({
      where: {
        orderNumber,
        sellerSplits: {
          some: {
            sellerId: seller.id,
          },
        },
      },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Seller order not found.");
    }

    return this.filterOrderForSeller(order, seller.id);
  }

  async updateSellerOrderStatus(
    actor: RequestUser,
    orderNumber: string,
    dto: UpdateSellerOrderStatusDto,
  ) {
    const seller = await this.resolveSeller(actor);
    const note = dto.note?.trim() || null;
    const result = await this.prisma.client.$transaction(async (tx) => {
      const orderRecord = await tx.order.findFirst({
        where: {
          orderNumber,
          sellerSplits: {
            some: {
              sellerId: seller.id,
            },
          },
        },
      });

      if (!orderRecord) {
        throw new NotFoundException("Seller order not found.");
      }

      const sellerSplits = await tx.orderSellerSplit.findMany({
        where: { orderId: orderRecord.id },
      });
      const shipments = await tx.orderShipment.findMany({
        where: { orderId: orderRecord.id },
      });
      const deliveryDetail = await tx.deliveryDetail.findUnique({
        where: { orderId: orderRecord.id },
      });
      const order = {
        ...orderRecord,
        sellerSplits,
        shipments,
        deliveryDetail,
      };

      const split = order.sellerSplits.find((sellerSplit) => sellerSplit.sellerId === seller.id);

      if (!split) {
        throw new ForbiddenException("Order does not belong to this seller.");
      }

      const currentShipment = order.shipments.find(
        (shipment) => shipment.orderSellerSplitId === split.id,
      );
      this.assertSellerStatusTransition(
        split.sellerStatus,
        dto.sellerStatus,
        currentShipment?.status,
      );

      const sellerStatusChanged = split.sellerStatus !== dto.sellerStatus;
      if (sellerStatusChanged) {
        const updated = await tx.orderSellerSplit.updateMany({
          where: {
            id: split.id,
            sellerStatus: split.sellerStatus,
          },
          data: {
            sellerStatus: dto.sellerStatus,
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException("Order status changed. Refresh the order and try again.");
        }

        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            statusType: StatusEventType.SELLER,
            oldStatus: split.sellerStatus,
            newStatus: dto.sellerStatus,
            note,
            createdById: actor.id,
          },
        });
      }

      const nextSplits = this.replaceSellerSplitStatus(
        order.sellerSplits,
        split.id,
        dto.sellerStatus,
      );
      const nextOrderStatus = this.resolveOrderStatusFromSellerSplits(
        order.orderStatus,
        nextSplits,
      );
      const requestedDeliveryStatus = this.deliveryStatusFromSellerStatus(dto.sellerStatus);
      if (requestedDeliveryStatus && currentShipment?.status) {
        this.assertDeliveryStatusTransition(currentShipment.status, requestedDeliveryStatus);
      }
      const rollupDeliveryStatus = this.resolveDeliveryStatusFromSellerSplits(
        order.deliveryStatus,
        nextSplits,
      );
      const nextDeliveryStatus = requestedDeliveryStatus
        ? this.advanceDeliveryStatus(rollupDeliveryStatus, requestedDeliveryStatus)
        : rollupDeliveryStatus;
      const orderStatusChanged = nextOrderStatus !== order.orderStatus;
      const deliveryStatusChanged = nextDeliveryStatus !== order.deliveryStatus;
      const deliveryDetailStatusChanged =
        nextDeliveryStatus !== (order.deliveryDetail?.status ?? null);

      if (orderStatusChanged || deliveryStatusChanged) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            ...(orderStatusChanged ? { orderStatus: nextOrderStatus } : {}),
            ...(deliveryStatusChanged ? { deliveryStatus: nextDeliveryStatus } : {}),
          },
        });
      }

      if (deliveryDetailStatusChanged && nextDeliveryStatus !== DeliveryStatus.NOT_ASSIGNED) {
        const delivery = await tx.deliveryDetail.upsert({
          where: { orderId: order.id },
          update: {
            status: nextDeliveryStatus,
            ...(note ? { deliveryNote: note } : {}),
          },
          create: {
            orderId: order.id,
            deliveryMode: order.deliveryDetail?.deliveryMode ?? DeliveryMode.LOCAL_DELIVERY_PARTNER,
            status: nextDeliveryStatus,
            deliveryNote: note,
          },
        });

        await tx.deliveryEvent.create({
          data: {
            deliveryDetailId: delivery.id,
            oldStatus: order.deliveryDetail?.status ?? null,
            newStatus: nextDeliveryStatus,
            note,
            updatedById: actor.id,
          },
        });
      }

      if (deliveryStatusChanged) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            statusType: StatusEventType.DELIVERY,
            oldStatus: order.deliveryStatus,
            newStatus: nextDeliveryStatus,
            note,
            createdById: actor.id,
          },
        });
      }

      if (requestedDeliveryStatus) {
        await this.updateSellerShipmentStatusGuarded(tx, {
          orderSellerSplitId: split.id,
          nextStatus: requestedDeliveryStatus,
          updateData: {
            status: requestedDeliveryStatus,
            ...(note ? { deliveryNote: note } : {}),
          },
          createData: {
            shipmentNumber: this.createShipmentNumber(
              order.orderNumber,
              order.sellerSplits.findIndex((sellerSplit) => sellerSplit.id === split.id) + 1,
            ),
            orderId: order.id,
            orderSellerSplitId: split.id,
            sellerId: seller.id,
            subtotalPaise: split.sellerSubtotalPaise,
            shippingPaise: 0,
            deliveryMode: order.deliveryDetail?.deliveryMode ?? DeliveryMode.LOCAL_DELIVERY_PARTNER,
            status: requestedDeliveryStatus,
            deliveryNote: note,
          },
        });
      }

      if (orderStatusChanged) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            statusType: StatusEventType.ORDER,
            oldStatus: order.orderStatus,
            newStatus: nextOrderStatus,
            note: note ?? "Seller fulfilment status updated.",
            createdById: actor.id,
          },
        });
      }

      if (
        nextOrderStatus === OrderStatus.DELIVERED &&
        (order.paymentStatus === PaymentStatus.PAID ||
          order.paymentStatus === PaymentStatus.NOT_REQUIRED)
      ) {
        await this.markSellerSplitsSettlementEligible(tx, order.id);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "seller.order_status.updated",
          entityType: "order",
          entityId: order.id,
          oldValue: {
            sellerStatus: split.sellerStatus,
            orderStatus: order.orderStatus,
            deliveryStatus: order.deliveryStatus,
          },
          newValue: {
            sellerStatus: dto.sellerStatus,
            orderStatus: nextOrderStatus,
            deliveryStatus: nextDeliveryStatus,
            note,
          },
        },
      });

      return {
        orderId: order.id,
        orderStatusChanged,
        nextOrderStatus,
        deliveryStatusChanged,
        nextDeliveryStatus,
      };
    });

    let order = await this.getOrderByIdOrThrow(result.orderId);
    if (result.deliveryStatusChanged && result.nextDeliveryStatus === DeliveryStatus.PACKED) {
      order = await this.autoAssignPackedDelivery(
        order,
        actor,
        "Auto assigned when seller marked the order packed.",
      );
    }
    const orderTemplate = result.orderStatusChanged
      ? this.orderStatusTemplate(result.nextOrderStatus)
      : undefined;
    const deliveryTemplate = result.deliveryStatusChanged
      ? this.deliveryStatusTemplate(result.nextDeliveryStatus)
      : undefined;
    if (result.orderStatusChanged) {
      await this.notifyCustomerOrderStatus(order, result.nextOrderStatus, note ?? undefined);
    }
    if (result.deliveryStatusChanged && deliveryTemplate !== orderTemplate) {
      await this.notifyCustomerDeliveryStatus(order, result.nextDeliveryStatus, note ?? undefined);
    }

    return this.filterOrderForSeller(order, seller.id);
  }

  async updateDelivery(
    actor: RequestUser,
    orderNumber: string,
    dto: UpdateDeliveryDto,
    options: { sellerOnly: boolean; deliveryPartnerOnly?: boolean },
  ) {
    const seller = options.sellerOnly ? await this.resolveSeller(actor) : null;
    const order = seller
      ? await this.prisma.client.order.findFirst({
          where: {
            orderNumber,
            sellerSplits: {
              some: {
                sellerId: seller.id,
              },
            },
          },
          include: orderInclude,
        })
      : options.deliveryPartnerOnly
        ? await this.prisma.client.order.findFirst({
            where: {
              orderNumber,
              deliveryDetail: {
                is: {
                  deliveryPartnerUserId: actor.id,
                },
              },
            },
            include: orderInclude,
          })
        : await this.getOrderByNumberOrThrow(orderNumber);

    if (!order) {
      const notFoundMessage = options.deliveryPartnerOnly
        ? "Assigned delivery order not found."
        : options.sellerOnly
          ? "Seller order not found."
          : "Order not found.";
      throw new NotFoundException(notFoundMessage);
    }

    const previousDelivery = order.deliveryDetail;
    if (
      options.deliveryPartnerOnly &&
      previousDelivery?.assignmentStatus !== DeliveryAssignmentStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        "Accept the delivery assignment before updating delivery progress.",
      );
    }

    const nextStatus = dto.status ?? previousDelivery?.status ?? DeliveryStatus.PENDING;
    const nextMode = options.deliveryPartnerOnly
      ? (previousDelivery?.deliveryMode ?? DeliveryMode.LOCAL_DELIVERY_PARTNER)
      : (dto.deliveryMode ?? previousDelivery?.deliveryMode ?? DeliveryMode.LOCAL_DELIVERY_PARTNER);
    const canAssignDeliveryPartner =
      !options.sellerOnly &&
      !options.deliveryPartnerOnly &&
      dto.deliveryPartnerUserId !== undefined;
    const nextModeUsesLocalPartner = nextMode === DeliveryMode.LOCAL_DELIVERY_PARTNER;
    if (canAssignDeliveryPartner && dto.deliveryPartnerUserId && !nextModeUsesLocalPartner) {
      throw new BadRequestException(
        "Local delivery partners can only be assigned when delivery mode is Local Delivery Partner.",
      );
    }
    const nextDeliveryPartnerUserId =
      canAssignDeliveryPartner && nextModeUsesLocalPartner
        ? (dto.deliveryPartnerUserId ?? null)
        : null;
    const shouldClearLocalPartnerForMode =
      !options.sellerOnly &&
      !options.deliveryPartnerOnly &&
      dto.deliveryMode !== undefined &&
      !nextModeUsesLocalPartner &&
      Boolean(previousDelivery?.deliveryPartnerUserId);
    const shouldUpdatePartnerAssignment =
      canAssignDeliveryPartner || shouldClearLocalPartnerForMode;
    const requestedTrackingReference =
      dto.trackingReference !== undefined
        ? this.normalizeTrackingReference(dto.trackingReference)
        : undefined;
    const manualTrackingReference = requestedTrackingReference ?? undefined;
    const trackingReferenceProvided = manualTrackingReference !== undefined;
    const shouldGenerateTrackingReference = this.shouldGenerateTrackingReference({
      previousDelivery,
      dto,
      options,
      canAssignDeliveryPartner,
      trackingReferenceProvided,
    });
    const shouldRecordCodCollection =
      dto.codCollected !== undefined ||
      dto.codCollectedAmountPaise !== undefined ||
      dto.codCollectionNote !== undefined;
    const codCollectionData = shouldRecordCodCollection
      ? this.codCollectionDeliveryData(order, previousDelivery, actor, dto)
      : null;
    const sellerShipment = seller
      ? order.shipments.find((shipment) => shipment.sellerId === seller.id)
      : null;

    if ((options.sellerOnly || options.deliveryPartnerOnly) && previousDelivery?.status) {
      this.assertDeliveryStatusTransition(previousDelivery.status, nextStatus);
    }
    if (options.sellerOnly && sellerShipment?.status) {
      this.assertDeliveryStatusTransition(sellerShipment.status, nextStatus);
    }
    if (options.sellerOnly && nextStatus === DeliveryStatus.CANCELLED) {
      const split = order.sellerSplits.find((sellerSplit) => sellerSplit.sellerId === seller?.id);
      this.assertSellerPackageCancellationAllowed(
        split?.sellerStatus ?? SellerOrderStatus.PENDING,
        sellerShipment?.status,
      );
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      if (nextDeliveryPartnerUserId) {
        await this.assertDeliveryPartnerUser(tx, nextDeliveryPartnerUserId);
      }

      const assignmentNow = new Date();
      const nextTrackingReference =
        manualTrackingReference !== undefined
          ? manualTrackingReference
          : shouldGenerateTrackingReference
            ? await this.createDeliveryTrackingReference(tx)
            : undefined;

      const delivery = await tx.deliveryDetail.upsert({
        where: { orderId: order.id },
        update: {
          deliveryMode: nextMode,
          ...(!options.deliveryPartnerOnly && dto.partnerName !== undefined
            ? { partnerName: dto.partnerName ?? null }
            : {}),
          ...(!options.deliveryPartnerOnly && dto.partnerPhone !== undefined
            ? { partnerPhone: dto.partnerPhone ?? null }
            : {}),
          ...(shouldUpdatePartnerAssignment
            ? {
                deliveryPartnerUserId: nextDeliveryPartnerUserId,
                assignmentStatus: nextDeliveryPartnerUserId
                  ? DeliveryAssignmentStatus.ASSIGNED
                  : DeliveryAssignmentStatus.UNASSIGNED,
                assignedAt: nextDeliveryPartnerUserId ? assignmentNow : null,
                acceptedAt: null,
                rejectedAt: null,
                assignmentNote: nextDeliveryPartnerUserId
                  ? (dto.deliveryNote ?? "Delivery partner assigned by admin.")
                  : (dto.deliveryNote ?? "Delivery partner unassigned for this delivery mode."),
              }
            : {}),
          ...(codCollectionData ?? {}),
          ...(nextTrackingReference !== undefined
            ? { trackingReference: nextTrackingReference }
            : {}),
          ...(dto.estimatedDeliveryDate !== undefined
            ? {
                estimatedDeliveryDate: dto.estimatedDeliveryDate
                  ? new Date(dto.estimatedDeliveryDate)
                  : null,
              }
            : {}),
          ...(dto.deliveryNote !== undefined ? { deliveryNote: dto.deliveryNote ?? null } : {}),
          ...(dto.receiverName !== undefined ? { receiverName: dto.receiverName ?? null } : {}),
          ...(dto.proofNote !== undefined ? { proofNote: dto.proofNote ?? null } : {}),
          ...(dto.proofReference !== undefined
            ? { proofReference: dto.proofReference ?? null }
            : {}),
          status: nextStatus,
        },
        create: {
          orderId: order.id,
          deliveryMode: nextMode,
          partnerName: options.deliveryPartnerOnly
            ? (previousDelivery?.partnerName ?? null)
            : (dto.partnerName ?? null),
          partnerPhone: options.deliveryPartnerOnly
            ? (previousDelivery?.partnerPhone ?? null)
            : (dto.partnerPhone ?? null),
          ...(shouldUpdatePartnerAssignment
            ? {
                deliveryPartnerUserId: nextDeliveryPartnerUserId,
                assignmentStatus: nextDeliveryPartnerUserId
                  ? DeliveryAssignmentStatus.ASSIGNED
                  : DeliveryAssignmentStatus.UNASSIGNED,
                assignedAt: nextDeliveryPartnerUserId ? assignmentNow : null,
                assignmentNote: nextDeliveryPartnerUserId
                  ? (dto.deliveryNote ?? "Delivery partner assigned by admin.")
                  : (dto.deliveryNote ?? "Delivery partner unassigned for this delivery mode."),
              }
            : {}),
          ...(codCollectionData ?? {}),
          trackingReference: nextTrackingReference ?? null,
          estimatedDeliveryDate: dto.estimatedDeliveryDate
            ? new Date(dto.estimatedDeliveryDate)
            : null,
          deliveryNote: dto.deliveryNote ?? null,
          receiverName: dto.receiverName ?? null,
          proofNote: dto.proofNote ?? null,
          proofReference: dto.proofReference ?? null,
          status: nextStatus,
        },
      });

      if (shouldUpdatePartnerAssignment) {
        const previousPartnerUserId =
          previousDelivery?.deliveryPartnerUserId &&
          previousDelivery.deliveryPartnerUserId !== nextDeliveryPartnerUserId
            ? previousDelivery.deliveryPartnerUserId
            : null;
        if (previousPartnerUserId) {
          await tx.deliveryAssignmentAttempt.updateMany({
            where: {
              orderId: order.id,
              partnerUserId: previousPartnerUserId,
              status: DeliveryAssignmentStatus.ASSIGNED,
            },
            data: {
              status: DeliveryAssignmentStatus.CANCELLED,
              respondedAt: assignmentNow,
              note: dto.deliveryNote ?? "Delivery partner changed by admin.",
            },
          });
        }
        const shouldRecordNewAttempt =
          Boolean(nextDeliveryPartnerUserId) &&
          (nextDeliveryPartnerUserId !== previousDelivery?.deliveryPartnerUserId ||
            (previousDelivery?.assignmentStatus !== DeliveryAssignmentStatus.ASSIGNED &&
              previousDelivery?.assignmentStatus !== DeliveryAssignmentStatus.ACCEPTED));
        if (nextDeliveryPartnerUserId && shouldRecordNewAttempt) {
          await tx.deliveryAssignmentAttempt.create({
            data: {
              orderId: order.id,
              deliveryDetailId: delivery.id,
              partnerUserId: nextDeliveryPartnerUserId,
              source: DeliveryAssignmentAttemptSource.MANUAL,
              status: DeliveryAssignmentStatus.ASSIGNED,
              note: dto.deliveryNote ?? "Delivery partner assigned by admin.",
              assignedById: actor.id,
            },
          });
        }

        await tx.orderShipment.updateMany({
          where: {
            orderId: order.id,
            status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
          },
          data: {
            deliveryPartnerUserId: nextDeliveryPartnerUserId,
            assignmentStatus: nextDeliveryPartnerUserId
              ? DeliveryAssignmentStatus.ASSIGNED
              : DeliveryAssignmentStatus.UNASSIGNED,
            assignedAt: nextDeliveryPartnerUserId ? assignmentNow : null,
            acceptedAt: null,
            rejectedAt: null,
            assignmentNote: nextDeliveryPartnerUserId
              ? (dto.deliveryNote ?? "Delivery partner assigned by admin.")
              : (dto.deliveryNote ?? "Delivery partner unassigned for this delivery mode."),
          },
        });
      }

      await tx.deliveryEvent.create({
        data: {
          deliveryDetailId: delivery.id,
          oldStatus: previousDelivery?.status ?? null,
          newStatus: delivery.status,
          note: dto.deliveryNote ?? null,
          updatedById: actor.id,
        },
      });

      if (seller) {
        const split = order.sellerSplits.find((sellerSplit) => sellerSplit.sellerId === seller.id);
        if (!split) {
          throw new ForbiddenException("Order does not belong to this seller.");
        }

        await this.updateSellerShipmentStatusGuarded(tx, {
          orderSellerSplitId: split.id,
          nextStatus,
          updateData: {
            deliveryMode: nextMode,
            ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName ?? null } : {}),
            ...(dto.partnerPhone !== undefined ? { partnerPhone: dto.partnerPhone ?? null } : {}),
            ...(nextTrackingReference !== undefined
              ? { trackingReference: nextTrackingReference }
              : {}),
            ...(dto.estimatedDeliveryDate !== undefined
              ? {
                  estimatedDeliveryDate: dto.estimatedDeliveryDate
                    ? new Date(dto.estimatedDeliveryDate)
                    : null,
                }
              : {}),
            ...(dto.deliveryNote !== undefined ? { deliveryNote: dto.deliveryNote ?? null } : {}),
            ...(dto.receiverName !== undefined ? { receiverName: dto.receiverName ?? null } : {}),
            ...(dto.proofNote !== undefined ? { proofNote: dto.proofNote ?? null } : {}),
            ...(dto.proofReference !== undefined
              ? { proofReference: dto.proofReference ?? null }
              : {}),
            status: nextStatus,
          },
          createData: {
            shipmentNumber: this.createShipmentNumber(
              order.orderNumber,
              order.sellerSplits.findIndex((sellerSplit) => sellerSplit.id === split.id) + 1,
            ),
            orderId: order.id,
            orderSellerSplitId: split.id,
            sellerId: seller.id,
            subtotalPaise: split.sellerSubtotalPaise,
            shippingPaise: 0,
            deliveryMode: nextMode,
            partnerName: dto.partnerName ?? null,
            partnerPhone: dto.partnerPhone ?? null,
            trackingReference: nextTrackingReference ?? null,
            estimatedDeliveryDate: dto.estimatedDeliveryDate
              ? new Date(dto.estimatedDeliveryDate)
              : null,
            deliveryNote: dto.deliveryNote ?? null,
            receiverName: dto.receiverName ?? null,
            proofNote: dto.proofNote ?? null,
            proofReference: dto.proofReference ?? null,
            status: nextStatus,
          },
        });
      } else {
        await tx.orderShipment.updateMany({
          where: {
            orderId: order.id,
            status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
          },
          data: {
            deliveryMode: nextMode,
            status: nextStatus,
            ...(dto.estimatedDeliveryDate !== undefined
              ? {
                  estimatedDeliveryDate: dto.estimatedDeliveryDate
                    ? new Date(dto.estimatedDeliveryDate)
                    : null,
                }
              : {}),
            ...(dto.deliveryNote !== undefined ? { deliveryNote: dto.deliveryNote ?? null } : {}),
          },
        });
      }

      const deliveryStatusChanged = nextStatus !== order.deliveryStatus;
      const deliveryDetailStatusChanged = nextStatus !== (previousDelivery?.status ?? null);
      if (deliveryDetailStatusChanged) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            statusType: StatusEventType.DELIVERY,
            oldStatus: previousDelivery?.status ?? null,
            newStatus: delivery.status,
            note: dto.deliveryNote ?? null,
            createdById: actor.id,
          },
        });
      }

      let sellerStatusChanged = false;
      let oldSellerStatus: SellerOrderStatus | null = null;
      let nextSellerStatus: SellerOrderStatus | null = null;
      let nextSplits = order.sellerSplits;
      if (seller) {
        const split = order.sellerSplits.find((sellerSplit) => sellerSplit.sellerId === seller.id);
        const derivedSellerStatus = this.sellerStatusFromDeliveryStatus(nextStatus);

        if (
          split &&
          derivedSellerStatus &&
          this.shouldApplyDerivedSellerStatus(split.sellerStatus, derivedSellerStatus)
        ) {
          const updated = await tx.orderSellerSplit.updateMany({
            where: {
              id: split.id,
              sellerStatus: split.sellerStatus,
            },
            data: {
              sellerStatus: derivedSellerStatus,
            },
          });

          if (updated.count !== 1) {
            throw new BadRequestException("Order status changed. Refresh the order and try again.");
          }

          sellerStatusChanged = true;
          oldSellerStatus = split.sellerStatus;
          nextSellerStatus = derivedSellerStatus;
          nextSplits = this.replaceSellerSplitStatus(
            order.sellerSplits,
            split.id,
            derivedSellerStatus,
          );

          await tx.orderStatusEvent.create({
            data: {
              orderId: order.id,
              statusType: StatusEventType.SELLER,
              oldStatus: split.sellerStatus,
              newStatus: derivedSellerStatus,
              note: dto.deliveryNote ?? null,
              createdById: actor.id,
            },
          });
        }
      }

      if (options.deliveryPartnerOnly) {
        const derivedSellerStatus = this.sellerStatusFromDeliveryStatus(nextStatus);
        if (derivedSellerStatus) {
          for (const split of order.sellerSplits) {
            if (!this.shouldApplyDerivedSellerStatus(split.sellerStatus, derivedSellerStatus)) {
              continue;
            }

            const updated = await tx.orderSellerSplit.updateMany({
              where: {
                id: split.id,
                sellerStatus: split.sellerStatus,
              },
              data: {
                sellerStatus: derivedSellerStatus,
              },
            });

            if (updated.count !== 1) {
              throw new BadRequestException(
                "Order status changed. Refresh the delivery and try again.",
              );
            }

            sellerStatusChanged = true;
            oldSellerStatus = split.sellerStatus;
            nextSellerStatus = derivedSellerStatus;
            nextSplits = this.replaceSellerSplitStatus(nextSplits, split.id, derivedSellerStatus);
          }

          if (sellerStatusChanged) {
            await tx.orderStatusEvent.create({
              data: {
                orderId: order.id,
                statusType: StatusEventType.SELLER,
                oldStatus: oldSellerStatus,
                newStatus: derivedSellerStatus,
                note: dto.deliveryNote ?? "Delivery partner updated delivery status.",
                createdById: actor.id,
              },
            });
          }
        }
      }

      const nextOrderStatus =
        seller || options.deliveryPartnerOnly
          ? this.resolveOrderStatusFromSellerSplits(order.orderStatus, nextSplits)
          : order.orderStatus;
      const orderStatusChanged = nextOrderStatus !== order.orderStatus;

      await tx.order.update({
        where: { id: order.id },
        data: {
          deliveryStatus: delivery.status,
          ...(orderStatusChanged ? { orderStatus: nextOrderStatus } : {}),
        },
      });

      if (orderStatusChanged) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            statusType: StatusEventType.ORDER,
            oldStatus: order.orderStatus,
            newStatus: nextOrderStatus,
            note: dto.deliveryNote ?? "Seller delivery status updated.",
            createdById: actor.id,
          },
        });
      }

      if (
        nextOrderStatus === OrderStatus.DELIVERED &&
        (order.paymentStatus === PaymentStatus.PAID ||
          order.paymentStatus === PaymentStatus.NOT_REQUIRED)
      ) {
        await this.markSellerSplitsSettlementEligible(tx, order.id);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.delivery.updated",
          entityType: "order",
          entityId: order.id,
          ...(previousDelivery ? { oldValue: this.deliveryAuditValue(previousDelivery) } : {}),
          newValue: {
            ...this.deliveryAuditValue(delivery),
            ...(sellerStatusChanged ? { oldSellerStatus, nextSellerStatus } : {}),
            ...(orderStatusChanged ? { oldOrderStatus: order.orderStatus, nextOrderStatus } : {}),
            ...(codCollectionData ? { codCollectionRecorded: true } : {}),
            ...(options.deliveryPartnerOnly ? { deliveryPartnerUserId: actor.id } : {}),
          },
        },
      });

      return {
        orderId: order.id,
        deliveryStatusChanged,
        nextStatus,
        orderStatusChanged,
        nextOrderStatus,
        codCollectionRecorded: Boolean(codCollectionData),
        deliveryPartnerAssigned: canAssignDeliveryPartner && Boolean(dto.deliveryPartnerUserId),
      };
    });

    let orderWithDelivery = await this.getOrderByIdOrThrow(result.orderId);
    if (
      result.deliveryStatusChanged &&
      result.nextStatus === DeliveryStatus.PACKED &&
      !result.deliveryPartnerAssigned
    ) {
      orderWithDelivery = await this.autoAssignPackedDelivery(
        orderWithDelivery,
        actor,
        "Auto assigned when delivery became packed.",
      );
    }
    const deliveryTemplate = result.deliveryStatusChanged
      ? this.deliveryStatusTemplate(result.nextStatus)
      : undefined;
    const orderTemplate = result.orderStatusChanged
      ? this.orderStatusTemplate(result.nextOrderStatus)
      : undefined;
    if (result.deliveryStatusChanged) {
      await this.notifyCustomerDeliveryStatus(
        orderWithDelivery,
        result.nextStatus,
        dto.deliveryNote,
      );
    }
    if (result.orderStatusChanged && orderTemplate !== deliveryTemplate) {
      await this.notifyCustomerOrderStatus(
        orderWithDelivery,
        result.nextOrderStatus,
        dto.deliveryNote,
      );
    }
    if (result.deliveryPartnerAssigned) {
      await this.notifyDeliveryPartnerAssigned(orderWithDelivery, dto.deliveryNote);
    }
    if (result.codCollectionRecorded) {
      await this.notifyAdminCodCollected(orderWithDelivery);
    }

    return seller
      ? this.filterOrderForSeller(orderWithDelivery, seller.id)
      : options.deliveryPartnerOnly
        ? this.toDeliveryPartnerOrder(orderWithDelivery)
        : orderWithDelivery;
  }

  private filterOrderForSeller(order: OrderWithRelations, sellerId: string): OrderWithRelations {
    return {
      ...order,
      items: order.items.filter((item) => item.sellerId === sellerId),
      sellerSplits: order.sellerSplits.filter((split) => split.sellerId === sellerId),
      shipments: order.shipments.filter((shipment) => shipment.sellerId === sellerId),
    };
  }

  private assertSellerStatusTransition(
    current: SellerOrderStatus,
    next: SellerOrderStatus,
    deliveryStatus?: DeliveryStatus | null,
  ) {
    if (current === next) {
      return;
    }

    if (current === SellerOrderStatus.CANCELLED) {
      throw new BadRequestException("Delivered or cancelled seller orders cannot be changed.");
    }

    if (next === SellerOrderStatus.CANCELLED) {
      this.assertSellerPackageCancellationAllowed(current, deliveryStatus);
      return;
    }

    if (current === SellerOrderStatus.DELIVERED) {
      throw new BadRequestException("Delivered or cancelled seller orders cannot be changed.");
    }

    if (sellerStatusRank[next] <= sellerStatusRank[current]) {
      throw new BadRequestException("Seller order status can only move forward.");
    }
  }

  private assertCustomerCancellationAllowed(order: OrderWithRelations) {
    if (this.hasOrderLeftSeller(order)) {
      throw new BadRequestException(dispatchedCustomerCancellationMessage);
    }
  }

  private hasOrderLeftSeller(order: OrderWithRelations) {
    return (
      dispatchedOrderStatuses.has(order.orderStatus) ||
      dispatchedDeliveryStatuses.has(order.deliveryStatus) ||
      (order.deliveryDetail?.status
        ? dispatchedDeliveryStatuses.has(order.deliveryDetail.status)
        : false) ||
      order.sellerSplits.some((split) => dispatchedSellerStatuses.has(split.sellerStatus)) ||
      order.shipments.some((shipment) => dispatchedDeliveryStatuses.has(shipment.status))
    );
  }

  private assertSellerPackageCancellationAllowed(
    sellerStatus: SellerOrderStatus,
    deliveryStatus?: DeliveryStatus | null,
  ) {
    if (
      dispatchedSellerStatuses.has(sellerStatus) ||
      (deliveryStatus ? dispatchedDeliveryStatuses.has(deliveryStatus) : false)
    ) {
      throw new BadRequestException(dispatchedSellerCancellationMessage);
    }
  }

  private assertDeliveryStatusTransition(current: DeliveryStatus, next: DeliveryStatus) {
    if (current === next) {
      return;
    }

    if (current === DeliveryStatus.DELIVERED || current === DeliveryStatus.CANCELLED) {
      throw new BadRequestException("Delivered or cancelled deliveries cannot be changed.");
    }

    if (deliveryStatusRank[next] < deliveryStatusRank[current]) {
      throw new BadRequestException("Delivery status cannot move backwards.");
    }
  }

  private replaceSellerSplitStatus<T extends { id: string; sellerStatus: SellerOrderStatus }>(
    splits: T[],
    splitId: string,
    sellerStatus: SellerOrderStatus,
  ) {
    return splits.map((split) => (split.id === splitId ? { ...split, sellerStatus } : split));
  }

  private resolveOrderStatusFromSellerSplits(
    currentStatus: OrderStatus,
    splits: Array<{ sellerStatus: SellerOrderStatus }>,
  ) {
    if (currentStatus === OrderStatus.CANCELLED || currentStatus === OrderStatus.DELIVERED) {
      return currentStatus;
    }

    const activeSplits = splits.filter(
      (split) => split.sellerStatus !== SellerOrderStatus.CANCELLED,
    );
    if (activeSplits.length === 0) {
      return OrderStatus.CANCELLED;
    }

    let nextStatus: OrderStatus = currentStatus;
    if (activeSplits.every((split) => split.sellerStatus === SellerOrderStatus.DELIVERED)) {
      nextStatus = OrderStatus.DELIVERED;
    } else if (
      activeSplits.some(
        (split) =>
          split.sellerStatus === SellerOrderStatus.DISPATCHED ||
          split.sellerStatus === SellerOrderStatus.DELIVERED,
      )
    ) {
      nextStatus = OrderStatus.SHIPPED;
    } else if (activeSplits.some((split) => split.sellerStatus === SellerOrderStatus.PROCESSING)) {
      nextStatus = OrderStatus.PROCESSING;
    } else if (
      activeSplits.every(
        (split) =>
          sellerStatusRank[split.sellerStatus] >= sellerStatusRank[SellerOrderStatus.ACCEPTED],
      )
    ) {
      nextStatus = OrderStatus.CONFIRMED;
    }

    return orderStatusRank[nextStatus] > orderStatusRank[currentStatus]
      ? nextStatus
      : currentStatus;
  }

  private resolveDeliveryStatusFromSellerSplits(
    currentStatus: DeliveryStatus,
    splits: Array<{ sellerStatus: SellerOrderStatus }>,
  ) {
    if (currentStatus === DeliveryStatus.CANCELLED || currentStatus === DeliveryStatus.DELIVERED) {
      return currentStatus;
    }

    const activeSplits = splits.filter(
      (split) => split.sellerStatus !== SellerOrderStatus.CANCELLED,
    );
    if (activeSplits.length === 0) {
      return DeliveryStatus.CANCELLED;
    }

    if (activeSplits.every((split) => split.sellerStatus === SellerOrderStatus.DELIVERED)) {
      return DeliveryStatus.DELIVERED;
    }

    if (
      activeSplits.some(
        (split) =>
          split.sellerStatus === SellerOrderStatus.DISPATCHED ||
          split.sellerStatus === SellerOrderStatus.DELIVERED,
      )
    ) {
      return this.advanceDeliveryStatus(currentStatus, DeliveryStatus.DISPATCHED);
    }

    if (activeSplits.some((split) => split.sellerStatus === SellerOrderStatus.PROCESSING)) {
      return this.advanceDeliveryStatus(currentStatus, DeliveryStatus.PACKED);
    }

    return currentStatus;
  }

  private deliveryStatusFromSellerStatus(status: SellerOrderStatus) {
    switch (status) {
      case SellerOrderStatus.PROCESSING:
        return DeliveryStatus.PACKED;
      case SellerOrderStatus.DISPATCHED:
        return DeliveryStatus.DISPATCHED;
      case SellerOrderStatus.DELIVERED:
        return DeliveryStatus.DELIVERED;
      case SellerOrderStatus.CANCELLED:
        return DeliveryStatus.CANCELLED;
      default:
        return null;
    }
  }

  private sellerStatusFromDeliveryStatus(status: DeliveryStatus) {
    switch (status) {
      case DeliveryStatus.PACKED:
        return SellerOrderStatus.PROCESSING;
      case DeliveryStatus.DISPATCHED:
      case DeliveryStatus.IN_TRANSIT:
        return SellerOrderStatus.DISPATCHED;
      case DeliveryStatus.DELIVERED:
        return SellerOrderStatus.DELIVERED;
      case DeliveryStatus.CANCELLED:
        return SellerOrderStatus.CANCELLED;
      default:
        return null;
    }
  }

  private shouldApplyDerivedSellerStatus(current: SellerOrderStatus, next: SellerOrderStatus) {
    if (current === next) {
      return false;
    }

    if (current === SellerOrderStatus.DELIVERED || current === SellerOrderStatus.CANCELLED) {
      return false;
    }

    return (
      next === SellerOrderStatus.CANCELLED || sellerStatusRank[next] > sellerStatusRank[current]
    );
  }

  private advanceDeliveryStatus(current: DeliveryStatus, next: DeliveryStatus) {
    if (current === DeliveryStatus.CANCELLED || current === DeliveryStatus.DELIVERED) {
      return current;
    }

    if (
      next === DeliveryStatus.CANCELLED ||
      deliveryStatusRank[next] > deliveryStatusRank[current]
    ) {
      return next;
    }

    return current;
  }

  private async markSellerSplitsSettlementEligible(tx: Prisma.TransactionClient, orderId: string) {
    await tx.orderSellerSplit.updateMany({
      where: {
        orderId,
        sellerStatus: { not: SellerOrderStatus.CANCELLED },
        payoutId: null,
      },
      data: {
        settlementStatus: SellerSettlementStatus.ELIGIBLE,
        settlementEligibleAt: new Date(),
      },
    });
  }

  private async autoAssignPackedDelivery(
    order: OrderWithRelations,
    actor: RequestUser,
    note: string,
  ) {
    if (
      order.deliveryStatus !== DeliveryStatus.PACKED &&
      order.deliveryDetail?.status !== DeliveryStatus.PACKED
    ) {
      return order;
    }
    if (order.deliveryDetail?.deliveryMode !== DeliveryMode.LOCAL_DELIVERY_PARTNER) {
      return order;
    }

    if (
      order.deliveryDetail?.deliveryPartnerUserId &&
      (order.deliveryDetail.assignmentStatus === DeliveryAssignmentStatus.ASSIGNED ||
        order.deliveryDetail.assignmentStatus === DeliveryAssignmentStatus.ACCEPTED)
    ) {
      return order;
    }

    const selection = await this.chooseBestDeliveryPartner(order);
    const candidate = selection.candidate;
    if (!candidate) {
      const courierFallback = await this.deliveryRouting.resolveDelivery({
        deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
        address: this.readShippingAddressSnapshot(order.shippingAddressSnapshot),
        subtotalPaise: order.subtotalPaise,
        paymentMethod: order.payments[0]?.method ?? null,
        orderId: order.id,
      });
      const shouldFallbackToCourier =
        courierFallback.deliveryMode === DeliveryMode.THIRD_PARTY_COURIER;
      const assignmentNote = shouldFallbackToCourier
        ? (courierFallback.routingFailureNote ??
          courierFallback.fallbackReason ??
          "No local delivery partner matched; routed to courier fallback.")
        : this.noAutoAssignmentNote(selection.diagnostics);
      const orderId = await this.prisma.client.$transaction(async (tx) => {
        const delivery = await tx.deliveryDetail.upsert({
          where: { orderId: order.id },
          update: {
            ...(shouldFallbackToCourier
              ? {
                  deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
                  courierProviderCode: courierFallback.courierProviderCode,
                  routingFailed: courierFallback.routingFailed,
                  routingFailureReason: courierFallback.routingFailureReason,
                  routingFailureNote: courierFallback.routingFailureNote,
                  routedAt: new Date(),
                  shippingChargeSnapshot: courierFallback.shippingSnapshot,
                  codSurchargeSnapshot: courierFallback.codSurchargeSnapshot,
                }
              : {}),
            deliveryPartnerUserId: null,
            assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
            assignedAt: null,
            acceptedAt: null,
            rejectedAt: null,
            assignmentNote,
          },
          create: {
            orderId: order.id,
            deliveryMode: shouldFallbackToCourier
              ? DeliveryMode.THIRD_PARTY_COURIER
              : DeliveryMode.LOCAL_DELIVERY_PARTNER,
            status: DeliveryStatus.PACKED,
            courierProviderCode: shouldFallbackToCourier
              ? courierFallback.courierProviderCode
              : null,
            routingFailed: shouldFallbackToCourier ? courierFallback.routingFailed : false,
            routingFailureReason: shouldFallbackToCourier
              ? courierFallback.routingFailureReason
              : null,
            routingFailureNote: shouldFallbackToCourier ? courierFallback.routingFailureNote : null,
            routedAt: shouldFallbackToCourier ? new Date() : null,
            shippingChargeSnapshot: shouldFallbackToCourier
              ? courierFallback.shippingSnapshot
              : Prisma.JsonNull,
            codSurchargeSnapshot: shouldFallbackToCourier
              ? courierFallback.codSurchargeSnapshot
              : Prisma.JsonNull,
            assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
            assignmentNote,
          },
        });

        await tx.deliveryEvent.create({
          data: {
            deliveryDetailId: delivery.id,
            oldStatus: order.deliveryDetail?.status ?? null,
            newStatus: delivery.status,
            note: assignmentNote,
            updatedById: actor.id,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: "order.delivery_assignment.auto_no_match",
            entityType: "order",
            entityId: order.id,
            ...(order.deliveryDetail
              ? { oldValue: this.deliveryAuditValue(order.deliveryDetail) }
              : {}),
            newValue: {
              orderNumber: order.orderNumber,
              assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
              deliveryMode: shouldFallbackToCourier
                ? DeliveryMode.THIRD_PARTY_COURIER
                : DeliveryMode.LOCAL_DELIVERY_PARTNER,
              courierProviderCode: shouldFallbackToCourier
                ? courierFallback.courierProviderCode
                : null,
              routingFailed: shouldFallbackToCourier ? courierFallback.routingFailed : false,
            },
          },
        });

        return order.id;
      });

      return this.getOrderByIdOrThrow(orderId);
    }

    return this.updateAdminDeliveryAssignment(
      actor,
      order.orderNumber,
      {
        deliveryPartnerUserId: candidate.user.id,
        assignmentNote: this.autoAssignmentNote(note, candidate, selection.diagnostics),
      },
      { source: DeliveryAssignmentAttemptSource.AUTO },
    );
  }

  private async chooseBestDeliveryPartner(order: OrderWithRelations) {
    const address = this.readShippingAddressSnapshot(order.shippingAddressSnapshot);
    const codPayment = this.findCodPayment(order);
    const codAmountPaise =
      codPayment && order.paymentStatus === PaymentStatus.PENDING ? codPayment.amountPaise : 0;
    const defaultLimit = await this.defaultPartnerCodLimitPaise();
    const rejectedPartnerIds = await this.rejectedDeliveryPartnerIds(order.id);
    const partners = await this.prisma.client.user.findMany({
      where: this.deliveryPartnerCandidateWhere(address, rejectedPartnerIds),
      include: {
        deliveryProfile: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });
    let skippedUnavailable = 0;
    let skippedCodLimit = 0;
    const metrics = await this.deliveryPartnerAssignmentMetrics(
      partners.map((partner) => partner.id),
    );

    const candidates = partners.map((user) => {
      const area = this.deliveryPartnerServiceAreaScore(user.deliveryProfile, address);
      if (!area.eligible) {
        skippedUnavailable += 1;
        return null;
      }

      const workload = metrics.workload.get(user.id) ?? 0;
      const codExposurePaise = metrics.codExposurePaise.get(user.id) ?? 0;
      const codLimitPaise = user.deliveryProfile?.codCashLimitPaise ?? defaultLimit;

      if (codAmountPaise > 0 && codExposurePaise + codAmountPaise > codLimitPaise) {
        skippedCodLimit += 1;
        return null;
      }

      return {
        user,
        score: area.score,
        workload,
        codExposurePaise,
        codLimitPaise,
        lastAssignmentAt: metrics.lastAssignmentAt.get(user.id) ?? null,
        area,
      };
    });

    const eligibleCandidates = candidates.filter(
      (candidate): candidate is DeliveryPartnerAssignmentCandidate => Boolean(candidate),
    );
    const candidate =
      eligibleCandidates.sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.workload !== right.workload) {
          return left.workload - right.workload;
        }
        if (left.codExposurePaise !== right.codExposurePaise) {
          return left.codExposurePaise - right.codExposurePaise;
        }
        const leftLastAssignmentAt = left.lastAssignmentAt?.getTime() ?? 0;
        const rightLastAssignmentAt = right.lastAssignmentAt?.getTime() ?? 0;
        if (leftLastAssignmentAt !== rightLastAssignmentAt) {
          return leftLastAssignmentAt - rightLastAssignmentAt;
        }
        return left.user.createdAt.getTime() - right.user.createdAt.getTime();
      })[0] ?? null;

    return {
      candidate,
      diagnostics: {
        partnersChecked: partners.length,
        skippedUnavailable,
        skippedCodLimit,
        skippedRejected: rejectedPartnerIds.size,
        eligibleCandidates: eligibleCandidates.length,
        codAmountPaise,
      },
    };
  }

  private autoAssignmentNote(
    note: string,
    candidate: DeliveryPartnerAssignmentCandidate,
    diagnostics: DeliveryPartnerAssignmentDiagnostics,
  ) {
    const parts = [
      note,
      `Matched ${candidate.area.matchLabel}.`,
      `Workload ${candidate.workload}.`,
    ];
    if (candidate.codLimitPaise > 0) {
      parts.push(
        `COD pending ${this.formatPaiseForNote(candidate.codExposurePaise)} of ${this.formatPaiseForNote(candidate.codLimitPaise)}.`,
      );
    }
    if (diagnostics.skippedRejected > 0) {
      parts.push(`${diagnostics.skippedRejected} rejected partner(s) skipped.`);
    }
    if (candidate.area.warnings.length > 0) {
      parts.push(`Review route: ${candidate.area.warnings.join("; ")}.`);
    }

    return parts.join(" ");
  }

  private noAutoAssignmentNote(diagnostics: DeliveryPartnerAssignmentDiagnostics) {
    const parts = [
      "No eligible delivery partner found for automatic assignment.",
      `${diagnostics.partnersChecked} active delivery partner user(s) checked.`,
    ];
    if (diagnostics.skippedUnavailable > 0) {
      parts.push(`${diagnostics.skippedUnavailable} missing an active available delivery profile.`);
    }
    if (diagnostics.skippedCodLimit > 0) {
      parts.push(`${diagnostics.skippedCodLimit} over COD cash limit.`);
    }
    if (diagnostics.skippedRejected > 0) {
      parts.push(`${diagnostics.skippedRejected} previously rejected partner(s) skipped.`);
    }
    if (diagnostics.codAmountPaise > 0) {
      parts.push(`Order COD amount: ${this.formatPaiseForNote(diagnostics.codAmountPaise)}.`);
    }

    return parts.join(" ");
  }

  private formatPaiseForNote(paise: number) {
    return `INR ${(paise / 100).toFixed(2)}`;
  }

  private deliveryPartnerCandidateWhere(
    address: TrackableAddressSnapshot | null,
    rejectedPartnerIds: Set<string>,
  ): Prisma.UserWhereInput {
    const profileAnd: Prisma.DeliveryPartnerProfileWhereInput[] = [{ isAvailable: true }];

    if (address?.countryCode) {
      profileAnd.push({
        OR: [{ serviceCountryCode: null }, { serviceCountryCode: address.countryCode }],
      });
    }
    if (address?.stateCode) {
      profileAnd.push({
        OR: [{ serviceStateCode: null }, { serviceStateCode: address.stateCode }],
      });
    }

    const serviceAreaOr: Prisma.DeliveryPartnerProfileWhereInput[] = [];
    if (address?.localAreaCode) {
      serviceAreaOr.push({ serviceLocalAreaCodes: { has: address.localAreaCode } });
    }
    if (address?.pincode) {
      serviceAreaOr.push({ servicePincodes: { has: address.pincode } });
    }
    if (address?.cityCode) {
      serviceAreaOr.push({ serviceCityCode: address.cityCode });
    }
    if (address?.stateCode) {
      serviceAreaOr.push({ serviceStateCode: address.stateCode });
    }
    if (address?.countryCode) {
      serviceAreaOr.push({ serviceCountryCode: address.countryCode });
    }
    serviceAreaOr.push({
      serviceCityCode: null,
      servicePincodes: { isEmpty: true },
      serviceLocalAreaCodes: { isEmpty: true },
    });
    profileAnd.push({ OR: serviceAreaOr });

    return {
      ...(rejectedPartnerIds.size > 0 ? { id: { notIn: Array.from(rejectedPartnerIds) } } : {}),
      status: UserStatus.ACTIVE,
      userRoles: {
        some: {
          role: {
            code: RoleCode.DELIVERY_PARTNER,
          },
        },
      },
      deliveryProfile: {
        is: {
          AND: profileAnd,
        },
      },
    };
  }

  private async rejectedDeliveryPartnerIds(orderId: string) {
    const attempts = await this.prisma.client.deliveryAssignmentAttempt.findMany({
      where: {
        orderId,
        status: DeliveryAssignmentStatus.REJECTED,
      },
      select: {
        partnerUserId: true,
      },
      distinct: ["partnerUserId"],
    });

    return new Set(attempts.map((attempt) => attempt.partnerUserId));
  }

  private async deliveryPartnerAssignmentMetrics(
    partnerIds: string[],
  ): Promise<DeliveryPartnerAssignmentMetrics> {
    const workload = new Map<string, number>();
    const codExposurePaise = new Map<string, number>();
    const lastAssignmentAt = new Map<string, Date>();
    if (partnerIds.length === 0) {
      return { workload, codExposurePaise, lastAssignmentAt };
    }

    const [workloadRows, codCollectedByRows, codAssignedRows, lastAssignmentRows] =
      await Promise.all([
        this.prisma.client.orderShipment.groupBy({
          by: ["deliveryPartnerUserId"],
          where: {
            deliveryPartnerUserId: { in: partnerIds },
            assignmentStatus: {
              in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED],
            },
            status: {
              notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
            },
          },
          _count: {
            id: true,
          },
        }),
        this.prisma.client.deliveryDetail.groupBy({
          by: ["codCollectedById"],
          where: {
            codCollectedById: { in: partnerIds },
            codCollectionStatus: CodCollectionStatus.COLLECTED,
          },
          _sum: {
            codCollectedAmountPaise: true,
          },
        }),
        this.prisma.client.deliveryDetail.groupBy({
          by: ["deliveryPartnerUserId"],
          where: {
            deliveryPartnerUserId: { in: partnerIds },
            codCollectedById: null,
            codCollectionStatus: CodCollectionStatus.COLLECTED,
          },
          _sum: {
            codCollectedAmountPaise: true,
          },
        }),
        this.prisma.client.deliveryAssignmentAttempt.groupBy({
          by: ["partnerUserId"],
          where: {
            partnerUserId: { in: partnerIds },
            status: {
              in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED],
            },
          },
          _max: {
            createdAt: true,
          },
        }),
      ]);

    workloadRows.forEach((row) => {
      if (row.deliveryPartnerUserId) {
        workload.set(row.deliveryPartnerUserId, row._count.id);
      }
    });
    codCollectedByRows.forEach((row) => {
      if (row.codCollectedById) {
        codExposurePaise.set(
          row.codCollectedById,
          (codExposurePaise.get(row.codCollectedById) ?? 0) +
            (row._sum.codCollectedAmountPaise ?? 0),
        );
      }
    });
    codAssignedRows.forEach((row) => {
      if (row.deliveryPartnerUserId) {
        codExposurePaise.set(
          row.deliveryPartnerUserId,
          (codExposurePaise.get(row.deliveryPartnerUserId) ?? 0) +
            (row._sum.codCollectedAmountPaise ?? 0),
        );
      }
    });
    lastAssignmentRows.forEach((row) => {
      if (row._max.createdAt) {
        lastAssignmentAt.set(row.partnerUserId, row._max.createdAt);
      }
    });

    return { workload, codExposurePaise, lastAssignmentAt };
  }

  private deliveryPartnerServiceAreaScore(
    profile: DeliveryPartnerWithProfile["deliveryProfile"],
    address: TrackableAddressSnapshot | null,
  ): DeliveryPartnerServiceAreaScore {
    if (!profile?.isAvailable) {
      return {
        eligible: false,
        score: 0,
        matchLabel: "unavailable",
        matchedFields: [],
        warnings: ["Partner profile is inactive or unavailable"],
      };
    }

    let score = 5;
    const matchedFields: string[] = [];
    const warnings: string[] = [];

    this.scoreConfiguredCode(profile.serviceCountryCode, address?.countryCode, "country", 5, {
      matchedFields,
      warnings,
      addScore: (points) => {
        score += points;
      },
    });
    this.scoreConfiguredCode(profile.serviceStateCode, address?.stateCode, "state", 10, {
      matchedFields,
      warnings,
      addScore: (points) => {
        score += points;
      },
    });
    this.scoreConfiguredCode(profile.serviceCityCode, address?.cityCode, "city", 40, {
      matchedFields,
      warnings,
      addScore: (points) => {
        score += points;
      },
    });
    this.scoreConfiguredArray(profile.servicePincodes, address?.pincode, "pincode", 30, {
      matchedFields,
      warnings,
      addScore: (points) => {
        score += points;
      },
    });
    this.scoreConfiguredArray(
      profile.serviceLocalAreaCodes,
      address?.localAreaCode,
      "local area",
      35,
      {
        matchedFields,
        warnings,
        addScore: (points) => {
          score += points;
        },
      },
    );

    return {
      eligible: true,
      score,
      matchLabel: this.serviceAreaMatchLabel(matchedFields),
      matchedFields,
      warnings,
    };
  }

  private scoreConfiguredCode(
    configured: string | null | undefined,
    actual: string | null | undefined,
    label: string,
    score: number,
    result: {
      matchedFields: string[];
      warnings: string[];
      addScore: (points: number) => void;
    },
  ) {
    if (!configured) {
      return;
    }

    if (this.serviceCodeMatches(configured, actual)) {
      result.matchedFields.push(label);
      result.addScore(score);
      return;
    }

    result.warnings.push(
      actual ? `outside configured ${label}` : `missing ${label} on order address`,
    );
  }

  private scoreConfiguredArray(
    configured: string[],
    actual: string | null | undefined,
    label: string,
    score: number,
    result: {
      matchedFields: string[];
      warnings: string[];
      addScore: (points: number) => void;
    },
  ) {
    if (!configured.length) {
      return;
    }

    if (this.serviceArrayMatches(configured, actual)) {
      result.matchedFields.push(label);
      result.addScore(score);
      return;
    }

    result.warnings.push(
      actual ? `outside configured ${label}` : `missing ${label} on order address`,
    );
  }

  private serviceAreaMatchLabel(matchedFields: string[]) {
    if (matchedFields.includes("local area")) {
      return "local area";
    }
    if (matchedFields.includes("pincode")) {
      return "pincode";
    }
    if (matchedFields.includes("city")) {
      return "city";
    }
    if (matchedFields.includes("state")) {
      return "state fallback";
    }
    if (matchedFields.includes("country")) {
      return "country fallback";
    }

    return "broad fallback";
  }

  private serviceCodeMatches(configured?: string | null, actual?: string | null) {
    if (!configured) {
      return true;
    }

    return Boolean(actual && configured.trim().toUpperCase() === actual.trim().toUpperCase());
  }

  private serviceArrayMatches(configured: string[], actual?: string | null) {
    if (!configured.length) {
      return true;
    }

    if (!actual) {
      return false;
    }

    const normalizedActual = actual.trim().toUpperCase();
    return configured.some((value) => value.trim().toUpperCase() === normalizedActual);
  }

  private async defaultPartnerCodLimitPaise() {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key: deliveryCodCashLimitSettingKey },
      select: { value: true },
    });
    const value = this.numberFromJson(setting?.value);
    return Number.isFinite(value) && value >= 0 ? value : defaultCodCashLimitPaise;
  }

  private numberFromJson(value: Prisma.JsonValue | undefined) {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return Number(value);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      return typeof record.value === "number"
        ? record.value
        : typeof record.value === "string"
          ? Number(record.value)
          : Number.NaN;
    }

    return Number.NaN;
  }

  private activePartnerWorkload(userId: string) {
    return this.prisma.client.orderShipment.count({
      where: {
        deliveryPartnerUserId: userId,
        assignmentStatus: {
          in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED],
        },
        status: {
          notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
        },
      },
    });
  }

  private async pendingPartnerCodExposure(userId: string) {
    return this.sumPartnerCodCollections(userId, CodCollectionStatus.COLLECTED);
  }

  private async sumPartnerCodCollections(userId: string, status: CodCollectionStatus) {
    const result = await this.prisma.client.deliveryDetail.aggregate({
      where: {
        codCollectionStatus: status,
        OR: [{ codCollectedById: userId }, { deliveryPartnerUserId: userId }],
      },
      _sum: {
        codCollectedAmountPaise: true,
      },
    });

    return result._sum.codCollectedAmountPaise ?? 0;
  }

  private async toDeliveryPartnerSummary(user: DeliveryPartnerWithProfile) {
    const [activeWorkload, pendingCodCashPaise] = await Promise.all([
      this.activePartnerWorkload(user.id),
      this.pendingPartnerCodExposure(user.id),
    ]);

    return {
      ...this.deliveryPartnerIdentity(user),
      deliveryProfile: user.deliveryProfile,
      activeWorkload,
      pendingCodCashPaise,
    };
  }

  private async toDeliveryPartnerSelfProfile(user: DeliveryPartnerWithProfile) {
    const [activeWorkload, pendingCodCashPaise, defaultCodLimitPaise] = await Promise.all([
      this.activePartnerWorkload(user.id),
      this.pendingPartnerCodExposure(user.id),
      this.defaultPartnerCodLimitPaise(),
    ]);
    const profile = user.deliveryProfile;

    return {
      ...this.deliveryPartnerIdentity(user),
      deliveryProfile: {
        phone: profile?.phone ?? user.phone ?? null,
        vehicleNumber: profile?.vehicleNumber ?? null,
        isAvailable: profile?.isAvailable ?? true,
        priority: profile?.priority ?? 100,
        serviceCountryCode: profile?.serviceCountryCode ?? null,
        serviceStateCode: profile?.serviceStateCode ?? null,
        serviceCityCode: profile?.serviceCityCode ?? null,
        servicePincodes: profile?.servicePincodes ?? [],
        serviceLocalAreaCodes: profile?.serviceLocalAreaCodes ?? [],
        codCashLimitPaise: profile?.codCashLimitPaise ?? null,
        effectiveCodCashLimitPaise: profile?.codCashLimitPaise ?? defaultCodLimitPaise,
        notes: profile?.notes ?? null,
      },
      activeWorkload,
      pendingCodCashPaise,
    };
  }

  private async getDeliveryPartnerUserOrThrow(userId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: {
              code: RoleCode.DELIVERY_PARTNER,
            },
          },
        },
      },
      include: {
        deliveryProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Delivery partner profile not found.");
    }

    return user;
  }

  private deliveryPartnerIdentity(user: DeliveryPartnerWithProfile) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      status: user.status,
    };
  }

  private ownDeliveryPartnerProfileData(dto: UpdateOwnDeliveryPartnerProfileDto) {
    return {
      ...(dto.phone !== undefined ? { phone: this.optionalText(dto.phone) } : {}),
      ...(dto.vehicleNumber !== undefined
        ? { vehicleNumber: this.optionalText(dto.vehicleNumber) }
        : {}),
      ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.serviceCountryCode !== undefined
        ? { serviceCountryCode: this.optionalText(dto.serviceCountryCode) }
        : {}),
      ...(dto.serviceStateCode !== undefined
        ? { serviceStateCode: this.optionalText(dto.serviceStateCode) }
        : {}),
      ...(dto.serviceCityCode !== undefined
        ? { serviceCityCode: this.optionalText(dto.serviceCityCode) }
        : {}),
      ...(dto.servicePincodes !== undefined
        ? { servicePincodes: this.cleanStringArray(dto.servicePincodes) }
        : {}),
      ...(dto.serviceLocalAreaCodes !== undefined
        ? { serviceLocalAreaCodes: this.cleanStringArray(dto.serviceLocalAreaCodes) }
        : {}),
      ...(dto.notes !== undefined ? { notes: this.optionalText(dto.notes) } : {}),
    };
  }

  private deliveryPartnerProfileAuditValue(profile: {
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

  private optionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private cleanStringArray(value: string[]) {
    return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
  }

  private customerDeliveryTimeline(order: OrderWithRelations) {
    const delivery = order.deliveryDetail;
    const items: Array<{ code: string; label: string; at: Date | null; completed: boolean }> = [
      {
        code: "ORDER_PLACED",
        label: "Order placed",
        at: order.createdAt,
        completed: true,
      },
      {
        code: "ASSIGNED_TO_PARTNER",
        label: "Assigned to delivery partner",
        at: delivery?.assignedAt ?? null,
        completed: Boolean(
          delivery?.assignedAt || delivery?.assignmentStatus === DeliveryAssignmentStatus.ACCEPTED,
        ),
      },
      {
        code: "PICKED_UP",
        label: "Picked up",
        at: this.deliveryEventTime(order, DeliveryStatus.DISPATCHED),
        completed: this.deliveryStatusReached(order.deliveryStatus, DeliveryStatus.DISPATCHED),
      },
      {
        code: "OUT_FOR_DELIVERY",
        label: "Out for delivery",
        at: this.deliveryEventTime(order, DeliveryStatus.IN_TRANSIT),
        completed: this.deliveryStatusReached(order.deliveryStatus, DeliveryStatus.IN_TRANSIT),
      },
      {
        code: "COD_COLLECTED",
        label: "COD collected",
        at: delivery?.codCollectedAt ?? null,
        completed:
          delivery?.codCollectionStatus === CodCollectionStatus.COLLECTED ||
          delivery?.codCollectionStatus === CodCollectionStatus.VERIFIED,
      },
      {
        code: "DELIVERED",
        label: "Delivered",
        at: this.deliveryEventTime(order, DeliveryStatus.DELIVERED),
        completed: order.deliveryStatus === DeliveryStatus.DELIVERED,
      },
    ];

    return items.filter((item) => item.completed || item.code !== "COD_COLLECTED");
  }

  private deliveryEventTime(order: OrderWithRelations, status: DeliveryStatus) {
    return (
      order.deliveryDetail?.events.find((event) => event.newStatus === status)?.createdAt ??
      order.statusEvents.find(
        (event) => event.statusType === StatusEventType.DELIVERY && event.newStatus === status,
      )?.createdAt ??
      null
    );
  }

  private deliveryStatusReached(current: DeliveryStatus, target: DeliveryStatus) {
    return deliveryStatusRank[current] >= deliveryStatusRank[target];
  }

  private async listOrders(where: Prisma.OrderWhereInput, query: OrderQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);

    const items = await this.prisma.client.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    const total = await this.prisma.client.order.count({ where });

    return { items, total, page, limit: take };
  }

  private orderQueryWhere(query: OrderQueryDto): Prisma.OrderWhereInput {
    return {
      ...(query.orderStatus ? { orderStatus: query.orderStatus } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.deliveryStatus ? { deliveryStatus: query.deliveryStatus } : {}),
      ...(query.search
        ? {
            OR: [{ orderNumber: { contains: query.search, mode: "insensitive" } }],
          }
        : {}),
    };
  }

  private async getOrderByNumberOrThrow(orderNumber: string) {
    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return order;
  }

  private async getOrderByIdOrThrow(orderId: string) {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    return order;
  }

  private orderContactMatches(
    order: {
      customer: {
        user: {
          email: string | null;
          phone: string | null;
        };
      };
      shippingAddressSnapshot: Prisma.JsonValue | null;
    },
    rawContact: string,
  ) {
    const email = this.normalizedEmail(rawContact);
    const phone = this.normalizedPhone(rawContact);
    const shippingAddress = this.readShippingAddressSnapshot(order.shippingAddressSnapshot);
    const emails = [order.customer.user.email]
      .map((value) => this.normalizedEmail(value))
      .filter((value): value is string => Boolean(value));
    const phones = [order.customer.user.phone, shippingAddress?.phone]
      .map((value) => this.normalizedPhone(value))
      .filter((value): value is string => Boolean(value));

    return Boolean((email && emails.includes(email)) || (phone && phones.includes(phone)));
  }

  private normalizedEmail(value?: string | null) {
    const normalized = value?.trim().toLowerCase();
    return normalized && normalized.includes("@") ? normalized : null;
  }

  private normalizedPhone(value?: string | null) {
    const digits = value?.replace(/\D/g, "") ?? "";
    if (!digits) {
      return null;
    }

    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  private readShippingAddressSnapshot(
    value: Prisma.JsonValue | null,
  ): TrackableAddressSnapshot | null {
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
    };
  }

  private readSnapshotString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async resolveShippingAddressSnapshot(customerId: string, dto: PlaceOrderDto) {
    if (dto.addressId) {
      const address = await this.customersService.getAddressForCustomerOrThrow(
        customerId,
        dto.addressId,
      );
      return {
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
      };
    }

    if (dto.shippingAddress) {
      return this.createAddressSnapshot(dto.shippingAddress);
    }

    throw new BadRequestException("Delivery address is required.");
  }

  private async createAddressSnapshot(address: CheckoutShippingAddressDto) {
    const location = await this.locationsService.resolveAddressLocation(address);

    return {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? null,
      area: location.area,
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      country: location.country,
      countryCode: location.countryCode,
      stateCode: location.stateCode,
      cityCode: location.cityCode,
      localAreaCode: location.localAreaCode,
    };
  }

  private resolveCheckoutDeliveryPreference(dto: PlaceOrderDto) {
    if (dto.deliveryPreference) {
      return dto.deliveryPreference;
    }

    if (dto.deliveryMode === DeliveryMode.STORE_PICKUP) {
      return CheckoutDeliveryPreference.STORE_PICKUP;
    }

    return CheckoutDeliveryPreference.DELIVER_TO_ADDRESS;
  }

  private resolvePayment(paymentMethod: CheckoutPaymentMethod) {
    switch (paymentMethod) {
      case CheckoutPaymentMethod.RAZORPAY:
        return { provider: PaymentProvider.RAZORPAY, status: PaymentStatus.PENDING };
      case CheckoutPaymentMethod.COD:
        return { provider: PaymentProvider.COD, status: PaymentStatus.PENDING };
      case CheckoutPaymentMethod.BANK_TRANSFER:
        return { provider: PaymentProvider.BANK_TRANSFER, status: PaymentStatus.PENDING };
      case CheckoutPaymentMethod.MANUAL:
      default:
        return { provider: PaymentProvider.MANUAL, status: PaymentStatus.PENDING };
    }
  }

  private createShipmentNumber(orderNumber: string, sequence: number) {
    return `${orderNumber}-S${String(sequence).padStart(2, "0")}`;
  }

  private async updateSellerShipmentStatusGuarded(
    tx: Prisma.TransactionClient,
    input: {
      orderSellerSplitId: string;
      nextStatus: DeliveryStatus;
      updateData: Prisma.OrderShipmentUpdateManyMutationInput;
      createData: Prisma.OrderShipmentUncheckedCreateInput;
    },
  ) {
    const shipment = await tx.orderShipment.findUnique({
      where: { orderSellerSplitId: input.orderSellerSplitId },
      select: { id: true, status: true },
    });

    if (!shipment) {
      await tx.orderShipment.create({ data: input.createData });
      return;
    }

    this.assertDeliveryStatusTransition(shipment.status, input.nextStatus);
    const updated = await tx.orderShipment.updateMany({
      where: {
        id: shipment.id,
        status: shipment.status,
      },
      data: {
        ...input.updateData,
        status: input.nextStatus,
      },
    });

    if (updated.count !== 1) {
      throw new BadRequestException("Seller package changed. Refresh the order and try again.");
    }
  }

  private allocateMinorAmountByKey(amountPaise: number, subtotals: Map<string, number>) {
    const allocations = new Map<string, number>();
    const entries = Array.from(subtotals.entries());
    if (amountPaise <= 0 || entries.length === 0) {
      for (const [key] of entries) {
        allocations.set(key, 0);
      }
      return allocations;
    }

    const subtotalPaise = entries.reduce((total, [, value]) => total + value, 0);
    if (subtotalPaise <= 0) {
      const evenShare = Math.floor(amountPaise / entries.length);
      let remainder = amountPaise - evenShare * entries.length;
      for (const [key] of entries) {
        const extra = remainder > 0 ? 1 : 0;
        allocations.set(key, evenShare + extra);
        remainder -= extra;
      }
      return allocations;
    }

    const weighted = entries.map(([key, subtotal], index) => {
      const exactShare = (amountPaise * subtotal) / subtotalPaise;
      const floorShare = Math.floor(exactShare);
      return {
        key,
        floorShare,
        remainder: exactShare - floorShare,
        index,
      };
    });
    let remaining = amountPaise - weighted.reduce((total, item) => total + item.floorShare, 0);
    weighted
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .forEach((item) => {
        const extra = remaining > 0 ? 1 : 0;
        allocations.set(item.key, item.floorShare + extra);
        remaining -= extra;
      });

    return allocations;
  }

  private checkoutPaymentRawResponse(
    method: Record<string, unknown>,
    paymentReference?: string,
  ): Prisma.InputJsonObject | null {
    const reference = paymentReference?.trim();
    const paymentMethod = typeof method.method === "string" ? method.method : null;
    const needsSnapshot =
      paymentMethod === CheckoutPaymentMethod.BANK_TRANSFER ||
      paymentMethod === CheckoutPaymentMethod.MANUAL ||
      Boolean(reference);

    if (!needsSnapshot) {
      return null;
    }

    const snapshot: Prisma.InputJsonObject = {
      checkoutMethod: {
        method: paymentMethod,
        label: typeof method.label === "string" ? method.label : null,
        note: typeof method.note === "string" ? method.note : null,
        instructions: typeof method.instructions === "string" ? method.instructions : null,
      },
      customerReference: reference || null,
    };

    if (
      method.bankTransferDetails &&
      typeof method.bankTransferDetails === "object" &&
      !Array.isArray(method.bankTransferDetails)
    ) {
      const details = method.bankTransferDetails as Record<string, unknown>;
      return {
        ...snapshot,
        bankTransferDetails: {
          configured: typeof details.configured === "boolean" ? details.configured : false,
          accountHolderName:
            typeof details.accountHolderName === "string" ? details.accountHolderName : "",
          bankName: typeof details.bankName === "string" ? details.bankName : "",
          accountNumber: typeof details.accountNumber === "string" ? details.accountNumber : "",
          ifscCode: typeof details.ifscCode === "string" ? details.ifscCode : "",
          branch: typeof details.branch === "string" ? details.branch : "",
          upiId: typeof details.upiId === "string" ? details.upiId : "",
          instructions: typeof details.instructions === "string" ? details.instructions : "",
          referenceRequired:
            typeof details.referenceRequired === "boolean" ? details.referenceRequired : true,
        },
      };
    }

    return snapshot;
  }

  private async notifyOrderPlaced(order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>) {
    const customerEmail = order.customer.user.email;
    const sellerEmails = [
      ...new Set(
        order.sellerSplits
          .map((split) => split.seller.user.email)
          .filter((email): email is string => Boolean(email)),
      ),
    ];

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.ORDER_PLACED_CUSTOMER,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: customerEmail,
        userId: order.customer.userId,
        variables: {
          orderNumber: order.orderNumber,
          totalPaise: order.totalPaise,
        },
      }),
      ...sellerEmails.map((recipient) =>
        this.notifications.notifyEvent({
          eventCode: EMAIL_TRIGGER_EVENTS.ORDER_RECEIVED_SELLER,
          recipientType: EmailRecipientType.SELLER,
          recipient,
          variables: {
            orderNumber: order.orderNumber,
            totalPaise: order.totalPaise,
          },
        }),
      ),
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.ORDER_PLACED_ADMIN, {
        orderNumber: order.orderNumber,
        totalPaise: order.totalPaise,
      }),
    ]);
  }

  private async notifyCustomerOrderStatus(
    order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>,
    status: OrderStatus,
    note?: string,
  ) {
    const eventCode = this.orderStatusTemplate(status);
    if (!eventCode) {
      return;
    }

    await this.notifications.notifyEvent({
      eventCode,
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: order.customer.user.email,
      userId: order.customer.userId,
      variables: {
        orderNumber: order.orderNumber,
        orderStatus: status,
        note: note ?? "",
      },
    });
  }

  private async notifyCustomerDeliveryStatus(
    order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>,
    status: DeliveryStatus,
    note?: string,
  ) {
    const eventCode = this.deliveryStatusTemplate(status);

    if (!eventCode) {
      return;
    }

    await this.notifications.notifyEvent({
      eventCode,
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: order.customer.user.email,
      userId: order.customer.userId,
      variables: {
        orderNumber: order.orderNumber,
        deliveryStatus: status,
        note: note ?? "",
      },
    });
  }

  private async notifyCustomerPaymentStatus(
    order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>,
    status: PaymentStatus,
    note?: string,
  ) {
    const eventCode =
      status === PaymentStatus.PAID
        ? EMAIL_TRIGGER_EVENTS.PAYMENT_SUCCESS
        : status === PaymentStatus.FAILED
          ? EMAIL_TRIGGER_EVENTS.PAYMENT_FAILED
          : status === PaymentStatus.PENDING
            ? EMAIL_TRIGGER_EVENTS.PAYMENT_PENDING
            : undefined;

    if (!eventCode) {
      return;
    }

    await this.notifications.notifyEvent({
      eventCode,
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: order.customer.user.email,
      userId: order.customer.userId,
      variables: {
        orderNumber: order.orderNumber,
        paymentStatus: status,
        note: note ?? "",
      },
    });
  }

  private async notifyDeliveryPartnerAssigned(
    order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>,
    note?: string | null,
  ) {
    const partner = order.deliveryDetail?.deliveryPartner;
    if (!partner?.email) {
      return;
    }

    await this.notifications.notifyEvent({
      eventCode: EMAIL_TRIGGER_EVENTS.DELIVERY_ASSIGNED_PARTNER,
      recipientType: EmailRecipientType.DELIVERY_PARTNER,
      recipient: partner.email,
      userId: partner.id,
      variables: {
        orderNumber: order.orderNumber,
        partnerName: partner.fullName ?? partner.email,
        note: note ?? "",
      },
    });
  }

  private async notifyDeliveryAssignmentDecision(
    order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>,
    partner: RequestUser,
    accepted: boolean,
    note?: string,
  ) {
    await this.notifications.notifyAdminEvent(
      accepted
        ? EMAIL_TRIGGER_EVENTS.DELIVERY_ASSIGNMENT_ACCEPTED_ADMIN
        : EMAIL_TRIGGER_EVENTS.DELIVERY_ASSIGNMENT_REJECTED_ADMIN,
      {
        orderNumber: order.orderNumber,
        partnerName: partner.email ?? partner.id,
        note: note ?? "",
      },
    );
  }

  private async notifyAdminCodCollected(
    order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>,
  ) {
    const delivery = order.deliveryDetail;
    if (!delivery) {
      return;
    }

    await this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.DELIVERY_COD_COLLECTED_ADMIN, {
      orderNumber: order.orderNumber,
      collectedAmountPaise: delivery.codCollectedAmountPaise ?? 0,
      partnerName:
        delivery.codCollectedBy?.fullName ??
        delivery.deliveryPartner?.fullName ??
        delivery.codCollectedBy?.email ??
        delivery.deliveryPartner?.email ??
        "",
    });
  }

  private orderStatusTemplate(status: OrderStatus) {
    switch (status) {
      case OrderStatus.CONFIRMED:
        return EMAIL_TRIGGER_EVENTS.ORDER_CONFIRMED;
      case OrderStatus.PROCESSING:
        return EMAIL_TRIGGER_EVENTS.ORDER_PROCESSING;
      case OrderStatus.SHIPPED:
        return EMAIL_TRIGGER_EVENTS.ORDER_DISPATCHED;
      case OrderStatus.DELIVERED:
        return EMAIL_TRIGGER_EVENTS.ORDER_DELIVERED;
      case OrderStatus.CANCELLED:
        return EMAIL_TRIGGER_EVENTS.ORDER_CANCELLED;
      default:
        return undefined;
    }
  }

  private deliveryStatusTemplate(status: DeliveryStatus) {
    switch (status) {
      case DeliveryStatus.DELIVERED:
        return EMAIL_TRIGGER_EVENTS.ORDER_DELIVERED;
      case DeliveryStatus.DISPATCHED:
      case DeliveryStatus.IN_TRANSIT:
        return EMAIL_TRIGGER_EVENTS.ORDER_DISPATCHED;
      default:
        return undefined;
    }
  }

  private async createOrderNumber() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    while (true) {
      const orderNumber = `1HI${stamp}${Math.floor(100000 + Math.random() * 900000)}`;
      const existing = await this.prisma.client.order.findUnique({ where: { orderNumber } });

      if (!existing) {
        return orderNumber;
      }
    }
  }

  private async createDeliveryTrackingReference(tx: Prisma.TransactionClient) {
    const dateKey = this.deliveryTrackingDateKey();

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const counter = await tx.deliveryTrackingCounter.upsert({
        where: { dateKey },
        update: { nextNumber: { increment: 1 } },
        create: { dateKey, nextNumber: 2 },
        select: { nextNumber: true },
      });
      const sequenceNumber = counter.nextNumber - 1;
      const trackingReference = `${deliveryTrackingReferencePrefix}-${dateKey}-${String(
        sequenceNumber,
      ).padStart(deliveryTrackingReferenceWidth, "0")}`;

      const existing = await tx.deliveryDetail.findUnique({
        where: { trackingReference },
        select: { id: true },
      });
      if (!existing) {
        return trackingReference;
      }
    }

    throw new BadRequestException(
      "Could not generate a unique delivery tracking reference. Please try again.",
    );
  }

  private deliveryTrackingDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}${part("month")}${part("day")}`;
  }

  private normalizeTrackingReference(value?: string | null) {
    const trackingReference = value?.trim();
    return trackingReference ? trackingReference : null;
  }

  private shouldGenerateTrackingReference({
    previousDelivery,
    dto,
    options,
    canAssignDeliveryPartner,
    trackingReferenceProvided,
  }: {
    previousDelivery: OrderWithRelations["deliveryDetail"];
    dto: UpdateDeliveryDto;
    options: { sellerOnly: boolean; deliveryPartnerOnly?: boolean };
    canAssignDeliveryPartner: boolean;
    trackingReferenceProvided: boolean;
  }) {
    if (trackingReferenceProvided || previousDelivery?.trackingReference) {
      return false;
    }

    if (canAssignDeliveryPartner && Boolean(dto.deliveryPartnerUserId)) {
      return true;
    }

    if (options.deliveryPartnerOnly) {
      return true;
    }

    return this.hasText(dto.partnerName) || this.hasText(dto.partnerPhone);
  }

  private hasText(value?: string | null) {
    return Boolean(value?.trim());
  }

  private async assertDeliveryPartnerUser(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: {
              code: RoleCode.DELIVERY_PARTNER,
            },
          },
        },
      },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException(
        "Assigned delivery partner must be an active user with the delivery partner role.",
      );
    }
  }

  private codCollectionDeliveryData(
    order: OrderWithRelations,
    previousDelivery: OrderWithRelations["deliveryDetail"],
    actor: RequestUser,
    dto: UpdateDeliveryDto,
  ) {
    if (dto.codCollected !== true) {
      throw new BadRequestException(
        "COD collection can only be recorded as collected from this screen.",
      );
    }

    const codPayment = this.findCodPayment(order);
    if (!codPayment) {
      throw new BadRequestException("COD collection can only be recorded for COD orders.");
    }

    if (
      order.paymentStatus !== PaymentStatus.PENDING ||
      codPayment.status !== PaymentStatus.PENDING
    ) {
      throw new BadRequestException("COD collection cannot be changed after payment is settled.");
    }

    if (previousDelivery?.codCollectionStatus === CodCollectionStatus.VERIFIED) {
      throw new BadRequestException(
        "Verified COD collection cannot be changed by delivery updates.",
      );
    }

    const amountPaise = dto.codCollectedAmountPaise ?? codPayment.amountPaise;
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException("Collected COD amount must be greater than zero.");
    }

    return {
      codCollectionStatus: CodCollectionStatus.COLLECTED,
      codCollectedAmountPaise: amountPaise,
      codCollectedAt: new Date(),
      codCollectedById: actor.id,
      codCollectionNote:
        dto.codCollectionNote ?? dto.deliveryNote ?? "COD collected by delivery partner.",
      codVerifiedAt: null,
      codVerifiedById: null,
      codVerificationNote: null,
    };
  }

  private findCodPayment(order: Pick<OrderWithRelations, "payments">) {
    return (
      order.payments.find(
        (payment) => payment.provider === PaymentProvider.COD || payment.method === "COD",
      ) ?? null
    );
  }

  private toDeliveryPartnerOrder(order: OrderWithRelations) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      totalPaise: order.totalPaise,
      currency: order.currency,
      buyerTotalMinor: order.buyerTotalMinor,
      buyerCurrency: order.buyerCurrency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shippingAddressSnapshot: order.shippingAddressSnapshot,
      customer: {
        email: order.customer.user.email,
        phone: order.customer.user.phone,
        fullName: order.customer.user.fullName,
      },
      items: order.items.map((item) => ({
        id: item.id,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        seller: item.seller
          ? {
              id: item.seller.id,
              storeName: item.seller.storeName,
              slug: item.seller.slug,
            }
          : null,
      })),
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        sellerId: shipment.sellerId,
        seller: shipment.seller
          ? {
              id: shipment.seller.id,
              storeName: shipment.seller.storeName,
              slug: shipment.seller.slug,
            }
          : null,
        subtotalPaise: shipment.subtotalPaise,
        shippingPaise: shipment.shippingPaise,
        deliveryMode: shipment.deliveryMode,
        status: shipment.status,
        assignmentStatus: shipment.assignmentStatus,
        deliveryPartnerUserId: shipment.deliveryPartnerUserId,
        partnerName: shipment.partnerName,
        partnerPhone: shipment.partnerPhone,
        trackingReference: shipment.trackingReference,
        estimatedDeliveryDate: shipment.estimatedDeliveryDate,
        deliveryNote: shipment.deliveryNote,
        codCollectionStatus: shipment.codCollectionStatus,
        codCollectedAmountPaise: shipment.codCollectedAmountPaise,
        codCollectedAt: shipment.codCollectedAt,
        codVerifiedAt: shipment.codVerifiedAt,
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        method: payment.method,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        status: payment.status,
      })),
      deliveryDetail: order.deliveryDetail
        ? {
            id: order.deliveryDetail.id,
            deliveryMode: order.deliveryDetail.deliveryMode,
            partnerName: order.deliveryDetail.partnerName,
            partnerPhone: order.deliveryDetail.partnerPhone,
            deliveryPartnerUserId: order.deliveryDetail.deliveryPartnerUserId,
            deliveryPartner: order.deliveryDetail.deliveryPartner
              ? {
                  id: order.deliveryDetail.deliveryPartner.id,
                  email: order.deliveryDetail.deliveryPartner.email,
                  phone: order.deliveryDetail.deliveryPartner.phone,
                  fullName: order.deliveryDetail.deliveryPartner.fullName,
                  deliveryProfile: order.deliveryDetail.deliveryPartner.deliveryProfile,
                }
              : null,
            assignmentStatus: order.deliveryDetail.assignmentStatus,
            assignedAt: order.deliveryDetail.assignedAt,
            acceptedAt: order.deliveryDetail.acceptedAt,
            rejectedAt: order.deliveryDetail.rejectedAt,
            assignmentNote: order.deliveryDetail.assignmentNote,
            trackingReference: order.deliveryDetail.trackingReference,
            estimatedDeliveryDate: order.deliveryDetail.estimatedDeliveryDate,
            deliveryNote: order.deliveryDetail.deliveryNote,
            receiverName: order.deliveryDetail.receiverName,
            proofNote: order.deliveryDetail.proofNote,
            proofReference: order.deliveryDetail.proofReference,
            status: order.deliveryDetail.status,
            codCollectionStatus: order.deliveryDetail.codCollectionStatus,
            codCollectedAmountPaise: order.deliveryDetail.codCollectedAmountPaise,
            codCollectedAt: order.deliveryDetail.codCollectedAt,
            codCollectionNote: order.deliveryDetail.codCollectionNote,
            codVerifiedAt: order.deliveryDetail.codVerifiedAt,
            codVerificationNote: order.deliveryDetail.codVerificationNote,
            codCollectedBy: order.deliveryDetail.codCollectedBy
              ? {
                  id: order.deliveryDetail.codCollectedBy.id,
                  email: order.deliveryDetail.codCollectedBy.email,
                  phone: order.deliveryDetail.codCollectedBy.phone,
                  fullName: order.deliveryDetail.codCollectedBy.fullName,
                }
              : null,
            codVerifiedBy: order.deliveryDetail.codVerifiedBy
              ? {
                  id: order.deliveryDetail.codVerifiedBy.id,
                  email: order.deliveryDetail.codVerifiedBy.email,
                  phone: order.deliveryDetail.codVerifiedBy.phone,
                  fullName: order.deliveryDetail.codVerifiedBy.fullName,
                }
              : null,
            events: order.deliveryDetail.events,
            attempts: order.deliveryDetail.attempts.map((attempt) => ({
              id: attempt.id,
              reason: attempt.reason,
              note: attempt.note,
              attemptedAt: attempt.attemptedAt,
              nextAttemptDate: attempt.nextAttemptDate,
              createdAt: attempt.createdAt,
              createdBy: attempt.createdBy
                ? {
                    id: attempt.createdBy.id,
                    email: attempt.createdBy.email,
                    phone: attempt.createdBy.phone,
                    fullName: attempt.createdBy.fullName,
                  }
                : null,
            })),
          }
        : null,
      statusEvents: order.statusEvents.filter(
        (event) =>
          event.statusType === StatusEventType.ORDER ||
          event.statusType === StatusEventType.DELIVERY,
      ),
    };
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

  private deliveryAuditValue(delivery: {
    deliveryMode: DeliveryMode;
    partnerName?: string | null;
    partnerPhone?: string | null;
    deliveryPartnerUserId?: string | null;
    courierProviderCode?: string | null;
    routingFailed?: boolean | null;
    routingFailureReason?: DeliveryRoutingFailureReason | null;
    routingFailureNote?: string | null;
    routedAt?: Date | null;
    assignmentStatus?: DeliveryAssignmentStatus | null;
    assignedAt?: Date | null;
    acceptedAt?: Date | null;
    rejectedAt?: Date | null;
    assignmentNote?: string | null;
    shippingChargeSnapshot?: Prisma.JsonValue | null;
    codSurchargeSnapshot?: Prisma.JsonValue | null;
    awbNumber?: string | null;
    courierTrackingStatus?: string | null;
    labelUrl?: string | null;
    trackingReference?: string | null;
    estimatedDeliveryDate?: Date | null;
    deliveryNote?: string | null;
    receiverName?: string | null;
    proofNote?: string | null;
    proofReference?: string | null;
    status: DeliveryStatus;
    codCollectionStatus?: CodCollectionStatus | null;
    codCollectedAmountPaise?: number | null;
    codCollectedAt?: Date | null;
    codCollectedById?: string | null;
    codCollectionNote?: string | null;
    codVerifiedAt?: Date | null;
    codVerifiedById?: string | null;
    codVerificationNote?: string | null;
  }) {
    return {
      deliveryMode: delivery.deliveryMode,
      partnerName: delivery.partnerName ?? null,
      partnerPhone: delivery.partnerPhone ?? null,
      deliveryPartnerUserId: delivery.deliveryPartnerUserId ?? null,
      courierProviderCode: delivery.courierProviderCode ?? null,
      routingFailed: delivery.routingFailed ?? false,
      routingFailureReason: delivery.routingFailureReason ?? null,
      routingFailureNote: delivery.routingFailureNote ?? null,
      routedAt: delivery.routedAt?.toISOString() ?? null,
      assignmentStatus: delivery.assignmentStatus ?? DeliveryAssignmentStatus.UNASSIGNED,
      assignedAt: delivery.assignedAt?.toISOString() ?? null,
      acceptedAt: delivery.acceptedAt?.toISOString() ?? null,
      rejectedAt: delivery.rejectedAt?.toISOString() ?? null,
      assignmentNote: delivery.assignmentNote ?? null,
      shippingChargeSnapshot: delivery.shippingChargeSnapshot ?? null,
      codSurchargeSnapshot: delivery.codSurchargeSnapshot ?? null,
      awbNumber: delivery.awbNumber ?? null,
      courierTrackingStatus: delivery.courierTrackingStatus ?? null,
      labelUrl: delivery.labelUrl ?? null,
      trackingReference: delivery.trackingReference ?? null,
      estimatedDeliveryDate: delivery.estimatedDeliveryDate?.toISOString() ?? null,
      deliveryNote: delivery.deliveryNote ?? null,
      receiverName: delivery.receiverName ?? null,
      proofNote: delivery.proofNote ?? null,
      proofReference: delivery.proofReference ?? null,
      status: delivery.status,
      codCollectionStatus: delivery.codCollectionStatus ?? CodCollectionStatus.NOT_COLLECTED,
      codCollectedAmountPaise: delivery.codCollectedAmountPaise ?? null,
      codCollectedAt: delivery.codCollectedAt?.toISOString() ?? null,
      codCollectedById: delivery.codCollectedById ?? null,
      codCollectionNote: delivery.codCollectionNote ?? null,
      codVerifiedAt: delivery.codVerifiedAt?.toISOString() ?? null,
      codVerifiedById: delivery.codVerifiedById ?? null,
      codVerificationNote: delivery.codVerificationNote ?? null,
    };
  }
}
