import { Clock01Icon, HeadsetIcon, PackageIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import type { ComponentType, PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/screen";
import { colors } from "../../theme";
import { getMaintenanceSettings, getStorefrontMaintenance } from "./maintenance-api";

export function StorefrontMaintenanceGate({ children }: PropsWithChildren) {
  const maintenanceQuery = useQuery({
    queryKey: ["mobile-maintenance-settings"],
    queryFn: getMaintenanceSettings,
    staleTime: 30_000,
    retry: 1,
  });
  const storefrontMaintenance = getStorefrontMaintenance(maintenanceQuery.data);

  if (maintenanceQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Checking store availability...</Text>
        </View>
      </Screen>
    );
  }

  if (storefrontMaintenance?.enabled) {
    return (
      <Screen>
        <View style={styles.maintenancePanel}>
          <View style={styles.iconBadge}>
            <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={28} strokeWidth={2.2} />
          </View>
          <Text style={styles.eyebrow}>Store maintenance</Text>
          <Text style={styles.title}>Shopping is temporarily paused</Text>
          <Text style={styles.message}>
            {storefrontMaintenance.message || "We are improving the shopping experience. Please check back shortly."}
          </Text>
          {storefrontMaintenance.eta ? (
            <View style={styles.etaRow}>
              <HugeiconsIcon color={colors.warning} icon={Clock01Icon} size={18} strokeWidth={2.2} />
              <Text style={styles.etaText}>{storefrontMaintenance.eta}</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Link asChild href="/account/support">
              <Pressable style={styles.primaryButton}>
                <HugeiconsIcon color="#FFFFFF" icon={HeadsetIcon} size={18} strokeWidth={2.2} />
                <Text style={styles.primaryButtonText}>Contact support</Text>
              </Pressable>
            </Link>
            <Link asChild href="/orders">
              <Pressable style={styles.secondaryButton}>
                <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={18} strokeWidth={2.2} />
                <Text style={styles.secondaryButtonText}>View orders</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

export function withStorefrontMaintenance<P extends object>(Component: ComponentType<P>) {
  return function StorefrontMaintenanceWrappedScreen(props: P) {
    return (
      <StorefrontMaintenanceGate>
        <Component {...props} />
      </StorefrontMaintenanceGate>
    );
  };
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  maintenancePanel: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 28,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softSurface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 8,
  },
  message: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#FFF8E7",
    borderWidth: 1,
    borderColor: "#F8E4A6",
    marginTop: 18,
  },
  etaText: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  actions: {
    gap: 10,
    marginTop: 24,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
});
