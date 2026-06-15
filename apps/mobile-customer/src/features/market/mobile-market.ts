import * as SecureStore from "expo-secure-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { getMarketCurrency, type MobileMarketCurrency } from "../storefront/storefront-api";

export const defaultMobileMarketCurrency: MobileMarketCurrency = {
  countryCode: "IN",
  countryName: "India",
  currency: "INR",
  locale: "en-IN",
  baseCurrency: "INR",
  rate: 1,
  provider: "frankfurter",
  fetchedAt: new Date(0).toISOString(),
  expiresAt: new Date(0).toISOString(),
  isStale: false,
};

type MobileMarketState = {
  countryCode: string;
  marketsByCountry: Record<string, MobileMarketCurrency>;
  markMarketStale: (countryCode: string) => void;
  setCountryCode: (countryCode: string) => void;
  setMarket: (market: MobileMarketCurrency) => void;
};

const marketStorage: StateStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

export const useMobileMarketStore = create<MobileMarketState>()(
  persist(
    (set) => ({
      countryCode: "IN",
      marketsByCountry: {},
      markMarketStale: (countryCode) =>
        set((state) => {
          const normalized = normalizeCountryCode(countryCode);
          const market = state.marketsByCountry[normalized];
          if (!market) {
            return state;
          }
          if (market.isStale) {
            return state;
          }

          return {
            marketsByCountry: {
              ...state.marketsByCountry,
              [normalized]: {
                ...market,
                isStale: true,
              },
            },
          };
        }),
      setCountryCode: (countryCode) =>
        set((state) => {
          const normalized = normalizeCountryCode(countryCode);
          return state.countryCode === normalized ? state : { countryCode: normalized };
        }),
      setMarket: (market) =>
        set((state) => {
          const normalized = normalizeCountryCode(market.countryCode);
          const nextMarket = {
            ...market,
            countryCode: normalized,
          };
          const currentMarket = state.marketsByCountry[normalized];
          if (state.countryCode === normalized && currentMarket && sameMarketCurrency(currentMarket, nextMarket)) {
            return state;
          }

          return {
            countryCode: normalized,
            marketsByCountry: {
              ...state.marketsByCountry,
              [normalized]: nextMarket,
            },
          };
        }),
    }),
    {
      name: "onehandindia-mobile-market",
      storage: createJSONStorage(() => marketStorage),
      partialize: (state) => ({
        countryCode: state.countryCode,
        marketsByCountry: state.marketsByCountry,
      }),
    },
  ),
);

export function useMobileMarket(preferredCountryCode?: string | null) {
  const queryClient = useQueryClient();
  const storedCountryCode = useMobileMarketStore((state) => state.countryCode);
  const setCountryCode = useMobileMarketStore((state) => state.setCountryCode);
  const setMarket = useMobileMarketStore((state) => state.setMarket);
  const markMarketStale = useMobileMarketStore((state) => state.markMarketStale);
  const marketsByCountry = useMobileMarketStore((state) => state.marketsByCountry);
  const countryCode = normalizeCountryCode(preferredCountryCode ?? storedCountryCode);
  const cachedMarket = marketsByCountry[countryCode];
  const cachedIsFresh = cachedMarket ? !marketNeedsRefresh(cachedMarket) : false;
  const marketQuery = useQuery({
    queryKey: ["mobile-market-currency", countryCode],
    queryFn: () => getMarketCurrency(countryCode),
    initialData: cachedMarket,
    retry: false,
    staleTime: cachedIsFresh && cachedMarket?.expiresAt ? Math.max(0, new Date(cachedMarket.expiresAt).getTime() - Date.now()) : 0,
  });

  useEffect(() => {
    setCountryCode(countryCode);
  }, [countryCode, setCountryCode]);

  useEffect(() => {
    if (marketQuery.data) {
      setMarket(marketQuery.data);
    }
  }, [marketQuery.data, setMarket]);

  useEffect(() => {
    if (marketQuery.isError && cachedMarket) {
      markMarketStale(countryCode);
    }
  }, [cachedMarket, countryCode, markMarketStale, marketQuery.isError]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }

      const latest = useMobileMarketStore.getState().marketsByCountry[countryCode];
      if (!latest || marketNeedsRefresh(latest)) {
        void marketQuery.refetch().catch(() => {
          if (latest) {
            markMarketStale(countryCode);
          }
        });
      }
    });

    return () => subscription.remove();
  }, [countryCode, markMarketStale, marketQuery.refetch]);

  const market = marketQuery.data ?? cachedMarket ?? {
    ...defaultMobileMarketCurrency,
    countryCode,
  };

  return useMemo(
    () => ({
      countryCode,
      isLoading: marketQuery.isLoading,
      isStale: market.isStale || marketNeedsRefresh(market),
      market,
      refetch: marketQuery.refetch,
      convert: (baseMinor?: number | null) => convertBaseMinorToMarket(baseMinor, market),
      format: (baseMinor?: number | null) => formatMoney(convertBaseMinorToMarket(baseMinor, market), market.currency, market.locale),
      formatMinor: (minor?: number | null, currency = market.currency, locale = market.locale) => formatMoney(minor, currency, locale),
      invalidateBuyerCurrencyQueries: () =>
        queryClient.invalidateQueries({
          predicate: (query) => {
            const root = query.queryKey[0];
            return typeof root === "string" && buyerCurrencyQueryRoots.has(root);
          },
        }),
    }),
    [countryCode, market, marketQuery.isLoading, marketQuery.refetch, queryClient],
  );
}

