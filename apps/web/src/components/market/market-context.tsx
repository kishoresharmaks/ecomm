"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convertBaseMinorToMarket, defaultMarketCurrency, getMarketCurrency, marketNeedsRefresh, type MarketCurrency } from "@/lib/market-api";
import { formatMoney } from "@/lib/storefront-api";

type MarketContextValue = {
  countryCode: string;
  setCountryCode: (countryCode: string) => void;
  market: MarketCurrency;
  isLoading: boolean;
  error: Error | null;
  convert: (baseMinor?: number | null) => number;
  format: (baseMinor?: number | null) => string;
  language: string;
  setLanguage: (lang: string) => void;
};

const MarketContext = createContext<MarketContextValue | null>(null);
const storageKey = "indihub.market.country";
const languageStorageKey = "indihub.market.language";
const marketCacheStorageKey = "indihub.market.currency-cache";
const buyerCurrencyQueryRoots = new Set(["checkout-summary"]);

export function MarketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [countryCode, setCountryCodeState] = useState("IN");
  const [language, setLanguageState] = useState("en");
  const [marketsByCountry, setMarketsByCountry] = useState<Record<string, MarketCurrency>>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        setCountryCodeState(stored);
      }
    } catch {
      // Ignored
    }

    try {
      const storedLang = window.localStorage.getItem(languageStorageKey);
      if (storedLang) {
        setLanguageState(storedLang);
      }
    } catch {
      // Ignored
    }

    setMarketsByCountry(readMarketCache());
  }, []);

  const cachedMarket = marketsByCountry[countryCode];
  const cachedIsFresh = cachedMarket ? !marketNeedsRefresh(cachedMarket) : false;
  const marketQuery = useQuery({
    queryKey: ["market-currency", countryCode],
    queryFn: () => getMarketCurrency(countryCode),
    initialData: cachedMarket,
    retry: false,
    staleTime: cachedIsFresh && cachedMarket?.expiresAt ? Math.max(0, new Date(cachedMarket.expiresAt).getTime() - Date.now()) : 0,
  });

  useEffect(() => {
    const nextMarket = marketQuery.data;
    if (!nextMarket) {
      return;
    }

    setMarketsByCountry((current) => {
      const next = {
        ...current,
        [nextMarket.countryCode]: nextMarket,
      };
      window.localStorage.setItem(marketCacheStorageKey, JSON.stringify(next));
      return next;
    });
  }, [marketQuery.data]);

  const market = marketQuery.data ?? cachedMarket ?? defaultMarketCurrency;
  const setCountryCode = useCallback(
    (nextCountryCode: string) => {
      const normalized = nextCountryCode.trim().toUpperCase() || "IN";
      try {
        window.localStorage.setItem(storageKey, normalized);
      } catch {
        // Ignored
      }
      setCountryCodeState(normalized);
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const root = query.queryKey[0];
          return typeof root === "string" && buyerCurrencyQueryRoots.has(root);
        },
      });
    },
    [queryClient],
  );

  const setLanguage = useCallback(
    (nextLang: string) => {
      const normalized = nextLang.trim().toLowerCase() || "en";
      try {
        window.localStorage.setItem(languageStorageKey, normalized);
      } catch {
        // Ignored
      }
      setLanguageState(normalized);
    },
    [],
  );

  const value = useMemo<MarketContextValue>(
    () => ({
      countryCode,
      setCountryCode,
      market,
      isLoading: marketQuery.isLoading,
      error: marketQuery.error instanceof Error ? marketQuery.error : null,
      convert: (baseMinor?: number | null) => convertBaseMinorToMarket(baseMinor, market),
      format: (baseMinor?: number | null) => formatMoney(convertBaseMinorToMarket(baseMinor, market), market.currency, market.locale),
      language,
      setLanguage
    }),
    [countryCode, market, marketQuery.error, marketQuery.isLoading, setCountryCode, language, setLanguage]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket() {
  const context = useContext(MarketContext);

  if (!context) {
    throw new Error("useMarket must be used inside MarketProvider.");
  }

  return context;
}

function readMarketCache() {
  try {
    const raw = window.localStorage.getItem(marketCacheStorageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, MarketCurrency>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
