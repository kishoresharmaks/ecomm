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
  DeliveryMode,
  ProductListingMode,
  ProductStatus,
  SellerStatus,
  SellerType,
  VariantStatus,
  Prisma,
} from "@indihub/database";

import type { RequestUser } from "../auth/types/indihub-request";
import { assertCheckoutDeliveryServiceable } from "../checkout/checkout-serviceability";
import {
  CheckoutPricingService,
  type CheckoutChargeDeliveryOptions,
} from "../checkout/checkout-pricing.service";
import { CheckoutDeliveryPreference } from "../checkout/dto/delivery-routing.dto";
import type { DeliveryRoutingAddress } from "../checkout/delivery-routing.service";
import { CouponsService, type CouponCheckoutItem } from "../coupons/coupons.service";
import { CustomersService } from "../customers/customers.service";
import { DealPricingService } from "../deals/deal-pricing.service";
import { MarketService } from "../market/market.service";
import { PrismaService } from "../prisma/prisma.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-item.dto";
import { CheckoutSummaryQueryDto } from "./dto/checkout-summary-query.dto";

const cartInclude = {
  items: {
    include: {
      seller: true,
      productVariant: {
        include: {
          product: {
            include: {
              images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
              seller: true,
              category: true,
              deliveryModeOptions: {
                where: { isEnabled: true },
                select: {
                  deliveryMode: true,
                  isEnabled: true,
                  manualTransportFreeDistanceKm: true,
                  manualTransportChargePerKmPaise: true,
                  manualTransportChargePerKmMinor: true,
                  manualTransportCurrency: true,
                  manualTransportNote: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

type CheckoutSummaryItem = {
  id: string;
  sellerId: string;
  quantity: number;
  unitPricePaise: number;
  productVariant: {
    currency: string;
    packageWeightGrams?: number | null;
    packageLengthCm?: number | null;
    packageBreadthCm?: number | null;
    packageHeightCm?: number | null;
    attributes?: Prisma.JsonValue | null;
    product: {
      id: string;
      categoryId: string;
      name: string;
      sellerId: string;
      weightKg?: Prisma.Decimal | number | string | null;
      deliveryModeOptions?: Array<{
        deliveryMode: DeliveryMode;
        isEnabled?: boolean | null;
        manualTransportFreeDistanceKm?: Prisma.Decimal | number | string | null;
        manualTransportChargePerKmPaise?: number | null;
        manualTransportChargePerKmMinor?: number | null;
        manualTransportCurrency?: string | null;
        manualTransportNote?: string | null;
      }>;
      seller: {
        id?: string;
        storeName?: string;
        sellerType: SellerType;
      };
    };
  };
};

@Injectable()
export class CartService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
    @Inject(CheckoutPricingService) private readonly checkoutPricing: CheckoutPricingService,
    @Inject(CouponsService) private readonly couponsService: CouponsService,
    @Inject(DealPricingService) private readonly dealPricing: DealPricingService,
    @Inject(MarketService) private readonly marketService: MarketService,
  ) {}

  async getCart(actor: RequestUser) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const activeCart = await this.ensureActiveCart(customer.id);

    const cart = await this.prisma.client.cart.findUniqueOrThrow({
      where: { id: activeCart.id },
      include: cartInclude,
    });
    return this.withDealCartPrices(cart);
  }

  async getCheckoutSummary(actor: RequestUser, query: CheckoutSummaryQueryDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const checkoutItems = await this.checkoutSummaryBaseItems(
      await this.checkoutSummaryItems(actor, query),
    );
    const subtotalPaise = checkoutItems.reduce((total: number, item: CheckoutSummaryItem) => total + item.quantity * item.unitPricePaise, 0);
    const itemCount = checkoutItems.reduce((total: number, item: CheckoutSummaryItem) => total + item.quantity, 0);
    const deliveryOptions = await this.checkoutSummaryDeliveryOptions(customer.id, query);
    const sellerPackages = this.checkoutSellerPackages(checkoutItems);
    const charges = await this.checkoutPricing.calculateSellerPackageCharges(
      subtotalPaise,
      sellerPackages,
      this.prisma.client,
      deliveryOptions,
    );
    assertCheckoutDeliveryServiceable(charges, {
      addressProvided: deliveryOptions.address !== undefined,
      deliveryPreference: deliveryOptions.deliveryPreference ?? null,
    });
    const market = await this.marketService.getMarketCurrency(query.buyerCountryCode ?? "IN", {
      requireFresh: true,
      forceRefresh: true,
    });
    const coupon = await this.couponsService.previewCoupon(actor, {
      ...(query.couponCode !== undefined ? { couponCode: query.couponCode } : {}),
      customerId: customer.id,
      items: this.checkoutCouponItems(checkoutItems),
      subtotalPaise,
      shippingPaise: charges.shippingPaise,
      shippingSnapshot: charges.snapshot,
      currency: market.baseCurrency,
    });
    const finalCharges = coupon
      ? await this.checkoutPricing.applyCouponAdjustments(charges, this.prisma.client, {
          merchandiseDiscountPaise: coupon.merchandiseDiscountPaise,
          shippingDiscountPaise: coupon.shippingDiscountPaise,
          snapshot: coupon.snapshot,
        })
      : {
          ...charges,
          payableSubtotalPaise: charges.subtotalPaise,
          payableShippingPaise: charges.shippingPaise,
          couponDiscountPaise: 0,
        };
    const buyerSubtotalMinor = this.marketService.convertMinorUnits(charges.subtotalPaise, market);
    const buyerPayableSubtotalMinor = this.marketService.convertMinorUnits(
      finalCharges.payableSubtotalPaise,
      market,
    );
    const buyerShippingMinor = this.marketService.convertMinorUnits(finalCharges.shippingPaise, market);
    const buyerPlatformFeeMinor = this.marketService.convertMinorUnits(
      finalCharges.platformFeePaise,
      market,
    );
    const buyerCouponDiscountMinor = this.marketService.convertMinorUnits(
      coupon?.discountPaise ?? 0,
      market,
    );

    return {
      itemCount,
      subtotalPaise: charges.subtotalPaise,
      payableSubtotalPaise: finalCharges.payableSubtotalPaise,
      shippingPaise: finalCharges.shippingPaise,
      platformFeePaise: finalCharges.platformFeePaise,
      couponDiscountPaise: coupon?.discountPaise ?? 0,
      couponMerchandiseDiscountPaise: coupon?.merchandiseDiscountPaise ?? 0,
      couponShippingDiscountPaise: coupon?.shippingDiscountPaise ?? 0,
      couponPlatformFundedDiscountPaise: coupon?.platformFundedDiscountPaise ?? 0,
      couponSellerFundedDiscountPaise: coupon?.sellerFundedDiscountPaise ?? 0,
      coupon: this.couponsService.publicReadback(coupon),
      totalPaise: finalCharges.totalPaise,
      currency: market.baseCurrency,
      buyerCountryCode: market.countryCode,
      buyerCurrency: market.currency,
      buyerSubtotalMinor,
      buyerPayableSubtotalMinor,
      buyerShippingMinor,
      buyerPlatformFeeMinor,
      buyerCouponDiscountMinor,
      buyerTotalMinor: this.marketService.convertMinorUnits(finalCharges.totalPaise, market),
      availableDeliveryOptions: finalCharges.availableDeliveryOptions,
      sellerDeliveryGroups: finalCharges.sellerDeliveryGroups,
    };
  }

  private async checkoutSummaryDeliveryOptions(
    customerId: string,
    query: CheckoutSummaryQueryDto,
  ): Promise<CheckoutChargeDeliveryOptions> {
    const address = await this.checkoutSummaryAddress(customerId, query);
    if (!query.deliveryPreference && !query.paymentMethod && address === undefined) {
      return {};
    }

    return {
      ...(query.deliveryPreference ? { deliveryPreference: query.deliveryPreference } : {}),
      ...(query.requestedDeliveryMode ? { deliveryMode: query.requestedDeliveryMode } : {}),
      ...(query.deliverySelections
        ? { deliverySelections: this.checkoutSummaryDeliverySelections(query.deliverySelections) }
        : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(address !== undefined ? { address } : {}),
    };
  }

  private checkoutSummaryDeliverySelections(value: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException("Delivery selections are invalid.");
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException("Delivery selections are invalid.");
    }

    if (parsed.length > 50) {
      throw new BadRequestException("Delivery selections are invalid.");
    }

    const seenSellerIds = new Set<string>();
    return parsed.map((entry) => {
      const selection = entry as { sellerId?: unknown; deliveryMode?: unknown };
      if (
        typeof selection.sellerId !== "string" ||
        !selection.sellerId ||
        typeof selection.deliveryMode !== "string" ||
        !Object.values(DeliveryMode).includes(selection.deliveryMode as DeliveryMode)
      ) {
        throw new BadRequestException("Delivery selections are invalid.");
      }
      if (seenSellerIds.has(selection.sellerId)) {
        throw new BadRequestException("Delivery selections are invalid.");
      }
      seenSellerIds.add(selection.sellerId);

      return {
        sellerId: selection.sellerId,
        deliveryMode: selection.deliveryMode as DeliveryMode,
      };
    });
  }

  private async checkoutSummaryAddress(
    customerId: string,
    query: CheckoutSummaryQueryDto,
  ): Promise<DeliveryRoutingAddress | null | undefined> {
    if (query.deliveryPreference === CheckoutDeliveryPreference.STORE_PICKUP) {
      return null;
    }

    if (query.addressId) {
      const address = await this.prisma.client.customerAddress.findFirst({
        where: {
          id: query.addressId,
          customerId,
        },
      });
      if (!address) {
        throw new NotFoundException("Delivery address not found.");
      }

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
          address.locationConfidenceScore === null
            ? null
            : Number(address.locationConfidenceScore),
      };
    }

    if (
      !query.countryCode &&
      !query.stateCode &&
      !query.cityCode &&
      !query.pincode &&
      !query.localAreaCode &&
      query.latitude === undefined &&
      query.longitude === undefined
    ) {
      return undefined;
    }

    return {
      countryCode: query.countryCode ?? null,
      stateCode: query.stateCode ?? null,
      cityCode: query.cityCode ?? null,
      pincode: query.pincode ?? null,
      localAreaCode: query.localAreaCode ?? null,
      latitude: query.latitude ?? null,
      longitude: query.longitude ?? null,
    };
  }

  private checkoutCouponItems(
    items: Array<{
      id: string;
      sellerId: string;
      quantity: number;
      unitPricePaise: number;
      productVariant: {
        product: {
          id: string;
          categoryId: string;
          name: string;
        };
      };
    }>,
  ): CouponCheckoutItem[] {
    return items.map((item) => ({
      key: item.id,
      sellerId: item.sellerId,
      productId: item.productVariant.product.id,
      categoryId: item.productVariant.product.categoryId,
      quantity: item.quantity,
      lineTotalPaise: item.quantity * item.unitPricePaise,
      productName: item.productVariant.product.name,
    }));
  }

  private async checkoutSummaryItems(
    actor: RequestUser,
    query: CheckoutSummaryQueryDto,
  ): Promise<CheckoutSummaryItem[]> {
    if (!query.directProductVariantId) {
      return (await this.getCart(actor)).items;
    }

    const quantity = query.directQuantity ?? 1;
    const variant = await this.getActiveVariantOrThrow(query.directProductVariantId);
    this.ensureStockAvailable(variant.stockQuantity, quantity);
    const price = await this.dealPricing.resolveVariantPrice(
      variant,
      variant.productId,
      this.prisma.client,
    );

    return [
      {
        id: `direct:${variant.id}`,
        sellerId: variant.product.sellerId,
        quantity,
        unitPricePaise: price.effectiveUnitPricePaise,
        productVariant: {
          ...variant,
          product: variant.product,
        },
      },
    ];
  }

  private async checkoutSummaryBaseItems(items: CheckoutSummaryItem[]) {
    return Promise.all(
      items.map(async (item) => ({
        ...item,
        unitPricePaise: await this.marketService.convertMinorUnitsToBase(
          item.unitPricePaise,
          item.productVariant.currency,
        ),
      })),
    );
  }

  async addItem(actor: RequestUser, dto: AddCartItemDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const cart = await this.ensureActiveCart(customer.id);
    const variant = await this.getActiveVariantOrThrow(dto.productVariantId);
    const existingItem = await this.prisma.client.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: dto.productVariantId,
        },
      },
    });
    const nextQuantity = (existingItem?.quantity ?? 0) + dto.quantity;

    this.ensureStockAvailable(variant.stockQuantity, nextQuantity);
    const price = await this.dealPricing.resolveVariantPrice(
      variant,
      variant.productId,
      this.prisma.client,
    );

    await this.prisma.client.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: dto.productVariantId,
        },
      },
      update: {
        quantity: nextQuantity,
        unitPricePaise: price.effectiveUnitPricePaise,
        currency: variant.currency,
      },
      create: {
        cartId: cart.id,
        productVariantId: dto.productVariantId,
        sellerId: variant.product.sellerId,
        quantity: dto.quantity,
        unitPricePaise: price.effectiveUnitPricePaise,
        currency: variant.currency,
      },
    });

    return this.getCart(actor);
  }

  async updateItem(actor: RequestUser, cartItemId: string, dto: UpdateCartItemDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const cart = await this.ensureActiveCart(customer.id);
    const cartItem = await this.getCartItemOrThrow(cart.id, cartItemId);
    const variant = await this.getActiveVariantOrThrow(cartItem.productVariantId);

    this.ensureStockAvailable(variant.stockQuantity, dto.quantity);
    const price = await this.dealPricing.resolveVariantPrice(
      variant,
      variant.productId,
      this.prisma.client,
    );

    await this.prisma.client.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity: dto.quantity,
        unitPricePaise: price.effectiveUnitPricePaise,
        currency: variant.currency,
      },
    });

    return this.getCart(actor);
  }

  async removeItem(actor: RequestUser, cartItemId: string) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const cart = await this.ensureActiveCart(customer.id);
    await this.getCartItemOrThrow(cart.id, cartItemId);

    await this.prisma.client.cartItem.delete({
      where: { id: cartItemId },
    });

    return this.getCart(actor);
  }

  async ensureActiveCart(customerId: string) {
    const existingCart = await this.prisma.client.cart.findFirst({
      where: {
        customerId,
        status: CartStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingCart) {
      return existingCart;
    }

    return this.prisma.client.cart.create({
      data: {
        customerId,
        status: CartStatus.ACTIVE,
      },
    });
  }

  private async getActiveVariantOrThrow(productVariantId: string) {
    const variant = await this.prisma.client.productVariant.findFirst({
      where: {
        id: productVariantId,
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
      include: {
        product: {
          include: {
            seller: true,
            deliveryModeOptions: {
              where: { isEnabled: true },
              select: {
                deliveryMode: true,
                isEnabled: true,
                manualTransportFreeDistanceKm: true,
                manualTransportChargePerKmPaise: true,
                manualTransportChargePerKmMinor: true,
                manualTransportCurrency: true,
                manualTransportNote: true,
              },
            },
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException("Active product variant not found.");
    }
    if (variant.product.listingMode === ProductListingMode.ENQUIRY_ONLY) {
      throw new BadRequestException("This listing is enquiry-only and cannot be added to cart.");
    }

    return variant;
  }

  private async withDealCartPrices<
    T extends {
      customerId: string;
      items: Array<{
        quantity: number;
        unitPricePaise: number;
        productVariant?: {
          productId: string;
          pricePaise: number;
          currency: string;
        } & Record<string, unknown>;
      }>;
    },
  >(cart: T) {
    const items = await Promise.all(
      cart.items.map(async (item) => {
        const productVariant = item.productVariant;
        if (!productVariant) {
          return item;
        }

        const price = await this.dealPricing.resolveVariantPrice(
          productVariant,
          productVariant.productId,
          this.prisma.client,
        );
        const decoratedVariant = {
          ...productVariant,
          pricePaise: price.effectiveUnitPricePaise,
          originalPricePaise: price.originalUnitPricePaise,
          dealPricePaise: price.dealSnapshot ? price.effectiveUnitPricePaise : null,
          dealDiscountBps: price.dealDiscountBps,
          dealDiscountPaise: price.dealDiscountPaise,
          activeDeal: price.dealSnapshot,
        };

        return {
          ...item,
          unitPricePaise: price.effectiveUnitPricePaise,
          originalUnitPricePaise: price.originalUnitPricePaise,
          dealDiscountBps: price.dealDiscountBps,
          dealDiscountPaise: price.dealDiscountPaise,
          activeDeal: price.dealSnapshot,
          productVariant: decoratedVariant,
        };
      }),
    );

    return { ...cart, items };
  }

  private async getCartItemOrThrow(cartId: string, cartItemId: string) {
    const cartItem = await this.prisma.client.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId,
      },
    });

    if (!cartItem) {
      throw new ForbiddenException("Cart item does not belong to this customer cart.");
    }

    return cartItem;
  }

  private ensureStockAvailable(stockQuantity: number, requestedQuantity: number) {
    if (requestedQuantity > stockQuantity) {
      throw new BadRequestException("Requested quantity is greater than available stock.");
    }
  }

  private checkoutSellerPackages(items: CheckoutSummaryItem[]) {
    const packages = new Map<
      string,
      {
        sellerId: string;
        sellerName: string;
        sellerType: SellerType;
        subtotalPaise: number;
        allowedDeliveryModes: DeliveryMode[];
        items: Array<{
          productId: string;
          productName: string;
          quantity: number;
          enabledDeliveryModes: DeliveryMode[];
          manualTransport?: {
            freeDistanceKm: number;
            chargePerKmMinor: number;
            currency: string;
            note: string;
          } | null;
        }>;
        package: {
          weightGrams: number;
          lengthCm: number;
          breadthCm: number;
          heightCm: number;
          itemCount: number;
        };
      }
    >();

    for (const item of items) {
      const variant = item.productVariant;
      const product = variant.product;
      const current = packages.get(product.sellerId) ?? {
        sellerId: product.sellerId,
        sellerName: product.seller.storeName ?? "Seller",
        sellerType: product.seller.sellerType,
        subtotalPaise: 0,
        allowedDeliveryModes: this.enabledProductDeliveryModes(product),
        items: [],
        package: {
          weightGrams: 0,
          lengthCm: 20,
          breadthCm: 15,
          heightCm: 8,
          itemCount: 0,
        },
      };
      const productWeightGrams = product.weightKg ? Math.round(Number(product.weightKg) * 1000) : null;
      const enabledDeliveryModes = this.enabledProductDeliveryModes(product);
      const itemWeightGrams = this.positiveInt(
        variant.packageWeightGrams ?? this.jsonNumber(variant.attributes, "packageWeightGrams") ?? productWeightGrams,
        500,
      );
      current.subtotalPaise += item.quantity * item.unitPricePaise;
      current.allowedDeliveryModes = current.allowedDeliveryModes.filter((mode) =>
        enabledDeliveryModes.includes(mode),
      );
      current.items.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        enabledDeliveryModes,
        manualTransport: this.manualTransportConfig(product),
      });
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

    return Array.from(packages.values());
  }

  private enabledProductDeliveryModes(product: {
    deliveryModeOptions?: Array<{ deliveryMode: DeliveryMode; isEnabled?: boolean | null }> | null;
  }) {
    const modes = (product.deliveryModeOptions ?? [])
      .filter((option) => option.isEnabled !== false)
      .map((option) => option.deliveryMode);

    return modes.length
      ? modes
      : [
          DeliveryMode.STORE_PICKUP,
          DeliveryMode.LOCAL_DELIVERY_PARTNER,
          DeliveryMode.THIRD_PARTY_COURIER,
        ];
  }

  private manualTransportConfig(product: {
    deliveryModeOptions?: Array<{
      deliveryMode: DeliveryMode;
      isEnabled?: boolean | null;
      manualTransportFreeDistanceKm?: Prisma.Decimal | number | string | null;
      manualTransportChargePerKmPaise?: number | null;
      manualTransportChargePerKmMinor?: number | null;
      manualTransportCurrency?: string | null;
      manualTransportNote?: string | null;
    }> | null;
  }) {
    const option = (product.deliveryModeOptions ?? []).find(
      (item) => item.deliveryMode === DeliveryMode.MANUAL_TRANSPORT && item.isEnabled !== false,
    );
    if (
      !option ||
      option.manualTransportFreeDistanceKm === null ||
      option.manualTransportFreeDistanceKm === undefined ||
      ((option.manualTransportChargePerKmMinor === null ||
        option.manualTransportChargePerKmMinor === undefined) &&
        (option.manualTransportChargePerKmPaise === null ||
          option.manualTransportChargePerKmPaise === undefined)) ||
      !option.manualTransportNote
    ) {
      return null;
    }

    return {
      freeDistanceKm: Number(option.manualTransportFreeDistanceKm),
      chargePerKmMinor: option.manualTransportChargePerKmMinor ?? option.manualTransportChargePerKmPaise ?? 0,
      currency: option.manualTransportCurrency?.trim().toUpperCase() || "INR",
      note: option.manualTransportNote,
    };
  }

  private positiveInt(value: unknown, fallback: number): number {
    if (typeof value === "number") {
      const parsed = Math.floor(value);
      return parsed > 0 ? parsed : fallback;
    }
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback;
    }
    return fallback;
  }

  private jsonNumber(json: unknown, key: string): number | null {
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const value = (json as Record<string, unknown>)[key];
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
    return null;
  }
}
