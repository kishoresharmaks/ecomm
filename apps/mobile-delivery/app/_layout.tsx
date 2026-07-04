import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Linking, Text } from "react-native";
import { MobileDeliveryAuthProvider, useMobileDeliveryAuth } from "../src/auth/mobile-delivery-auth-context";
import { Button, Card, Screen } from "../src/components/screen";
import { getDeliveryAccess } from "../src/features/delivery/delivery-api";
import { deliveryVersionGate } from "../src/features/delivery/version-gate";
import { createQueryClient } from "../src/lib/query-client";
import { initMobileTelemetry, withMobileTelemetry } from "../src/lib/mobile-telemetry";

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
        <MobileDeliveryAuthProvider>
          <StatusBar style="dark" />
          <DeliveryRouteGate />
        </MobileDeliveryAuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function DeliveryRouteGate() {
  const versionGate = deliveryVersionGate();
  const auth = useMobileDeliveryAuth();
  const clerkAuth = useAuth();
  const segments = useSegments();
  const isAuthRoute = segments[0] === "auth";
  const isAccessBlockedRoute = segments[0] === "access-blocked";
  const accessQuery = useQuery({
    queryKey: ["delivery-access", auth.authKey],
    queryFn: () => getDeliveryAccess(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });

  if (versionGate.status === "blocked") {
    return (
      <Screen>
        <Card>
          <Text style={{ color: "#123A5A", fontSize: 24, fontWeight: "900" }}>Update required</Text>
          <Text style={{ color: "#6B7280", fontSize: 14, lineHeight: 20 }}>
            This delivery build is no longer supported. Install the latest app before continuing.
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>
            Current build {versionGate.currentVersionCode} / required {versionGate.minimumVersionCode}
          </Text>
          <Button title="Open update page" onPress={() => void Linking.openURL(versionGate.updateUrl)} />
        </Card>
      </Screen>
    );
  }

  if (auth.status === "signed-out" && !isAuthRoute) return <Redirect href="/auth/sign-in" />;
  if ((auth.status === "error" || clerkAuth.isSignedIn === false) && !isAuthRoute) return <Redirect href="/auth/sign-in" />;
  if (!isAuthRoute && (auth.status === "loading" || auth.status === "syncing")) {
    return <LoadingMessage message="Preparing delivery workspace..." />;
  }
  if (auth.enabled && accessQuery.isLoading && !isAuthRoute && !isAccessBlockedRoute) {
    return <LoadingMessage message="Checking delivery partner approval..." />;
  }
  if (auth.enabled && accessQuery.isSuccess && !accessQuery.data.isDeliveryPartner && !isAuthRoute && !isAccessBlockedRoute) {
    return <Redirect href="/access-blocked" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="access-blocked" />
      <Stack.Screen name="orders/[orderNumber]" />
      <Stack.Screen name="returns/[requestNumber]" />
    </Stack>
  );
}

function LoadingMessage({ message }: { message: string }) {
  return (
    <Screen>
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 20, fontWeight: "900" }}>{message}</Text>
        <Text style={{ color: "#6B7280" }}>This should only take a moment.</Text>
      </Card>
    </Screen>
  );
}

export default withMobileTelemetry(RootLayout);

