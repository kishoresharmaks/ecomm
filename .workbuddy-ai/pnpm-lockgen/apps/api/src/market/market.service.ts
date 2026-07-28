import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { FxProviderService, type RuntimeFxProvider } from "./fx-provider.service";

const FRANKFURTER_BASE_URL = "https://api.frankfurter.dev/v2";

type CurrencyRateRecord = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: Prisma.Decimal;
  provider: string;
  fetchedAt: Date;
  expiresAt: Date;
};

export type MarketCurrencySnapshot = {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  baseCurrency: string;
  rate: number;
  provider: string;
  fetchedAt: Date;
  expiresAt: Date;
  isStale: boolean;
};

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly refreshPromises = new Map<string, Promise<CurrencyRateRecord>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(FxProviderService) private readonly fxProviders?: FxProviderService,
  ) {}

  async getMarketCurrency(
    countryCode = "IN",
    options: { requireFresh?: boolean; forceRefresh?: boolean } = {},
  ): Promise<MarketCurrencySnapshot> {
    const normalizedCountryCode = countryCode.trim().toUpperCase();
    const country = await this.prisma.client.locationCountry.findUnique({
      where: { code: normalizedCountryCode }
    });

    const baseCurrency = (process.env.FX_BASE_CURRENCY ?? "INR").toUpperCase();
    const providers = await this.providerChain();
    const primaryProvider = providers[0]!;

    if ((!country || !country.enabled) && normalizedCountryCode === "IN") {
      return this.defaultIndiaSnapshot(baseCurrency, primaryProvider);
    }

    if (!country || !country.enabled) {
      throw new BadRequestException("Selected market country is not enabled.");
    }

    const now = new Date();

    if (country.currency === baseCurrency) {
      return {
        countryCode: country.code,
        countryName: country.name,
        currency: country.currency,
        locale: country.locale,
        baseCurrency,
        rate: 1,
        provider: primaryProvider.providerCode,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + this.cacheTtlMs(primaryProvider)),
        isStale: false
      };
    }

    let staleFallback: CurrencyRateRecord | null = null;
    for (const provider of providers) {
      const cached = await this.cachedRate(baseCurrency, country.currency, provider.providerCode);
      staleFallback ??= cached;

      if (!options.forceRefresh && cached && cached.expiresAt > now) {
        this.logger.debug(`FX cache hit ${baseCurrency}->${country.currency} via ${provider.providerCode}`);
        return this.snapshotFromRate(country, cached, false);
      }

      try {
        const refreshed = await this.fetchAndStoreRateCoalesced(baseCurrency, country.currency, provider);
        return this.snapshotFromRate(country, refreshed, false);
      } catch {
        this.logger.warn(`FX provider failed ${baseCurrency}->${country.currency} via ${provider.providerCode}`);
      }
    }

    if (staleFallback && !options.requireFresh) {
      this.logger.warn(
        `All FX providers unavailable; serving stale ${baseCurrency}->${country.currency} via ${staleFallback.provider}`,
      );
      return this.snapshotFromRate(country, staleFallback, true);
    }

    throw new ServiceUnavailableException("Currency rate is not available. Please try again later.");
  }

  async buildCheckoutSnapshot(countryCode?: string | null) {
    return this.getMarketCurrency(countryCode ?? "IN", { requireFresh: true, forceRefresh: true });
  }

  convertMinorUnits(baseMinor: number, market: MarketCurrencySnapshot) {
    if (market.currency === market.baseCurrency) {
      return baseMinor;
    }

    return Math.round((baseMinor / 100) * market.rate * 100);
  }

  async convertMinorUnitsToBase(
    sourceMinor: number,
    sourceCurrency: string | null | undefined,
    options: { requireFresh?: boolean } = {},
  ) {
    const baseCurrency = (process.env.FX_BASE_CURRENCY ?? "INR").toUpperCase();
    const normalizedSourceCurrency = sourceCurrency?.trim().toUpperCase() || baseCurrency;

    if (!/^[A-Z]{3}$/.test(normalizedSourceCurrency)) {
      throw new BadRequestException("Product currency is not valid.");
    }

    if (normalizedSourceCurrency === baseCurrency) {
      return sourceMinor;
    }

    const now = new Date();
    const providers = await this.providerChain();
    let usableRate: CurrencyRateRecord | null = null;
    let staleFallback: CurrencyRateRecord | null = null;

    for (const provider of providers) {
      const cached = await this.cachedRate(baseCurrency, normalizedSourceCurrency, provider.providerCode);
      staleFallback ??= cached;
      if (cached && cached.expiresAt > now) {
        usableRate = cached;
        break;
      }

      try {
        usableRate = await this.fetchAndStoreRateCoalesced(baseCurrency, normalizedSourceCurrency, provider);
        break;
      } catch {
        this.logger.warn(
          `FX provider failed ${baseCurrency}->${normalizedSourceCurrency} via ${provider.providerCode}`,
        );
      }
    }

    usableRate ??= !options.requireFresh ? staleFallback : null;
    if (!usableRate) {
      throw new ServiceUnavailableException("Currency rate is not available. Please try again later.");
    }

    const rate = usableRate.rate.toNumber();
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new ServiceUnavailableException("Currency rate is not available. Please try again later.");
    }

    return Math.round((sourceMinor / 100 / rate) * 100);
  }

  private async fetchAndStoreRateCoalesced(
    baseCurrency: string,
    quoteCurrency: string,
    provider: RuntimeFxProvider,
  ) {
    const key = `${baseCurrency}:${quoteCurrency}:${provider.providerCode}`;
    const existing = this.refreshPromises.get(key);

    if (existing) {
      this.logger.debug(`FX refresh coalesced ${baseCurrency}->${quoteCurrency} via ${provider.providerCode}`);
      return existing;
    }

    const startedAt = Date.now();
    const refreshPromise = this.fetchAndStoreRate(baseCurrency, quoteCurrency, provider)
      .then((rate) => {
        this.logger.log(
          `FX refresh complete ${baseCurrency}->${quoteCurrency} via ${provider.providerCode} in ${Date.now() - startedAt}ms`,
        );
        return rate;
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `FX refresh failed ${baseCurrency}->${quoteCurrency} via ${provider.providerCode} in ${Date.now() - startedAt}ms`,
        );
        throw error;
      })
      .finally(() => {
        this.refreshPromises.delete(key);
      });

    this.refreshPromises.set(key, refreshPromise);
    return refreshPromise;
  }

  private async fetchAndStoreRate(
    baseCurrency: string,
    quoteCurrency: string,
    provider: RuntimeFxProvider,
  ) {
    const quote = this.fxProviders
      ? await this.fxProviders.fetchRate(provider, baseCurrency, quoteCurrency)
      : await this.fetchEnvironmentFallback(provider, baseCurrency, quoteCurrency);

    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + this.cacheTtlMs(provider));

    return this.prisma.client.currencyRate.upsert({
      where: {
        baseCurrency_quoteCurrency_provider: {
          baseCurrency,
          quoteCurrency,
          provider: provider.providerCode
        }
      },
      update: {
        rate: new Prisma.Decimal(quote.rate),
        fetchedAt,
        expiresAt,
        rawResponse: quote.rawResponse,
      },
      create: {
        baseCurrency,
        quoteCurrency,
        provider: provider.providerCode,
        rate: new Prisma.Decimal(quote.rate),
        fetchedAt,
        expiresAt,
        rawResponse: quote.rawResponse,
      }
    });
  }

  private async fetchEnvironmentFallback(
    provider: RuntimeFxProvider,
    baseCurrency: string,
    quoteCurrency: string,
  ) {
    const url = `${FRANKFURTER_BASE_URL}/rate/${encodeURIComponent(baseCurrency)}/${encodeURIComponent(quoteCurrency)}`;
    const response = await fetch(url);
    if (!response.ok) throw new ServiceUnavailableException("FX provider returned an error.");
    const payload = (await response.json()) as { rate?: number; date?: string };
    if (typeof payload.rate !== "number" || !Number.isFinite(payload.rate) || payload.rate <= 0) {
      throw new ServiceUnavailableException("FX provider returned an invalid rate.");
    }
    return {
      rate: payload.rate,
      providerTimestamp: payload.date ? new Date(payload.date) : null,
      receivedAt: new Date(),
      rawResponse: payload as Prisma.InputJsonValue,
    };
  }

  private cachedRate(baseCurrency: string, quoteCurrency: string, provider: string) {
    return this.prisma.client.currencyRate.findUnique({
      where: {
        baseCurrency_quoteCurrency_provider: {
          baseCurrency,
          quoteCurrency,
          provider,
        },
      },
    });
  }

  private async providerChain(): Promise<RuntimeFxProvider[]> {
    if (this.fxProviders) return this.fxProviders.configuredProviders();

    const configured = (process.env.FX_PROVIDER ?? "frankfurter").trim();
    return [{
      id: null,
      providerCode: configured,
      displayName: "Frankfurter (environment fallback)",
      adapterCode: "FRANKFURTER",
      apiBaseUrl: FRANKFURTER_BASE_URL,
      apiKey: null,
      timeoutMs: 5000,
      cacheTtlMinutes: Number(process.env.FX_CACHE_TTL_MINUTES ?? 360),
      isPrimary: true,
      priority: 100,
      source: "ENVIRONMENT_FALLBACK",
    }];
  }

  private snapshotFromRate(
    country: { code: string; name: string; currency: string; locale: string },
    rate: { baseCurrency: string; quoteCurrency: string; rate: Prisma.Decimal; provider: string; fetchedAt: Date; expiresAt: Date },
    isStale: boolean
  ): MarketCurrencySnapshot {
    return {
      countryCode: country.code,
      countryName: country.name,
      currency: country.currency,
      locale: country.locale,
      baseCurrency: rate.baseCurrency,
      rate: rate.rate.toNumber(),
      provider: rate.provider,
      fetchedAt: rate.fetchedAt,
      expiresAt: rate.expiresAt,
      isStale
    };
  }

  private cacheTtlMs(provider?: RuntimeFxProvider) {
    const minutes = provider?.cacheTtlMinutes ?? Number(process.env.FX_CACHE_TTL_MINUTES ?? 360);
    return Math.max(1, minutes) * 60 * 1000;
  }

  private defaultIndiaSnapshot(baseCurrency: string, provider: RuntimeFxProvider): MarketCurrencySnapshot {
    const now = new Date();

    return {
      countryCode: "IN",
      countryName: "India",
      currency: baseCurrency,
      locale: "en-IN",
      baseCurrency,
      rate: 1,
      provider: provider.providerCode,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + this.cacheTtlMs(provider)),
      isStale: false
    };
  }
}
