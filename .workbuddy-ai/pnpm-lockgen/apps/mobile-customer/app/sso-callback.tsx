import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { Screen } from "../src/components/screen";
import { colors } from "../src/theme";

WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const customerAuth = useMobileCustomerAuth();
  const [allowSignedOutRedirect, setAllowSignedOutRedirect] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setAllowSignedOutRedirect(true), 8000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && customerAuth.enabled) {
      router.replace("/account");
      return;
    }
    if (customerAuth.status === "error" || (!isSignedIn && allowSignedOutRedirect)) {
      router.replace("/auth/sign-in");
    }
  }, [allowSignedOutRedirect, customerAuth.enabled, customerAuth.status, isLoaded, isSignedIn]);

  return (
    <Screen>
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.title}>Completing sign in...</Text>
        <Text style={styles.text}>Taking you back to 1HandIndia.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
});
