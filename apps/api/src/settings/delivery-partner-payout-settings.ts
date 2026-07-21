import { Prisma } from "@indihub/database";
import { readBooleanSetting, readNumberSetting } from "./setting-value-utils";

export const deliveryPartnerPayoutSettingGroup = "delivery_partner_payouts";

export const deliveryPartnerPayoutSettingKeys = {
  minimumPerOrderPaise: "delivery_partner.payout.minimum_per_order_paise",
  includedDistanceKm: "delivery_partner.payout.included_distance_km",
  basePayPaise: "delivery_partner.payout.base_pay_paise",
  perKmPaise: "delivery_partner.payout.per_km_paise",
  codBonusPaise: "delivery_partner.payout.cod_bonus_paise",
  reversePickupBasePayPaise: "delivery_partner.payout.reverse_pickup_base_pay_paise",
  reversePickupCostBearer: "delivery_partner.payout.reverse_pickup_cost_bearer",
  minimumWalletPayoutPaise: "delivery_partner.payout.minimum_wallet_payout_paise",
  requestsEnabled: "delivery_partner.payout.requests_enabled",
  freeDeliveryPlatformSubsidyEnabled:
    "delivery_partner.payout.free_delivery_platform_subsidy_enabled",
} as const;

export type DeliveryPartnerPayoutSettings = {
  minimumPerOrderPaise: number;
  includedDistanceKm: number;
  basePayPaise: number;
  perKmPaise: number;
  codBonusPaise: number;
  reversePickupBasePayPaise: number;
  reversePickupCostBearer: "MARKETPLACE" | "SELLER";
  minimumWalletPayoutPaise: number;
  requestsEnabled: boolean;
  freeDeliveryPlatformSubsidyEnabled: boolean;
};

export const defaultDeliveryPartnerPayoutSettings: DeliveryPartnerPayoutSettings = {
  minimumPerOrderPaise: 4_000,
  includedDistanceKm: 3,
  basePayPaise: 2_500,
  perKmPaise: 800,
  codBonusPaise: 500,
  reversePickupBasePayPaise: 4_000,
  reversePickupCostBearer: "MARKETPLACE",
  minimumWalletPayoutPaise: 100_000,
  requestsEnabled: true,
  freeDeliveryPlatformSubsidyEnabled: true,
};

type SettingLike = {
  key: string;
  value: Prisma.JsonValue;
};

type SettingReader = {
  setting: {
    findMany(args: Prisma.SettingFindManyArgs): Promise<SettingLike[]>;
  };
};

export async function readDeliveryPartnerPayoutSettings(
  client: SettingReader,
): Promise<DeliveryPartnerPayoutSettings> {
  const settings = await client.setting.findMany({
    where: {
      key: {
        in: Object.values(deliveryPartnerPayoutSettingKeys),
      },
    },
  });
  return normalizeDeliveryPartnerPayoutSettings(settings);
}

export function normalizeDeliveryPartnerPayoutSettings(
  settings: SettingLike[],
): DeliveryPartnerPayoutSettings {
  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    minimumPerOrderPaise: nonNegativeInt(
      readNumberSetting(
        settingMap.get(deliveryPartnerPayoutSettingKeys.minimumPerOrderPaise),
        defaultDeliveryPartnerPayoutSettings.minimumPerOrderPaise,
      ),
    ),
    includedDistanceKm: nonNegativeInt(
      readNumberSetting(
        settingMap.get(deliveryPartnerPayoutSettingKeys.includedDistanceKm),
        defaultDeliveryPartnerPayoutSettings.includedDistanceKm,
      ),
    ),
    basePayPaise: nonNegativeInt(
      readNumberSetting(
        settingMap.get(deliveryPartnerPayoutSettingKeys.basePayPaise),
        defaultDeliveryPartnerPayoutSettings.basePayPaise,
      ),
    ),
    perKmPaise: nonNegativeInt(
      readNumberSetting(
        settingMap.get(deliveryPartnerPayoutSettingKeys.perKmPaise),
        defaultDeliveryPartnerPayoutSettings.perKmPaise,
      ),
    ),
    codBonusPaise: nonNegativeInt(
      readNumberSetting(
        settingMap.get(deliveryPartnerPayoutSettingKeys.codBonusPaise),
        defaultDeliveryPartnerPayoutSettings.codBonusPaise,
      ),
    ),
    reversePickupBasePayPaise: nonNegativeInt(
      readNumberSetting(
        settingMap.get(deliveryPartnerPayoutSettingKeys.reversePickupBasePayPaise),
        defaultDeliveryPartnerPayoutSettings.reversePickupBasePayPaise,
      ),
    ),
    reversePickupCostBearer:
      settingMap.get(deliveryPartnerPayoutSettingKeys.reversePickupCostBearer) === "SELLER"
        ? "SELLER"
        : "MARKETPLACE",
    minimumWalletPayoutPaise: nonNegativeInt(
      readNumberSetting(
        settingMap.get(deliveryPartnerPayoutSettingKeys.minimumWalletPayoutPaise),
        defaultDeliveryPartnerPayoutSettings.minimumWalletPayoutPaise,
      ),
    ),
    requestsEnabled: readBooleanSetting(
      settingMap.get(deliveryPartnerPayoutSettingKeys.requestsEnabled),
      defaultDeliveryPartnerPayoutSettings.requestsEnabled,
    ),
    freeDeliveryPlatformSubsidyEnabled: readBooleanSetting(
      settingMap.get(deliveryPartnerPayoutSettingKeys.freeDeliveryPlatformSubsidyEnabled),
      defaultDeliveryPartnerPayoutSettings.freeDeliveryPlatformSubsidyEnabled,
    ),
  };
}

function nonNegativeInt(value: number) {
  return Math.max(0, Math.round(value));
}