const buyerCurrencyQueryRoots = new Set(["mobile-checkout-summary"]);

export function normalizeCountryCode(countryCode?: string | null) {
  return countryCode?.trim().toUpperCase() || "IN";
}

export function convertBaseMinorToMarket(baseMinor: number | null | undefined, market: MobileMarketCurrency) {
  const value = baseMinor ?? 0;
  if (market.currency === market.baseCurrency) {
    return value;
  }

  return Math.round((value / 100) * market.rate * 100);
}

export function formatMoney(minor?: number | null, currency = "INR", locale = currency === "INR" ? "en-IN" : "en-US") {
  const amount = (minor ?? 0) / 100;

  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    style: "currency",
  }).format(amount);
}

export function formatOrderDisplayTotal(order: {
  buyerCurrency?: string | null;
  buyerTotalMinor?: number | null;
  currency: string;
  totalPaise: number;
}) {
  if (order.buyerCurrency && order.buyerTotalMinor !== undefined && order.buyerTotalMinor !== null) {
    return formatMoney(order.buyerTotalMinor, order.buyerCurrency);
  }

  return formatMoney(order.totalPaise, order.currency);
}

export function formatOrderDisplayAmount(
  order: { buyerCurrency?: string | null; currency: string },
  buyerMinor: number | null | undefined,
  baseMinor: number | null | undefined,
) {
  if (order.buyerCurrency && buyerMinor !== undefined && buyerMinor !== null) {
    return formatMoney(buyerMinor, order.buyerCurrency);
  }

  return formatMoney(baseMinor ?? 0, order.currency);
}

export function formatOrderBaseAmount(order: { buyerCurrency?: string | null; currency: string }, baseMinor: number | null | undefined) {
  if (!order.buyerCurrency || order.buyerCurrency === order.currency) {
    return null;
  }

  return formatMoney(baseMinor ?? 0, order.currency);
}

export function marketNeedsRefresh(market?: Pick<MobileMarketCurrency, "expiresAt"> | null, now = Date.now()) {
  const expiresAt = market?.expiresAt;
  if (!expiresAt) {
    return true;
  }

  const timestamp = new Date(expiresAt).getTime();
  return !Number.isFinite(timestamp) || now >= timestamp;
}

export function announceCurrencyChange(market: MobileMarketCurrency) {
  void AccessibilityInfo.announceForAccessibility?.(`Currency changed to ${market.currency} for ${market.countryName}`);
}

function sameMarketCurrency(left: MobileMarketCurrency, right: MobileMarketCurrency) {
  return (
    left.countryCode === right.countryCode &&
    left.countryName === right.countryName &&
    left.currency === right.currency &&
    left.locale === right.locale &&
    left.baseCurrency === right.baseCurrency &&
    left.rate === right.rate &&
    left.provider === right.provider &&
    left.fetchedAt === right.fetchedAt &&
    left.expiresAt === right.expiresAt &&
    left.isStale === right.isStale
  );
}
