import { indihubFetch } from "./api";

export type MarketCurrency = {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  baseCurrency: string;
  rate: number;
  provider: string;
  fetchedAt: string;
  expiresAt: string;
  isStale: boolean;
};

export const defaultMarketCurrency: MarketCurrency = {
  countryCode: "IN",
  countryName: "India",
  currency: "INR",
  locale: "en-IN",
  baseCurrency: "INR",
  rate: 1,
  provider: "frankfurter",
  fetchedAt: new Date(0).toISOString(),
  expiresAt: new Date(0).toISOString(),
  isStale: false
};

export function getMarketCurrency(countryCode = "IN") {
  return indihubFetch<MarketCurrency>(`/api/market/currency?countryCode=${encodeURIComponent(countryCode)}`);
}

export function convertBaseMinorToMarket(baseMinor: number | null | undefined, market: MarketCurrency) {
  const value = baseMinor ?? 0;

  if (market.currency === market.baseCurrency) {
    return value;
  }

  return Math.round((value / 100) * market.rate * 100);
}

export function marketNeedsRefresh(market?: Pick<MarketCurrency, "expiresAt"> | null, now = Date.now()) {
  const expiresAt = market?.expiresAt;
  if (!expiresAt) {
    return true;
  }

  const timestamp = new Date(expiresAt).getTime();
  return !Number.isFinite(timestamp) || now >= timestamp;
}
