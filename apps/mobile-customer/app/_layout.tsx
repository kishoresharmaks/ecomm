import { ClerkProvider } from "@clerk/clerk-expo";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { MobileCustomerAuthProvider, useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { useMobileMarket } from "../src/features/market/mobile-market";
import { getBrowsingLocation } from "../src/features/storefront/storefront-api";
import { createQueryClient } from "../src/lib/query-client";
import { useLocationStore } from "../src/state/location-store";

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

export default function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <MobileCustomerAuthProvider>
          <BrowsingLocationAccountSync />
          <MobileMarketLocationSync />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[slug]" />
            <Stack.Screen name="store/[slug]" />
            <Stack.Screen name="stores/[slug]" />
            <Stack.Screen name="deals" />
            <Stack.Screen name="track-order" />
            <Stack.Screen name="orders/[orderNumber]" />
            <Stack.Screen name="account/profile" />
            <Stack.Screen name="account/addresses" />
            <Stack.Screen name="account/location" />
            <Stack.Screen name="account/wishlist" />
            <Stack.Screen name="account/support" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="checkout/success/[orderNumber]" />
            <Stack.Screen name="auth/sign-in" />
          </Stack>
        </MobileCustomerAuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function MobileMarketLocationSync() {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  useMobileMarket(selectedLocation.countryCode);
  return null;
}

function BrowsingLocationAccountSync() {
  const customerAuth = useMobileCustomerAuth();
  const setSelectedLocation = useLocationStore((state) => state.setSelectedLocation);
  const browsingLocationQuery = useQuery({
    queryKey: ["mobile-browsing-location", customerAuth.authKey, "root-sync"],
    queryFn: () => getBrowsingLocation(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (browsingLocationQuery.data?.location) {
      setSelectedLocation(browsingLocationQuery.data.location);
    }
  }, [browsingLocationQuery.data?.location, setSelectedLocation]);

  return null;
}
