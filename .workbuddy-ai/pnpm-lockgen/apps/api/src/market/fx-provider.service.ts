import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { decryptProviderSecret, encryptProviderSecret } from "../common/provider-secret";
import { PrismaService } from "../prisma/prisma.service";
import {
  CompareFxQuotesDto,
  type FxProviderAdapterCode,
  TestFxProviderDto,
  UpsertFxProviderDto,
} from "./dto/fx-provider.dto";

const providerCatalog = {
  FRANKFURTER: {
    providerCode: "FRANKFURTER",
    displayName: "Frankfurter",
    apiBaseUrl: "https://api.frankfurter.dev/v2",
    requiresApiKey: false,
    description: "Keyless reference rates sourced from central-bank datasets.",
  },
  CURRENCYAPI: {
    providerCode: "CURRENCYAPI",
    displayName: "CurrencyAPI",
    apiBaseUrl: "https://api.currencyapi.com/v3",
    requiresApiKey: true,
    description: "API-key provider with plan-dependent update frequency.",
  },
} satisfies Record<
  FxProviderAdapterCode,
  {
    providerCode: string;
    displayName: string;
    apiBaseUrl: string;
    requiresApiKey: boolean;
    description: string;
  }
>;

type FxProviderRecord = {
  id: string;
  providerCode: string;
  displayName: string;
  adapterCode: string;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: number;
  apiBaseUrl: string | null;
  apiKeyEncrypted: string | null;
  credentialsConfigured: boolean;
  timeoutMs: number;
  cacheTtlMinutes: number;
  notes: string | null;
  lastHealthStatus: string;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RuntimeFxProvider = {
  id: string | null;
  providerCode: string;
  displayName: string;
  adapterCode: FxProviderAdapterCode;
  apiBaseUrl: string;
  apiKey: string | null;
  timeoutMs: number;
  cacheTtlMinutes: number;
  isPrimary: boolean;
  priority: number;
  source: "DATABASE" | "ENVIRONMENT_FALLBACK";
};

export type ProviderRateQuote = {
  rate: number;
  providerTimestamp: Date | null;
  receivedAt: Date;
  rawResponse: Prisma.InputJsonValue;
};

@Injectable()
export class FxProviderService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listProviders() {
    const items = await this.prisma.client.fxProviderSetting.findMany({
      orderBy: [{ isPrimary: "desc" }, { priority: "asc" }, { displayName: "asc" }],
    });
    const runtimeFallbackActive = items.filter((item) => item.isEnabled).length === 0;

    return {
      items: items.map((item) => this.readback(item)),
      supportedProviders: Object.entries(providerCatalog).map(([adapterCode, provider]) => ({
        adapterCode,
        ...provider,
      })),
      runtimeFallback: runtimeFallbackActive ? this.environmentFallbackReadback() : null,
      baseCurrency: this.baseCurrency(),
    };
  }

  async createProvider(actor: RequestUser, dto: UpsertFxProviderDto) {
    const normalized = this.normalizedInput(dto);
    const duplicate = await this.prisma.client.fxProviderSetting.findFirst({
      where: {
        OR: [
          { providerCode: normalized.providerCode },
          { adapterCode: normalized.adapterCode },
        ],
      },
    });
    if (duplicate) {
      throw new ConflictException("This FX provider adapter is already configured.");
    }
    this.assertCanEnable(normalized.adapterCode, normalized.isEnabled, normalized.apiKeyEncrypted);

    const created = await this.prisma.client.$transaction(async (tx) => {
      if (normalized.isPrimary) {
        await tx.fxProviderSetting.updateMany({ data: { isPrimary: false } });
      }
      const provider = await tx.fxProviderSetting.create({ data: normalized });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "finance.fx_provider.created",
          entityType: "fx_provider_setting",
          entityId: provider.id,
          newValue: this.readback(provider) as Prisma.InputJsonValue,
        },
      });
      return provider;
    });

    return this.readback(created);
  }

  async updateProvider(actor: RequestUser, providerId: string, dto: UpsertFxProviderDto) {
    const existing = await this.providerOrThrow(providerId);
    if (dto.adapterCode !== existing.adapterCode) {
      throw new BadRequestException("Provider adapter cannot be changed after creation.");
    }
    const normalized = this.normalizedInput(dto, existing);
    if (normalized.providerCode !== existing.providerCode) {
      const duplicate = await this.prisma.client.fxProviderSetting.findFirst({
        where: { id: { not: providerId }, providerCode: normalized.providerCode },
      });
      if (duplicate) throw new ConflictException("This FX provider code is already configured.");
    }
    this.assertCanEnable(normalized.adapterCode, normalized.isEnabled, normalized.apiKeyEncrypted);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      if (normalized.isPrimary) {
        await tx.fxProviderSetting.updateMany({
          where: { id: { not: providerId } },
          data: { isPrimary: false },
        });
      }
      const provider = await tx.fxProviderSetting.update({
        where: { id: providerId },
        data: normalized,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "finance.fx_provider.updated",
          entityType: "fx_provider_setting",
          entityId: provider.id,
          oldValue: this.readback(existing) as Prisma.InputJsonValue,
          newValue: this.readback(provider) as Prisma.InputJsonValue,
        },
      });
      return provider;
    });

    return this.readback(updated);
  }

  async makePrimary(actor: RequestUser, providerId: string) {
    const existing = await this.providerOrThrow(providerId);
    if (!existing.isEnabled) {
      throw new BadRequestException("Enable the provider before making it primary.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      await tx.fxProviderSetting.updateMany({ data: { isPrimary: false } });
      const provider = await tx.fxProviderSetting.update({
        where: { id: providerId },
        data: { isPrimary: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "finance.fx_provider.primary_changed",
          entityType: "fx_provider_setting",
          entityId: provider.id,
          oldValue: this.readback(existing) as Prisma.InputJsonValue,
          newValue: this.readback(provider) as Prisma.InputJsonValue,
        },
      });
      return provider;
    });

    return this.readback(updated);
  }

  async compareQuotes(dto: CompareFxQuotesDto) {
    const configured = await this.configuredProviders(true);
    const providers = configured.length ? configured : await this.configuredProviders();
    const amountMinor = dto.amountMinor ?? 10_000;
    const baseCurrency = this.currency(dto.baseCurrency);
    const quoteCurrency = this.currency(dto.quoteCurrency);
    if (baseCurrency === quoteCurrency) {
      throw new BadRequestException("Choose two different currencies.");
    }

    const quotes = await Promise.all(
      providers.map((provider) => this.comparisonQuote(provider, baseCurrency, quoteCurrency, amountMinor)),
    );
    const successfulRates = quotes
      .filter((quote): quote is typeof quote & { rate: number } => quote.status === "SUCCESS" && quote.rate !== null)
      .map((quote) => quote.rate)
      .sort((a, b) => a - b);
    const middle = Math.floor(successfulRates.length / 2);
    const medianRate = successfulRates.length === 0
      ? null
      : successfulRates.length % 2
        ? successfulRates[middle]!
        : (successfulRates[middle - 1]! + successfulRates[middle]!) / 2;

    return {
      baseCurrency,
      quoteCurrency,
      amountMinor,
      generatedAt: new Date(),
      primaryProviderCode: providers.find((provider) => provider.isPrimary)?.providerCode ?? providers[0]?.providerCode ?? null,
      quotes: quotes.map((quote) => ({
        ...quote,
        deviationBps:
          medianRate && quote.rate
            ? Math.round(((quote.rate - medianRate) / medianRate) * 10_000)
            : null,
      })),
    };
  }

  async testProvider(providerId: string, dto: TestFxProviderDto) {
    const record = await this.providerOrThrow(providerId);
    const provider = this.runtimeProvider(record);
    return this.comparisonQuote(
      provider,
      this.currency(dto.baseCurrency),
      this.currency(dto.quoteCurrency),
      dto.amountMinor ?? 10_000,
    );
  }

  async configuredProviders(includeDisabled = false): Promise<RuntimeFxProvider[]> {
    const records = await this.prisma.client.fxProviderSetting.findMany({
      ...(includeDisabled ? {} : { where: { isEnabled: true } }),
      orderBy: [{ isPrimary: "desc" }, { priority: "asc" }, { displayName: "asc" }],
    });
    const usableRecords = includeDisabled ? records : records.filter((record) => record.isEnabled);
    if (usableRecords.length) return usableRecords.map((record) => this.runtimeProvider(record));
    return includeDisabled ? [] : [this.environmentFallback()];
  }

  async fetchRate(provider: RuntimeFxProvider, baseCurrency: string, quoteCurrency: string) {
    if (provider.adapterCode === "FRANKFURTER") {
      return this.fetchFrankfurter(provider, baseCurrency, quoteCurrency);
    }
    if (provider.adapterCode === "CURRENCYAPI") {
      return this.fetchCurrencyApi(provider, baseCurrency, quoteCurrency);
    }
    throw new ServiceUnavailableException("Unsupported FX provider adapter.");
  }

  private async comparisonQuote(
    provider: RuntimeFxProvider,
    baseCurrency: string,
    quoteCurrency: string,
    amountMinor: number,
  ) {
    const startedAt = Date.now();
    try {
      const quote = await this.fetchRate(provider, baseCurrency, quoteCurrency);
      await this.recordHealth(provider.id, true, null);
      return {
        providerId: provider.id,
        providerCode: provider.providerCode,
        displayName: provider.displayName,
        adapterCode: provider.adapterCode,
        isPrimary: provider.isPrimary,
        status: "SUCCESS" as const,
        rate: quote.rate,
        convertedMinor: Math.round(amountMinor * quote.rate),
        providerTimestamp: quote.providerTimestamp,
        receivedAt: quote.receivedAt,
        latencyMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      const message = this.safeProviderError(error);
      await this.recordHealth(provider.id, false, message);
      return {
        providerId: provider.id,
        providerCode: provider.providerCode,
        displayName: provider.displayName,
        adapterCode: provider.adapterCode,
        isPrimary: provider.isPrimary,
        status: "ERROR" as const,
        rate: null,
        convertedMinor: null,
        providerTimestamp: null,
        receivedAt: new Date(),
        latencyMs: Date.now() - startedAt,
        error: message,
      };
    }
  }

  private async fetchFrankfurter(
    provider: RuntimeFxProvider,
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<ProviderRateQuote> {
    const url = `${provider.apiBaseUrl.replace(/\/$/, "")}/rate/${encodeURIComponent(baseCurrency)}/${encodeURIComponent(quoteCurrency)}`;
    const payload = await this.fetchJson(url, provider, {}) as { rate?: number; date?: string };
    const rate = this.validRate(payload.rate);
    return {
      rate,
      providerTimestamp: payload.date ? this.validDate(payload.date) : null,
      receivedAt: new Date(),
      rawResponse: payload as Prisma.InputJsonValue,
    };
  }

  private async fetchCurrencyApi(
    provider: RuntimeFxProvider,
    baseCurrency: string,
    quoteCurrency: string,
  ): Promise<ProviderRateQuote> {
    if (!provider.apiKey) {
      throw new ServiceUnavailableException("CurrencyAPI key is not configured.");
    }
    const params = new URLSearchParams({
      base_currency: baseCurrency,
      currencies: quoteCurrency,
    });
    const url = `${provider.apiBaseUrl.replace(/\/$/, "")}/latest?${params.toString()}`;
    const payload = await this.fetchJson(url, provider, { apikey: provider.apiKey }) as {
      meta?: { last_updated_at?: string };
      data?: Record<string, { code?: string; value?: number }>;
    };
    const rate = this.validRate(payload.data?.[quoteCurrency]?.value);
    return {
      rate,
      providerTimestamp: payload.meta?.last_updated_at
        ? this.validDate(payload.meta.last_updated_at)
        : null,
      receivedAt: new Date(),
      rawResponse: payload as Prisma.InputJsonValue,
    };
  }

  private async fetchJson(url: string, provider: RuntimeFxProvider, headers: Record<string, string>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) {
        throw new ServiceUnavailableException(`${provider.displayName} returned HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableException(`${provider.displayName} request timed out.`);
      }
      throw new ServiceUnavailableException(`${provider.displayName} is unavailable.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizedInput(dto: UpsertFxProviderDto, existing?: FxProviderRecord) {
    const adapterCode = dto.adapterCode;
    const catalog = providerCatalog[adapterCode];
    const apiKey = dto.apiKey?.trim();
    const apiKeyEncrypted = dto.clearApiKey
      ? null
      : apiKey
        ? encryptProviderSecret(apiKey)
        : existing?.apiKeyEncrypted ?? null;
    const isEnabled = dto.isEnabled ?? existing?.isEnabled ?? false;
    const isPrimary = dto.isPrimary ?? existing?.isPrimary ?? false;

    return {
      providerCode: (dto.providerCode?.trim().toUpperCase() || existing?.providerCode || catalog.providerCode),
      displayName: dto.displayName.trim(),
      adapterCode,
      isEnabled,
      isPrimary: isEnabled && isPrimary,
      priority: dto.priority ?? existing?.priority ?? 100,
      apiBaseUrl: this.safeApiBaseUrl(
        adapterCode,
        dto.apiBaseUrl?.trim() || existing?.apiBaseUrl || catalog.apiBaseUrl,
      ),
      apiKeyEncrypted,
      credentialsConfigured: catalog.requiresApiKey ? Boolean(apiKeyEncrypted || process.env.CURRENCYAPI_API_KEY) : true,
      timeoutMs: dto.timeoutMs ?? existing?.timeoutMs ?? 5000,
      cacheTtlMinutes: dto.cacheTtlMinutes ?? existing?.cacheTtlMinutes ?? 60,
      notes: dto.notes?.trim() || null,
    };
  }

  private runtimeProvider(record: FxProviderRecord): RuntimeFxProvider {
    const adapterCode = this.adapterCode(record.adapterCode);
    const catalog = providerCatalog[adapterCode];
    return {
      id: record.id,
      providerCode: record.providerCode,
      displayName: record.displayName,
      adapterCode,
      apiBaseUrl: record.apiBaseUrl || catalog.apiBaseUrl,
      apiKey: record.apiKeyEncrypted
        ? decryptProviderSecret(record.apiKeyEncrypted)
        : (adapterCode === "CURRENCYAPI" ? process.env.CURRENCYAPI_API_KEY?.trim() || null : null),
      timeoutMs: record.timeoutMs,
      cacheTtlMinutes: record.cacheTtlMinutes,
      isPrimary: record.isPrimary,
      priority: record.priority,
      source: "DATABASE",
    };
  }

  private environmentFallback(): RuntimeFxProvider {
    const configured = (process.env.FX_PROVIDER ?? "frankfurter").trim().toUpperCase();
    const adapterCode = configured === "CURRENCYAPI" ? "CURRENCYAPI" : "FRANKFURTER";
    const catalog = providerCatalog[adapterCode];
    return {
      id: null,
      providerCode: catalog.providerCode,
      displayName: `${catalog.displayName} (environment fallback)`,
      adapterCode,
      apiBaseUrl: catalog.apiBaseUrl,
      apiKey: adapterCode === "CURRENCYAPI" ? process.env.CURRENCYAPI_API_KEY?.trim() || null : null,
      timeoutMs: 5000,
      cacheTtlMinutes: Number(process.env.FX_CACHE_TTL_MINUTES ?? 360),
      isPrimary: true,
      priority: 100,
      source: "ENVIRONMENT_FALLBACK",
    };
  }

  private environmentFallbackReadback() {
    const fallback = this.environmentFallback();
    return {
      providerCode: fallback.providerCode,
      displayName: fallback.displayName,
      adapterCode: fallback.adapterCode,
      credentialsConfigured: fallback.adapterCode === "FRANKFURTER" || Boolean(fallback.apiKey),
      source: fallback.source,
    };
  }

  private readback(provider: FxProviderRecord) {
    return {
      id: provider.id,
      providerCode: provider.providerCode,
      displayName: provider.displayName,
      adapterCode: provider.adapterCode,
      isEnabled: provider.isEnabled,
      isPrimary: provider.isPrimary,
      priority: provider.priority,
      apiBaseUrl: provider.apiBaseUrl,
      credentialsConfigured: provider.credentialsConfigured,
      timeoutMs: provider.timeoutMs,
      cacheTtlMinutes: provider.cacheTtlMinutes,
      notes: provider.notes,
      lastHealthStatus: provider.lastHealthStatus,
      lastCheckedAt: provider.lastCheckedAt,
      lastSuccessAt: provider.lastSuccessAt,
      lastError: provider.lastError,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  private async providerOrThrow(providerId: string) {
    const provider = await this.prisma.client.fxProviderSetting.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException("FX provider configuration not found.");
    return provider;
  }

  private async recordHealth(providerId: string | null, success: boolean, error: string | null) {
    if (!providerId) return;
    await this.prisma.client.fxProviderSetting.update({
      where: { id: providerId },
      data: {
        lastHealthStatus: success ? "HEALTHY" : "ERROR",
        lastCheckedAt: new Date(),
        ...(success ? { lastSuccessAt: new Date(), lastError: null } : { lastError: error }),
      },
    }).catch(() => undefined);
  }

  private assertCanEnable(adapterCode: FxProviderAdapterCode, enabled: boolean, apiKeyEncrypted: string | null) {
    if (
      enabled &&
      providerCatalog[adapterCode].requiresApiKey &&
      !apiKeyEncrypted &&
      !process.env.CURRENCYAPI_API_KEY?.trim()
    ) {
      throw new BadRequestException("Configure the CurrencyAPI key before enabling this provider.");
    }
  }

  private adapterCode(value: string): FxProviderAdapterCode {
    if (value === "FRANKFURTER" || value === "CURRENCYAPI") return value;
    throw new ServiceUnavailableException("Unsupported FX provider adapter.");
  }

  private baseCurrency() {
    return this.currency(process.env.FX_BASE_CURRENCY ?? "INR");
  }

  private safeApiBaseUrl(adapterCode: FxProviderAdapterCode, value: string) {
    const official = new URL(providerCatalog[adapterCode].apiBaseUrl);
    let requested: URL;
    try {
      requested = new URL(value);
    } catch {
      throw new BadRequestException("FX provider API URL is invalid.");
    }
    if (
      requested.protocol !== "https:" ||
      requested.hostname !== official.hostname ||
      requested.username ||
      requested.password ||
      requested.search ||
      requested.hash
    ) {
      throw new BadRequestException(`Use the official ${providerCatalog[adapterCode].displayName} HTTPS host.`);
    }
    return requested.toString().replace(/\/$/, "");
  }

  private currency(value: string) {
    const currency = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException("Currency code is invalid.");
    return currency;
  }

  private validRate(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new ServiceUnavailableException("FX provider returned an invalid rate.");
    }
    return value;
  }

  private validDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private safeProviderError(error: unknown) {
    return error instanceof Error
      ? error.message.replace(/apikey=[^&\s]+/gi, "apikey=[redacted]").slice(0, 500)
      : "FX provider request failed.";
  }
}
