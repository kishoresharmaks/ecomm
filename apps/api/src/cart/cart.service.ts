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
  ProductListingMode,
  ProductStatus,
  SellerStatus,
  VariantStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  CheckoutPricingService,
  type CheckoutChargeDeliveryOptions,
} from "../checkout/checkout-pricing.service";
import { CheckoutDeliveryPreference } from "../checkout/dto/delivery-routing.dto";
import type { DeliveryRoutingAddress } from "../checkout/delivery-routing.service";
import { CustomersService } from "../customers/customers.service";
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
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

@Injectable()
export class CartService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
    @Inject(CheckoutPricingService) private readonly checkoutPricing: CheckoutPricingService,
    @Inject(MarketService) private readonly marketService: MarketService,
  ) {}

  async getCart(actor: RequestUser) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const cart = await this.ensureActiveCart(customer.id);

    return this.prisma.client.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });
  }

  async getCheckoutSummary(actor: RequestUser, query: CheckoutSummaryQueryDto) {
    const cart = await this.getCart(actor);
    const subtotalPaise = cart.items.reduce(
      (total, item) => total + item.quantity * item.unitPricePaise,
      0,
    );
    const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);
    const deliveryOptions = await this.checkoutSummaryDeliveryOptions(cart.customerId, query);
    const charges = await this.checkoutPricing.calculateCharges(
      subtotalPaise,
      this.prisma.client,
      deliveryOptions,
    );
    const market = await this.marketService.getMarketCurrency(query.buyerCountryCode ?? "IN");
    const buyerSubtotalMinor = this.marketService.convertMinorUnits(charges.subtotalPaise, market);
    const buyerShippingMinor = this.marketService.convertMinorUnits(charges.shippingPaise, market);
    const buyerPlatformFeeMinor = this.marketService.convertMinorUnits(
      charges.platformFeePaise,
      market,
    );

    return {
      itemCount,
      subtotalPaise: charges.subtotalPaise,
      shippingPaise: charges.shippingPaise,
      platformFeePaise: charges.platformFeePaise,
      totalPaise: charges.totalPaise,
      currency: market.baseCurrency,
      buyerCountryCode: market.countryCode,
      buyerCurrency: market.currency,
      buyerSubtotalMinor,
      buyerShippingMinor,
      buyerPlatformFeeMinor,
      buyerTotalMinor: buyerSubtotalMinor + buyerShippingMinor + buyerPlatformFeeMinor,
      feeSnapshot: charges.snapshot,
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
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(address !== undefined ? { address } : {}),
    };
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
      };
    }

    if (
      !query.countryCode &&
      !query.stateCode &&
      !query.cityCode &&
      !query.pincode &&
      !query.localAreaCode
    ) {
      return undefined;
    }

    return {
      countryCode: query.countryCode ?? null,
      stateCode: query.stateCode ?? null,
      cityCode: query.cityCode ?? null,
      pincode: query.pincode ?? null,
      localAreaCode: query.localAreaCode ?? null,
    };
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

    await this.prisma.client.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: dto.productVariantId,
        },
      },
      update: {
        quantity: nextQuantity,
        unitPricePaise: variant.pricePaise,
        currency: variant.currency,
      },
      create: {
        cartId: cart.id,
        productVariantId: dto.productVariantId,
        sellerId: variant.product.sellerId,
        quantity: dto.quantity,
        unitPricePaise: variant.pricePaise,
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

    await this.prisma.client.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity: dto.quantity,
        unitPricePaise: variant.pricePaise,
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
        product: true,
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
}
