import { Prisma } from "@indihub/database";

export const contactSettingKey = "contact.public_config";
export const contactSettingGroup = "contact";

export type ContactChannelCode = "EMAIL" | "PHONE" | "WHATSAPP";

export type ContactSettingsConfig = {
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  whatsappUrl: string;
  businessAddress: string;
  workingHours: string;
  responseSla: string;
  mapUrl: string;
  enableEmail: boolean;
  enablePhone: boolean;
  enableWhatsapp: boolean;
  enableAddress: boolean;
  enableMap: boolean;
};

export type PublicContactConfig = ContactSettingsConfig & {
  enabledChannels: ContactChannelCode[];
  whatsappLink: string;
};

export const defaultContactSettings: ContactSettingsConfig = {
  supportEmail: "support@1handindia.com",
  supportPhone: "",
  whatsappNumber: "",
  whatsappUrl: "",
  businessAddress: "",
  workingHours: "Monday to Saturday, 10:00 AM - 6:00 PM IST",
  responseSla: "We usually respond within 1 business day.",
  mapUrl: "",
  enableEmail: true,
  enablePhone: false,
  enableWhatsapp: false,
  enableAddress: false,
  enableMap: false,
};

export function normalizeContactSettings(input: unknown): ContactSettingsConfig {
  const record = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

  return {
    supportEmail: trimmed(record.supportEmail) || defaultContactSettings.supportEmail,
    supportPhone: trimmed(record.supportPhone),
    whatsappNumber: trimmed(record.whatsappNumber),
    whatsappUrl: safeUrl(record.whatsappUrl),
    businessAddress: trimmed(record.businessAddress),
    workingHours: trimmed(record.workingHours) || defaultContactSettings.workingHours,
    responseSla: trimmed(record.responseSla) || defaultContactSettings.responseSla,
    mapUrl: safeUrl(record.mapUrl),
    enableEmail: booleanValue(record.enableEmail, defaultContactSettings.enableEmail),
    enablePhone: booleanValue(record.enablePhone, defaultContactSettings.enablePhone),
    enableWhatsapp: booleanValue(record.enableWhatsapp, defaultContactSettings.enableWhatsapp),
    enableAddress: booleanValue(record.enableAddress, defaultContactSettings.enableAddress),
    enableMap: booleanValue(record.enableMap, defaultContactSettings.enableMap),
  };
}

export function contactSettingsFromSetting(
  setting?: { value?: Prisma.JsonValue | null } | null,
): ContactSettingsConfig {
  return normalizeContactSettings(setting?.value ?? defaultContactSettings);
}

export function publicContactConfig(config: ContactSettingsConfig): PublicContactConfig {
  const whatsappLink = config.whatsappUrl || whatsappNumberLink(config.whatsappNumber);
  const enabledChannels: ContactChannelCode[] = [];

  if (config.enableEmail && config.supportEmail) {
    enabledChannels.push("EMAIL");
  }
  if (config.enablePhone && config.supportPhone) {
    enabledChannels.push("PHONE");
  }
  if (config.enableWhatsapp && (config.whatsappNumber || whatsappLink)) {
    enabledChannels.push("WHATSAPP");
  }

  return {
    ...config,
    whatsappLink,
    enabledChannels,
    businessAddress: config.enableAddress ? config.businessAddress : "",
    mapUrl: config.enableMap ? config.mapUrl : "",
  };
}

export function adminContactConfig(config: ContactSettingsConfig): PublicContactConfig {
  const storefrontConfig = publicContactConfig(config);
  return {
    ...config,
    whatsappLink: storefrontConfig.whatsappLink,
    enabledChannels: storefrontConfig.enabledChannels,
  };
}

function trimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeUrl(value: unknown) {
  const candidate = trimmed(value);
  if (!candidate) {
    return "";
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? candidate : "";
  } catch {
    return "";
  }
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") {
      return true;
    }
    if (lowered === "false") {
      return false;
    }
  }
  return fallback;
}

function whatsappNumberLink(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}
