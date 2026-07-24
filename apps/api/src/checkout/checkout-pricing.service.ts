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
const checkoutDeliveryModes = [
  DeliveryMode.LOCAL_DELIVERY_PARTNER,
  DeliveryMode.THIRD_PARTY_COURIER,
  DeliveryMode.MANUAL_TRANSPORT,
  DeliveryMode.STORE_PICKUP,
] as const;
const sellerCollectedCodDeliveryModes = new Set<DeliveryMode>([
  DeliveryMode.STORE_PICKUP,
  DeliveryMode.MANUAL_TRANSPORT,
]);
const platformVerifiedCodDeliveryModes = new Set<DeliveryMode>([
  DeliveryMode.LOCAL_DELIVERY_PARTNER,
  DeliveryMode.THIRD_PARTY_COURIER,
]);
const mixedCodCollectionModesMessage =
  "This COD cart combines seller-collected delivery and courier/partner delivery. Please place separate orders for these products.";

type PlatformFeeType = "PERCENTAGE" | "FIXED" | "MANUAL";
type PricingClient = Prisma.TransactionClient | PrismaService["client"];

export type CheckoutChargeDeliveryOptions = {
  deliveryPreference?: CheckoutDeliveryPreference | undefined;
  deliveryMode?: DeliveryMode | undefined;
  deliverySelections?: Array<{ sellerId: string; deliveryMode: DeliveryMode }> | undefined;
  address?: DeliveryRoutingAddress | null | undefined;
  paymentMethod?: string | null | undefined;
  orderId?: string | undefined;
};

export type CheckoutDeliveryOption = {
  mode: DeliveryMode;
  chargePaise: number;
  payableChargePaise?: number;
  isCheapest: boolean;
  available: boolean;
  reason: string | null;
  manualTransport?: {
    distanceKm?: number | null;
    freeDistanceKm?: number | null;
    billableKm?: number | null;
    chargePerKmMinor?: number | null;
    sellerChargeMinor?: number | null;
    sellerCurrency?: string | null;
    baseChargeMinor?: number | null;
    baseCurrency?: string | null;
    fxRate?: number | null;
    note?: string | null;
  } | null | undefined;
};

export type CheckoutSellerPackageDeliveryInput = {
  sellerId: string;
  sellerName?: string | undefined;
  sellerType: SellerType;
  subtotalPaise: number;
  allowedDeliveryModes?: DeliveryMode[] | undefined;
  items?: Array<{
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
  }> | undefined;
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
  deliveryChargePaise: number;
  codSurchargePaise: number;
  shippingPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  snapshot: Prisma.InputJsonObject;
  deliveryRouting: DeliveryRoutingQuote | null;
  deliveryRoutings?: CheckoutSellerPackageDeliveryRouting[];
  availableDeliveryOptions?: CheckoutDeliveryOption[] | undefined;
  sellerDeliveryGroups?: Array<{
    sellerId: string;
    sellerName: string;
    subtotalPaise: number;
    items: NonNullable<CheckoutSellerPackageDeliveryInput["items"]>;
    availableDeliveryOptions: CheckoutDeliveryOption[];
    selectedDeliveryMode?: DeliveryMode | undefined;
    blockedReason?: string | null;
  }> | undefined;
};

export type CheckoutCouponAdjustments = {
  merchandiseDiscountPaise?: number;
  shippingDiscountPaise?: number;
  shippingDiscountsBySeller?: Array<{
    sellerId: string;
    shippingDiscountPaise: number;
  }>;
  snapshot?: Prisma.InputJsonValue;
};

