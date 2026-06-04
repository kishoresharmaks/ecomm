import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { DeliveryMode, Prisma, SellerType } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { readBooleanSetting, readNumberSetting } from "../settings/setting-value-utils";
import {
  CheckoutDeliveryPreference,
} from "./dto/delivery-routing.dto";
import {
  DeliveryRoutingAddress,
  DeliveryRoutingPackage,
  DeliveryRoutingQuote,
  DeliveryRoutingService,
} from "./delivery-routing.service";

const settingKeys = {
  shippingDefaultChargePaise: "shipping.default_charge_paise",
  platformFeeEnabled: "checkout.platform_fee.enabled",
  platformFeeType: "checkout.platform_fee.type",
  platformFeeValueBps: "checkout.platform_fee.value_bps",
  platformFeeFixedPaise: "checkout.platform_fee.fixed_paise"
} as const;

type PlatformFeeType = "PERCENTAGE" | "FIXED" | "MANUAL";
type PricingClient = Prisma.TransactionClient | PrismaService["client"];

export type CheckoutChargeDeliveryOptions = {
  deliveryPreference?: CheckoutDeliveryPreference | undefined;
  deliveryMode?: DeliveryMode | undefined;
  address?: DeliveryRoutingAddress | null | undefined;
  paymentMethod?: string | null | undefined;
  orderId?: string | undefined;
};

export type CheckoutSellerPackageDeliveryInput = {
  sellerId: string;
  sellerType: SellerType;
  subtotalPaise: number;
  package?: DeliveryRoutingPackage | null;
};

export type CheckoutSellerPackageDeliveryRouting = {
  sellerId: string;
  sellerType: SellerType;
  subtotalPaise: number;
  quote: DeliveryRoutingQuote;
};

export type CheckoutCharges = {
  subtotalPaise: number;
  shippingPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  snapshot: Prisma.InputJsonObject;
  deliveryRouting: DeliveryRoutingQuote | null;
  deliveryRoutings?: CheckoutSellerPackageDeliveryRouting[];
};

