import { ClerkProvider } from "@clerk/clerk-expo";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef } from "react";
import { MobileCustomerAuthProvider, useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { useMobileMarket } from "../src/features/market/mobile-market";
import { useCustomerPushNotifications } from "../src/features/notifications/use-customer-push-notifications";
import { getBrowsingLocation, updateBrowsingLocation } from "../src/features/storefront/storefront-api";
import { initMobileTelemetry, withMobileTelemetry } from "../src/lib/mobile-telemetry";
import { createQueryClient } from "../src/lib/query-client";
import { useLocationStore } from "../src/state/location-store";
import type { SelectedLocation } from "../src/types/storefront";

initMobileTelemetry();

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "pk_live_Y2xlcmsuMWhhbmRpbmRpYS5jb20k";

function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <MobileCustomerAuthProvider>
          <BrowsingLocationAccountSync />
          <MobileMarketLocationSync />
          <CustomerPushRegistration />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[slug]" />
            <Stack.Screen name="store/[slug]" />
            <Stack.Screen name="stores/[slug]" />
            <Stack.Screen name="deals" />
            <Stack.Screen name="track-order" />
            <Stack.Screen name="orders/[orderNumber]" />
            <Stack.Screen name="orders/[orderNumber]/return" />
            <Stack.Screen name="account/profile" />
            <Stack.Screen name="account/addresses" />
            <Stack.Screen name="account/location" />
            <Stack.Screen name="account/notifications" />
            <Stack.Screen name="account/notification-preferences" />
            <Stack.Screen name="account/wishlist" />
            <Stack.Screen name="account/support" />
            <Stack.Screen name="account/returns" />
            <Stack.Screen name="account/returns/[requestNumber]" />
            {/* B2B workspace */}
            <Stack.Screen name="account/b2b/index" />
            <Stack.Screen name="account/b2b/profile" />
            <Stack.Screen name="account/b2b/addresses" />
            <Stack.Screen name="account/b2b/address-form" />
            <Stack.Screen name="account/b2b/enquiries/index" />
            <Stack.Screen name="account/b2b/enquiries/new" />
            <Stack.Screen name="account/b2b/enquiries/[enquiryId]" />
            <Stack.Screen name="account/b2b/orders/index" />
            <Stack.Screen name="account/b2b/orders/[orderNumber]" />
            <Stack.Screen name="sentry-example" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="checkout/success/[orderNumber]" />
            <Stack.Screen name="auth/sign-in" />
            <Stack.Screen name="sso-callback" />
          </Stack>
        </MobileCustomerAuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default withMobileTelemetry(RootLayout);

function MobileMarketLocationSync() {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  useMobileMarket(selectedLocation.countryCode);
  return null;
}

function BrowsingLocationAccountSync() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const setSelectedLocation = useLocationStore((state) => state.setSelectedLocation);
  const lastSavedLocationKeyRef = useRef<string | null>(null);
  const browsingLocationQuery = useQuery({
    queryKey: ["mobile-browsing-location", customerAuth.authKey, "root-sync"],
    queryFn: () => getBrowsingLocation(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (browsingLocationQuery.data?.location) {
      lastSavedLocationKeyRef.current = locationKeyForSync(browsingLocationQuery.data.location);
      setSelectedLocation(browsingLocationQuery.data.location);
    }
  }, [browsingLocationQuery.data?.location, setSelectedLocation]);

  useEffect(() => {
    if (!customerAuth.enabled || !isPersistableLocation(selectedLocation)) {
      return;
    }

    const selectedKey = locationKeyForSync(selectedLocation);
    if (!selectedKey || selectedKey === lastSavedLocationKeyRef.current) {
      return;
    }

    let cancelled = false;
    lastSavedLocationKeyRef.current = selectedKey;
    updateBrowsingLocation(customerAuth.authHeaders, selectedLocation)
      .then((response) => {
        if (cancelled) {
          return;
        }
        if (response.location) {
          lastSavedLocationKeyRef.current = locationKeyForSync(response.location);
          setSelectedLocation(response.location);
        }
        void queryClient.invalidateQueries({ queryKey: ["mobile-browsing-location", customerAuth.authKey] });
      })
      .catch(() => {
        if (!cancelled) {
          lastSavedLocationKeyRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customerAuth.authHeaders, customerAuth.authKey, customerAuth.enabled, queryClient, selectedLocation, setSelectedLocation]);

  return null;
}

function isPersistableLocation(location: SelectedLocation) {
  return Boolean(
    location.label.trim() &&
      location.label !== "Select location" &&
      location.countryCode?.trim() &&
      (location.stateCode?.trim() || location.cityCode?.trim() || location.localAreaCode?.trim() || location.pincode?.trim()),
  );
}

function locationKeyForSync(location?: SelectedLocation | null) {
  if (!location) {
    return null;
  }
  return [
    location.label.trim(),
    location.countryCode?.trim().toUpperCase(),
    location.stateCode?.trim(),
    location.cityCode?.trim(),
    location.localAreaCode?.trim(),
    location.pincode?.trim(),
  ]
    .filter(Boolean)
    .join(":");
}

function CustomerPushRegistration() {
  const customerAuth = useMobileCustomerAuth();
  useCustomerPushNotifications({
    authHeaders: customerAuth.authHeaders,
    enabled: customerAuth.enabled,
  });
  return null;
}
