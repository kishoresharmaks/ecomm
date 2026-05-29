"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convertBaseMinorToMarket, defaultMarketCurrency, getMarketCurrency, type MarketCurrency } from "@/lib/market-api";
import { formatMoney } from "@/lib/storefront-api";

type MarketContextValue = {
  countryCode: string;
  setCountryCode: (countryCode: string) => void;
  market: MarketCurrency;
  isLoading: boolean;
  error: Error | null;
  convert: (baseMinor?: number | null) => number;
  format: (baseMinor?: number | null) => string;
};

const MarketContext = createContext<MarketContextValue | null>(null);
const storageKey = "indihub.market.country";

export function MarketProvider({ children }: { children: ReactNode }) {
  const [countryCode, setCountryCodeState] = useState("IN");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setCountryCodeState(stored);
    }
  }, []);

  const marketQuery = useQuery({
    queryKey: ["market-currency", countryCode],
    queryFn: () => getMarketCurrency(countryCode),
    retry: false
  });

  const market = marketQuery.data ?? defaultMarketCurrency;

  const value = useMemo<MarketContextValue>(
    () => ({
      countryCode,
      setCountryCode: (nextCountryCode: string) => {
        const normalized = nextCountryCode.trim().toUpperCase() || "IN";
        window.localStorage.setItem(storageKey, normalized);
        setCountryCodeState(normalized);
      },
      market,
      isLoading: marketQuery.isLoading,
      error: marketQuery.error instanceof Error ? marketQuery.error : null,
      convert: (baseMinor?: number | null) => convertBaseMinorToMarket(baseMinor, market),
      format: (baseMinor?: number | null) => formatMoney(convertBaseMinorToMarket(baseMinor, market), market.currency, market.locale)
    }),
    [countryCode, market, marketQuery.error, marketQuery.isLoading]
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
