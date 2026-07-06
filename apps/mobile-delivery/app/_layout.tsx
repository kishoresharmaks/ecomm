import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef } from "react";
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
    return safeSecureStoreGet(key);
  },
  async saveToken(key: string, value: string) {
    return safeSecureStoreSet(key, value);
  },
};

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "pk_live_Y2xlcmsuMWhhbmRpbmRpYS5jb20k";

function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
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
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  const rootSegment = String(segments[0] ?? "");
  const isAuthRoute = rootSegment === "auth";
  const isSsoCallbackRoute = rootSegment === "sso-callback";
  const isPublicAuthRoute = isAuthRoute || isSsoCallbackRoute;
  const isAccessBlockedRoute = segments[0] === "access-blocked";

  const accessQuery = useQuery({
    queryKey: ["delivery-access", auth.authKey],
    queryFn: () => getDeliveryAccess(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });

  // ─── Navigation guard ────────────────────────────────────────────────────
  // IMPORTANT: Never render <Redirect> conditionally inside a component that
  // also calls useSegments(). Doing so creates a loop:
  //   Redirect → nav state change → useSegments() new ref → re-render → Redirect …
  // Instead, perform all redirects imperatively inside a useEffect.
  useEffect(() => {
    if (isNavigatingRef.current) return;

    let target: string | null = null;

    if (auth.status === "signed-out" && !isPublicAuthRoute) {
      target = "/auth/sign-in";
    } else if ((auth.status === "error" || clerkAuth.isSignedIn === false) && !isPublicAuthRoute) {
      target = "/auth/sign-in";
    } else if (
      auth.enabled &&
      accessQuery.isSuccess &&
      !accessQuery.data.isDeliveryPartner &&
      !isPublicAuthRoute &&
      !isAccessBlockedRoute
    ) {
      target = "/access-blocked";
    }

    if (target) {
      isNavigatingRef.current = true;
      router.replace(target as Parameters<typeof router.replace>[0]);
      // Reset after a tick so future auth changes can trigger again
      setTimeout(() => { isNavigatingRef.current = false; }, 300);
    }
  }, [
    auth.status,
    auth.enabled,
    clerkAuth.isSignedIn,
    isPublicAuthRoute,
    isAccessBlockedRoute,
    accessQuery.isSuccess,
    accessQuery.data?.isDeliveryPartner,
    router,
  ]);

  // ─── Blocking UI states ───────────────────────────────────────────────────
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

  if (!isPublicAuthRoute && (auth.status === "loading" || auth.status === "syncing")) {
    return <LoadingMessage message="Preparing delivery workspace..." />;
  }

  if (auth.enabled && accessQuery.isLoading && !isPublicAuthRoute && !isAccessBlockedRoute) {
    return <LoadingMessage message="Checking delivery partner approval..." />;
  }

  // Render the navigator; the useEffect above handles redirects
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/sign-in" />
      <Stack.Screen name="sso-callback" />
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

export default withMobileTelemetry(RootLayout);