@Injectable()
export class CheckoutPricingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(DeliveryRoutingService)
    private readonly deliveryRouting?: DeliveryRoutingService,
  ) {}

  async calculateCharges(
    subtotalPaise: number,
    client: PricingClient = this.prisma.client,
    deliveryOptions: CheckoutChargeDeliveryOptions = {},
  ): Promise<CheckoutCharges> {
    const normalizedSubtotal = this.nonNegativeInt(subtotalPaise);
    const settings = await client.setting.findMany({
      where: {
        key: {
          in: Object.values(settingKeys)
        }
      }
    });
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const deliveryRouting = this.shouldResolveDelivery(deliveryOptions)
      ? await this.requireDeliveryRouting().resolveDelivery(
          this.deliveryRoutingInput(deliveryOptions, normalizedSubtotal),
          client,
        )
      : null;
    const shippingPaise = deliveryRouting
      ? this.nonNegativeInt(deliveryRouting.totalDeliveryChargePaise)
      : this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.shippingDefaultChargePaise), 0));
    const platformFeeEnabled = this.booleanSetting(settingMap.get(settingKeys.platformFeeEnabled), false);
    const platformFeeType = this.platformFeeType(settingMap.get(settingKeys.platformFeeType));
    const platformFeeValueBps = this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.platformFeeValueBps), 0));
    const platformFeeFixedPaise = this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.platformFeeFixedPaise), 0));
    const platformFeePaise = platformFeeEnabled
      ? this.calculatePlatformFee(normalizedSubtotal, platformFeeType, platformFeeValueBps, platformFeeFixedPaise)
      : 0;

    return {
      subtotalPaise: normalizedSubtotal,
      shippingPaise,
      platformFeePaise,
      totalPaise: normalizedSubtotal + shippingPaise + platformFeePaise,
      snapshot: {
        shipping: {
          key: deliveryRouting ? null : settingKeys.shippingDefaultChargePaise,
          chargePaise: shippingPaise,
          routing: deliveryRouting?.shippingSnapshot ?? null,
          codSurcharge: deliveryRouting?.codSurchargeSnapshot ?? null
        },
        platformFee: {
          enabled: platformFeeEnabled,
          type: platformFeeType,
          valueBps: platformFeeValueBps,
          fixedPaise: platformFeeFixedPaise,
          amountPaise: platformFeePaise
        },
        deliveryRouting: deliveryRouting?.routingSnapshot ?? null
      },
      deliveryRouting
    };
  }

  async calculateSellerPackageCharges(
    subtotalPaise: number,
    sellerPackages: CheckoutSellerPackageDeliveryInput[],
    client: PricingClient = this.prisma.client,
    deliveryOptions: CheckoutChargeDeliveryOptions = {},
  ): Promise<CheckoutCharges> {
    const normalizedSubtotal = this.nonNegativeInt(subtotalPaise);
    const settings = await this.pricingSettings(client);
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const deliveryRoutings = this.shouldResolveDelivery(deliveryOptions)
      ? await Promise.all(
          sellerPackages.map(async (sellerPackage) => {
            const quote = await this.requireDeliveryRouting().resolveDelivery(
              {
                ...this.deliveryRoutingInput(
                  deliveryOptions,
                  this.nonNegativeInt(sellerPackage.subtotalPaise),
                ),
                sellerId: sellerPackage.sellerId,
                sellerType: sellerPackage.sellerType,
                package: sellerPackage.package ?? null,
              },
              client,
            );

            return {
              sellerId: sellerPackage.sellerId,
              sellerType: sellerPackage.sellerType,
              subtotalPaise: this.nonNegativeInt(sellerPackage.subtotalPaise),
              quote,
            } satisfies CheckoutSellerPackageDeliveryRouting;
          }),
        )
      : [];
    const shippingPaise = deliveryRoutings.length
      ? deliveryRoutings.reduce(
          (total, routing) => total + this.nonNegativeInt(routing.quote.totalDeliveryChargePaise),
          0,
        )
      : this.nonNegativeInt(
          this.numberSetting(settingMap.get(settingKeys.shippingDefaultChargePaise), 0),
        );
    const platformFeeEnabled = this.booleanSetting(settingMap.get(settingKeys.platformFeeEnabled), false);
    const platformFeeType = this.platformFeeType(settingMap.get(settingKeys.platformFeeType));
    const platformFeeValueBps = this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.platformFeeValueBps), 0));
    const platformFeeFixedPaise = this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.platformFeeFixedPaise), 0));
    const platformFeePaise = platformFeeEnabled
      ? this.calculatePlatformFee(normalizedSubtotal, platformFeeType, platformFeeValueBps, platformFeeFixedPaise)
      : 0;
    const shipmentSnapshots = deliveryRoutings.map((routing) => ({
      sellerId: routing.sellerId,
      sellerType: routing.sellerType,
      subtotalPaise: routing.subtotalPaise,
      shippingPaise: this.nonNegativeInt(routing.quote.shippingChargePaise),
      codSurchargePaise: this.nonNegativeInt(routing.quote.codSurchargePaise),
      deliveryMode: routing.quote.deliveryMode,
      routingFailed: routing.quote.routingFailed,
      routing: routing.quote.shippingSnapshot,
      codSurcharge: routing.quote.codSurchargeSnapshot,
      routingSnapshot: routing.quote.routingSnapshot,
    }));

    return {
      subtotalPaise: normalizedSubtotal,
      shippingPaise,
      platformFeePaise,
      totalPaise: normalizedSubtotal + shippingPaise + platformFeePaise,
      snapshot: {
        shipping: {
          key: deliveryRoutings.length ? null : settingKeys.shippingDefaultChargePaise,
          chargePaise: shippingPaise,
          shipments: shipmentSnapshots,
          discountApportionment: "Future shipping discounts are apportioned pro-rata by shipment charge.",
        },
        platformFee: {
          enabled: platformFeeEnabled,
          type: platformFeeType,
          valueBps: platformFeeValueBps,
          fixedPaise: platformFeeFixedPaise,
          amountPaise: platformFeePaise
        },
        deliveryRouting: {
          ruleVersion: "seller_type_delivery_routing_v1",
          shipments: deliveryRoutings.map((routing) => routing.quote.routingSnapshot),
        },
      },
      deliveryRouting: deliveryRoutings[0]?.quote ?? null,
      deliveryRoutings,
    };
  }

  private shouldResolveDelivery(options: CheckoutChargeDeliveryOptions) {
    return Boolean(
      options.deliveryPreference ||
        options.deliveryMode ||
        options.address ||
        options.paymentMethod ||
        options.orderId,
    );
  }

  private requireDeliveryRouting() {
    if (!this.deliveryRouting) {
      throw new BadRequestException("Delivery routing service is not available.");
    }

    return this.deliveryRouting;
  }

  private pricingSettings(client: PricingClient) {
    return client.setting.findMany({
      where: {
        key: {
          in: Object.values(settingKeys)
        }
      }
    });
  }

  private deliveryRoutingInput(options: CheckoutChargeDeliveryOptions, subtotalPaise: number) {
    return {
      ...(options.deliveryPreference !== undefined
        ? { deliveryPreference: options.deliveryPreference }
        : {}),
      ...(options.deliveryMode !== undefined ? { requestedDeliveryMode: options.deliveryMode } : {}),
      ...(options.address !== undefined ? { address: options.address } : {}),
      subtotalPaise,
      ...(options.paymentMethod !== undefined ? { paymentMethod: options.paymentMethod } : {}),
      ...(options.orderId !== undefined ? { orderId: options.orderId } : {}),
    };
  }

  private calculatePlatformFee(subtotalPaise: number, type: PlatformFeeType, valueBps: number, fixedPaise: number) {
    switch (type) {
      case "PERCENTAGE":
        return Math.round((subtotalPaise * valueBps) / 10_000);
      case "FIXED":
        return fixedPaise;
      case "MANUAL":
      default:
        return 0;
    }
  }

  private booleanSetting(value: Prisma.JsonValue | undefined, fallback: boolean) {
    return readBooleanSetting(value, fallback);
  }

  private numberSetting(value: Prisma.JsonValue | undefined, fallback: number) {
    return readNumberSetting(value, fallback);
  }

  private platformFeeType(value: Prisma.JsonValue | undefined): PlatformFeeType {
    return value === "PERCENTAGE" || value === "FIXED" || value === "MANUAL" ? value : "MANUAL";
  }

  private nonNegativeInt(value: number) {
    return Math.max(0, Math.round(value));
  }
}
