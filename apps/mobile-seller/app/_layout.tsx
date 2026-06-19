import { ClerkProvider } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { MobileSellerAuthProvider, useMobileSellerAuth } from "../src/auth/mobile-seller-auth-context";
import { LoadingState } from "../src/components/screen";
import { useSellerPushNotifications } from "../src/features/seller/use-seller-push-notifications";
import { initMobileTelemetry, withMobileTelemetry } from "../src/lib/mobile-telemetry";
import { createQueryClient } from "../src/lib/query-client";

initMobileTelemetry();

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <MobileSellerAuthProvider>
          <StatusBar style="dark" />
          <SellerRouteGate />
        </MobileSellerAuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function SellerRouteGate() {
  const auth = useMobileSellerAuth();
  const segments = useSegments();
  const isAuthRoute = segments[0] === "auth";
  useSellerPushNotifications(auth);

  if (auth.status === "signed-out" && !isAuthRoute) {
    return <Redirect href="/auth/sign-in" />;
  }

  if (auth.status === "error" && !isAuthRoute) {
    return <Redirect href="/auth/sign-in" />;
  }

  if (!isAuthRoute && (auth.status === "loading" || auth.status === "syncing")) {
    return <LoadingState message="Preparing seller workspace..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="products/new" />
      <Stack.Screen name="products/[id]" />
      <Stack.Screen name="products/detail/[id]" />
      <Stack.Screen name="orders/[orderNumber]" />
    </Stack>
  );
}

export default withMobileTelemetry(RootLayout);
