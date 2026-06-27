"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useMobileCustomerAuth } from "../../auth/mobile-auth-context";
import { MobileApiError } from "../../lib/api";
import { getB2BProfile } from "../../lib/mobile-b2b-api";
import { colors, spacing } from "../../theme";

type B2BAuthGateProps = {
  children: ReactNode;
};

/**
 * Gate that wraps any B2B workspace screen.
 *
 * State machine:
 *   loading    → spinner
 *   signed-out → prompt to sign in
 *   404        → onboarding (NOT an error)
 *   403        → "access not available" panel (no retry)
 *   401        → handled by useMobileCustomerAuth (re-auth)
 *   429        → retry-after panel
 *   5xx        → error panel with manual retry (API client already did one auto-retry)
 *   ok         → render children
 *
 * The 5xx auto-retry-once-after-2s is performed by the API client layer
 * (mobile-b2b-api.ts withServerRetry). This gate only handles the final error.
 */
export function B2BAuthGate({ children }: B2BAuthGateProps) {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["b2b-profile-gate", customerAuth.authKey],
    queryFn: () => getB2BProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: (failureCount, error) => {
      if (error instanceof MobileApiError) {
        // Never retry auth/forbidden/not-found errors.
        if ([401, 403, 404].includes(error.status)) return false;
        // Honour 429 — do not auto-retry rate limits.
        if (error.status === 429) return false;
        // For 5xx the API client already retried once; do not retry again here.
        if (error.status >= 500) return false;
      }
      return failureCount < 2;
    },
  });

  // 404 redirect — must happen in useEffect, never during render.
  const needsOnboarding =
    profileQuery.isError &&
    profileQuery.error instanceof MobileApiError &&
    profileQuery.error.status === 404;

  useEffect(() => {
    if (needsOnboarding && !redirecting) {
      setRedirecting(true);
      router.replace("/account/b2b/profile" as never);
    }
  }, [needsOnboarding, redirecting, router]);

  if (!customerAuth.enabled) {
    if (customerAuth.status === "loading" || customerAuth.status === "syncing") {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Sign in required</Text>
        <Text style={styles.body}>Sign in to access the B2B workspace.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push("/auth/sign-in")}>
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (profileQuery.isLoading || redirecting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>{redirecting ? "Setting up B2B workspace..." : "Loading B2B workspace..."}</Text>
      </View>
    );
  }

  if (needsOnboarding) {
    // useEffect above will redirect — show spinner in the meantime
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Setting up B2B workspace...</Text>
      </View>
    );
  }

  if (profileQuery.isError) {
    const error = profileQuery.error;

    // 403 — access not available; no retry.
    if (error instanceof MobileApiError && error.status === 403) {
      return (
        <View style={styles.center}>
          <Text style={styles.heading}>Access not available</Text>
          <Text style={styles.body}>
            Your account does not have access to the B2B workspace. Contact support if you believe
            this is incorrect.
          </Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)/account")}>
            <Text style={styles.secondaryBtnText}>Back to Account</Text>
          </Pressable>
        </View>
      );
    }

    // 429 — rate limited.
    if (error instanceof MobileApiError && error.status === 429) {
      return (
        <View style={styles.center}>
          <Text style={styles.heading}>Too many requests</Text>
          <Text style={styles.body}>Please wait a moment and try again.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void profileQuery.refetch()}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    // 5xx or network — error panel with manual retry.
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Something went wrong</Text>
        <Text style={styles.body}>
          {error instanceof Error ? error.message : "Could not load B2B workspace. Try again."}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => void profileQuery.refetch()}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  loadingText: { color: colors.muted, fontSize: 14, marginTop: spacing.sm },
  heading: { color: colors.ink, fontSize: 18, fontWeight: "700", textAlign: "center" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  secondaryBtnText: { color: colors.ink, fontWeight: "600" },
});
