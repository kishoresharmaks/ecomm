import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useMobileCustomerAuth } from "../../auth/mobile-auth-context";
import { colors, spacing } from "../../theme";

type B2BCustomerAuthGateProps = {
  children: ReactNode;
};

export function B2BCustomerAuthGate({ children }: B2BCustomerAuthGateProps) {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();

  if (customerAuth.enabled) {
    return <>{children}</>;
  }

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
      <Text style={styles.body}>Sign in to manage your B2B buyer account.</Text>
      <Pressable style={styles.primaryBtn} onPress={() => router.push("/auth/sign-in")}>
        <Text style={styles.primaryBtnText}>Sign in</Text>
      </Pressable>
    </View>
  );
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
});
