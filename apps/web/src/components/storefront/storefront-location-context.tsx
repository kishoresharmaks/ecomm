"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { listCustomerAddresses } from "@/lib/account-api";
import {
  defaultBrowsingLocationFromAddresses,
  normalizeBrowsingLocation,
  type StorefrontBrowsingLocation,
} from "./storefront-location-utils";

type StorefrontLocationSource = "manual" | "saved-address" | "global";

type StorefrontLocationContextValue = {
  activeLocation: StorefrontBrowsingLocation | null;
  manualLocation: StorefrontBrowsingLocation | null;
  source: StorefrontLocationSource;
  prefillLocation: StorefrontBrowsingLocation | null;
  isReady: boolean;
  isPrefillLoading: boolean;
  setManualLocation: (location: StorefrontBrowsingLocation | null) => void;
  resetLocationPreference: () => void;
};

const storageKey = "indihub.storefront.manual-location";
const StorefrontLocationContext = createContext<StorefrontLocationContextValue | null>(null);

export function StorefrontLocationProvider({ children }: { children: ReactNode }) {
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [manualLocation, setManualLocationState] = useState<StorefrontBrowsingLocation | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StorefrontBrowsingLocation>;
        setManualLocationState(normalizeBrowsingLocation(parsed));
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setHasLoadedStorage(true);
    }
  }, []);

  const addressesQuery = useQuery({
    queryKey: ["storefront-browsing-location-prefill", customerAuth.authKey],
    queryFn: () => listCustomerAddresses(customerAuth.authHeaders),
    enabled: hasLoadedStorage && customerAuth.enabled,
    retry: false,
  });

  const prefillLocation = useMemo(
    () =>
      !manualLocation && hasLoadedStorage
        ? defaultBrowsingLocationFromAddresses(addressesQuery.data)
        : null,
    [addressesQuery.data, hasLoadedStorage, manualLocation],
  );

  const value = useMemo<StorefrontLocationContextValue>(() => {
    const activeLocation = manualLocation ?? prefillLocation ?? null;
    const source: StorefrontLocationSource = manualLocation
      ? "manual"
      : prefillLocation
        ? "saved-address"
        : "global";

    return {
      activeLocation,
      manualLocation,
      source,
      prefillLocation,
      isReady: hasLoadedStorage,
      isPrefillLoading: addressesQuery.isLoading,
      setManualLocation: (location) => {
        const normalized = normalizeBrowsingLocation(location);
        setManualLocationState(normalized);
        if (normalized) {
          window.localStorage.setItem(storageKey, JSON.stringify(normalized));
        } else {
          window.localStorage.removeItem(storageKey);
        }
      },
      resetLocationPreference: () => {
        setManualLocationState(null);
        window.localStorage.removeItem(storageKey);
      },
    };
  }, [addressesQuery.isLoading, hasLoadedStorage, manualLocation, prefillLocation]);

  useEffect(() => {
    const countryCode = value.activeLocation?.countryCode?.trim().toUpperCase();
    if (countryCode && countryCode !== market.countryCode) {
      market.setCountryCode(countryCode);
    }
  }, [market.countryCode, market.setCountryCode, value.activeLocation?.countryCode]);

  return (
    <StorefrontLocationContext.Provider value={value}>
      {children}
    </StorefrontLocationContext.Provider>
  );
}

export function useStorefrontLocation() {
  const context = useContext(StorefrontLocationContext);
  const [hasHydratedConsumer, setHasHydratedConsumer] = useState(false);

  useEffect(() => {
    setHasHydratedConsumer(true);
  }, []);

  const hydrationSafeContext = useMemo<StorefrontLocationContextValue | null>(() => {
    if (!context || hasHydratedConsumer) {
      return context;
    }

    return {
      ...context,
      activeLocation: null,
      manualLocation: null,
      source: "global",
      prefillLocation: null,
      isReady: false,
      isPrefillLoading: false,
    };
  }, [context, hasHydratedConsumer]);

  if (!hydrationSafeContext) {
    throw new Error("useStorefrontLocation must be used inside StorefrontLocationProvider.");
  }

  return hydrationSafeContext;
}
