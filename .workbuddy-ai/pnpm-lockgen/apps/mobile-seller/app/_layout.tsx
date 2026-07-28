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
    return safeSecureStoreGet(key);
  },
  async saveToken(key: string, value: string) {
    return safeSecureStoreSet(key, value);
  },
};

const clerkPublishableKey = requiredPublicEnv(
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
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
  const rootSegment = String(segments[0] ?? "");
  const isAuthRoute = rootSegment === "auth";
  const isSsoCallbackRoute = rootSegment === "sso-callback";
  const isPublicAuthRoute = isAuthRoute || isSsoCallbackRoute;
  useSellerPushNotifications(auth);

  if (auth.status === "signed-out" && !isPublicAuthRoute) {
    return <Redirect href="/auth/sign-in" />;
  }

  if (auth.status === "error" && !isPublicAuthRoute) {
    return <Redirect href="/auth/sign-in" />;
  }

  if (!isPublicAuthRoute && (auth.status === "loading" || auth.status === "syncing")) {
    return <LoadingState message="Preparing seller workspace..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="sso-callback" />
      <Stack.Screen name="products/new" />
      <Stack.Screen name="products/[id]" />
      <Stack.Screen name="products/detail/[id]" />
      <Stack.Screen name="services/new" />
      <Stack.Screen name="services/[id]" />
      <Stack.Screen name="service-bookings/[bookingNumber]" />
      <Stack.Screen name="service-calendar" />
      <Stack.Screen name="account-privacy" />
      <Stack.Screen name="orders/[orderNumber]" />
    </Stack>
  );
}

async function safeSecureStoreGet(key: string) {
  if (!isValidSecureStoreKey(key)) {
    return null;
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSecureStoreSet(key: string, value: string) {
  if (!isValidSecureStoreKey(key)) {
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Clerk can recover by requesting a fresh session token.
  }
}

function isValidSecureStoreKey(key: string) {
  return /^[A-Za-z0-9._-]+$/.test(key);
}

function requiredPublicEnv(name: string, rawValue: string | undefined) {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export default withMobileTelemetry(RootLayout);
