import { BellDotIcon, CouponPercentIcon, Notification02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { accountErrorMessage, SignInRequiredState } from "../../src/features/account/account-ui";
import {
  getCustomerNotificationPreferences,
  updateCustomerNotificationPreferences,
  type CustomerNotificationPreferences,
} from "../../src/features/notifications/customer-notifications-api";
import {
  useCustomerPushNotificationStatus,
  type CustomerPushPermissionState,
} from "../../src/features/notifications/use-customer-push-notifications";
import { colors } from "../../src/theme";

export default function NotificationPreferencesScreen() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const pushStatus = useCustomerPushNotificationStatus();
  const preferencesQuery = useQuery({
    queryKey: ["mobile-notification-preferences", customerAuth.authKey],
    queryFn: () => getCustomerNotificationPreferences(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CustomerNotificationPreferences>) =>
      updateCustomerNotificationPreferences(customerAuth.authHeaders, payload),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["mobile-notification-preferences", customerAuth.authKey], preferences);
    },
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing") {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Notification preferences" }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Preparing preferences...</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Notification preferences" }} />
        <SignInRequiredState title="Sign in to manage notifications" message="Control deal alerts and marketing campaign push notifications." />
      </>
    );
  }

  const preferences = preferencesQuery.data;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Notification preferences" }} />
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <HugeiconsIcon color={colors.primary} icon={Notification02Icon} size={30} strokeWidth={2.1} />
        </View>
        <Text style={styles.title}>Push preferences</Text>
        <Text style={styles.subtitle}>Order updates are transactional and remain enabled for your account.</Text>
        <Text style={styles.pushStatus}>{pushStatusCopy(pushStatus.state)}</Text>
        {pushStatus.state !== "registered" ? (
          <Pressable style={styles.secondaryButton} onPress={() => pushStatus.refresh()}>
            <Text style={styles.secondaryButtonText}>Retry push registration</Text>
          </Pressable>
        ) : null}
      </View>

      {preferencesQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : preferencesQuery.isError ? (
        <EmptyState title="Preferences could not load" message={accountErrorMessage(preferencesQuery.error, "Please try again.")} />
      ) : preferences ? (
        <View style={styles.card}>
          <PreferenceRow
            description="Promotions when marketplace deals are published."
            icon={CouponPercentIcon}
            title="Deal alerts"
            value={preferences.dealAlertsEnabled}
            onValueChange={(dealAlertsEnabled) => updateMutation.mutate({ dealAlertsEnabled })}
          />
          <PreferenceRow
            description="Admin campaigns with offers, store launches, and curated picks."
            icon={BellDotIcon}
            title="Marketing campaigns"
            value={preferences.marketingCampaignsEnabled}
            onValueChange={(marketingCampaignsEnabled) => updateMutation.mutate({ marketingCampaignsEnabled })}
          />
        </View>
      ) : null}

      {updateMutation.isError ? (
        <Text style={styles.errorText}>{accountErrorMessage(updateMutation.error, "Preference update failed.")}</Text>
      ) : null}
    </Screen>
  );
}

function PreferenceRow({
  description,
  icon,
  onValueChange,
  title,
  value,
}: {
  description: string;
  icon: typeof Notification02Icon;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceIcon}>
        <HugeiconsIcon color={colors.primary} icon={icon} size={24} strokeWidth={2.1} />
      </View>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceText}>{description}</Text>
      </View>
      <Switch
        ios_backgroundColor="#F3E7E2"
        thumbColor={value ? colors.primary : "#F8FAFC"}
        trackColor={{ false: "#E5E7EB", true: "#FFD9CC" }}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function pushStatusCopy(state: CustomerPushPermissionState) {
  switch (state) {
    case "registered":
      return "Push permission is active on this device.";
    case "permission-denied":
      return "Push permission is blocked in OS settings.";
    case "device-unsupported":
      return "Push notifications need a physical device.";
    case "expo-go-unsupported":
      return "Use a development or production build for push notifications.";
    case "unavailable":
      return "Push registration is currently unavailable.";
    default:
      return "Checking device push permission...";
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 18,
    overflow: "hidden",
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  preferenceCopy: {
    flex: 1,
    minWidth: 0,
  },
  preferenceIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 16,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  preferenceRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 92,
    padding: 16,
  },
  preferenceText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  preferenceTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  pushStatus: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 12,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 14,
  },
});
