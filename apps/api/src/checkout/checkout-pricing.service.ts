import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { DeliveryMode, Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { readBooleanSetting, readNumberSetting } from "../settings/setting-value-utils";
import {
  CheckoutDeliveryPreference,
} from "./dto/delivery-routing.dto";
import {
  DeliveryRoutingAddress,
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

export type CheckoutCharges = {
  subtotalPaise: number;
  shippingPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  snapshot: Prisma.InputJsonObject;
  deliveryRouting: DeliveryRoutingQuote | null;
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
