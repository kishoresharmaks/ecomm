import { Link } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../components/empty-state";
import { Screen } from "../../components/screen";
import type { MobileOrderDetail } from "../storefront/storefront-api";
import type { LocationArea, SelectedLocation } from "../../types/storefront";
import { colors } from "../../theme";

const blockedOrderStatuses = new Set(["CANCELLED", "SHIPPED", "DELIVERED"]);
const blockedDeliveryStatuses = new Set(["DISPATCHED", "IN_TRANSIT", "DELIVERED"]);
const blockedSellerStatuses = new Set(["DISPATCHED", "DELIVERED"]);

export function AccountLoadingState({ title = "Loading account..." }: { title?: string }) {
  return (
    <Screen>
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.stateText}>{title}</Text>
      </View>
    </Screen>
  );
}

export function SignInRequiredState({
  message = "This section is linked to your 1HandIndia account.",
  title = "Sign in to continue",
}: {
  message?: string;
  title?: string;
}) {
  return (
    <Screen>
      <EmptyState title={title} message={message} />
      <Link href="/auth/sign-in" style={styles.primaryLink}>
        Sign in
      </Link>
    </Screen>
  );
}

export function RetryState({
  message,
  onRetry,
  title,
}: {
  message: string;
  onRetry: () => void;
  title: string;
}) {
  return (
    <Screen>
      <EmptyState title={title} message={message} />
      <Pressable style={styles.primaryButton} onPress={onRetry}>
        <Text style={styles.primaryButtonText}>Retry</Text>
      </Pressable>
    </Screen>
  );
}

export function StatusPill({ label, tone = "neutral" }: { label?: string | null; tone?: "neutral" | "success" | "warning" | "danger" }) {
  if (!label) {
    return null;
  }

  return (
    <View
      style={[
        styles.statusPill,
        tone === "success" ? styles.successPill : null,
        tone === "warning" ? styles.warningPill : null,
        tone === "danger" ? styles.dangerPill : null,
      ]}
    >
      <Text style={styles.statusText}>{formatStatus(label)}</Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { action?: ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function formatPrice(pricePaise?: number | null) {
  return `Rs ${Math.round((pricePaise ?? 0) / 100).toLocaleString("en-IN")}`;
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "Not updated";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not updated";
  }

  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not updated";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not updated";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function orderCanBeCancelled(order: Pick<MobileOrderDetail, "deliveryDetail" | "deliveryStatus" | "orderStatus" | "sellerSplits" | "shipments">) {
  if (blockedOrderStatuses.has(order.orderStatus)) {
    return false;
  }

  if (order.deliveryStatus && blockedDeliveryStatuses.has(order.deliveryStatus)) {
    return false;
  }

  if (order.deliveryDetail?.status && blockedDeliveryStatuses.has(order.deliveryDetail.status)) {
    return false;
  }

  if (order.shipments?.some((shipment) => blockedDeliveryStatuses.has(shipment.status))) {
    return false;
  }

  return !order.sellerSplits?.some((split) => blockedSellerStatuses.has(split.sellerStatus));
}

export function locationFromArea(area: LocationArea): SelectedLocation {
  const postalCode = area.postalCode?.trim();
  const localArea = area.name.trim();
  const city = area.city.name.trim();
  const state = area.city.subdivision.name.trim();
  const primary = `${localArea}${postalCode ? ` (${postalCode})` : ""}`;
  const labelParts = [primary, city, state].filter(Boolean);

  return {
    label: labelParts.join(", "),
    countryCode: area.city.subdivision.country.code,
    stateCode: area.city.subdivision.code,
    cityCode: area.city.code,
    localAreaCode: area.code,
    ...(postalCode ? { pincode: postalCode } : {}),
  };
}

export function accountErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  primaryLink: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 16,
    overflow: "hidden",
    paddingVertical: 14,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  statusPill: {
    backgroundColor: "#EEF6FF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  successPill: {
    backgroundColor: "#ECFDF3",
  },
  warningPill: {
    backgroundColor: "#FFF7ED",
  },
  dangerPill: {
    backgroundColor: "#FEF3F2",
  },
  statusText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
});
