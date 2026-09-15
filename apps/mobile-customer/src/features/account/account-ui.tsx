import { Link } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../components/empty-state";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { UserCircleIcon, ShoppingBag01Icon, TicketIcon, Location01Icon } from "@hugeicons/core-free-icons";
import { Screen } from "../../components/screen";
import { formatMoney } from "../market/mobile-market";
import type { MobileOrderDetail } from "../storefront/storefront-api";
import type { LocationArea, SelectedLocation } from "../../types/storefront";
import { colors } from "../../theme";

const blockedOrderStatuses = new Set(["CANCELLED", "SHIPPED", "DELIVERED"]);
const blockedDeliveryStatuses = new Set(["DISPATCHED", "IN_TRANSIT", "DELIVERED"]);
const blockedSellerStatuses = new Set(["DISPATCHED", "DELIVERED"]);

const BENEFITS = [
  { icon: ShoppingBag01Icon, label: "Track orders" },
  { icon: TicketIcon, label: "Wishlist" },
  { icon: Location01Icon, label: "Saved addresses" },
];

export function RequireAuthGate({ title, message }: { message?: string; title?: string }) {
  return (
    <Screen padded={false}>
      <View style={styles.gateWrap}>
        <View style={styles.gateCard}>
          <View style={styles.gateGlow} />
          <View style={styles.gateIconWrap}>
            <HugeiconsIcon color={colors.primary} icon={UserCircleIcon} size={40} strokeWidth={1.8} />
          </View>
          <Text style={styles.gateTitle}>{title ?? "Sign in to continue"}</Text>
          <Text style={styles.gateMessage}>{message ?? "This section is linked to your 1HandIndia account."}</Text>
          <View style={styles.gateBenefitRow}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.label} style={styles.gateBenefit}>
                <View style={styles.gateBenefitIconWrap}>
                  <HugeiconsIcon color={colors.primary} icon={benefit.icon} size={18} strokeWidth={2.2} />
                </View>
                <Text style={styles.gateBenefitText}>{benefit.label}</Text>
              </View>
            ))}
          </View>
          <Link href="/auth/sign-in" style={styles.gatePrimary}>
            Sign in
          </Link>
          <Link href="/auth/sign-in" style={styles.gateSecondary}>
            Create new account
          </Link>
        </View>
      </View>
    </Screen>
  );
}

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
  return <RequireAuthGate message={message} title={title} />;
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
  return formatMoney(pricePaise ?? 0, "INR", "en-IN");
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
  gateWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  gateCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#F3E7E2",
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 36,
    position: "relative",
    shadowColor: colors.primary,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 34,
    elevation: 4,
  },
  gateGlow: {
    backgroundColor: "rgba(237,53,0,0.05)",
    borderRadius: 999,
    height: 160,
    position: "absolute",
    top: -50,
    width: 160,
  },
  gateIconWrap: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 88,
    justifyContent: "center",
    marginBottom: 20,
    width: 88,
    zIndex: 1,
  },
  gateTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 29,
    textAlign: "center",
    zIndex: 1,
  },
  gateMessage: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center",
    zIndex: 1,
  },
  gateBenefitRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 26,
    zIndex: 1,
  },
  gateBenefit: {
    alignItems: "center",
    gap: 8,
  },
  gateBenefitIconWrap: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  gateBenefitText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  gatePrimary: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 28,
    overflow: "hidden",
    paddingVertical: 16,
    textAlign: "center",
    width: "100%",
    zIndex: 1,
  },
  gateSecondary: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
    zIndex: 1,
  },
});
