import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../src/components/screen";
import { captureMobileException } from "../src/lib/mobile-telemetry";
import { colors } from "../src/theme";

const enabled =
  __DEV__ ||
  process.env.EXPO_PUBLIC_ENABLE_SENTRY_EXAMPLE === "true";
const dsnConfigured = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());

export default function SentryExampleScreen() {
  const [eventId, setEventId] = useState("");

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Sentry test" }} />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Sentry verification</Text>
        <Text style={styles.title}>Test mobile error monitoring</Text>
        <Text style={styles.body}>
          This screen is for development verification. Production triggering is disabled unless
          EXPO_PUBLIC_ENABLE_SENTRY_EXAMPLE is enabled.
        </Text>
        <Pressable
          accessibilityHint="Sends a captured test exception to Sentry without crashing the app"
          accessibilityLabel={dsnConfigured ? "Send Sentry test event" : "Set Sentry DSN first"}
          accessibilityRole="button"
          disabled={!enabled || !dsnConfigured}
          style={[styles.button, !enabled || !dsnConfigured ? styles.buttonDisabled : null]}
          onPress={() => {
            const id = captureMobileException(
              new Error("Sentry example error from 1HandIndia mobile"),
              "mobile_sentry_example",
              { source: "sentry-example" },
            );
            setEventId(id ?? "not-sent");
          }}
        >
          <Text style={[styles.buttonText, !enabled || !dsnConfigured ? styles.buttonTextDisabled : null]}>
            {dsnConfigured ? "Send test error" : "Set DSN first"}
          </Text>
        </Pressable>
        {eventId ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {eventId === "not-sent" ? "Sentry is not configured for this build." : `Test event sent. Event ID: ${eventId}`}
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 12,
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    justifyContent: "center",
    marginTop: 28,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  buttonTextDisabled: {
    color: colors.muted,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 10,
  },
  notice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  noticeText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
  },
});
