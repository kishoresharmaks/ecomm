import { Prisma } from "@indihub/database";
import { readBooleanSetting, readNumberSetting } from "./setting-value-utils";

export const gstSettingGroup = "gst";

export const gstSettingKeys = {
  legalName: "gst.platform.legal_name",
  gstin: "gst.platform.gstin",
  stateCode: "gst.platform.state_code",
  address: "gst.platform.address",
  eInvoiceEnabled: "gst.einvoice.enabled",
  eInvoiceProvider: "gst.einvoice.provider",
  eWayBillEnabled: "gst.eway.enabled",
  eWayBillProvider: "gst.eway.provider",
  eWayBillThresholdPaise: "gst.eway.threshold_paise",
} as const;

export type GstPlatformAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: "India";
};

export type GstSettings = {
  platform: {
    legalName: string;
    gstin: string;
    stateCode: string;
    address: GstPlatformAddress;
  };
  eInvoice: {
    enabled: boolean;
    provider: "MANUAL";
  };
  eWayBill: {
    enabled: boolean;
    provider: "MANUAL";
    thresholdPaise: number;
  };
};

type SettingReader = {
  setting?: {
    findMany(args: Prisma.SettingFindManyArgs): Promise<
      Array<{ key: string; value: Prisma.JsonValue }>
    >;
  };
};

export async function readGstSettings(client: SettingReader): Promise<GstSettings> {
  if (!client.setting) {
    return normalizeGstSettings({
      platform: {
        legalName: "",
        gstin: "",
        stateCode: "",
        address: {
          line1: "",
          line2: "",
          city: "",
          state: "",
          postalCode: "",
          country: "India",
        },
      },
      eInvoice: { enabled: false, provider: "MANUAL" },
      eWayBill: {
        enabled: false,
        provider: "MANUAL",
        thresholdPaise: 5_000_000,
      },
    });
  }
  const settings = await client.setting.findMany({
    where: { key: { in: Object.values(gstSettingKeys) } },
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const addressValue = values.get(gstSettingKeys.address);
  const address =
    addressValue && typeof addressValue === "object" && !Array.isArray(addressValue)
      ? addressValue
      : {};

  return normalizeGstSettings({
    platform: {
      legalName: stringValue(values.get(gstSettingKeys.legalName)),
      gstin: stringValue(values.get(gstSettingKeys.gstin)),
      stateCode: stringValue(values.get(gstSettingKeys.stateCode)),
      address: {
        line1: stringValue(address.line1),
        line2: stringValue(address.line2),
        city: stringValue(address.city),
        state: stringValue(address.state),
        postalCode: stringValue(address.postalCode),
        country: "India",
      },
    },
    eInvoice: {
      enabled: readBooleanSetting(values.get(gstSettingKeys.eInvoiceEnabled), false),
      provider: "MANUAL",
    },
    eWayBill: {
      enabled: readBooleanSetting(values.get(gstSettingKeys.eWayBillEnabled), false),
      provider: "MANUAL",
      thresholdPaise: readNumberSetting(
        values.get(gstSettingKeys.eWayBillThresholdPaise),
        5_000_000,
      ),
    },
  });
}

export function normalizeGstSettings(input: GstSettings): GstSettings {
  return {
    platform: {
      legalName: normalizedText(input.platform.legalName),
      gstin: input.platform.gstin.trim().toUpperCase(),
      stateCode: input.platform.stateCode.trim(),
      address: {
        line1: normalizedText(input.platform.address.line1),
        line2: normalizedText(input.platform.address.line2),
        city: normalizedText(input.platform.address.city),
        state: normalizedText(input.platform.address.state),
        postalCode: input.platform.address.postalCode.trim(),
        country: "India",
      },
    },
    eInvoice: {
      enabled: Boolean(input.eInvoice.enabled),
      provider: "MANUAL",
    },
    eWayBill: {
      enabled: Boolean(input.eWayBill.enabled),
      provider: "MANUAL",
      thresholdPaise: Math.max(0, Math.round(input.eWayBill.thresholdPaise)),
    },
  };
}

export function isConfiguredPlatformGst(settings: GstSettings) {
  const { platform } = settings;
  return Boolean(
    platform.legalName &&
      validGstin(platform.gstin) &&
      platform.stateCode &&
      platform.gstin.slice(0, 2) === platform.stateCode &&
      platform.address.line1 &&
      platform.address.city &&
      platform.address.state &&
      platform.address.postalCode,
  );
}

export function validGstin(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value.trim().toUpperCase(),
  );
}

function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function stringValue(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" ? value : "";
}
