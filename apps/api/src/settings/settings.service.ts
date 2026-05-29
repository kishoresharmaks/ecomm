import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma, SettingValueType } from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import {
  SettingsQueryDto,
  UpsertCheckoutPlatformFeeDto,
  UpsertEmailSettingDto,
  UpsertSettingDto,
} from "./dto/settings.dto";
import {
  normalizeTypedSettingValue,
  readBooleanSetting,
  readNumberSetting,
} from "./setting-value-utils";

const DEFAULT_EMAIL_SETTING_ID = "00000000-0000-0000-0000-000000000001";
const sensitiveSettingPatterns = [/secret/i, /key_secret/i, /password/i, /token/i];
const checkoutPlatformFeeKeys = {
  enabled: "checkout.platform_fee.enabled",
  type: "checkout.platform_fee.type",
  valueBps: "checkout.platform_fee.value_bps",
  fixedPaise: "checkout.platform_fee.fixed_paise",
} as const;

type CheckoutPlatformFeeType = "PERCENTAGE" | "FIXED" | "MANUAL";
type SettingLike = {
  key: string;
  group: string;
  valueType: string;
  value: Prisma.JsonValue;
};
type EmailProviderConfig = {
  brevoApiKey?: string;
  resendApiKey?: string;
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  smtpBridgeUrl?: string;
};
type EmailSettingLike = {
  id: string;
  provider: string;
  senderName: string;
  senderEmail: string;
  adminRecipients?: string | null;
  isEnabled: boolean;
  providerConfig?: Prisma.JsonValue | null;
  updatedAt?: Date;
};

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSettings(query: SettingsQueryDto) {
    const settings = await this.prisma.client.setting.findMany({
      where: {
        ...(query.group ? { group: query.group } : {}),
      },
      orderBy: [{ group: "asc" }, { key: "asc" }],
    });

    return settings.map((setting) => this.sanitizeSetting(setting));
  }

  async getCheckoutPlatformFee() {
    const settings = await this.prisma.client.setting.findMany({
      where: {
        key: {
          in: Object.values(checkoutPlatformFeeKeys),
        },
      },
    });

    return this.checkoutPlatformFeeAuditValue(settings);
  }

  async upsertSetting(actor: RequestUser, key: string, dto: UpsertSettingDto) {
    const existing = await this.prisma.client.setting.findUnique({ where: { key } });
    const value = dto.value as Prisma.InputJsonValue;
    const setting = await this.prisma.client.setting.upsert({
      where: { key },
      update: {
        value,
        valueType: dto.valueType,
        group: dto.group,
      },
      create: {
        key,
        value,
        valueType: dto.valueType,
        group: dto.group,
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: existing ? "settings.updated" : "settings.created",
        entityType: "setting",
        entityId: setting.id,
        ...(existing ? { oldValue: this.settingAuditValue(existing) } : {}),
        newValue: this.settingAuditValue(setting),
      },
    });

    return this.sanitizeSetting(setting);
  }

  async upsertCheckoutPlatformFee(actor: RequestUser, dto: UpsertCheckoutPlatformFeeDto) {
    const normalized = {
      enabled: dto.enabled,
      type: dto.type,
      valueBps: this.nonNegativeInt(dto.valueBps),
      fixedPaise: this.nonNegativeInt(dto.fixedPaise),
    };
    const writes = [
      this.settingWrite(
        checkoutPlatformFeeKeys.enabled,
        "checkout",
        SettingValueType.BOOLEAN,
        normalized.enabled,
      ),
      this.settingWrite(
        checkoutPlatformFeeKeys.type,
        "checkout",
        SettingValueType.STRING,
        normalized.type,
      ),
      this.settingWrite(
        checkoutPlatformFeeKeys.valueBps,
        "checkout",
        SettingValueType.NUMBER,
        normalized.valueBps,
      ),
      this.settingWrite(
        checkoutPlatformFeeKeys.fixedPaise,
        "checkout",
        SettingValueType.NUMBER,
        normalized.fixedPaise,
      ),
    ];

    const settings = await this.prisma.client.$transaction(async (tx) => {
      const before = await tx.setting.findMany({
        where: {
          key: {
            in: Object.values(checkoutPlatformFeeKeys),
          },
        },
      });
      const updatedSettings = [];

      for (const write of writes) {
        const setting = await tx.setting.upsert({
          where: { key: write.key },
          update: {
            value: write.value,
            valueType: write.valueType,
            group: write.group,
          },
          create: write,
        });
        updatedSettings.push(setting);
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "settings.checkout_platform_fee.updated",
          entityType: "checkout_platform_fee",
          oldValue: this.checkoutPlatformFeeAuditValue(before),
          newValue: {
            enabled: normalized.enabled,
            type: normalized.type,
            valueBps: normalized.valueBps,
            fixedPaise: normalized.fixedPaise,
          },
        },
      });

      return updatedSettings;
    });

    return {
      ...normalized,
      settings: settings.map((setting) => this.sanitizeSetting(setting)),
    };
  }

  async getEmailSetting() {
    const setting = await this.ensureEmailSetting();
    return this.emailSettingReadback(setting);
  }

  private ensureEmailSetting() {
    return this.prisma.client.emailSetting.upsert({
      where: { id: DEFAULT_EMAIL_SETTING_ID },
      update: {},
      create: {
        id: DEFAULT_EMAIL_SETTING_ID,
        provider: "smtp",
        senderName: "1HandIndia",
        senderEmail: "no-reply@example.com",
        adminRecipients: null,
        isEnabled: false,
        providerConfig: {},
      },
    });
  }

  async upsertEmailSetting(actor: RequestUser, dto: UpsertEmailSettingDto) {
    const existing = await this.ensureEmailSetting();
    const provider = dto.provider.toLowerCase();
    const providerConfig = this.normalizeEmailProviderConfig(
      dto.providerConfig,
      this.emailProviderConfig(existing.providerConfig),
    );
    const adminRecipients = this.normalizeEmailRecipients(
      dto.adminRecipients,
      existing.adminRecipients,
    );
    this.assertEmailProviderConfig(provider, dto.isEnabled ?? false, providerConfig);

    const setting = await this.prisma.client.emailSetting.update({
      where: { id: DEFAULT_EMAIL_SETTING_ID },
      data: {
        provider,
        senderName: dto.senderName,
        senderEmail: dto.senderEmail,
        adminRecipients,
        isEnabled: dto.isEnabled ?? false,
        providerConfig: providerConfig as Prisma.InputJsonObject,
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "settings.email.updated",
        entityType: "email_setting",
        entityId: setting.id,
        oldValue: this.emailSettingAuditValue(existing),
        newValue: this.emailSettingAuditValue(setting),
      },
    });

    return this.emailSettingReadback(setting);
  }

  private settingAuditValue(setting: {
    key: string;
    group: string;
    valueType: string;
    value: Prisma.JsonValue;
  }): Prisma.InputJsonObject {
    return {
      key: setting.key,
      group: setting.group,
      valueType: setting.valueType,
      value: this.isSensitiveSettingKey(setting.key)
        ? "[secret configured]"
        : (setting.value as Prisma.InputJsonValue),
    };
  }

  private checkoutPlatformFeeAuditValue(settings: SettingLike[]): Prisma.InputJsonObject {
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      enabled: this.booleanSetting(settingMap.get(checkoutPlatformFeeKeys.enabled), false),
      type: this.platformFeeType(settingMap.get(checkoutPlatformFeeKeys.type)),
      valueBps: this.numberSetting(settingMap.get(checkoutPlatformFeeKeys.valueBps), 0),
      fixedPaise: this.numberSetting(settingMap.get(checkoutPlatformFeeKeys.fixedPaise), 0),
    };
  }

  private sanitizeSetting<
    T extends { key: string; value: Prisma.JsonValue; valueType: SettingValueType | string },
  >(setting: T) {
    if (!this.isSensitiveSettingKey(setting.key)) {
      return {
        ...setting,
        value: normalizeTypedSettingValue(setting.valueType, setting.value),
      };
    }

    return {
      ...setting,
      value: typeof setting.value === "string" && setting.value ? "[secret configured]" : "",
    };
  }

  private isSensitiveSettingKey(key: string) {
    return sensitiveSettingPatterns.some((pattern) => pattern.test(key));
  }

  private settingWrite(
    key: string,
    group: string,
    valueType: SettingValueType,
    value: Prisma.InputJsonValue,
  ) {
    return {
      key,
      group,
      valueType,
      value,
    };
  }

  private booleanSetting(value: Prisma.JsonValue | undefined, fallback: boolean) {
    return readBooleanSetting(value, fallback);
  }

  private numberSetting(value: Prisma.JsonValue | undefined, fallback: number) {
    return readNumberSetting(value, fallback);
  }

  private platformFeeType(value: Prisma.JsonValue | undefined): CheckoutPlatformFeeType {
    return value === "PERCENTAGE" || value === "FIXED" || value === "MANUAL" ? value : "PERCENTAGE";
  }

  private nonNegativeInt(value: number) {
    return Math.max(0, Math.round(value));
  }

  private emailProviderConfig(value: Prisma.JsonValue | null | undefined): EmailProviderConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const input = value as Record<string, unknown>;
    const config: EmailProviderConfig = {};
    const brevoApiKey = this.secretValue(input.brevoApiKey);
    const resendApiKey = this.secretValue(input.resendApiKey);
    const sendgridApiKey = this.secretValue(input.sendgridApiKey);
    const smtpHost = this.trimmedString(input.smtpHost);
    const smtpPort = this.portValue(input.smtpPort);
    const smtpUsername = this.trimmedString(input.smtpUsername);
    const smtpPassword = this.secretValue(input.smtpPassword);
    const smtpSecure = this.booleanValue(input.smtpSecure);
    const smtpBridgeUrl = this.safeUrlValue(input.smtpBridgeUrl);

    if (brevoApiKey) {
      config.brevoApiKey = brevoApiKey;
    }

    if (resendApiKey) {
      config.resendApiKey = resendApiKey;
    }

    if (sendgridApiKey) {
      config.sendgridApiKey = sendgridApiKey;
    }

    if (smtpHost) {
      config.smtpHost = smtpHost;
    }

    if (smtpPort) {
      config.smtpPort = smtpPort;
    }

    if (smtpUsername) {
      config.smtpUsername = smtpUsername;
    }

    if (smtpPassword) {
      config.smtpPassword = smtpPassword;
    }

    if (smtpSecure !== undefined) {
      config.smtpSecure = smtpSecure;
    }

    if (smtpBridgeUrl) {
      config.smtpBridgeUrl = smtpBridgeUrl;
    }

    return config;
  }

  private normalizeEmailProviderConfig(
    input: UpsertEmailSettingDto["providerConfig"],
    existing: EmailProviderConfig,
  ): EmailProviderConfig {
    const next: EmailProviderConfig = { ...existing };

    this.assignSecret(next, "brevoApiKey", input?.brevoApiKey);
    this.assignSecret(next, "resendApiKey", input?.resendApiKey);
    this.assignSecret(next, "sendgridApiKey", input?.sendgridApiKey);
    this.assignSecret(next, "smtpPassword", input?.smtpPassword);

    if (input?.smtpHost !== undefined) {
      const host = this.trimmedString(input.smtpHost);
      if (host) {
        next.smtpHost = host;
      } else {
        delete next.smtpHost;
      }
    }

    if (input?.smtpPort !== undefined) {
      const port = this.portValue(input.smtpPort);
      if (port) {
        next.smtpPort = port;
      } else {
        delete next.smtpPort;
      }
    }

    if (input?.smtpUsername !== undefined) {
      const username = this.trimmedString(input.smtpUsername);
      if (username) {
        next.smtpUsername = username;
      } else {
        delete next.smtpUsername;
      }
    }

    if (input?.smtpSecure !== undefined) {
      next.smtpSecure = Boolean(input.smtpSecure);
    }

    if (input?.smtpBridgeUrl !== undefined) {
      const url = this.safeUrlValue(input.smtpBridgeUrl);
      if (url) {
        next.smtpBridgeUrl = url;
      } else {
        delete next.smtpBridgeUrl;
      }
    }

    return next;
  }

  private assignSecret(
    target: EmailProviderConfig,
    key: keyof Pick<
      EmailProviderConfig,
      "brevoApiKey" | "resendApiKey" | "sendgridApiKey" | "smtpPassword"
    >,
    value: string | undefined,
  ) {
    if (value === undefined) {
      return;
    }

    const secret = value.trim();
    if (secret && secret !== "[secret configured]" && !/^\*+$/.test(secret)) {
      target[key] = secret;
    }
  }

  private assertEmailProviderConfig(
    provider: string,
    isEnabled: boolean,
    config: EmailProviderConfig,
  ) {
    if (!isEnabled) {
      return;
    }

    if (provider === "smtp" && !config.smtpBridgeUrl && (!config.smtpHost || !config.smtpPort)) {
      throw new BadRequestException(
        "SMTP host and port, or SMTP bridge URL, are required before enabling SMTP email sending.",
      );
    }

    if (provider === "brevo" && !config.brevoApiKey) {
      throw new BadRequestException(
        "Brevo API key is required before enabling Brevo email sending.",
      );
    }

    if (provider === "resend" && !config.resendApiKey) {
      throw new BadRequestException(
        "Resend API key is required before enabling Resend email sending.",
      );
    }

    if (provider === "sendgrid" && !config.sendgridApiKey) {
      throw new BadRequestException(
        "SendGrid API key is required before enabling SendGrid email sending.",
      );
    }
  }

  private emailSettingReadback<T extends EmailSettingLike>(setting: T) {
    const config = this.emailProviderConfig(setting.providerConfig);

    return {
      ...setting,
      adminRecipients: setting.adminRecipients ?? "",
      providerConfig: {
        brevoApiKey: "",
        brevoApiKeyConfigured: Boolean(config.brevoApiKey),
        resendApiKey: "",
        resendApiKeyConfigured: Boolean(config.resendApiKey),
        sendgridApiKey: "",
        sendgridApiKeyConfigured: Boolean(config.sendgridApiKey),
        smtpHost: config.smtpHost ?? "",
        smtpPort: config.smtpPort ?? 587,
        smtpUsername: config.smtpUsername ?? "",
        smtpPassword: "",
        smtpPasswordConfigured: Boolean(config.smtpPassword),
        smtpSecure: config.smtpSecure ?? false,
        smtpBridgeUrl: config.smtpBridgeUrl ?? "",
      },
    };
  }

  private emailSettingAuditValue(setting: EmailSettingLike): Prisma.InputJsonObject {
    const config = this.emailProviderConfig(setting.providerConfig);

    return {
      provider: setting.provider,
      senderName: setting.senderName,
      senderEmail: setting.senderEmail,
      isEnabled: setting.isEnabled,
      adminRecipientCount: this.emailRecipientCount(setting.adminRecipients),
      providerConfig: {
        brevoApiKeyConfigured: Boolean(config.brevoApiKey),
        resendApiKeyConfigured: Boolean(config.resendApiKey),
        sendgridApiKeyConfigured: Boolean(config.sendgridApiKey),
        smtpHostConfigured: Boolean(config.smtpHost),
        smtpPortConfigured: Boolean(config.smtpPort),
        smtpUsernameConfigured: Boolean(config.smtpUsername),
        smtpPasswordConfigured: Boolean(config.smtpPassword),
        smtpSecure: Boolean(config.smtpSecure),
        smtpBridgeUrlConfigured: Boolean(config.smtpBridgeUrl),
      },
    };
  }

  private normalizeEmailRecipients(value: string | undefined, existing: string | null | undefined) {
    if (value === undefined) {
      return existing ?? null;
    }

    const recipients = value
      .split(/[\n,]/)
      .map((recipient) => recipient.trim().toLowerCase())
      .filter(Boolean);
    const uniqueRecipients = [...new Set(recipients)];
    const invalidRecipient = uniqueRecipients.find(
      (recipient) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient),
    );

    if (invalidRecipient) {
      throw new BadRequestException(`Invalid admin alert recipient: ${invalidRecipient}.`);
    }

    return uniqueRecipients.length ? uniqueRecipients.join(", ") : null;
  }

  private emailRecipientCount(value: string | null | undefined) {
    return value
      ? value
          .split(/[\n,]/)
          .map((recipient) => recipient.trim())
          .filter(Boolean).length
      : 0;
  }

  private secretValue(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private trimmedString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private portValue(value: unknown) {
    const port =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : Number.NaN;

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return undefined;
    }

    return port;
  }

  private booleanValue(value: unknown) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (value.toLowerCase() === "true") {
        return true;
      }

      if (value.toLowerCase() === "false") {
        return false;
      }
    }

    return undefined;
  }

  private safeUrlValue(value: unknown) {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      const url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:" ? trimmed : undefined;
    } catch {
      return undefined;
    }
  }
}
