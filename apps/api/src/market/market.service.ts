import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";

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

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMarketCurrency(countryCode = "IN", options: { requireFresh?: boolean } = {}): Promise<MarketCurrencySnapshot> {
    const normalizedCountryCode = countryCode.trim().toUpperCase();
    const country = await this.prisma.client.locationCountry.findUnique({
      where: { code: normalizedCountryCode }
    });

    const baseCurrency = (process.env.FX_BASE_CURRENCY ?? "INR").toUpperCase();
    const provider = process.env.FX_PROVIDER ?? "frankfurter";

    if ((!country || !country.enabled) && normalizedCountryCode === "IN") {
      return this.defaultIndiaSnapshot(baseCurrency, provider);
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
        provider,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + this.cacheTtlMs()),
        isStale: false
      };
    }

    const cached = await this.prisma.client.currencyRate.findUnique({
      where: {
        baseCurrency_quoteCurrency_provider: {
          baseCurrency,
          quoteCurrency: country.currency,
          provider
        }
      }
    });

    if (cached && cached.expiresAt > now) {
      this.logger.debug(`FX cache hit ${baseCurrency}->${country.currency} via ${provider}`);
      return this.snapshotFromRate(country, cached, false);
    }

    try {
      const refreshed = await this.fetchAndStoreRateCoalesced(baseCurrency, country.currency, provider);
      return this.snapshotFromRate(country, refreshed, false);
    } catch {
      if (cached && !options.requireFresh) {
        this.logger.warn(`FX provider unavailable; serving stale ${baseCurrency}->${country.currency} via ${provider}`);
        return this.snapshotFromRate(country, cached, true);
      }

      throw new ServiceUnavailableException("Currency rate is not available. Please try again later.");
    }
  }

  async buildCheckoutSnapshot(countryCode?: string | null) {
    return this.getMarketCurrency(countryCode ?? "IN", { requireFresh: true });
  }

  convertMinorUnits(baseMinor: number, market: MarketCurrencySnapshot) {
    if (market.currency === market.baseCurrency) {
      return baseMinor;
    }

    return Math.round((baseMinor / 100) * market.rate * 100);
  }

  private async fetchAndStoreRateCoalesced(baseCurrency: string, quoteCurrency: string, provider: string) {
    const key = `${baseCurrency}:${quoteCurrency}:${provider}`;
    const existing = this.refreshPromises.get(key);

    if (existing) {
      this.logger.debug(`FX refresh coalesced ${baseCurrency}->${quoteCurrency} via ${provider}`);
      return existing;
    }

    const startedAt = Date.now();
    const refreshPromise = this.fetchAndStoreRate(baseCurrency, quoteCurrency, provider)
      .then((rate) => {
        this.logger.log(
          `FX refresh complete ${baseCurrency}->${quoteCurrency} via ${provider} in ${Date.now() - startedAt}ms`,
        );
        return rate;
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `FX refresh failed ${baseCurrency}->${quoteCurrency} via ${provider} in ${Date.now() - startedAt}ms`,
        );
        throw error;
      })
      .finally(() => {
        this.refreshPromises.delete(key);
      });

    this.refreshPromises.set(key, refreshPromise);
    return refreshPromise;
  }

  private async fetchAndStoreRate(baseCurrency: string, quoteCurrency: string, provider: string) {
    if (provider !== "frankfurter") {
      throw new ServiceUnavailableException("Unsupported FX provider.");
    }

    const url = `${FRANKFURTER_BASE_URL}/rate/${encodeURIComponent(baseCurrency)}/${encodeURIComponent(quoteCurrency)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new ServiceUnavailableException("FX provider returned an error.");
    }

    const payload = (await response.json()) as { rate?: number; date?: string };

    if (typeof payload.rate !== "number" || !Number.isFinite(payload.rate) || payload.rate <= 0) {
      throw new ServiceUnavailableException("FX provider returned an invalid rate.");
    }

    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + this.cacheTtlMs());

    return this.prisma.client.currencyRate.upsert({
      where: {
        baseCurrency_quoteCurrency_provider: {
          baseCurrency,
          quoteCurrency,
          provider
        }
      },
      update: {
        rate: new Prisma.Decimal(payload.rate),
        fetchedAt,
        expiresAt,
        rawResponse: payload as Prisma.InputJsonValue
      },
      create: {
        baseCurrency,
        quoteCurrency,
        provider,
        rate: new Prisma.Decimal(payload.rate),
        fetchedAt,
        expiresAt,
        rawResponse: payload as Prisma.InputJsonValue
      }
    });
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

  private cacheTtlMs() {
    const minutes = Number(process.env.FX_CACHE_TTL_MINUTES ?? 360);
    return Math.max(1, minutes) * 60 * 1000;
  }

  private defaultIndiaSnapshot(baseCurrency: string, provider: string): MarketCurrencySnapshot {
    const now = new Date();

    return {
      countryCode: "IN",
      countryName: "India",
      currency: baseCurrency,
      locale: "en-IN",
      baseCurrency,
      rate: 1,
      provider,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + this.cacheTtlMs()),
      isStale: false
    };
  }
}
