import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  ApprovalStatus,
  CartStatus,
  CheckoutStatus,
  DeliveryAssignmentAttemptSource,
  DeliveryPartnerPayoutStatus,
  DeliveryPartnerWalletEntryDirection,
  DeliveryPartnerWalletEntryType,
  CodCollectionStatus,
  CourierShipmentStatus,
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryRoutingFailureReason,
  DeliveryStatus,
  EmailRecipientType,
  InventoryMovementType,
  OrderStatus,
  OrderShipmentPackageStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductListingMode,
  ProductStatus,
  PushNotificationType,
  RoleCode,
  SellerStatus,
  SellerType,
  SellerOrderStatus,
  SellerSettlementStatus,
  StatusEventType,
  UserStatus,
  VariantStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { CheckoutPricingService } from "../checkout/checkout-pricing.service";
import {
  DeliveryRoutingService,
  type DeliveryRoutingPackage,
  type DeliveryRoutingQuote,
} from "../checkout/delivery-routing.service";
import { CheckoutDeliveryPreference } from "../checkout/dto/delivery-routing.dto";
import { CouponsService, type CouponCheckoutItem } from "../coupons/coupons.service";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
} from "../common/pagination";
import { CustomersService } from "../customers/customers.service";
import { DealPricingService } from "../deals/deal-pricing.service";
import {
  DeliveryPartnerPayoutQueryDto,
  MarkPayoutPaidDto,
  PayoutActionDto,
} from "../finance/dto/finance.dto";
import { SellerLedgerService } from "../finance/seller-ledger.service";
import { LocationsService } from "../locations/locations.service";
import { RouteDistanceService, type RouteDistanceResult } from "../maps/route-distance.service";
import { MarketService } from "../market/market.service";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { ExpoPushService } from "../notifications/expo-push.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { readDeliveryPartnerPayoutSettings } from "../settings/delivery-partner-payout-settings";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import {
  CheckoutPaymentMethod,
  CheckoutShippingAddressDto,
  PlaceOrderDto,
} from "./dto/checkout.dto";
import { CodVerificationDecision, CodVerificationDto } from "./dto/cod-verification.dto";
import {
  CourierDeliveryPartnerAvailabilityDto,
  CreateDeliveryAttemptDto,
  DeliveryAssignmentDecision,
  DeliveryAssignmentDecisionDto,
  DeliveryOperationsQueryDto,
  DeliveryPartnerPayoutRequestDto,
  DeliveryPartnerQueryDto,
  DeliveryPartnerWalletQueryDto,
  UpdateDeliveryAssignmentDto,
  UpdateDeliveryPartnerProfileDto,
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
          packages: {
            include: {
              courierPackages: {
                include: {
                  courierConsignment: true,
                },
                orderBy: { updatedAt: "desc" as const },
              },
            },
            orderBy: { sequence: "asc" as const },
          },
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
          profile: true,
          addresses: {
            orderBy: { createdAt: "asc" as const },
          },
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
      packages: {
        include: {
          courierPackages: {
            include: {
              courierConsignment: true,
            },
            orderBy: { updatedAt: "desc" as const },
          },
        },
        orderBy: { sequence: "asc" as const },
      },
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

const deliveryPartnerPayoutInclude = {
  partner: {
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      deliveryProfile: {
        select: {
          vehicleNumber: true,
          isAvailable: true,
        },
      },
    },
  },
  requestedBy: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  approvedBy: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  paidBy: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  walletEntries: {
    select: {
      id: true,
      entryType: true,
      direction: true,
      amountPaise: true,
      createdAt: true,
    },
  },
};

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type DeliveryPartnerPayoutWithRelations = Prisma.DeliveryPartnerPayoutGetPayload<{
  include: typeof deliveryPartnerPayoutInclude;
}>;
type OrderShipmentPackageWithRelations =
  OrderWithRelations["shipments"][number]["packages"][number];
type DeliveryPartnerWithProfile = Prisma.UserGetPayload<{
  include: { deliveryProfile: true };
}>;

type DeliveryPartnerProfileReadback = {
  phone: string | null;
  vehicleNumber: string | null;
  isAvailable: boolean;
  priority: number;
  serviceCountryCode: string | null;
  serviceStateCode: string | null;
  serviceCityCode: string | null;
  servicePincodes: string[];
  serviceLocalAreaCodes: string[];
  baseLatitude: string | null;
  baseLongitude: string | null;
  serviceRadiusKm: number | null;
  codCashLimitPaise: number | null;
  effectiveCodCashLimitPaise: number;
  notes: string | null;
};

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
const deliveryRoutingRetryIntervalMs = 15 * 60 * 1000;
const deliveryRoutingRetryWindowMs = 2 * 60 * 60 * 1000;
const deliveryAssignmentAcceptanceWindowMinutes = 110;
const deliveryAssignmentAcceptanceWindowMs =
  deliveryAssignmentAcceptanceWindowMinutes * 60 * 1000;
const deliveryAssignmentExpiredNote =
  "Delivery partner assignment auto-released after 110 minutes without acceptance.";
const labelDownloadBlockedStatuses = new Set<CourierShipmentStatus>([
  CourierShipmentStatus.CANCELLED,
  CourierShipmentStatus.FAILED,
  CourierShipmentStatus.RTO_INITIATED,
  CourierShipmentStatus.RTO_IN_TRANSIT,
  CourierShipmentStatus.RTO_DELIVERED,
]);

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

const sellerStatusFlow: readonly SellerOrderStatus[] = [
  SellerOrderStatus.PENDING,
  SellerOrderStatus.ACCEPTED,
  SellerOrderStatus.PROCESSING,
  SellerOrderStatus.DISPATCHED,
  SellerOrderStatus.DELIVERED,
];

const deliveryStatusFlow: readonly DeliveryStatus[] = [
  DeliveryStatus.NOT_ASSIGNED,
  DeliveryStatus.PENDING,
  DeliveryStatus.PACKED,
  DeliveryStatus.DISPATCHED,
  DeliveryStatus.IN_TRANSIT,
  DeliveryStatus.DELIVERED,
];

const orderStatusFlow: readonly OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function workflowStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nextWorkflowStatus<T extends string>(flow: readonly T[], current: T) {
  const index = flow.indexOf(current);
  return index >= 0 && index < flow.length - 1 ? flow[index + 1] : null;
}

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
  latitude: number | null;
  longitude: number | null;
  locationSource: string | null;
  accuracyMeters: number | null;
  locationConfidenceScore: number | null;
};

type DeliveryPartnerWalletReadClient = Pick<
  Prisma.TransactionClient,
  "deliveryPartnerPayout" | "deliveryPartnerWalletEntry" | "setting"