export type CheckoutAdjustedCharges = CheckoutCharges & {
  payableSubtotalPaise: number;
  payableShippingPaise: number;
  couponDiscountPaise: number;
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
    
    // Auto-resolve or requested delivery mode
    const deliveryRouting = this.shouldResolveDelivery(deliveryOptions)
      ? await this.requireDeliveryRouting().resolveDelivery(
          this.deliveryRoutingInput(deliveryOptions, normalizedSubtotal),
          client,
        )
      : null;


    const codSurchargePaise = deliveryRouting
      ? this.nonNegativeInt(deliveryRouting.codSurchargePaise)
      : 0;
    const deliveryChargePaise = deliveryRouting
      ? this.nonNegativeInt(
          deliveryRouting.shippingChargePaise ??
            deliveryRouting.totalDeliveryChargePaise - codSurchargePaise,
        )
      : this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.shippingDefaultChargePaise), 0));
    const shippingPaise = deliveryChargePaise + codSurchargePaise;
    const platformFeeEnabled = this.booleanSetting(settingMap.get(settingKeys.platformFeeEnabled), false);
    const platformFeeType = this.platformFeeType(settingMap.get(settingKeys.platformFeeType));
    const platformFeeValueBps = this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.platformFeeValueBps), 0));
    const platformFeeFixedPaise = this.nonNegativeInt(this.numberSetting(settingMap.get(settingKeys.platformFeeFixedPaise), 0));
    const platformFeePaise = platformFeeEnabled
      ? this.calculatePlatformFee(normalizedSubtotal, platformFeeType, platformFeeValueBps, platformFeeFixedPaise)
      : 0;

    return {
      subtotalPaise: normalizedSubtotal,
      deliveryChargePaise,
      codSurchargePaise,
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
      deliveryRouting,
      availableDeliveryOptions: undefined
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
    const shouldResolveDelivery = this.shouldResolveDelivery(deliveryOptions);
    const packageOptionsList = shouldResolveDelivery
      ? await Promise.all(
          sellerPackages.map(async (sellerPackage) => {
            const modes = this.selectableModesForPackage(sellerPackage, deliveryOptions);
            const selectedMode = this.selectedDeliveryModeForPackage(sellerPackage, deliveryOptions);
            if (selectedMode && !modes.includes(selectedMode)) {
              throw new BadRequestException("Selected delivery option is not enabled for one or more items.");
            }

            const options = modes.length
              ? await this.requireDeliveryRouting().resolveAllDeliveryOptions(
                  {
                    ...this.deliveryRoutingInput(
                      deliveryOptions,
                      this.nonNegativeInt(sellerPackage.subtotalPaise),
                    ),
                    sellerId: sellerPackage.sellerId,
                    sellerType: sellerPackage.sellerType,
                    package: sellerPackage.package ?? null,
                    items: sellerPackage.items ?? [],
                    deliveryPreference: undefined,
                  },
                  modes,
                  client,
                )
              : [];

            return { sellerPackage, options, selectedMode };
          }),
        )
      : [];
    const sellerDeliveryGroups = shouldResolveDelivery
      ? packageOptionsList.map(({ sellerPackage, options, selectedMode }) => {
          const availableDeliveryOptions = this.deliveryOptionsReadback(options);
          return {
            sellerId: sellerPackage.sellerId,
            sellerName: sellerPackage.sellerName ?? "Seller",
            subtotalPaise: this.nonNegativeInt(sellerPackage.subtotalPaise),
            items: sellerPackage.items ?? [],
            availableDeliveryOptions,
            ...(selectedMode ? { selectedDeliveryMode: selectedMode } : {}),
            blockedReason: availableDeliveryOptions.some((option) => option.available)
              ? null
              : "Delivery is not available for this seller package.",
          };
        })
      : undefined;
    const availableDeliveryOptions = shouldResolveDelivery
      ? this.aggregateDeliveryOptions(packageOptionsList)
      : undefined;
    const deliveryRoutings = shouldResolveDelivery
      ? packageOptionsList.map(({ sellerPackage, options, selectedMode }) => {
          const selectedOption = this.selectedDeliveryOption(options, selectedMode);
          if (!selectedOption) {
            throw new BadRequestException("Delivery is not available for one or more seller packages.");
          }

          return {
            sellerId: sellerPackage.sellerId,
            sellerType: sellerPackage.sellerType,
            subtotalPaise: this.nonNegativeInt(sellerPackage.subtotalPaise),
            quote: selectedOption.quote,
          } satisfies CheckoutSellerPackageDeliveryRouting;
        })
      : [];
    this.assertSupportedCodCollectionMix(deliveryRoutings, deliveryOptions.paymentMethod);
    const deliveryChargePaise = deliveryRoutings.length
      ? deliveryRoutings.reduce(
          (total, routing) => total + this.nonNegativeInt(routing.quote.shippingChargePaise),
          0,
        )
      : this.nonNegativeInt(
          this.numberSetting(settingMap.get(settingKeys.shippingDefaultChargePaise), 0),
        );
    const codSurchargePaise = deliveryRoutings.reduce(
      (total, routing) => total + this.nonNegativeInt(routing.quote.codSurchargePaise),
      0,
    );
    const shippingPaise = deliveryChargePaise + codSurchargePaise;
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
      deliveryChargePaise,
      codSurchargePaise,
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
      availableDeliveryOptions,
      sellerDeliveryGroups,
    };
  }

  private assertSupportedCodCollectionMix(
    deliveryRoutings: CheckoutSellerPackageDeliveryRouting[],
    paymentMethod?: string | null,
  ) {
    if (paymentMethod?.trim().toUpperCase() !== "COD" || deliveryRoutings.length < 2) {
      return;
    }

    const deliveryModes = deliveryRoutings.map((routing) => routing.quote.deliveryMode);
    const hasSellerCollectedMode = deliveryModes.some((mode) => sellerCollectedCodDeliveryModes.has(mode));
    const hasPlatformVerifiedMode = deliveryModes.some((mode) => platformVerifiedCodDeliveryModes.has(mode));
    if (hasSellerCollectedMode && hasPlatformVerifiedMode) {
      throw new BadRequestException(mixedCodCollectionModesMessage);
    }
  }

  async applyCouponAdjustments(
    charges: CheckoutCharges,
    client: PricingClient = this.prisma.client,
    adjustments: CheckoutCouponAdjustments = {},
  ): Promise<CheckoutAdjustedCharges> {
    const merchandiseDiscountPaise = Math.min(
      this.nonNegativeInt(adjustments.merchandiseDiscountPaise ?? 0),
      charges.subtotalPaise,
    );
    const shippingDiscountPaise = Math.min(
      this.nonNegativeInt(adjustments.shippingDiscountPaise ?? 0),
      charges.deliveryChargePaise,
    );
    const payableSubtotalPaise = this.nonNegativeInt(
      charges.subtotalPaise - merchandiseDiscountPaise,
    );
    const payableDeliveryChargePaise = this.nonNegativeInt(
      charges.deliveryChargePaise - shippingDiscountPaise,
    );
    const payableShippingPaise = payableDeliveryChargePaise + charges.codSurchargePaise;
    const shippingDiscountsBySeller = new Map(
      (adjustments.shippingDiscountsBySeller ?? []).map((item) => [
        item.sellerId,
        this.nonNegativeInt(item.shippingDiscountPaise),
      ]),
    );
    const selectedModeBySeller = new Map(
      (charges.deliveryRoutings ?? []).map((routing) => [
        routing.sellerId,
        routing.quote.deliveryMode,
      ]),
    );
    const sellerDeliveryGroups = charges.sellerDeliveryGroups?.map((group) => {
      const selectedMode = selectedModeBySeller.get(group.sellerId) ?? group.selectedDeliveryMode;
      const sellerDiscountPaise = shippingDiscountsBySeller.get(group.sellerId) ?? 0;
      return {
        ...group,
        availableDeliveryOptions: group.availableDeliveryOptions.map((option) =>
          option.mode === selectedMode
            ? {
                ...option,
                payableChargePaise: this.nonNegativeInt(
                  option.chargePaise - sellerDiscountPaise,
                ),
              }
            : option,
        ),
      };
    });
    const selectedModes = new Set(
      (charges.deliveryRoutings ?? []).map((routing) => routing.quote.deliveryMode),
    );
    const selectedAggregateMode = selectedModes.size === 1 ? [...selectedModes][0] : undefined;
    const availableDeliveryOptions = charges.availableDeliveryOptions?.map((option) =>
      option.mode === selectedAggregateMode
        ? {
            ...option,
            payableChargePaise: this.nonNegativeInt(
              option.chargePaise - shippingDiscountPaise,
            ),
          }
        : option,
    );
    const settings = await this.pricingSettings(client);
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const platformFeeEnabled = this.booleanSetting(settingMap.get(settingKeys.platformFeeEnabled), false);
    const platformFeeType = this.platformFeeType(settingMap.get(settingKeys.platformFeeType));
    const platformFeeValueBps = this.nonNegativeInt(
      this.numberSetting(settingMap.get(settingKeys.platformFeeValueBps), 0),
    );
    const platformFeeFixedPaise = this.nonNegativeInt(
      this.numberSetting(settingMap.get(settingKeys.platformFeeFixedPaise), 0),
    );
    const platformFeePaise = platformFeeEnabled
      ? this.calculatePlatformFee(
          payableSubtotalPaise,
          platformFeeType,
          platformFeeValueBps,
          platformFeeFixedPaise,
        )
      : 0;

    return {
      ...charges,
      deliveryChargePaise: payableDeliveryChargePaise,
      shippingPaise: payableShippingPaise,
      platformFeePaise,
      totalPaise: payableSubtotalPaise + payableShippingPaise + platformFeePaise,
      payableSubtotalPaise,
      payableShippingPaise,
      couponDiscountPaise: merchandiseDiscountPaise + shippingDiscountPaise,
      availableDeliveryOptions,
      sellerDeliveryGroups,
      snapshot: {
        ...this.jsonObject(charges.snapshot),
        coupon: {
          merchandiseDiscountPaise,
          shippingDiscountPaise,
          totalDiscountPaise: merchandiseDiscountPaise + shippingDiscountPaise,
          subtotalBeforeCouponPaise: charges.subtotalPaise,
          subtotalAfterCouponPaise: payableSubtotalPaise,
          shippingBeforeCouponPaise: charges.shippingPaise,
          shippingAfterCouponPaise: payableShippingPaise,
          platformFeeBasePaise: payableSubtotalPaise,
          couponSnapshot: adjustments.snapshot ?? null,
        },
        platformFee: {
          enabled: platformFeeEnabled,
          type: platformFeeType,
          valueBps: platformFeeValueBps,
          fixedPaise: platformFeeFixedPaise,
          amountPaise: platformFeePaise,
          basePaise: payableSubtotalPaise,
        },
      },
    };
  }

  private shouldResolveDelivery(options: CheckoutChargeDeliveryOptions) {
    return Boolean(
      options.deliveryPreference ||
        options.deliveryMode ||
        options.deliverySelections?.length ||
        options.address ||
        options.paymentMethod ||
        options.orderId,
    );
  }

  private selectableModesForPackage(
    sellerPackage: CheckoutSellerPackageDeliveryInput,
    options: CheckoutChargeDeliveryOptions,
  ) {
    const allowedModes = sellerPackage.allowedDeliveryModes?.length
      ? sellerPackage.allowedDeliveryModes
      : [...checkoutDeliveryModes];

    if (options.deliveryPreference === CheckoutDeliveryPreference.STORE_PICKUP) {
      return allowedModes.filter((mode) => mode === DeliveryMode.STORE_PICKUP);
    }

    if (options.deliveryPreference === CheckoutDeliveryPreference.DELIVER_TO_ADDRESS) {
      return allowedModes.filter((mode) => mode !== DeliveryMode.STORE_PICKUP);
    }

    if (sellerPackage.allowedDeliveryModes !== undefined || options.deliverySelections?.length) {
      return allowedModes;
    }

    return allowedModes;
  }

  private selectedDeliveryModeForPackage(
    sellerPackage: CheckoutSellerPackageDeliveryInput,
    options: CheckoutChargeDeliveryOptions,
  ) {
    return (
      options.deliverySelections?.find((selection) => selection.sellerId === sellerPackage.sellerId)
        ?.deliveryMode ?? options.deliveryMode
    );
  }

  private deliveryOptionsReadback(
    options: Array<{ mode: DeliveryMode; quote: DeliveryRoutingQuote }>,
  ): CheckoutDeliveryOption[] {
    const mappedOptions = options.map((option) => ({
      mode: option.mode,
      chargePaise: this.nonNegativeInt(option.quote.totalDeliveryChargePaise),
      available: !option.quote.routingFailed,
      reason: option.quote.routingFailed
        ? option.quote.routingFailureNote ?? "Delivery unavailable"
        : null,
      manualTransport: this.manualTransportReadback(option.quote),
      isCheapest: false,
    }));
    const availableOptions = mappedOptions.filter((option) => option.available);
    const minCharge = availableOptions.length
      ? Math.min(...availableOptions.map((option) => option.chargePaise))
      : null;

    return mappedOptions.map((option) => ({
      ...option,
      isCheapest: option.available && option.chargePaise === minCharge,
    }));
  }

  private aggregateDeliveryOptions(
    packageOptionsList: Array<{
      options: Array<{ mode: DeliveryMode; quote: DeliveryRoutingQuote }>;
    }>,
  ): CheckoutDeliveryOption[] {
    const mappedOptions = checkoutDeliveryModes.map((mode) => {
      let chargePaise = 0;
      let available = true;
      let reason: string | null = null;

      for (const packageOptions of packageOptionsList) {
        const option = packageOptions.options.find((item) => item.mode === mode);
        if (!option || option.quote.routingFailed) {
          available = false;
          reason =
            option?.quote.routingFailureNote ??
            "Delivery option is not enabled for every seller package.";
          break;
        }

        chargePaise += this.nonNegativeInt(option.quote.totalDeliveryChargePaise);
      }

      return { mode, chargePaise, available, reason, isCheapest: false };
    });
    const availableOptions = mappedOptions.filter((option) => option.available);
    const minCharge = availableOptions.length
      ? Math.min(...availableOptions.map((option) => option.chargePaise))
      : null;

    return mappedOptions.map((option) => ({
      ...option,
      isCheapest: option.available && option.chargePaise === minCharge,
    }));
  }

  private selectedDeliveryOption(
    options: Array<{ mode: DeliveryMode; quote: DeliveryRoutingQuote }>,
    selectedMode?: DeliveryMode,
  ) {
    if (selectedMode) {
      const selected = options.find((option) => option.mode === selectedMode);
      return selected && !selected.quote.routingFailed ? selected : undefined;
    }

    const availableOptions = options.filter((option) => !option.quote.routingFailed);
    return [...availableOptions].sort(
      (left, right) =>
        this.nonNegativeInt(left.quote.totalDeliveryChargePaise) -
        this.nonNegativeInt(right.quote.totalDeliveryChargePaise),
    )[0];
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

  private manualTransportReadback(quote: DeliveryRoutingQuote): CheckoutDeliveryOption["manualTransport"] {
    if (quote.deliveryMode !== DeliveryMode.MANUAL_TRANSPORT) {
      return null;
    }
    const snapshot = this.jsonObject(quote.routingSnapshot);
    const manual = this.jsonObject(snapshot.manualTransport as Prisma.InputJsonValue);

    return {
      distanceKm: typeof manual.distanceKm === "number" ? manual.distanceKm : null,
      freeDistanceKm: typeof manual.freeDistanceKm === "number" ? manual.freeDistanceKm : null,
      billableKm: typeof manual.billableKm === "number" ? manual.billableKm : null,
      chargePerKmMinor: typeof manual.chargePerKmMinor === "number" ? manual.chargePerKmMinor : null,
      sellerChargeMinor: typeof manual.sellerChargeMinor === "number" ? manual.sellerChargeMinor : null,
      sellerCurrency: typeof manual.sellerCurrency === "string" ? manual.sellerCurrency : null,
      baseChargeMinor: typeof manual.baseChargeMinor === "number" ? manual.baseChargeMinor : null,
      baseCurrency: typeof manual.baseCurrency === "string" ? manual.baseCurrency : null,
      fxRate: typeof manual.fxRate === "number" ? manual.fxRate : null,
      note: typeof manual.note === "string" ? manual.note : null,
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
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  private jsonObject(value: Prisma.InputJsonValue): Prisma.InputJsonObject {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Prisma.InputJsonObject;
    }

    return {};
  }
}