>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CheckoutPricingService) private readonly checkoutPricing: CheckoutPricingService,
    @Inject(DeliveryRoutingService) private readonly deliveryRouting: DeliveryRoutingService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
    @Inject(DealPricingService) private readonly dealPricing: DealPricingService,
    @Inject(CouponsService) private readonly couponsService: CouponsService,
    @Inject(SellerLedgerService) private readonly sellerLedgerService: SellerLedgerService,
    @Inject(LocationsService) private readonly locationsService: LocationsService,
    @Inject(RouteDistanceService) private readonly routeDistance: RouteDistanceService,
    @Inject(MarketService) private readonly marketService: MarketService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ExpoPushService) private readonly expoPush: ExpoPushService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {}

  async placeOrder(actor: RequestUser, dto: PlaceOrderDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const idempotencyKey = this.normalizeOrderIdempotencyKey(dto.idempotencyKey);
    const existingIdempotentOrder = idempotencyKey
      ? await this.findCustomerOrderByIdempotencyKey(customer.id, idempotencyKey)
      : null;
    if (existingIdempotentOrder) {
      return existingIdempotentOrder;
    }

    const cart = await this.prisma.client.cart.findFirst({
      where: {
        customerId: customer.id,
        status: CartStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    if (!cart?.items.length) {
      const recoveredIdempotentOrder = idempotencyKey
        ? await this.findCustomerOrderByIdempotencyKey(customer.id, idempotencyKey)
        : null;
      if (recoveredIdempotentOrder) {
        return recoveredIdempotentOrder;
      }

      throw new BadRequestException("Cart is empty.");
    }

    const shippingAddressSnapshot = await this.resolveShippingAddressSnapshot(customer.id, dto);
    const buyerCountryCode = dto.buyerCountryCode ?? shippingAddressSnapshot?.countryCode ?? "IN";
    const market = await this.marketService.buildCheckoutSnapshot(buyerCountryCode);
    const orderNumber = await this.createOrderNumber();
    const payment = this.resolvePayment(dto.paymentMethod);
    const deliveryPreference = this.resolveCheckoutDeliveryPreference(dto);

    const orderPlacement = await this.prisma.client.$transaction(async (tx) => {
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
        if (idempotencyKey) {
          const recoveredOrder = await tx.order.findFirst({
            where: {
              customerId: customer.id,
              idempotencyKey,
            },
            include: orderInclude,
          });
          if (recoveredOrder) {
            return { orderId: recoveredOrder.id, recovered: true };
          }
        }

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
          include: {
            seller: {
              include: {
                user: true,
              },
            },
          },
        });

        if (product.listingMode === ProductListingMode.ENQUIRY_ONLY) {
          throw new BadRequestException(
            `${product.name} is enquiry-only and cannot be checked out.`,
          );
        }

        if (item.quantity > variant.stockQuantity) {
          throw new BadRequestException(`Insufficient stock for ${product.name}.`);
        }

        const price = await this.dealPricing.resolveVariantPrice(variant, product.id, tx);
        validatedItems.push({ item, variant, product, price });
      }

      const subtotalPaise = validatedItems.reduce(
        (total, { item, price }) => total + item.quantity * price.effectiveUnitPricePaise,
        0,
      );
      const sellerPackages = this.checkoutSellerPackages(validatedItems);
      const baseCharges = await this.checkoutPricing.calculateSellerPackageCharges(
        subtotalPaise,
        sellerPackages,
        tx,
        {
          ...(dto.deliveryPreference !== undefined || dto.deliveryMode === undefined
            ? { deliveryPreference }
            : {}),
          ...(dto.deliveryMode !== undefined ? { deliveryMode: dto.deliveryMode } : {}),
          address: shippingAddressSnapshot,
          paymentMethod: dto.paymentMethod,
        },
      );
      const coupon = await this.couponsService.reserveCouponForOrder(
        {
          ...(dto.couponCode !== undefined ? { couponCode: dto.couponCode } : {}),
          customerId: customer.id,
          items: this.orderCouponItems(validatedItems),
          subtotalPaise,
          shippingPaise: baseCharges.shippingPaise,
          shippingSnapshot: baseCharges.snapshot,
          currency: market.baseCurrency,
        },
        tx,
      );
      const charges = coupon
        ? await this.checkoutPricing.applyCouponAdjustments(baseCharges, tx, {
            merchandiseDiscountPaise: coupon.merchandiseDiscountPaise,
            shippingDiscountPaise: coupon.shippingDiscountPaise,
            snapshot: coupon.snapshot,
          })
        : {
            ...baseCharges,
            payableSubtotalPaise: baseCharges.subtotalPaise,
            payableShippingPaise: baseCharges.shippingPaise,
            couponDiscountPaise: 0,
          };
      const { shippingPaise, platformFeePaise, totalPaise } = charges;
      const deliveryRoutings = charges.deliveryRoutings ?? [];
      const deliveryRoutingBySeller = new Map(
        deliveryRoutings.map((routing) => [routing.sellerId, routing.quote]),
      );
      const summaryRouting = this.summaryDeliveryRouting(deliveryRoutings, charges.deliveryRouting);
      const resolvedDeliveryMode = this.summaryDeliveryMode(
        deliveryRoutings.map((routing) => routing.quote.deliveryMode),
        dto.deliveryMode,
      );
      const buyerSubtotalMinor = this.marketService.convertMinorUnits(subtotalPaise, market);
      const buyerShippingMinor = this.marketService.convertMinorUnits(shippingPaise, market);
      const buyerPlatformFeeMinor = this.marketService.convertMinorUnits(platformFeePaise, market);
      const buyerTotalMinor = this.marketService.convertMinorUnits(totalPaise, market);
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
          shippingAddressSnapshot: shippingAddressSnapshot ?? Prisma.JsonNull,
          paymentMethod: dto.paymentMethod,
          deliveryMode: resolvedDeliveryMode,
        },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          idempotencyKey,
          customerId: customer.id,
          orderStatus: OrderStatus.PLACED,
          paymentStatus: payment.status,
          deliveryStatus: DeliveryStatus.PENDING,
          subtotalPaise,
          shippingPaise,
          platformFeePaise,
          couponId: coupon?.couponId ?? null,
          couponCode: coupon?.code ?? null,
          couponTitle: coupon?.title ?? null,
          couponDiscountPaise: coupon?.discountPaise ?? 0,
          couponMerchandiseDiscountPaise: coupon?.merchandiseDiscountPaise ?? 0,
          couponShippingDiscountPaise: coupon?.shippingDiscountPaise ?? 0,
          couponPlatformFundedDiscountPaise: coupon?.platformFundedDiscountPaise ?? 0,
          couponSellerFundedDiscountPaise: coupon?.sellerFundedDiscountPaise ?? 0,
          couponSnapshot: coupon?.snapshot ?? Prisma.JsonNull,
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
          shippingAddressSnapshot: shippingAddressSnapshot ?? Prisma.JsonNull,
        },
      });

      const sellerTotals = new Map<string, number>();
      const sellerItemAllocations = new Map<
        string,
        Array<{
          orderItemId: string;
          productId: string;
          productVariantId: string;
          productName: string;
          sku?: string | null;
          variantName?: string | null;
          quantity: number;
          lineTotalPaise: number;
          weightGrams?: number | null;
          lengthCm?: number | null;
          breadthCm?: number | null;
          heightCm?: number | null;
        }>
      >();

      for (const { item, variant, product, price } of validatedItems) {
        const lineTotalPaise = item.quantity * price.effectiveUnitPricePaise;
        const lineDealDiscountPaise = item.quantity * price.dealDiscountPaise;
        const couponAllocation = this.couponsService.itemAllocation(coupon, item.id);
        sellerTotals.set(
          product.sellerId,
          (sellerTotals.get(product.sellerId) ?? 0) + lineTotalPaise,
        );

        const orderItem = await tx.orderItem.create({
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
            activeQuantity: item.quantity,
            retainedQuantity: item.quantity,
            unitPricePaise: price.effectiveUnitPricePaise,
            lineTotalPaise,
            currency: variant.currency,
            originalUnitPricePaise: price.dealSnapshot ? price.originalUnitPricePaise : null,
            dealDiscountBps: price.dealDiscountBps,
            dealDiscountPaise: lineDealDiscountPaise,
            dealId: price.dealSnapshot?.dealId ?? null,
            dealSnapshot: price.dealSnapshot
              ? {
                  ...price.dealSnapshot,
                  originalUnitPricePaise: price.originalUnitPricePaise,
                  effectiveUnitPricePaise: price.effectiveUnitPricePaise,
                  unitDiscountPaise: price.dealDiscountPaise,
                  lineDiscountPaise: lineDealDiscountPaise,
                }
              : Prisma.JsonNull,
            couponDiscountPaise: couponAllocation?.discountPaise ?? 0,
            couponPlatformFundedDiscountPaise:
              couponAllocation?.platformFundedDiscountPaise ?? 0,
            couponSellerFundedDiscountPaise:
              couponAllocation?.sellerFundedDiscountPaise ?? 0,
            couponSnapshot: couponAllocation
              ? {
                  ...coupon!.snapshot,
                  allocation: couponAllocation,
                }
              : Prisma.JsonNull,
            returnPolicySnapshot: this.orderItemReturnPolicySnapshot(product.attributes),
          },
        });
        const allocations = sellerItemAllocations.get(product.sellerId) ?? [];
        allocations.push({
          orderItemId: orderItem.id,
          productId: product.id,
          productVariantId: variant.id,
          productName: product.name,
          sku: variant.sku,
          variantName: variant.variantName,
          quantity: item.quantity,
          lineTotalPaise,
          weightGrams: variant.packageWeightGrams,
          lengthCm: variant.packageLengthCm,
          breadthCm: variant.packageBreadthCm,
          heightCm: variant.packageHeightCm,
        });
        sellerItemAllocations.set(product.sellerId, allocations);

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
      const routedAt = new Date();
      let shipmentSequence = 1;
      for (const [sellerId, sellerSubtotalPaise] of sellerTotals.entries()) {
        const shipmentRouting = deliveryRoutingBySeller.get(sellerId) ?? summaryRouting;
        const shipmentRoutingFailedAt = shipmentRouting?.routingFailed ? routedAt : null;
        const couponSellerAllocation = this.couponsService.sellerAllocation(coupon, sellerId);
        const sellerSplit = await tx.orderSellerSplit.create({
          data: {
            orderId: order.id,
            sellerId,
            sellerSubtotalPaise,
            commissionPaise: 0,
            couponDiscountPaise: couponSellerAllocation?.discountPaise ?? 0,
            couponPlatformFundedDiscountPaise:
              couponSellerAllocation?.platformFundedDiscountPaise ?? 0,
            couponSellerFundedDiscountPaise:
              couponSellerAllocation?.sellerFundedDiscountPaise ?? 0,
            couponSnapshot: couponSellerAllocation
              ? {
                  ...coupon!.snapshot,
                  sellerAllocation: couponSellerAllocation,
                }
              : Prisma.JsonNull,
            settlementStatus: SellerSettlementStatus.NOT_ELIGIBLE,
            sellerStatus: SellerOrderStatus.PENDING,
          },
        });

        const orderShipment = await tx.orderShipment.upsert({
          where: { orderSellerSplitId: sellerSplit.id },
          update: {},
          create: {
            shipmentNumber: this.createShipmentNumber(order.orderNumber, shipmentSequence),
            orderId: order.id,
            orderSellerSplitId: sellerSplit.id,
            sellerId,
            subtotalPaise: sellerSubtotalPaise,
            shippingPaise:
              shipmentRouting?.shippingChargePaise ?? sellerShippingShares.get(sellerId) ?? 0,
            codSurchargePaise: shipmentRouting?.codSurchargePaise ?? 0,
            deliveryMode: shipmentRouting?.deliveryMode ?? resolvedDeliveryMode,
            status: DeliveryStatus.PENDING,
            deliveryNote: dto.customerNote ?? null,
            courierProviderCode: shipmentRouting?.courierProviderCode ?? null,
            routingFailed: shipmentRouting?.routingFailed ?? false,
            routingFailureReason: shipmentRouting?.routingFailureReason ?? null,
            routingFailureNote: shipmentRouting?.routingFailureNote ?? null,
            routedAt: shipmentRouting ? routedAt : null,
            routingFirstFailedAt: shipmentRoutingFailedAt,
            routingLastAttemptAt: shipmentRouting ? routedAt : null,
            routingRetryCount: 0,
            routingPermanentFailureAt: null,
            routingSnapshot: shipmentRouting?.routingSnapshot ?? Prisma.JsonNull,
            shippingChargeSnapshot: shipmentRouting?.shippingSnapshot ?? Prisma.JsonNull,
            codSurchargeSnapshot: shipmentRouting?.codSurchargeSnapshot ?? Prisma.JsonNull,
            assignmentNote: this.shipmentRoutingAssignmentNote(shipmentRouting),
          },
        });
        const itemAllocations = sellerItemAllocations.get(sellerId) ?? [];
        await tx.orderShipmentPackage.create({
          data: {
            packageNumber: this.createPackageNumber(orderShipment.shipmentNumber, 1),
            orderShipmentId: orderShipment.id,
            orderId: order.id,
            sellerId,
            sequence: 1,
            deliveryMode: orderShipment.deliveryMode,
            status: this.initialPackageStatus(orderShipment.deliveryMode),
            shippingPaise: orderShipment.shippingPaise,
            codSurchargePaise: orderShipment.codSurchargePaise,
            declaredValuePaise: sellerSubtotalPaise,
            currency: market.baseCurrency,
            itemAllocations,
            packageSnapshot: {
              source: "CHECKOUT_DEFAULT_PACKAGE",
              packageRule: "ONE_DEFAULT_PACKAGE_PER_SELLER_SHIPMENT",
              orderNumber: order.orderNumber,
              shipmentNumber: orderShipment.shipmentNumber,
              itemCount: itemAllocations.length,
            },
            readyForBookingAt:
              orderShipment.deliveryMode === DeliveryMode.THIRD_PARTY_COURIER ? routedAt : null,
          },
        });
        shipmentSequence += 1;
      }

      const summaryRoutingFailedAt = summaryRouting?.routingFailed ? routedAt : null;

      await tx.deliveryDetail.create({
        data: {
          orderId: order.id,
          deliveryMode: resolvedDeliveryMode,
          status: DeliveryStatus.PENDING,
          deliveryNote: dto.customerNote ?? null,
          courierProviderCode: summaryRouting?.courierProviderCode ?? null,
          routingFailed: deliveryRoutings.some((routing) => routing.quote.routingFailed),
          routingFailureReason: summaryRouting?.routingFailureReason ?? null,
          routingFailureNote: summaryRouting?.routingFailureNote ?? null,
          routedAt: summaryRouting ? routedAt : null,
          shippingChargeSnapshot: charges.snapshot.shipping ?? Prisma.JsonNull,
          codSurchargeSnapshot: summaryRouting?.codSurchargeSnapshot ?? Prisma.JsonNull,
          assignmentNote: summaryRoutingFailedAt
            ? (summaryRouting?.routingFailureNote ?? null)
            : "Seller package routes are stored on individual shipments.",
        },
      });

      await this.couponsService.recordRedemption(
        tx,
        order.id,
        customer.id,
        market.baseCurrency,
        coupon,
      );

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
            couponCode: coupon?.code ?? null,
            couponDiscountPaise: coupon?.discountPaise ?? 0,
            couponMerchandiseDiscountPaise: coupon?.merchandiseDiscountPaise ?? 0,
            couponShippingDiscountPaise: coupon?.shippingDiscountPaise ?? 0,
            couponFundingSource: coupon?.fundingSource ?? null,
            totalPaise,
            buyerCurrency: market.currency,
            buyerPlatformFeeMinor,
            buyerTotalMinor,
            fxRate: market.rate,
            paymentMethod: dto.paymentMethod,
            deliveryPreference,
            deliveryMode: resolvedDeliveryMode,
            deliveryRouting: charges.snapshot.deliveryRouting ?? null,
          },
        },
      });

      return { orderId: order.id, recovered: false };
    });

    const order = await this.getOrderByIdOrThrow(orderPlacement.orderId);
    if (!orderPlacement.recovered) {
      await this.runOrderPlacedSideEffects(order);
    }
    return order;
  }

  async listCustomerOrders(actor: RequestUser, query: OrderQueryDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const result = await this.listOrders(
      { ...this.orderQueryWhere(query), customerId: customer.id },
      query,
    );
    return {
      ...result,
      items: result.items.map((order) => this.customerSafeOrder(order)),
    };
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

    return this.customerSafeOrder(order);
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
      couponCode: order.couponCode,
      couponTitle: order.couponTitle,
      couponDiscountPaise: order.couponDiscountPaise,
      couponMerchandiseDiscountPaise: order.couponMerchandiseDiscountPaise,
      couponShippingDiscountPaise: order.couponShippingDiscountPaise,
      couponPlatformFundedDiscountPaise: order.couponPlatformFundedDiscountPaise,
      couponSellerFundedDiscountPaise: order.couponSellerFundedDiscountPaise,
      totalPaise: order.totalPaise,
      currency: order.currency,
      buyerCountryCode: order.buyerCountryCode,
      buyerCurrency: order.buyerCurrency,
      buyerSubtotalMinor: order.buyerSubtotalMinor,
      buyerShippingMinor: order.buyerShippingMinor,
      buyerPlatformFeeMinor: order.buyerPlatformFeeMinor,
      buyerPayableSubtotalMinor: this.orderBuyerMinor(
        order,
        Math.max(0, order.subtotalPaise - (order.couponMerchandiseDiscountPaise ?? 0)),
      ),
      buyerCouponDiscountMinor: this.orderBuyerMinor(order, order.couponDiscountPaise ?? 0),
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
        originalUnitPricePaise: item.originalUnitPricePaise,
        dealDiscountBps: item.dealDiscountBps,
        dealDiscountPaise: item.dealDiscountPaise,
        dealId: item.dealId,
        dealSnapshot: item.dealSnapshot,
        couponDiscountPaise: item.couponDiscountPaise,
        couponPlatformFundedDiscountPaise: item.couponPlatformFundedDiscountPaise,
        couponSellerFundedDiscountPaise: item.couponSellerFundedDiscountPaise,
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
      shipments: order.shipments.map((shipment) =>
        this.customerSafeShipmentReadback(shipment, { publicLookup: true }),
      ),
      deliveryDetail: this.customerSafeDeliveryDetail(order.deliveryDetail, { publicLookup: true }),
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
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const existing = await this.prisma.client.order.findFirst({
      where: {
        orderNumber,
        customerId: customer.id,
      },
      include: orderInclude,
    });
    if (!existing) {
      throw new NotFoundException("Order not found.");
    }

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
          assignmentExpiresAt: null,
        },
      });

      if (existing.deliveryDetail) {
        await tx.deliveryDetail.update({
          where: { orderId: existing.id },
          data: { status: DeliveryStatus.CANCELLED, assignmentExpiresAt: null },
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

      await this.couponsService.recordOrderCancellationAdjustment(
        tx,
        existing,
        actor,
        dto.note ?? "Customer cancelled order.",
      );

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

  async getAdminOrderSummary() {
    const [totalOrders, pendingOrders, completedOrders, inDeliveryOrders, cancelledOrders] =
      await Promise.all([
        this.prisma.client.order.count(),
        this.prisma.client.order.count({
          where: {
            orderStatus: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED] },
          },
        }),
        this.prisma.client.order.count({
          where: {
            orderStatus: OrderStatus.DELIVERED,
          },
        }),
        this.prisma.client.order.count({
          where: {
            orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.DELIVERED] },
            deliveryStatus: {
              in: [DeliveryStatus.PACKED, DeliveryStatus.DISPATCHED, DeliveryStatus.IN_TRANSIT],
            },
          },
        }),
        this.prisma.client.order.count({
          where: {
            orderStatus: OrderStatus.CANCELLED,
          },
        }),
      ]);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      inDeliveryOrders,
      cancelledOrders,
      generatedAt: new Date().toISOString(),
    };
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

  listCourierDeliveryPartners(query: DeliveryPartnerQueryDto) {
    return this.listDeliveryPartners(query);
  }

  async getCourierDeliveryPartner(userId: string) {
    const user = await this.getDeliveryPartnerUserForOperationsOrThrow(userId);
    return this.toDeliveryPartnerSummary(user);
  }

  async updateCourierDeliveryPartnerProfile(
    actor: RequestUser,
    userId: string,
    dto: UpdateDeliveryPartnerProfileDto,
  ) {
    const user = await this.getDeliveryPartnerUserForOperationsOrThrow(userId);
    const profileData = this.deliveryPartnerProfileData(dto);

    await this.prisma.client.$transaction(async (tx) => {
      const profile = await tx.deliveryPartnerProfile.upsert({
        where: { userId },
        update: profileData,
        create: {
          userId,
          phone: dto.phone ?? user.phone,
          isAvailable: dto.isAvailable ?? true,
          ...profileData,
        },
      });

      if (dto.phone !== undefined && dto.phone !== user.phone) {
        await tx.user.update({
          where: { id: userId },
          data: { phone: dto.phone || null },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "courier.delivery_partner.profile_updated",
          entityType: "user",
          entityId: userId,
          ...(user.deliveryProfile
            ? { oldValue: this.deliveryPartnerProfileAuditValue(user.deliveryProfile) }
            : {}),
          newValue: this.deliveryPartnerProfileAuditValue(profile),
        },
      });
    });

    return this.getCourierDeliveryPartner(userId);
  }

  async updateCourierDeliveryPartnerAvailability(
    actor: RequestUser,
    userId: string,
    dto: CourierDeliveryPartnerAvailabilityDto,
  ) {
    const user = await this.getDeliveryPartnerUserForOperationsOrThrow(userId);

    await this.prisma.client.$transaction(async (tx) => {
      const profile = await tx.deliveryPartnerProfile.upsert({
        where: { userId },
        update: { isAvailable: dto.isAvailable },
        create: {
          userId,
          phone: user.phone,
          isAvailable: dto.isAvailable,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "courier.delivery_partner.availability_updated",
          entityType: "user",
          entityId: userId,
          oldValue: {
            isAvailable: user.deliveryProfile?.isAvailable ?? null,
          },
          newValue: {
            isAvailable: profile.isAvailable,
            note: dto.note?.trim() || null,
          },
        },
      });
    });

    return this.getCourierDeliveryPartner(userId);
  }

  async getDeliveryPartnerProfile(actor: RequestUser) {
    const user = await this.getDeliveryPartnerUserOrThrow(actor.id);
    return this.toDeliveryPartnerSelfProfile(user);
  }

  async getDeliveryPartnerWallet(actor: RequestUser, query: DeliveryPartnerWalletQueryDto) {
    await this.getDeliveryPartnerUserOrThrow(actor.id);
    return this.deliveryPartnerWalletForUser(actor.id, query);
  }

  async requestDeliveryPartnerWalletPayout(
    actor: RequestUser,
    dto: DeliveryPartnerPayoutRequestDto,
  ) {
    await this.getDeliveryPartnerUserOrThrow(actor.id);

    const payoutId = await this.prisma.client.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM users
        WHERE id = ${actor.id}::uuid
        FOR UPDATE
      `;
      const summary = await this.deliveryPartnerWalletSummary(actor.id, tx);
      if (!summary.payoutRequestsEnabled) {
        throw new BadRequestException("Delivery partner payout requests are disabled by admin.");
      }

      if (summary.activePayoutRequestCount > 0) {
        throw new ConflictException(
          "You already have a payout request pending approval or payment.",
        );
      }

      if (summary.availableBalancePaise < summary.minimumPayoutPaise) {
        throw new BadRequestException(
          `Available wallet balance is below the minimum payout threshold of INR ${(
            summary.minimumPayoutPaise / 100
          ).toLocaleString("en-IN")}.`,
        );
      }

      const payout = await tx.deliveryPartnerPayout.create({
        data: {
          payoutNumber: this.makeDeliveryPartnerPayoutNumber(),
          partnerUserId: actor.id,
          amountPaise: summary.availableBalancePaise,
          currency: summary.currency,
          status: DeliveryPartnerPayoutStatus.REQUESTED,
          note: dto.note?.trim() || null,
          requestedById: actor.id,
          settingsSnapshot: summary.payoutSettings as Prisma.InputJsonObject,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "delivery_partner_payout.requested",
          entityType: "delivery_partner_payout",
          entityId: payout.id,
          newValue: {
            payoutNumber: payout.payoutNumber,
            partnerUserId: actor.id,
            amountPaise: payout.amountPaise,
            currency: payout.currency,
            status: payout.status,
            settingsSnapshot: summary.payoutSettings,
          },
        },
      });

      return payout.id;
    });

    return this.getDeliveryPartnerPayout(payoutId);
  }

  async listDeliveryPartnerPayouts(query: DeliveryPartnerPayoutQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const search = query.search?.trim();
    const where: Prisma.DeliveryPartnerPayoutWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.partnerUserId ? { partnerUserId: query.partnerUserId } : {}),
      ...(search
        ? {
            OR: [
              { payoutNumber: { contains: search, mode: "insensitive" } },
              { partner: { email: { contains: search, mode: "insensitive" } } },
              { partner: { phone: { contains: search, mode: "insensitive" } } },
              { partner: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.deliveryPartnerPayout.findMany({
        where,
        include: deliveryPartnerPayoutInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.deliveryPartnerPayout.count({ where }),
    ]);

    return {
      items: items.map((payout) => this.deliveryPartnerPayoutReadback(payout)),
      total,
      page,
      limit: take,
    };
  }

  async getDeliveryPartnerPayout(payoutId: string) {
    const payout = await this.prisma.client.deliveryPartnerPayout.findUnique({
      where: { id: payoutId },
      include: deliveryPartnerPayoutInclude,
    });

    if (!payout) {
      throw new NotFoundException("Delivery partner payout not found.");
    }

    return this.deliveryPartnerPayoutReadback(payout);
  }

  async approveDeliveryPartnerPayout(payoutId: string, dto: PayoutActionDto, actor: RequestUser) {
    await this.prisma.client.$transaction(async (tx) => {
      const payout = await tx.deliveryPartnerPayout.findUnique({ where: { id: payoutId } });
      if (!payout) {
        throw new NotFoundException("Delivery partner payout not found.");
      }

      if (payout.status !== DeliveryPartnerPayoutStatus.REQUESTED) {
        throw new BadRequestException("Only requested delivery partner payouts can be approved.");
      }

      const update = await tx.deliveryPartnerPayout.updateMany({
        where: { id: payoutId, status: DeliveryPartnerPayoutStatus.REQUESTED },
        data: {
          status: DeliveryPartnerPayoutStatus.APPROVED,
          approvedById: actor.id,
          approvedAt: new Date(),
          note: dto.note ?? payout.note,
        },
      });

      if (update.count !== 1) {
        throw new ConflictException("Delivery partner payout changed. Refresh and try again.");
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "delivery_partner_payout.approved",
          entityType: "delivery_partner_payout",
          entityId: payoutId,
          oldValue: { status: payout.status, note: payout.note },
          newValue: { status: DeliveryPartnerPayoutStatus.APPROVED, note: dto.note ?? payout.note },
        },
      });
    });

    return this.getDeliveryPartnerPayout(payoutId);
  }

  async rejectDeliveryPartnerPayout(payoutId: string, dto: PayoutActionDto, actor: RequestUser) {
    const rejectableStatuses: DeliveryPartnerPayoutStatus[] = [
      DeliveryPartnerPayoutStatus.REQUESTED,
      DeliveryPartnerPayoutStatus.APPROVED,
    ];

    await this.prisma.client.$transaction(async (tx) => {
      const payout = await tx.deliveryPartnerPayout.findUnique({ where: { id: payoutId } });
      if (!payout) {
        throw new NotFoundException("Delivery partner payout not found.");
      }

      if (!rejectableStatuses.includes(payout.status)) {
        throw new BadRequestException(
          "Only requested or approved delivery partner payouts can be rejected.",
        );
      }

      const update = await tx.deliveryPartnerPayout.updateMany({
        where: { id: payoutId, status: { in: rejectableStatuses } },
        data: {
          status: DeliveryPartnerPayoutStatus.REJECTED,
          note: dto.note ?? payout.note,
        },
      });

      if (update.count !== 1) {
        throw new ConflictException("Delivery partner payout changed. Refresh and try again.");
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "delivery_partner_payout.rejected",
          entityType: "delivery_partner_payout",
          entityId: payoutId,
          oldValue: { status: payout.status, note: payout.note },
          newValue: { status: DeliveryPartnerPayoutStatus.REJECTED, note: dto.note ?? payout.note },
        },
      });
    });

    return this.getDeliveryPartnerPayout(payoutId);
  }

  async markDeliveryPartnerPayoutPaid(
    payoutId: string,
    dto: MarkPayoutPaidDto,
    actor: RequestUser,
  ) {
    await this.prisma.client.$transaction(async (tx) => {
      const payout = await tx.deliveryPartnerPayout.findUnique({ where: { id: payoutId } });
      if (!payout) {
        throw new NotFoundException("Delivery partner payout not found.");
      }

      if (payout.status !== DeliveryPartnerPayoutStatus.APPROVED) {
        throw new BadRequestException("Only approved delivery partner payouts can be marked paid.");
      }

      const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      const update = await tx.deliveryPartnerPayout.updateMany({
        where: { id: payoutId, status: DeliveryPartnerPayoutStatus.APPROVED },
        data: {
          status: DeliveryPartnerPayoutStatus.PAID,
          paidById: actor.id,
          paidAt,
          paymentMode: dto.paymentMode.trim(),
          transactionReference: dto.transactionReference.trim(),
          note: dto.note ?? payout.note,
        },
      });

      if (update.count !== 1) {
        throw new ConflictException("Delivery partner payout changed. Refresh and try again.");
      }

      await tx.deliveryPartnerWalletEntry.create({
        data: {
          partnerUserId: payout.partnerUserId,
          payoutId: payout.id,
          entryType: DeliveryPartnerWalletEntryType.MANUAL_PAYOUT,
          direction: DeliveryPartnerWalletEntryDirection.DEBIT,
          amountPaise: payout.amountPaise,
          currency: payout.currency,
          description: `Manual payout paid for ${payout.payoutNumber}`,
          metadata: {
            payoutNumber: payout.payoutNumber,
            paymentMode: dto.paymentMode.trim(),
            transactionReference: dto.transactionReference.trim(),
            paidAt: paidAt.toISOString(),
            note: dto.note ?? null,
          },
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "delivery_partner_payout.paid",
          entityType: "delivery_partner_payout",
          entityId: payoutId,
          oldValue: { status: payout.status },
          newValue: {
            status: DeliveryPartnerPayoutStatus.PAID,
            paymentMode: dto.paymentMode.trim(),
            transactionReference: dto.transactionReference.trim(),
            amountPaise: payout.amountPaise,
          },
        },
      });
    });

    return this.getDeliveryPartnerPayout(payoutId);
  }

  async updateOwnDeliveryPartnerProfile(
    actor: RequestUser,
    dto: UpdateOwnDeliveryPartnerProfileDto,
  ) {
    const user = await this.getDeliveryPartnerUserOrThrow(actor.id);
    const profileData = this.deliveryPartnerProfileData(dto);

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
      ...this.deliveryPartnerReadyOrderWhere(),
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
    this.assertOrderReadyForDeliveryPartnerAssignment(order);
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
    const assignmentExpiresAt = isUnassign ? null : this.deliveryAssignmentExpiresAt(now);

    if (!isUnassign) {
      this.assertOrderReadyForDeliveryPartnerAssignment(order);
    }

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
          assignmentExpiresAt,
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
          assignmentExpiresAt,
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
          assignmentExpiresAt,
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

  async updateAdminShipmentDelivery(
    actor: RequestUser,
    orderNumber: string,
    shipmentNumber: string,
    dto: UpdateDeliveryDto,
  ) {
    const order = await this.getOrderByNumberOrThrow(orderNumber);
    const shipment = order.shipments.find(
      (item) => item.shipmentNumber.toUpperCase() === shipmentNumber.toUpperCase(),
    );
    if (!shipment) {
      throw new NotFoundException("Shipment not found for this order.");
    }

    const nextMode = dto.deliveryMode ?? shipment.deliveryMode;
    const nextModeUsesLocalPartner = nextMode === DeliveryMode.LOCAL_DELIVERY_PARTNER;
    if (dto.deliveryPartnerUserId && !nextModeUsesLocalPartner) {
      throw new BadRequestException(
        "Local delivery partners can only be assigned when shipment mode is Local Delivery Partner.",
      );
    }
    if (dto.deliveryPartnerUserId) {
      await this.assertDeliveryPartnerUser(this.prisma.client, dto.deliveryPartnerUserId);
    }

    const updatedOrderId = await this.prisma.client.$transaction(async (tx) => {
      const assignmentNow = new Date();
      const shipmentAssignmentExpiresAt =
        nextModeUsesLocalPartner && dto.deliveryPartnerUserId
          ? this.deliveryAssignmentExpiresAt(assignmentNow)
          : null;
      const updatedShipment = await tx.orderShipment.update({
        where: { id: shipment.id },
        data: {
          deliveryMode: nextMode,
          ...(dto.courierProviderCode !== undefined
            ? { courierProviderCode: this.cleanProviderCode(dto.courierProviderCode) }
            : nextMode !== DeliveryMode.THIRD_PARTY_COURIER
              ? { courierProviderCode: null }
              : {}),
          ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName ?? null } : {}),
          ...(dto.partnerPhone !== undefined ? { partnerPhone: dto.partnerPhone ?? null } : {}),
          ...(dto.deliveryPartnerUserId !== undefined
            ? {
                deliveryPartnerUserId: nextModeUsesLocalPartner
                  ? (dto.deliveryPartnerUserId ?? null)
                  : null,
                assignmentStatus:
                  nextModeUsesLocalPartner && dto.deliveryPartnerUserId
                    ? DeliveryAssignmentStatus.ASSIGNED
                    : DeliveryAssignmentStatus.UNASSIGNED,
                assignedAt:
                  nextModeUsesLocalPartner && dto.deliveryPartnerUserId ? assignmentNow : null,
                acceptedAt: null,
                rejectedAt: null,
                assignmentExpiresAt: shipmentAssignmentExpiresAt,
              }
            : nextModeUsesLocalPartner
              ? {}
              : {
                  deliveryPartnerUserId: null,
                  assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
                  assignedAt: null,
                  acceptedAt: null,
                  rejectedAt: null,
                  assignmentExpiresAt: null,
                }),
          ...(dto.trackingReference !== undefined
            ? { trackingReference: this.normalizeTrackingReference(dto.trackingReference) }
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
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          routingFailed: false,
          routingFailureReason: null,
          routingFailureNote: null,
          routingPermanentFailureAt: null,
          routingLastAttemptAt: assignmentNow,
          assignmentNote:
            dto.deliveryNote ??
            (nextMode === DeliveryMode.MANUAL_TRANSPORT
              ? "Manual transport selected by admin. No courier booking will be attempted."
              : "Shipment delivery route manually overridden by admin."),
        },
      });

      const allShipments = await tx.orderShipment.findMany({
        where: { orderId: order.id },
        select: {
          deliveryMode: true,
          routingFailed: true,
          routingFailureReason: true,
          routingFailureNote: true,
        },
      });
      const nextSummaryMode = this.summaryDeliveryMode(
        allShipments.map((item) => item.deliveryMode),
        order.deliveryDetail?.deliveryMode,
      );
      await tx.deliveryDetail.updateMany({
        where: { orderId: order.id },
        data: {
          deliveryMode: nextSummaryMode,
          routingFailed: allShipments.some((item) => item.routingFailed),
          routingFailureReason:
            allShipments.find((item) => item.routingFailed)?.routingFailureReason ?? null,
          routingFailureNote:
            allShipments.find((item) => item.routingFailed)?.routingFailureNote ?? null,
          assignmentNote: "Seller shipment delivery modes are managed package-wise.",
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.shipment.delivery_overridden",
          entityType: "order_shipment",
          entityId: shipment.id,
          oldValue: this.deliveryAuditValue(shipment),
          newValue: this.deliveryAuditValue(updatedShipment),
        },
      });

      return order.id;
    });

    return this.getOrderByIdOrThrow(updatedOrderId);
  }

  async retryDueRoutingFailures(actor?: RequestUser) {
    const now = new Date();
    const dueSince = new Date(now.getTime() - deliveryRoutingRetryIntervalMs);
    const permanentSince = new Date(now.getTime() - deliveryRoutingRetryWindowMs);
    const shipments = await this.prisma.client.orderShipment.findMany({
      where: {
        routingFailed: true,
        routingPermanentFailureAt: null,
        routingFirstFailedAt: { not: null },
        routingLastAttemptAt: { lte: dueSince },
        status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
      },
      include: {
        seller: true,
        order: {
          include: {
            payments: { orderBy: { createdAt: "desc" } },
          },
        },
      },
      orderBy: [{ routingFirstFailedAt: "asc" }],
      take: 50,
    });

    let retried = 0;
    let resolved = 0;
    let permanent = 0;

    for (const shipment of shipments) {
      if (shipment.routingFirstFailedAt && shipment.routingFirstFailedAt <= permanentSince) {
        await this.prisma.client.orderShipment.update({
          where: { id: shipment.id },
          data: {
            routingPermanentFailureAt: now,
            routingLastAttemptAt: now,
            routingRetryCount: { increment: 1 },
            assignmentNote:
              shipment.assignmentNote ??
              "Routing failure is permanent after the two-hour retry window. Admin override is required.",
          },
        });
        permanent += 1;
        continue;
      }

      const quote = await this.deliveryRouting.resolveDelivery(
        {
          deliveryPreference: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
          address: this.readShippingAddressSnapshot(shipment.order.shippingAddressSnapshot),
          subtotalPaise: shipment.subtotalPaise,
          paymentMethod: shipment.order.payments[0]?.method ?? null,
          sellerId: shipment.sellerId,
          sellerType: shipment.seller.sellerType,
          package: this.routingPackageFromSnapshot(shipment.routingSnapshot),
        },
        this.prisma.client,
      );
      const failedAt = quote.routingFailed ? (shipment.routingFirstFailedAt ?? now) : null;

      await this.prisma.client.orderShipment.update({
        where: { id: shipment.id },
        data: {
          deliveryMode: quote.deliveryMode,
          shippingPaise: quote.shippingChargePaise,
          codSurchargePaise: quote.codSurchargePaise,
          courierProviderCode: quote.courierProviderCode,
          routingFailed: quote.routingFailed,
          routingFailureReason: quote.routingFailureReason,
          routingFailureNote: quote.routingFailureNote,
          routedAt: now,
          routingFirstFailedAt: failedAt,
          routingLastAttemptAt: now,
          routingRetryCount: { increment: 1 },
          routingPermanentFailureAt: null,
          routingSnapshot: quote.routingSnapshot,
          shippingChargeSnapshot: quote.shippingSnapshot,
          codSurchargeSnapshot: quote.codSurchargeSnapshot,
          assignmentNote: this.shipmentRoutingAssignmentNote(quote),
        },
      });

      retried += 1;
      if (!quote.routingFailed) {
        resolved += 1;
      }
    }

    if (actor && (retried || permanent)) {
      await this.prisma.client.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "delivery.routing_failures.retry_due",
          entityType: "order_shipment",
          newValue: { retried, resolved, permanent, scanned: shipments.length },
        },
      });
    }

    return { scanned: shipments.length, retried, resolved, permanent };
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

    const now = new Date();
    if (this.deliveryAssignmentExpired(order.deliveryDetail.assignmentExpiresAt, now)) {
      await this.releaseExpiredDeliveryAssignmentForPartner(order, actor.id, now);
      throw new BadRequestException(
        "This delivery assignment expired because it was not accepted within 110 minutes. Refresh your assigned orders.",
      );
    }

    const accepting = dto.decision === DeliveryAssignmentDecision.ACCEPT;
    if (accepting) {
      this.assertOrderReadyForDeliveryPartnerAssignment(order);
    }

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
              assignmentExpiresAt: null,
              assignmentNote: dto.note ?? order.deliveryDetail!.assignmentNote,
            }
          : {
              deliveryPartnerUserId: null,
              assignmentStatus: DeliveryAssignmentStatus.REJECTED,
              rejectedAt: respondedAt,
              acceptedAt: null,
              assignmentExpiresAt: null,
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
              assignmentExpiresAt: null,
              assignmentNote: dto.note ?? order.deliveryDetail!.assignmentNote,
            }
          : {
              deliveryPartnerUserId: null,
              assignmentStatus: DeliveryAssignmentStatus.REJECTED,
              rejectedAt: respondedAt,
              acceptedAt: null,
              assignmentExpiresAt: null,
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
    this.assertOrderReadyForDeliveryPartnerAssignment(order);

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

    if (dto.orderStatus) {
      this.assertOrderStatusTransition(existing.orderStatus, dto.orderStatus);
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
            assignmentExpiresAt: null,
          },
        });

        if (existing.deliveryDetail) {
          await tx.deliveryDetail.update({
            where: { orderId: existing.id },
            data: {
              status: DeliveryStatus.CANCELLED,
              assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
              assignmentExpiresAt: null,
            },
          });
        }

        await this.sellerLedgerService.recordRefundAdjustmentForOrder(
          tx,
          existing.id,
          actor,
          dto.note ?? "Order cancelled by admin.",
        );

        await this.couponsService.recordOrderCancellationAdjustment(
          tx,
          existing,
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
      const nextDeliveryStatus = rollupDeliveryStatus;
      const orderStatusChanged = nextOrderStatus !== order.orderStatus;
      const deliveryStatusChanged = nextDeliveryStatus !== order.deliveryStatus;
      const deliveryDetailStatusChanged =
        nextDeliveryStatus !== (order.deliveryDetail?.status ?? null);
      let deliveryDetailIdForWallet = order.deliveryDetail?.id ?? null;

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
        deliveryDetailIdForWallet = delivery.id;

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

      if (requestedDeliveryStatus === DeliveryStatus.DELIVERED && deliveryDetailIdForWallet) {
        await this.creditLocalDeliveryPartnerEarnings(tx, {
          orderId: order.id,
          deliveryDetailId: deliveryDetailIdForWallet,
          createdById: actor.id,
          note,
        });
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
    if (
      result.nextDeliveryStatus === DeliveryStatus.PACKED &&
      this.orderReadyForDeliveryPartnerAssignment(order)
    ) {
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
    const requestedTrackingReference =
      dto.trackingReference !== undefined
        ? this.normalizeTrackingReference(dto.trackingReference)
        : undefined;
    if (options.deliveryPartnerOnly && dto.trackingReference !== undefined) {
      const existingTrackingReference = previousDelivery?.trackingReference ?? null;
      if (requestedTrackingReference !== existingTrackingReference) {
        throw new BadRequestException(
          "Tracking reference is generated during assignment and cannot be edited by delivery partners.",
        );
      }
    }

    if (options.deliveryPartnerOnly) {
      this.assertOrderReadyForDeliveryPartnerAssignment(order);
    }
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
    if (canAssignDeliveryPartner && dto.deliveryPartnerUserId) {
      this.assertOrderReadyForDeliveryPartnerAssignment(order);
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
    const sellerSplitForDeliveryAggregate = seller
      ? order.sellerSplits.find((sellerSplit) => sellerSplit.sellerId === seller.id)
      : null;
    const derivedSellerStatusForDeliveryAggregate = seller
      ? this.sellerStatusFromDeliveryStatus(nextStatus)
      : null;
    const aggregateSplitsForDeliveryStatus =
      seller && sellerSplitForDeliveryAggregate && derivedSellerStatusForDeliveryAggregate
        ? this.replaceSellerSplitStatus(
            order.sellerSplits,
            sellerSplitForDeliveryAggregate.id,
            derivedSellerStatusForDeliveryAggregate,
          )
        : order.sellerSplits;
    const nextOrderDeliveryStatus = seller
      ? this.resolveDeliveryStatusFromSellerSplits(
          order.deliveryStatus,
          aggregateSplitsForDeliveryStatus,
        )
      : nextStatus;

    if (dto.status !== undefined) {
      this.assertDeliveryStatusTransition(
        options.sellerOnly && sellerShipment?.status
          ? sellerShipment.status
          : (previousDelivery?.status ?? order.deliveryStatus),
        nextStatus,
      );
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
      const assignmentExpiresAt = nextDeliveryPartnerUserId
        ? this.deliveryAssignmentExpiresAt(assignmentNow)
        : null;
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
                assignmentExpiresAt,
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
          status: nextOrderDeliveryStatus,
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
                assignmentExpiresAt,
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
          status: nextOrderDeliveryStatus,
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
            assignmentExpiresAt,
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

      const deliveryStatusChanged = nextOrderDeliveryStatus !== order.deliveryStatus;
      const deliveryDetailStatusChanged =
        nextOrderDeliveryStatus !== (previousDelivery?.status ?? null);
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

      if (delivery.status === DeliveryStatus.DELIVERED) {
        await this.creditLocalDeliveryPartnerEarnings(tx, {
          orderId: order.id,
          deliveryDetailId: delivery.id,
          createdById: actor.id,
          note: dto.deliveryNote ?? null,
        });
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
        nextStatus: delivery.status,
        orderStatusChanged,
        nextOrderStatus,
        codCollectionRecorded: Boolean(codCollectionData),
        deliveryPartnerAssigned: canAssignDeliveryPartner && Boolean(dto.deliveryPartnerUserId),
      };
    });

    let orderWithDelivery = await this.getOrderByIdOrThrow(result.orderId);
    if (
      result.nextStatus === DeliveryStatus.PACKED &&
      !result.deliveryPartnerAssigned &&
      this.orderReadyForDeliveryPartnerAssignment(orderWithDelivery)
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

  private filterOrderForSeller(order: OrderWithRelations, sellerId: string) {
    return {
      ...this.customerSafeOrder(order),
      items: order.items.filter((item) => item.sellerId === sellerId),
      sellerSplits: order.sellerSplits
        .filter((split) => split.sellerId === sellerId)
        .map((split) => ({
          ...split,
          shipment: split.shipment
            ? this.shipmentReadback(split.shipment, { sellerLabelAccess: true })
            : null,
        })),
      shipments: order.shipments
        .filter((shipment) => shipment.sellerId === sellerId)
        .map((shipment) => this.shipmentReadback(shipment, { sellerLabelAccess: true })),
    };
  }

  private customerSafeOrder(order: OrderWithRelations) {
    return {
      ...order,
      buyerPayableSubtotalMinor: this.orderBuyerMinor(
        order,
        Math.max(0, order.subtotalPaise - (order.couponMerchandiseDiscountPaise ?? 0)),
      ),
      buyerCouponDiscountMinor: this.orderBuyerMinor(order, order.couponDiscountPaise ?? 0),
      deliveryDetail: this.customerSafeDeliveryDetail(order.deliveryDetail, {
        publicLookup: false,
      }),
      sellerSplits: order.sellerSplits.map((split) => ({
        ...split,
        shipment: split.shipment
          ? this.customerSafeShipmentReadback(split.shipment, { publicLookup: false })
          : null,
      })),
      shipments: order.shipments.map((shipment) =>
        this.customerSafeShipmentReadback(shipment, { publicLookup: false }),
      ),
    };
  }

  private orderBuyerMinor(
    order: Pick<OrderWithRelations, "buyerCurrency" | "currency" | "fxRate">,
    baseMinor: number,
  ) {
    if (!order.buyerCurrency || order.buyerCurrency === order.currency) {
      return baseMinor;
    }

    const rate = order.fxRate?.toNumber();
    if (!rate || !Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    return Math.round((Math.max(0, baseMinor) / 100) * rate * 100);
  }

  private normalizeOrderIdempotencyKey(value: string | undefined) {
    const key = value?.trim();
    return key || null;
  }

  private findCustomerOrderByIdempotencyKey(customerId: string, idempotencyKey: string) {
    return this.prisma.client.order.findFirst({
      where: {
        customerId,
        idempotencyKey,
      },
      include: orderInclude,
    });
  }

  private customerSafeDeliveryDetail(
    delivery: OrderWithRelations["deliveryDetail"],
    options: { publicLookup: boolean },
  ) {
    if (!delivery) {
      return null;
    }

    return {
      deliveryMode: delivery.deliveryMode,
      partnerName: options.publicLookup
        ? null
        : (delivery.partnerName ?? delivery.deliveryPartner?.fullName ?? null),
      partnerPhone: options.publicLookup
        ? null
        : (delivery.partnerPhone ??
          delivery.deliveryPartner?.deliveryProfile?.phone ??
          delivery.deliveryPartner?.phone ??
          null),
      deliveryPartner:
        options.publicLookup || !delivery.deliveryPartner
          ? null
          : {
              id: delivery.deliveryPartner.id,
              fullName: delivery.deliveryPartner.fullName,
              phone:
                delivery.deliveryPartner.deliveryProfile?.phone ??
                delivery.deliveryPartner.phone ??
                null,
              vehicleNumber: delivery.deliveryPartner.deliveryProfile?.vehicleNumber ?? null,
            },
      assignmentStatus: delivery.assignmentStatus,
      assignedAt: delivery.assignedAt,
      acceptedAt: delivery.acceptedAt,
      assignmentExpiresAt: options.publicLookup ? null : delivery.assignmentExpiresAt,
      trackingReference: options.publicLookup ? null : delivery.trackingReference,
      estimatedDeliveryDate: delivery.estimatedDeliveryDate,
      deliveryNote: delivery.deliveryNote,
      status: delivery.status,
      events: delivery.events.map((event) => ({
        id: event.id,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        note: event.note,
        createdAt: event.createdAt,
      })),
    };
  }

  private customerSafeShipmentReadback(
    shipment:
      | OrderWithRelations["shipments"][number]
      | NonNullable<OrderWithRelations["sellerSplits"][number]["shipment"]>,
    options: { publicLookup: boolean },
  ) {
    const seller = "seller" in shipment ? shipment.seller : null;

    return {
      id: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      sellerId: shipment.sellerId,
      seller: seller
        ? {
            storeName: seller.storeName,
            slug: seller.slug,
          }
        : null,
      subtotalPaise: shipment.subtotalPaise,
      shippingPaise: shipment.shippingPaise,
      codSurchargePaise: shipment.codSurchargePaise,
      deliveryMode: shipment.deliveryMode,
      status: shipment.status,
      assignmentStatus: shipment.assignmentStatus,
      assignmentExpiresAt: options.publicLookup ? null : shipment.assignmentExpiresAt,
      partnerName: options.publicLookup
        ? null
        : (shipment.partnerName ?? shipment.deliveryPartner?.fullName ?? null),
      partnerPhone: options.publicLookup
        ? null
        : (shipment.partnerPhone ??
          shipment.deliveryPartner?.deliveryProfile?.phone ??
          shipment.deliveryPartner?.phone ??
          null),
      deliveryPartner:
        options.publicLookup || !shipment.deliveryPartner
          ? null
          : {
              id: shipment.deliveryPartner.id,
              fullName: shipment.deliveryPartner.fullName,
              phone:
                shipment.deliveryPartner.deliveryProfile?.phone ??
                shipment.deliveryPartner.phone ??
                null,
              vehicleNumber: shipment.deliveryPartner.deliveryProfile?.vehicleNumber ?? null,
            },
      trackingReference: options.publicLookup ? null : shipment.trackingReference,
      estimatedDeliveryDate: shipment.estimatedDeliveryDate,
      deliveryNote: shipment.deliveryNote,
      packages: shipment.packages.map((shipmentPackage) =>
        this.customerSafeShipmentPackageReadback(shipmentPackage),
      ),
    };
  }

  private customerSafeShipmentPackageReadback(shipmentPackage: OrderShipmentPackageWithRelations) {
    const courierPackage = shipmentPackage.courierPackages[0] ?? null;

    return {
      id: shipmentPackage.id,
      packageNumber: shipmentPackage.packageNumber,
      orderShipmentId: shipmentPackage.orderShipmentId,
      orderId: shipmentPackage.orderId,
      sellerId: shipmentPackage.sellerId,
      sequence: shipmentPackage.sequence,
      deliveryMode: shipmentPackage.deliveryMode,
      status: shipmentPackage.status,
      shippingPaise: shipmentPackage.shippingPaise,
      codSurchargePaise: shipmentPackage.codSurchargePaise,
      declaredValuePaise: shipmentPackage.declaredValuePaise,
      currency: shipmentPackage.currency,
      itemAllocations: shipmentPackage.itemAllocations,
      readyForBookingAt: shipmentPackage.readyForBookingAt,
      bookedAt: shipmentPackage.bookedAt,
      pickupScheduledAt: shipmentPackage.pickupScheduledAt,
      pickedUpAt: shipmentPackage.pickedUpAt,
      deliveredAt: shipmentPackage.deliveredAt,
      cancelledAt: shipmentPackage.cancelledAt,
      awbNumber: courierPackage?.awbNumber ?? null,
      courierName: courierPackage?.courierName ?? null,
      courierTrackingStatus: courierPackage?.trackingStatus ?? CourierShipmentStatus.NOT_BOOKED,
      courierTrackingStatusLabel: courierPackage?.trackingStatusLabel ?? null,
      trackingUrl: courierPackage?.trackingUrl ?? null,
      shipmentBookedAt:
        courierPackage?.bookedAt ?? courierPackage?.courierConsignment.bookedAt ?? null,
      canDownloadLabel: false,
      labelDownloadUrl: null,
    };
  }

  private shipmentReadback(
    shipment:
      | OrderWithRelations["shipments"][number]
      | NonNullable<OrderWithRelations["sellerSplits"][number]["shipment"]>,
    options: { sellerLabelAccess: boolean },
  ) {
    return {
      ...shipment,
      labelUrl: null,
      courierShipment: shipment.courierShipment
        ? {
            ...shipment.courierShipment,
            labelUrl: null,
          }
        : null,
      packages: shipment.packages.map((shipmentPackage) =>
        this.shipmentPackageReadback(shipmentPackage, options),
      ),
    };
  }

  private shipmentPackageReadback(
    shipmentPackage: OrderShipmentPackageWithRelations,
    options: { sellerLabelAccess: boolean },
  ) {
    const courierPackage = shipmentPackage.courierPackages[0] ?? null;
    const canDownloadLabel = Boolean(
      options.sellerLabelAccess &&
      shipmentPackage.deliveryMode === DeliveryMode.THIRD_PARTY_COURIER &&
      courierPackage?.labelUrl &&
      !labelDownloadBlockedStatuses.has(courierPackage.trackingStatus),
    );

    return {
      id: shipmentPackage.id,
      packageNumber: shipmentPackage.packageNumber,
      orderShipmentId: shipmentPackage.orderShipmentId,
      orderId: shipmentPackage.orderId,
      sellerId: shipmentPackage.sellerId,
      sequence: shipmentPackage.sequence,
      deliveryMode: shipmentPackage.deliveryMode,
      status: shipmentPackage.status,
      shippingPaise: shipmentPackage.shippingPaise,
      codSurchargePaise: shipmentPackage.codSurchargePaise,
      declaredValuePaise: shipmentPackage.declaredValuePaise,
      currency: shipmentPackage.currency,
      weightGrams: shipmentPackage.weightGrams,
      lengthCm: shipmentPackage.lengthCm,
      breadthCm: shipmentPackage.breadthCm,
      heightCm: shipmentPackage.heightCm,
      itemAllocations: shipmentPackage.itemAllocations,
      readyForBookingAt: shipmentPackage.readyForBookingAt,
      bookedAt: shipmentPackage.bookedAt,
      pickupScheduledAt: shipmentPackage.pickupScheduledAt,
      pickedUpAt: shipmentPackage.pickedUpAt,
      deliveredAt: shipmentPackage.deliveredAt,
      cancelledAt: shipmentPackage.cancelledAt,
      createdAt: shipmentPackage.createdAt,
      updatedAt: shipmentPackage.updatedAt,
      awbNumber: courierPackage?.awbNumber ?? null,
      courierName: courierPackage?.courierName ?? null,
      courierCode:
        courierPackage?.courierCode ?? courierPackage?.courierConsignment.providerCode ?? null,
      courierTrackingStatus: courierPackage?.trackingStatus ?? CourierShipmentStatus.NOT_BOOKED,
      courierTrackingStatusLabel: courierPackage?.trackingStatusLabel ?? null,
      trackingUrl: courierPackage?.trackingUrl ?? null,
      shippingZone:
        courierPackage?.shippingZone ?? courierPackage?.courierConsignment.shippingZone ?? null,
      providerRawStatus: courierPackage?.providerRawStatus ?? null,
      providerRawStatusCode: courierPackage?.providerRawStatusCode ?? null,
      shipmentBookedAt:
        courierPackage?.bookedAt ?? courierPackage?.courierConsignment.bookedAt ?? null,
      canDownloadLabel,
      labelDownloadUrl: canDownloadLabel
        ? `/api/seller/packages/${encodeURIComponent(shipmentPackage.id)}/label`
        : null,
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

    const expected = nextWorkflowStatus(sellerStatusFlow, current);
    if (next !== expected) {
      throw new BadRequestException(
        expected
          ? `Seller order status must move step by step. ${workflowStatusLabel(
              current,
            )} can only move to ${workflowStatusLabel(expected)}.`
          : "Seller order status cannot move beyond its final step.",
      );
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

    if (next === DeliveryStatus.CANCELLED) {
      return;
    }

    const expected = nextWorkflowStatus(deliveryStatusFlow, current);
    if (next !== expected) {
      throw new BadRequestException(
        expected
          ? `Delivery status must move step by step. ${workflowStatusLabel(
              current,
            )} can only move to ${workflowStatusLabel(expected)}.`
          : "Delivery status cannot move beyond its final step.",
      );
    }
  }

  private assertOrderStatusTransition(current: OrderStatus, next: OrderStatus) {
    if (current === next) {
      return;
    }

    if (current === OrderStatus.DELIVERED || current === OrderStatus.CANCELLED) {
      throw new BadRequestException("Delivered or cancelled orders cannot be changed.");
    }

    if (next === OrderStatus.CANCELLED) {
      return;
    }

    const expected = nextWorkflowStatus(orderStatusFlow, current);
    if (next !== expected) {
      throw new BadRequestException(
        expected
          ? `Order status must move step by step. ${workflowStatusLabel(
              current,
            )} can only move to ${workflowStatusLabel(expected)}.`
          : "Order status cannot move beyond its final step.",
      );
    }
  }

  private deliveryPartnerReadyOrderWhere(): Prisma.OrderWhereInput {
    return {
      sellerSplits: {
        some: {
          sellerStatus: {
            not: SellerOrderStatus.CANCELLED,
          },
          shipment: {
            is: {
              status: {
                in: [DeliveryStatus.PACKED, DeliveryStatus.DISPATCHED, DeliveryStatus.IN_TRANSIT],
              },
            },
          },
        },
        none: {
          sellerStatus: {
            not: SellerOrderStatus.CANCELLED,
          },
          OR: [
            {
              sellerStatus: {
                in: [SellerOrderStatus.PENDING, SellerOrderStatus.ACCEPTED],
              },
            },
            {
              shipment: {
                is: null,
              },
            },
            {
              shipment: {
                is: {
                  status: {
                    in: [DeliveryStatus.NOT_ASSIGNED, DeliveryStatus.PENDING],
                  },
                },
              },
            },
          ],
        },
      },
    };
  }

  private orderReadyForDeliveryPartnerAssignment(
    order: Pick<OrderWithRelations, "sellerSplits" | "shipments">,
  ) {
    const activeSplits = order.sellerSplits.filter(
      (split) => split.sellerStatus !== SellerOrderStatus.CANCELLED,
    );

    return (
      activeSplits.length > 0 &&
      activeSplits.every((split) => {
        const shipment = order.shipments.find((item) => item.orderSellerSplitId === split.id);

        return (
          sellerStatusRank[split.sellerStatus] >= sellerStatusRank[SellerOrderStatus.PROCESSING] &&
          Boolean(
            shipment &&
            deliveryStatusRank[shipment.status] >= deliveryStatusRank[DeliveryStatus.PACKED] &&
            shipment.status !== DeliveryStatus.CANCELLED,
          )
        );
      })
    );
  }

  private assertOrderReadyForDeliveryPartnerAssignment(
    order: Pick<OrderWithRelations, "sellerSplits" | "shipments">,
  ) {
    if (!this.orderReadyForDeliveryPartnerAssignment(order)) {
      throw new BadRequestException(
        "Delivery partner assignment is available only after every active seller has packed their items.",
      );
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
      activeSplits.every(
        (split) =>
          split.sellerStatus === SellerOrderStatus.DISPATCHED ||
          split.sellerStatus === SellerOrderStatus.DELIVERED,
      )
    ) {
      return this.advanceDeliveryStatus(currentStatus, DeliveryStatus.DISPATCHED);
    }

    if (
      activeSplits.every(
        (split) =>
          sellerStatusRank[split.sellerStatus] >= sellerStatusRank[SellerOrderStatus.PROCESSING],
      )
    ) {
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
    if (!this.orderReadyForDeliveryPartnerAssignment(order)) {
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
            assignmentExpiresAt: null,
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
            assignmentExpiresAt: null,
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
        status: { in: [DeliveryAssignmentStatus.REJECTED, DeliveryAssignmentStatus.CANCELLED] },
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
    const [activeWorkload, pendingCodCashPaise, defaultCodLimitPaise, wallet] = await Promise.all([
      this.activePartnerWorkload(user.id),
      this.pendingPartnerCodExposure(user.id),
      this.defaultPartnerCodLimitPaise(),
      this.deliveryPartnerWalletSummary(user.id),
    ]);
    const deliveryProfile = this.deliveryPartnerProfileReadback(user, defaultCodLimitPaise);

    return {
      ...this.deliveryPartnerIdentity(user),
      deliveryProfile,
      activeWorkload,
      pendingCodCashPaise,
      wallet,
      ...this.deliveryPartnerReadiness(user, deliveryProfile, pendingCodCashPaise),
    };
  }

  private async toDeliveryPartnerSelfProfile(user: DeliveryPartnerWithProfile) {
    const [activeWorkload, pendingCodCashPaise, defaultCodLimitPaise, wallet] = await Promise.all([
      this.activePartnerWorkload(user.id),
      this.pendingPartnerCodExposure(user.id),
      this.defaultPartnerCodLimitPaise(),
      this.deliveryPartnerWalletSummary(user.id),
    ]);
    const deliveryProfile = this.deliveryPartnerProfileReadback(user, defaultCodLimitPaise);

    return {
      ...this.deliveryPartnerIdentity(user),
      deliveryProfile,
      activeWorkload,
      pendingCodCashPaise,
      wallet,
      ...this.deliveryPartnerReadiness(user, deliveryProfile, pendingCodCashPaise),
    };
  }

  private async deliveryPartnerWalletForUser(
    partnerUserId: string,
    query: DeliveryPartnerWalletQueryDto,
  ) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20 });
    const where: Prisma.DeliveryPartnerWalletEntryWhereInput = { partnerUserId };

    const [summary, entries, total, payouts] = await Promise.all([
      this.deliveryPartnerWalletSummary(partnerUserId),
      this.prisma.client.deliveryPartnerWalletEntry.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              paymentStatus: true,
              deliveryStatus: true,
            },
          },
          orderShipment: {
            select: {
              shipmentNumber: true,
              deliveryMode: true,
              status: true,
              shippingPaise: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.deliveryPartnerWalletEntry.count({ where }),
      this.prisma.client.deliveryPartnerPayout.findMany({
        where: { partnerUserId },
        include: deliveryPartnerPayoutInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    ]);

    return {
      summary,
      items: entries.map((entry) => ({
        id: entry.id,
        entryType: entry.entryType,
        direction: entry.direction,
        amountPaise: entry.amountPaise,
        currency: entry.currency,
        description: entry.description,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
        order: entry.order
          ? {
              orderNumber: entry.order.orderNumber,
              paymentStatus: entry.order.paymentStatus,
              deliveryStatus: entry.order.deliveryStatus,
            }
          : null,
        shipment: entry.orderShipment
          ? {
              shipmentNumber: entry.orderShipment.shipmentNumber,
              deliveryMode: entry.orderShipment.deliveryMode,
              status: entry.orderShipment.status,
              shippingPaise: entry.orderShipment.shippingPaise,
            }
          : null,
      })),
      payouts: payouts.map((payout) => this.deliveryPartnerPayoutReadback(payout)),
      total,
      page,
      limit: take,
    };
  }

  private async deliveryPartnerWalletSummary(
    partnerUserId: string,
    client: DeliveryPartnerWalletReadClient = this.prisma.client,
  ) {
    const [credit, debit, earnings, pendingPayout, settings] = await Promise.all([
      client.deliveryPartnerWalletEntry.aggregate({
        where: {
          partnerUserId,
          direction: DeliveryPartnerWalletEntryDirection.CREDIT,
        },
        _sum: { amountPaise: true },
        _count: { _all: true },
      }),
      client.deliveryPartnerWalletEntry.aggregate({
        where: {
          partnerUserId,
          direction: DeliveryPartnerWalletEntryDirection.DEBIT,
        },
        _sum: { amountPaise: true },
        _count: { _all: true },
      }),
      client.deliveryPartnerWalletEntry.aggregate({
        where: {
          partnerUserId,
          entryType: DeliveryPartnerWalletEntryType.LOCAL_DELIVERY_EARNING,
          direction: DeliveryPartnerWalletEntryDirection.CREDIT,
        },
        _sum: { amountPaise: true },
        _count: { _all: true },
      }),
      client.deliveryPartnerPayout.aggregate({
        where: {
          partnerUserId,
          status: {
            in: [DeliveryPartnerPayoutStatus.REQUESTED, DeliveryPartnerPayoutStatus.APPROVED],
          },
        },
        _sum: { amountPaise: true },
        _count: { _all: true },
      }),
      readDeliveryPartnerPayoutSettings(client),
    ]);

    const totalCreditPaise = credit._sum.amountPaise ?? 0;
    const totalDebitPaise = debit._sum.amountPaise ?? 0;
    const ledgerBalancePaise = totalCreditPaise - totalDebitPaise;
    const pendingPayoutPaise = pendingPayout._sum.amountPaise ?? 0;
    const availableBalancePaise = Math.max(0, ledgerBalancePaise - pendingPayoutPaise);

    return {
      totalEarnedPaise: earnings._sum.amountPaise ?? 0,
      totalCreditedPaise: totalCreditPaise,
      totalDebitedPaise: totalDebitPaise,
      ledgerBalancePaise,
      pendingPayoutPaise,
      activePayoutRequestCount: pendingPayout._count._all,
      availableBalancePaise,
      localDeliveryCount: earnings._count._all,
      currency: "INR",
      minimumPayoutPaise: settings.minimumWalletPayoutPaise,
      payoutRequestsEnabled: settings.requestsEnabled,
      canRequestPayout:
        settings.requestsEnabled && availableBalancePaise >= settings.minimumWalletPayoutPaise,
      payoutSettings: settings,
    };
  }

  private deliveryPartnerPayoutReadback(payout: DeliveryPartnerPayoutWithRelations) {
    return {
      id: payout.id,
      payoutNumber: payout.payoutNumber,
      partnerUserId: payout.partnerUserId,
      amountPaise: payout.amountPaise,
      currency: payout.currency,
      status: payout.status,
      note: payout.note,
      settingsSnapshot: payout.settingsSnapshot,
      requestedAt: payout.requestedAt,
      approvedAt: payout.approvedAt,
      paidAt: payout.paidAt,
      paymentMode: payout.paymentMode,
      transactionReference: payout.transactionReference,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt,
      partner: payout.partner
        ? {
            id: payout.partner.id,
            email: payout.partner.email,
            phone: payout.partner.phone,
            fullName: payout.partner.fullName,
            deliveryProfile: payout.partner.deliveryProfile,
          }
        : null,
      requestedBy: payout.requestedBy,
      approvedBy: payout.approvedBy,
      paidBy: payout.paidBy,
      walletEntries: payout.walletEntries,
    };
  }

  private makeDeliveryPartnerPayoutNumber() {
    const datePart = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .replace(/-/g, "");
    return `DPP-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async creditLocalDeliveryPartnerEarnings(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      deliveryDetailId: string;
      createdById: string;
      note?: string | null;
    },
  ) {
    const settings = await readDeliveryPartnerPayoutSettings(tx);
    const shipments = await tx.orderShipment.findMany({
      where: {
        orderId: input.orderId,
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        status: DeliveryStatus.DELIVERED,
        deliveryPartnerUserId: { not: null },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            currency: true,
            shippingAddressSnapshot: true,
            payments: {
              select: {
                provider: true,
                method: true,
              },
            },
          },
        },
        seller: {
          select: {
            storeName: true,
            addresses: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: {
                line1: true,
                city: true,
                state: true,
                pincode: true,
                latitude: true,
                longitude: true,
                locationSource: true,
                accuracyMeters: true,
                locationConfidenceScore: true,
              },
            },
          },
        },
        deliveryPartner: {
          include: {
            deliveryProfile: true,
          },
        },
      },
    });

    for (const shipment of shipments) {
      if (!shipment.deliveryPartnerUserId) {
        continue;
      }

      const existingEntry = await tx.deliveryPartnerWalletEntry.findUnique({
        where: {
          orderShipmentId_entryType: {
            orderShipmentId: shipment.id,
            entryType: DeliveryPartnerWalletEntryType.LOCAL_DELIVERY_EARNING,
          },
        },
        select: { id: true },
      });
      if (existingEntry) {
        continue;
      }

      const shippingAddress = this.readShippingAddressSnapshot(
        shipment.order.shippingAddressSnapshot,
      );
      const distanceResult = await this.deliveryPartnerEarningDistance(
        tx,
        shipment.seller.addresses[0],
        shipment.deliveryPartner?.deliveryProfile,
        shippingAddress,
      );
      const distanceKm = distanceResult.distanceKm;
      const billableDistanceKm = Math.max(0, Math.ceil(distanceKm ?? 0));
      const isCod = shipment.order.payments.some(
        (payment) =>
          payment.provider === PaymentProvider.COD ||
          payment.method?.trim().toUpperCase() === "COD",
      );
      const perKmPayPaise = billableDistanceKm * settings.perKmPaise;
      const codBonusPaise = isCod ? settings.codBonusPaise : 0;
      const formulaPaise = Math.max(
        settings.minimumPerOrderPaise,
        settings.basePayPaise + perKmPayPaise + codBonusPaise,
      );
      const customerShippingPaise = Math.max(0, shipment.shippingPaise);
      const amountPaise = settings.freeDeliveryPlatformSubsidyEnabled
        ? formulaPaise
        : Math.min(formulaPaise, customerShippingPaise);
      const platformSubsidyPaise = Math.max(0, amountPaise - customerShippingPaise);

      if (amountPaise <= 0) {
        continue;
      }

      await tx.deliveryPartnerWalletEntry.create({
        data: {
          partnerUserId: shipment.deliveryPartnerUserId,
          orderId: shipment.orderId,
          orderShipmentId: shipment.id,
          deliveryDetailId: input.deliveryDetailId,
          entryType: DeliveryPartnerWalletEntryType.LOCAL_DELIVERY_EARNING,
          direction: DeliveryPartnerWalletEntryDirection.CREDIT,
          amountPaise,
          currency: shipment.order.currency,
          description: `Local delivery earning for ${shipment.order.orderNumber}`,
          metadata: {
            orderNumber: shipment.order.orderNumber,
            shipmentNumber: shipment.shipmentNumber,
            sellerStoreName: shipment.seller.storeName,
            deliveryMode: shipment.deliveryMode,
            source: "LOCAL_DELIVERY_PARTNER_DYNAMIC_PAYOUT",
            note: input.note ?? null,
            settingsSnapshot: settings,
            distanceSnapshot: distanceResult,
            locationQualitySnapshot: {
              pickup: this.locationQualitySnapshot(shipment.seller.addresses[0]),
              destination: shippingAddress
                ? {
                    locationSource: shippingAddress.locationSource,
                    accuracyMeters: shippingAddress.accuracyMeters,
                    locationConfidenceScore: shippingAddress.locationConfidenceScore,
                  }
                : null,
            },
            calculation: {
              minimumPerOrderPaise: settings.minimumPerOrderPaise,
              basePayPaise: settings.basePayPaise,
              perKmPaise: settings.perKmPaise,
              billableDistanceKm,
              distanceKm,
              usedDistanceFallback: distanceResult.accuracy !== "ROAD_ROUTE",
              distanceProvider: distanceResult.provider,
              distanceAccuracy: distanceResult.accuracy,
              distanceFailureReason: distanceResult.failureReason,
              perKmPayPaise,
              isCod,
              codBonusPaise,
              formulaPaise,
              customerShippingPaise,
              freeDeliveryPlatformSubsidyEnabled: settings.freeDeliveryPlatformSubsidyEnabled,
              platformSubsidyPaise,
            },
          },
          createdById: input.createdById,
        },
      });
    }
  }

  private async deliveryPartnerEarningDistance(
    tx: Prisma.TransactionClient,
    pickupAddress:
      | {
          line1?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          latitude?: Prisma.Decimal | number | string | null;
          longitude?: Prisma.Decimal | number | string | null;
          locationSource?: string | null;
          accuracyMeters?: Prisma.Decimal | number | string | null;
          locationConfidenceScore?: Prisma.Decimal | number | string | null;
        }
      | null
      | undefined,
    profile:
      | {
          baseLatitude?: Prisma.Decimal | number | string | null;
          baseLongitude?: Prisma.Decimal | number | string | null;
        }
      | null
      | undefined,
    address: TrackableAddressSnapshot | null,
  ): Promise<RouteDistanceResult> {
    const destination = address
      ? {
          latitude: address.latitude,
          longitude: address.longitude,
          label: [address.line1, address.city, address.pincode].filter(Boolean).join(", "),
        }
      : null;
    const pickupResult = await this.routeDistance.calculate({
      origin: pickupAddress
        ? {
            latitude: pickupAddress.latitude,
            longitude: pickupAddress.longitude,
            label: ["Seller pickup", pickupAddress.line1, pickupAddress.city, pickupAddress.pincode]
              .filter(Boolean)
              .join(", "),
          }
        : null,
      destination,
      client: tx,
    });

    if (pickupResult.distanceKm !== null) {
      return pickupResult;
    }

    const partnerBaseResult = await this.routeDistance.calculate({
      origin: {
        latitude: profile?.baseLatitude,
        longitude: profile?.baseLongitude,
        label: "Delivery partner base",
      },
      destination,
      client: tx,
    });

    return partnerBaseResult.distanceKm !== null ? partnerBaseResult : pickupResult;
  }

  private locationQualitySnapshot(
    address:
      | {
          locationSource?: string | null;
          accuracyMeters?: Prisma.Decimal | number | string | null;
          locationConfidenceScore?: Prisma.Decimal | number | string | null;
        }
      | null
      | undefined,
  ) {
    if (!address) {
      return null;
    }

    return {
      locationSource: address.locationSource ?? null,
      accuracyMeters: this.readSnapshotNumber(address.accuracyMeters),
      locationConfidenceScore: this.readSnapshotNumber(address.locationConfidenceScore),
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

  private async getDeliveryPartnerUserForOperationsOrThrow(userId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: {
        id: userId,
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

  private deliveryPartnerProfileReadback(
    user: DeliveryPartnerWithProfile,
    defaultCodLimitPaise: number,
  ): DeliveryPartnerProfileReadback {
    const profile = user.deliveryProfile;

    return {
      phone: profile?.phone ?? user.phone ?? null,
      vehicleNumber: profile?.vehicleNumber ?? null,
      isAvailable: profile?.isAvailable ?? true,
      priority: profile?.priority ?? 100,
      serviceCountryCode: profile?.serviceCountryCode ?? null,
      serviceStateCode: profile?.serviceStateCode ?? null,
      serviceCityCode: profile?.serviceCityCode ?? null,
      servicePincodes: profile?.servicePincodes ?? [],
      serviceLocalAreaCodes: profile?.serviceLocalAreaCodes ?? [],
      baseLatitude: profile?.baseLatitude?.toString() ?? null,
      baseLongitude: profile?.baseLongitude?.toString() ?? null,
      serviceRadiusKm: profile?.serviceRadiusKm ?? null,
      codCashLimitPaise: profile?.codCashLimitPaise ?? null,
      effectiveCodCashLimitPaise: profile?.codCashLimitPaise ?? defaultCodLimitPaise,
      notes: profile?.notes ?? null,
    };
  }

  private deliveryPartnerReadiness(
    user: DeliveryPartnerWithProfile,
    profile: DeliveryPartnerProfileReadback,
    pendingCodCashPaise: number,
  ) {
    const readinessReasons: string[] = [];
    const hasProfile = Boolean(user.deliveryProfile);
    const hasServiceCoverage = Boolean(
      profile.serviceCountryCode ||
      profile.serviceStateCode ||
      profile.serviceCityCode ||
      profile.servicePincodes.length > 0 ||
      profile.serviceLocalAreaCodes.length > 0 ||
      profile.serviceRadiusKm,
    );
    const codLimitExceeded =
      profile.effectiveCodCashLimitPaise >= 0 &&
      pendingCodCashPaise > profile.effectiveCodCashLimitPaise;

    if (!hasProfile) {
      readinessReasons.push("Missing profile");
    }
    if (user.status !== UserStatus.ACTIVE) {
      readinessReasons.push("User disabled");
    }
    if (!profile.isAvailable) {
      readinessReasons.push("Paused");
    }
    if (!hasServiceCoverage) {
      readinessReasons.push("No service coverage");
    }
    if (codLimitExceeded) {
      readinessReasons.push("COD limit exceeded");
    }

    return {
      hasProfile,
      hasServiceCoverage,
      codLimitExceeded,
      assignmentReady: readinessReasons.length === 0,
      readinessReasons,
    };
  }

  private deliveryPartnerProfileData(
    dto: UpdateOwnDeliveryPartnerProfileDto | UpdateDeliveryPartnerProfileDto,
  ) {
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
      ...(dto.baseLatitude !== undefined ? { baseLatitude: dto.baseLatitude } : {}),
      ...(dto.baseLongitude !== undefined ? { baseLongitude: dto.baseLongitude } : {}),
      ...(dto.serviceRadiusKm !== undefined ? { serviceRadiusKm: dto.serviceRadiusKm } : {}),
      ...("codCashLimitPaise" in dto && dto.codCashLimitPaise !== undefined
        ? { codCashLimitPaise: dto.codCashLimitPaise }
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
    baseLatitude?: Prisma.Decimal | number | string | null;
    baseLongitude?: Prisma.Decimal | number | string | null;
    serviceRadiusKm?: number | null;
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
      baseLatitude: profile.baseLatitude?.toString() ?? null,
      baseLongitude: profile.baseLongitude?.toString() ?? null,
      serviceRadiusKm: profile.serviceRadiusKm ?? null,
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
        code: "DELIVERED",
        label: "Delivered",
        at: this.deliveryEventTime(order, DeliveryStatus.DELIVERED),
        completed: order.deliveryStatus === DeliveryStatus.DELIVERED,
      },
    ];

    return items;
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
    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query);
      const cursorWhere = createdAtCursorWhere(cursor) as Prisma.OrderWhereInput | undefined;
      const items = await this.prisma.client.order.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: orderInclude,
        orderBy: createdAtCursorOrderBy(),
        take: take + 1,
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = paginationFromQuery(query);

    const items = await this.prisma.client.order.findMany({
      where,
      include: orderInclude,
      orderBy: createdAtCursorOrderBy(),
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
            OR: [
              { orderNumber: { contains: query.search, mode: "insensitive" } },
              {
                customer: {
                  is: {
                    user: {
                      is: {
                        OR: [
                          { email: { contains: query.search, mode: "insensitive" } },
                          { fullName: { contains: query.search, mode: "insensitive" } },
                          { phone: { contains: query.search, mode: "insensitive" } },
                        ],
                      },
                    },
                  },
                },
              },
            ],
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

  private async resolveShippingAddressSnapshot(customerId: string, dto: PlaceOrderDto) {
    const deliveryPreference = this.resolveCheckoutDeliveryPreference(dto);
    if (deliveryPreference === CheckoutDeliveryPreference.STORE_PICKUP) {
      return null;
    }

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
        latitude: address.latitude === null ? null : Number(address.latitude),
        longitude: address.longitude === null ? null : Number(address.longitude),
        locationSource: address.locationSource,
        accuracyMeters: address.accuracyMeters === null ? null : Number(address.accuracyMeters),
        locationConfidenceScore:
          address.locationConfidenceScore === null ? null : Number(address.locationConfidenceScore),
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
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      locationSource: address.locationSource ?? null,
      accuracyMeters: address.accuracyMeters ?? null,
      locationConfidenceScore: address.locationConfidenceScore ?? null,
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

  private createPackageNumber(shipmentNumber: string, sequence: number) {
    return `${shipmentNumber}-P${String(sequence).padStart(2, "0")}`;
  }

  private initialPackageStatus(deliveryMode: DeliveryMode) {
    return deliveryMode === DeliveryMode.THIRD_PARTY_COURIER
      ? OrderShipmentPackageStatus.READY_FOR_BOOKING
      : OrderShipmentPackageStatus.PACKING_PENDING;
  }

  private packageStatusFromDeliveryStatus(status: DeliveryStatus, deliveryMode: DeliveryMode) {
    switch (status) {
      case DeliveryStatus.PACKED:
        return deliveryMode === DeliveryMode.THIRD_PARTY_COURIER
          ? OrderShipmentPackageStatus.READY_FOR_BOOKING
          : OrderShipmentPackageStatus.PACKING_PENDING;
      case DeliveryStatus.DISPATCHED:
        return OrderShipmentPackageStatus.PICKED_UP;
      case DeliveryStatus.IN_TRANSIT:
        return OrderShipmentPackageStatus.IN_TRANSIT;
      case DeliveryStatus.DELIVERED:
        return OrderShipmentPackageStatus.DELIVERED;
      case DeliveryStatus.CANCELLED:
        return OrderShipmentPackageStatus.CANCELLED;
      default:
        return this.initialPackageStatus(deliveryMode);
    }
  }

  private orderItemReturnPolicySnapshot(attributes: Prisma.JsonValue | null) {
    const attributeRecord =
      attributes && typeof attributes === "object" && !Array.isArray(attributes)
        ? (attributes as Record<string, unknown>)
        : {};

    return {
      returnEligibility:
        this.stringAttribute(attributeRecord.returnEligibility) ??
        this.stringAttribute(attributeRecord.returnPolicy) ??
        "Returnable",
      warranty: this.stringAttribute(attributeRecord.warranty) ?? null,
      capturedAt: new Date().toISOString(),
    };
  }

  private stringAttribute(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private orderCouponItems(
    items: Array<{
      item: { id: string; quantity: number };
      price: { effectiveUnitPricePaise: number };
      product: {
        id: string;
        sellerId: string;
        categoryId: string;
        name: string;
      };
    }>,
  ): CouponCheckoutItem[] {
    return items.map(({ item, price, product }) => ({
      key: item.id,
      sellerId: product.sellerId,
      productId: product.id,
      categoryId: product.categoryId,
      quantity: item.quantity,
      lineTotalPaise: item.quantity * price.effectiveUnitPricePaise,
      productName: product.name,
    }));
  }

  private checkoutSellerPackages(
    items: Array<{
      item: { quantity: number };
      variant: {
        packageWeightGrams?: number | null;
        packageLengthCm?: number | null;
        packageBreadthCm?: number | null;
        packageHeightCm?: number | null;
        attributes?: Prisma.JsonValue | null;
        pricePaise: number;
      };
      price: {
        effectiveUnitPricePaise: number;
      };
      product: {
        sellerId: string;
        seller: {
          sellerType: SellerType;
        };
      };
    }>,
  ) {
    const packages = new Map<
      string,
      {
        sellerId: string;
        sellerType: SellerType;
        subtotalPaise: number;
        package: {
          weightGrams: number;
          lengthCm: number;
          breadthCm: number;
          heightCm: number;
          itemCount: number;
        };
      }
    >();

    for (const { item, variant, product, price } of items) {
      const current = packages.get(product.sellerId) ?? {
        sellerId: product.sellerId,
        sellerType: product.seller.sellerType,
        subtotalPaise: 0,
        package: {
          weightGrams: 0,
          lengthCm: 20,
          breadthCm: 15,
          heightCm: 8,
          itemCount: 0,
        },
      };
      const itemWeightGrams = this.positiveInt(
        variant.packageWeightGrams ?? this.jsonNumber(variant.attributes, "packageWeightGrams"),
        500,
      );
      current.subtotalPaise += item.quantity * price.effectiveUnitPricePaise;
      current.package.weightGrams += itemWeightGrams * item.quantity;
      current.package.lengthCm = Math.max(
        current.package.lengthCm,
        this.positiveInt(
          variant.packageLengthCm ?? this.jsonNumber(variant.attributes, "packageLengthCm"),
          20,
        ),
      );
      current.package.breadthCm = Math.max(
        current.package.breadthCm,
        this.positiveInt(
          variant.packageBreadthCm ?? this.jsonNumber(variant.attributes, "packageBreadthCm"),
          15,
        ),
      );
      current.package.heightCm = Math.max(
        current.package.heightCm,
        this.positiveInt(
          variant.packageHeightCm ?? this.jsonNumber(variant.attributes, "packageHeightCm"),
          8,
        ),
      );
      current.package.itemCount += item.quantity;
      packages.set(product.sellerId, current);
    }

    return Array.from(packages.values()).map((sellerPackage) => ({
      ...sellerPackage,
      package: {
        ...sellerPackage.package,
        weightGrams: Math.max(sellerPackage.package.weightGrams, 500),
      },
    }));
  }

  private summaryDeliveryRouting(
    routings: Array<{ quote: DeliveryRoutingQuote }>,
    fallback: DeliveryRoutingQuote | null,
  ) {
    return (
      routings.find((routing) => routing.quote.routingFailed)?.quote ??
      routings[0]?.quote ??
      fallback
    );
  }

  private summaryDeliveryMode(modes: DeliveryMode[], fallback?: DeliveryMode) {
    if (!modes.length) {
      return fallback ?? DeliveryMode.LOCAL_DELIVERY_PARTNER;
    }
    const firstMode = modes[0] ?? fallback ?? DeliveryMode.LOCAL_DELIVERY_PARTNER;
    if (modes.every((mode) => mode === firstMode)) {
      return firstMode;
    }
    if (modes.includes(DeliveryMode.MANUAL_TRANSPORT)) {
      return DeliveryMode.MANUAL_TRANSPORT;
    }
    return DeliveryMode.THIRD_PARTY_COURIER;
  }

  private shipmentRoutingAssignmentNote(routing: DeliveryRoutingQuote | null) {
    if (!routing) {
      return null;
    }
    if (routing.routingFailureNote) {
      return routing.routingFailureNote;
    }
    if (routing.deliveryMode === DeliveryMode.MANUAL_TRANSPORT) {
      return "Manual transport coordination required. No courier booking will be attempted.";
    }
    if (routing.recommendedPartnerUserId) {
      return "Local delivery route selected. Partner will be assigned after this seller package is packed.";
    }
    if (routing.deliveryMode === DeliveryMode.THIRD_PARTY_COURIER) {
      return "Courier route selected. Shiprocket pickup location must match the seller profile before live booking.";
    }

    return null;
  }

  private positiveInt(value: number | null | undefined, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? Math.round(value)
      : fallback;
  }

  private jsonNumber(value: Prisma.JsonValue | null | undefined, key: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
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
      select: { id: true, status: true, deliveryMode: true },
    });

    if (!shipment) {
      const created = await tx.orderShipment.create({ data: input.createData });
      const packageStatus = this.packageStatusFromDeliveryStatus(
        created.status,
        created.deliveryMode,
      );
      await tx.orderShipmentPackage.create({
        data: {
          packageNumber: this.createPackageNumber(created.shipmentNumber, 1),
          orderShipmentId: created.id,
          orderId: created.orderId,
          sellerId: created.sellerId,
          sequence: 1,
          deliveryMode: created.deliveryMode,
          status: packageStatus,
          shippingPaise: created.shippingPaise,
          codSurchargePaise: created.codSurchargePaise,
          declaredValuePaise: created.subtotalPaise,
          packageSnapshot: {
            source: "SELLER_STATUS_COMPATIBILITY_DEFAULT_PACKAGE",
            shipmentNumber: created.shipmentNumber,
          },
        },
      });
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
    await tx.orderShipmentPackage.updateMany({
      where: {
        orderShipmentId: shipment.id,
        status: {
          notIn: [
            OrderShipmentPackageStatus.DELIVERED,
            OrderShipmentPackageStatus.CANCELLED,
            OrderShipmentPackageStatus.FAILED,
            OrderShipmentPackageStatus.RTO_DELIVERED,
          ],
        },
      },
      data: {
        status: this.packageStatusFromDeliveryStatus(input.nextStatus, shipment.deliveryMode),
        ...(input.nextStatus === DeliveryStatus.PACKED ? { readyForBookingAt: new Date() } : {}),
        ...(input.nextStatus === DeliveryStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        ...(input.nextStatus === DeliveryStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
      },
    });
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

  private async runOrderPlacedSideEffects(order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>) {
    await Promise.allSettled([
      this.notifyOrderPlaced(order),
      this.notifyShipmentRoutingOperations(order),
    ]).then((results) => {
      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
          const label = index === 0 ? "order placed notifications" : "shipment routing notifications";
          this.logger.warn(
            `Order ${order.orderNumber} placed, but ${label} failed: ${this.errorMessage(result.reason)}`,
          );
        }
      }
    });
  }

  private async notifyOrderPlaced(order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>) {
    const customerEmail = order.customer.user.email;
    const sellerRecipients = [
      ...new Map(
        order.sellerSplits
          .filter((split) => split.seller.user.email)
          .map((split) => [split.sellerId, split]),
      ).values(),
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
      this.expoPush.notifyCustomer({
        customerId: order.customerId,
        type: PushNotificationType.ORDER_PLACED,
        templateCode: "CUSTOMER_ORDER_PLACED_PUSH",
        eventCode: "customer.order.placed",
        title: "Order placed",
        body: `Order ${order.orderNumber} has been placed successfully.`,
        href: `/orders/${order.orderNumber}`,
        sourceType: "order",
        sourceId: order.id,
        data: {
          type: "order",
          orderNumber: order.orderNumber,
          href: `/orders/${order.orderNumber}`,
        },
      }),
      ...sellerRecipients.map((split) =>
        this.notifications.notifyEvent({
          eventCode: EMAIL_TRIGGER_EVENTS.ORDER_RECEIVED_SELLER,
          recipientType: EmailRecipientType.SELLER,
          recipient: split.seller.user.email,
          userId: split.seller.userId,
          variables: {
            orderNumber: order.orderNumber,
            totalPaise: split.sellerSubtotalPaise,
          },
        }),
      ),
      ...sellerRecipients.map((split) =>
        this.expoPush.notifySeller({
          sellerId: split.sellerId,
          templateCode: "SELLER_ORDER_RECEIVED_PUSH",
          eventCode: "seller.order.received",
          title: "New order received",
          body: `Order ${order.orderNumber} is ready for seller action.`,
          data: {
            type: "seller_order",
            orderNumber: order.orderNumber,
            href: `/orders/${order.orderNumber}`,
          },
        }),
      ),
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.ORDER_PLACED_ADMIN, {
        orderNumber: order.orderNumber,
        totalPaise: order.totalPaise,
      }),
    ]);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private async notifyShipmentRoutingOperations(
    order: Awaited<ReturnType<OrdersService["getAdminOrder"]>>,
  ) {
    const shippingAddress = this.readShippingAddressSnapshot(order.shippingAddressSnapshot);
    const buyerDestination = [
      shippingAddress?.area,
      shippingAddress?.city,
      shippingAddress?.state,
      shippingAddress?.pincode,
      shippingAddress?.countryCode,
    ]
      .filter(Boolean)
      .join(", ");
    const alerts = order.shipments.flatMap((shipment) => {
      const sellerName = shipment.seller.storeName;
      const sellerContact =
        shipment.seller.user.email ?? shipment.seller.user.phone ?? shipment.seller.userId;
      const baseVariables = {
        orderNumber: order.orderNumber,
        shipmentNumber: shipment.shipmentNumber,
        sellerName,
        deliveryMode: shipment.deliveryMode,
        packageDimensions: this.routingPackageText(shipment.routingSnapshot),
        buyerDestination,
        sellerContact,
        note: shipment.routingFailureNote ?? shipment.assignmentNote ?? "",
      };
      const items: Array<Promise<unknown>> = [];

      if (shipment.routingFailed) {
        items.push(
          this.notifications.notifyAdminEvent(
            EMAIL_TRIGGER_EVENTS.DELIVERY_ROUTING_FAILED_ADMIN,
            baseVariables,
          ),
        );
      }

      if (shipment.deliveryMode === DeliveryMode.MANUAL_TRANSPORT) {
        items.push(
          this.notifications.notifyAdminEvent(
            EMAIL_TRIGGER_EVENTS.MANUAL_TRANSPORT_REQUIRED_ADMIN,
            {
              ...baseVariables,
              note:
                shipment.assignmentNote ??
                "Manual transport requires offline coordination. No courier booking will be attempted.",
            },
          ),
        );
        if (shipment.seller.user.email) {
          items.push(
            this.notifications.notifyEvent({
              eventCode: EMAIL_TRIGGER_EVENTS.MANUAL_TRANSPORT_REQUIRED_SELLER,
              recipientType: EmailRecipientType.SELLER,
              recipient: shipment.seller.user.email,
              userId: shipment.seller.userId,
              variables: {
                ...baseVariables,
                note:
                  shipment.assignmentNote ??
                  "Manual transport requires offline coordination. Our operations team will coordinate dispatch details.",
              },
            }),
          );
        }
      }

      return items;
    });

    if (alerts.length) {
      await Promise.all(alerts);
    }
  }

  private routingPackageText(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "";
    }

    const packageSnapshot = (value as Record<string, unknown>).package;
    if (!packageSnapshot || typeof packageSnapshot !== "object" || Array.isArray(packageSnapshot)) {
      return "";
    }

    const record = packageSnapshot as Record<string, unknown>;
    const weightGrams = typeof record.weightGrams === "number" ? record.weightGrams : null;
    const lengthCm = typeof record.lengthCm === "number" ? record.lengthCm : null;
    const breadthCm = typeof record.breadthCm === "number" ? record.breadthCm : null;
    const heightCm = typeof record.heightCm === "number" ? record.heightCm : null;

    return [
      weightGrams ? `${weightGrams}g` : null,
      lengthCm && breadthCm && heightCm ? `${lengthCm}x${breadthCm}x${heightCm}cm` : null,
    ]
      .filter(Boolean)
      .join(" ");
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

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: order.customer.user.email,
        userId: order.customer.userId,
        variables: {
          orderNumber: order.orderNumber,
          orderStatus: status,
          note: note ?? "",
        },
      }),
      ...(status === OrderStatus.DELIVERED
        ? [
            this.expoPush.notifyCustomer({
              customerId: order.customerId,
              type: PushNotificationType.ORDER_DELIVERED,
              templateCode: "CUSTOMER_ORDER_DELIVERED_PUSH",
              eventCode: "customer.order.delivered",
              title: "Order delivered",
              body: `Order ${order.orderNumber} has been delivered.`,
              href: `/orders/${order.orderNumber}`,
              sourceType: "order",
              sourceId: order.id,
              data: {
                type: "order",
                orderNumber: order.orderNumber,
                href: `/orders/${order.orderNumber}`,
              },
            }),
          ]
        : []),
    ]);
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

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: order.customer.user.email,
        userId: order.customer.userId,
        variables: {
          orderNumber: order.orderNumber,
          deliveryStatus: status,
          note: note ?? "",
        },
      }),
      ...(status === DeliveryStatus.DELIVERED
        ? [
            this.expoPush.notifyCustomer({
              customerId: order.customerId,
              type: PushNotificationType.ORDER_DELIVERED,
              templateCode: "CUSTOMER_ORDER_DELIVERED_PUSH",
              eventCode: "customer.order.delivered",
              title: "Order delivered",
              body: `Order ${order.orderNumber} has been delivered.`,
              href: `/orders/${order.orderNumber}`,
              sourceType: "order",
              sourceId: order.id,
              data: {
                type: "order",
                orderNumber: order.orderNumber,
                href: `/orders/${order.orderNumber}`,
              },
            }),
          ]
        : []),
    ]);
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

  private cleanProviderCode(value?: string | null) {
    const providerCode = value?.trim().toUpperCase();
    return providerCode || null;
  }

  private routingPackageFromSnapshot(
    value: Prisma.JsonValue | null | undefined,
  ): DeliveryRoutingPackage | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const rawPackage = (value as Record<string, unknown>).package;
    if (!rawPackage || typeof rawPackage !== "object" || Array.isArray(rawPackage)) {
      return null;
    }

    const record = rawPackage as Record<string, unknown>;
    return {
      weightGrams: this.snapshotNumber(record.weightGrams),
      lengthCm: this.snapshotNumber(record.lengthCm),
      breadthCm: this.snapshotNumber(record.breadthCm),
      heightCm: this.snapshotNumber(record.heightCm),
      itemCount: this.snapshotNumber(record.itemCount),
    };
  }

  private snapshotNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
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

  private async assertDeliveryPartnerUser(
    tx: Prisma.TransactionClient | PrismaService["client"],
    userId: string,
  ) {
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

  private deliveryAssignmentExpiresAt(assignedAt: Date) {
    return new Date(assignedAt.getTime() + deliveryAssignmentAcceptanceWindowMs);
  }

  private deliveryAssignmentExpired(expiresAt: Date | null | undefined, now: Date) {
    return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
  }

  private async releaseExpiredDeliveryAssignmentForPartner(
    order: OrderWithRelations,
    partnerUserId: string,
    now: Date,
  ) {
    const delivery = order.deliveryDetail;
    if (!delivery) {
      return;
    }

    await this.prisma.client.$transaction(async (tx) => {
      const released = await tx.deliveryDetail.updateMany({
        where: {
          id: delivery.id,
          deliveryPartnerUserId: partnerUserId,
          assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
          assignmentExpiresAt: { lte: now },
        },
        data: {
          deliveryPartnerUserId: null,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
          assignedAt: null,
          acceptedAt: null,
          rejectedAt: now,
          assignmentExpiresAt: null,
          assignmentNote: deliveryAssignmentExpiredNote,
        },
      });

      if (released.count !== 1) {
        return;
      }

      await tx.deliveryAssignmentAttempt.updateMany({
        where: {
          deliveryDetailId: delivery.id,
          partnerUserId,
          status: DeliveryAssignmentStatus.ASSIGNED,
        },
        data: {
          status: DeliveryAssignmentStatus.CANCELLED,
          respondedAt: now,
          note: deliveryAssignmentExpiredNote,
        },
      });

      await tx.orderShipment.updateMany({
        where: {
          orderId: order.id,
          deliveryPartnerUserId: partnerUserId,
          assignmentStatus: DeliveryAssignmentStatus.ASSIGNED,
          status: { notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] },
        },
        data: {
          deliveryPartnerUserId: null,
          assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
          assignedAt: null,
          acceptedAt: null,
          rejectedAt: now,
          assignmentExpiresAt: null,
          assignmentNote: deliveryAssignmentExpiredNote,
        },
      });

      await tx.deliveryEvent.create({
        data: {
          deliveryDetailId: delivery.id,
          oldStatus: delivery.status,
          newStatus: delivery.status,
          note: deliveryAssignmentExpiredNote,
          updatedById: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: "order.delivery_assignment.expired",
          entityType: "order",
          entityId: order.id,
          oldValue: this.deliveryAuditValue(delivery),
          newValue: {
            orderNumber: order.orderNumber,
            assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
            expiredPartnerUserId: partnerUserId,
            note: deliveryAssignmentExpiredNote,
          },
        },
      });
    });
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
              contactName:
                shipment.seller.profile?.contactName ??
                shipment.seller.user.fullName ??
                shipment.seller.storeName,
              contactPhone:
                shipment.seller.profile?.contactPhone ?? shipment.seller.user.phone ?? null,
              contactEmail:
                shipment.seller.profile?.contactEmail ?? shipment.seller.user.email ?? null,
              pickupAddress: this.sellerPickupAddressReadback(shipment.seller),
            }
          : null,
        subtotalPaise: shipment.subtotalPaise,
        shippingPaise: shipment.shippingPaise,
        codSurchargePaise: shipment.codSurchargePaise,
        deliveryMode: shipment.deliveryMode,
        courierProviderCode: shipment.courierProviderCode,
        routingFailed: shipment.routingFailed,
        routingFailureReason: shipment.routingFailureReason,
        routingFailureNote: shipment.routingFailureNote,
        routedAt: shipment.routedAt,
        routingFirstFailedAt: shipment.routingFirstFailedAt,
        routingLastAttemptAt: shipment.routingLastAttemptAt,
        routingRetryCount: shipment.routingRetryCount,
        routingPermanentFailureAt: shipment.routingPermanentFailureAt,
        status: shipment.status,
        assignmentStatus: shipment.assignmentStatus,
        assignmentExpiresAt: shipment.assignmentExpiresAt,
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
        packages: shipment.packages.map((shipmentPackage) =>
          this.shipmentPackageReadback(shipmentPackage, { sellerLabelAccess: false }),
        ),
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
            assignmentExpiresAt: order.deliveryDetail.assignmentExpiresAt,
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

  private sellerPickupAddressReadback(seller: OrderWithRelations["shipments"][number]["seller"]) {
    const address = seller?.addresses?.[0];
    if (!address) {
      return null;
    }

    return {
      line1: address.line1,
      line2: address.line2,
      area: address.area,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
      countryCode: address.countryCode,
      latitude: address.latitude?.toString() ?? null,
      longitude: address.longitude?.toString() ?? null,
      locationSource: address.locationSource ?? null,
      accuracyMeters: address.accuracyMeters?.toString() ?? null,
      locationConfidenceScore: address.locationConfidenceScore?.toString() ?? null,
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
    assignmentExpiresAt?: Date | null;
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
      assignmentExpiresAt: delivery.assignmentExpiresAt?.toISOString() ?? null,
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
