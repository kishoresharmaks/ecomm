import {
  CheckmarkCircle02Icon,
  CreditCardIcon,
  HeadsetIcon,
  PackageIcon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../../src/components/empty-state";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { formatMoney, formatOrderBaseAmount, formatOrderDisplayTotal } from "../../../src/features/market/mobile-market";
import { getCustomerOrder } from "../../../src/features/storefront/storefront-api";
import { colors } from "../../../src/theme";

export default function CheckoutSuccessScreen() {
  const params = useLocalSearchParams<{
    orderNumber?: string;
    totalPaise?: string;
    currency?: string;
    buyerCurrency?: string;
    buyerTotalMinor?: string;
    paymentStatus?: string;
  }>();
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const orderNumber = Array.isArray(params.orderNumber) ? params.orderNumber[0] : params.orderNumber;
  const fallbackTotalParam = Array.isArray(params.totalPaise) ? params.totalPaise[0] : params.totalPaise;
  const fallbackTotalPaise = Number(fallbackTotalParam);
  const fallbackCurrency = Array.isArray(params.currency) ? params.currency[0] : params.currency;
  const fallbackBuyerCurrency = Array.isArray(params.buyerCurrency) ? params.buyerCurrency[0] : params.buyerCurrency;
  const fallbackBuyerTotalParam = Array.isArray(params.buyerTotalMinor) ? params.buyerTotalMinor[0] : params.buyerTotalMinor;
  const fallbackBuyerTotalMinor = Number(fallbackBuyerTotalParam);
  const fallbackPaymentStatus = Array.isArray(params.paymentStatus) ? params.paymentStatus[0] : params.paymentStatus;
  const hasCheckoutSnapshot = Boolean(
    orderNumber &&
      fallbackTotalParam !== undefined &&
      Number.isFinite(fallbackTotalPaise) &&
      fallbackCurrency &&
      fallbackPaymentStatus,
  );

  const orderQuery = useQuery({
    queryKey: ["mobile-order-detail", customerAuth.authKey, orderNumber],
    queryFn: () => getCustomerOrder(customerAuth.authHeaders, orderNumber ?? ""),
    enabled: customerAuth.enabled && Boolean(orderNumber) && !hasCheckoutSnapshot,
    refetchOnMount: "always",
    retry: false,
  });

  const order = orderQuery.data;
  const totalPaise = order?.totalPaise ?? (Number.isFinite(fallbackTotalPaise) ? fallbackTotalPaise : 0);
  const currency = order?.currency ?? fallbackCurrency ?? "INR";
  const buyerCurrency = order?.buyerCurrency ?? fallbackBuyerCurrency ?? currency;
  const buyerTotalMinor =
    order?.buyerTotalMinor ?? (Number.isFinite(fallbackBuyerTotalMinor) ? fallbackBuyerTotalMinor : undefined);
  const paymentStatus = order?.paymentStatus ?? fallbackPaymentStatus ?? "PENDING";
  const orderStatus = order?.orderStatus ?? "PLACED";
  const totalSnapshot = {
    currency,
    totalPaise,
    ...(buyerCurrency ? { buyerCurrency } : {}),
    ...(buyerTotalMinor !== undefined ? { buyerTotalMinor } : {}),
  };

  if (!orderNumber) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Order placed" }} />
        <EmptyState title="Order not found" message="Open your recent orders to check the latest order status." />
        <Pressable style={styles.primaryButton} onPress={() => router.replace("/orders" as never)}>
          <Text style={styles.primaryButtonText}>View orders</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Order placed" }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <HugeiconsIcon color={colors.surface} icon={CheckmarkCircle02Icon} size={42} strokeWidth={2.4} />
          </View>
          <Text style={styles.eyebrow}>Order confirmed</Text>
          <Text style={styles.title}>Thank you for shopping with 1HandIndia</Text>
          <Text style={styles.subtitle}>We have received your order and will keep you updated as it moves forward.</Text>

          <View style={styles.orderNumberCard}>
            <Text style={styles.orderNumberLabel}>Order number</Text>
            <Text selectable style={styles.orderNumber}>
              {orderNumber}
            </Text>
          </View>

          <View style={styles.totalCard}>
            <View>
              <Text style={styles.totalLabel}>Order total ({buyerCurrency})</Text>
              <Text style={styles.totalValue}>{formatOrderDisplayTotal(totalSnapshot)}</Text>
              {formatOrderBaseAmount(totalSnapshot, totalPaise) ? (
                <Text style={styles.baseTotalText}>Base total: {formatMoney(totalPaise, currency, "en-IN")}</Text>
              ) : null}
            </View>
            <View style={styles.statusPill}>
              <HugeiconsIcon color={paymentStatusColor(paymentStatus)} icon={CreditCardIcon} size={16} strokeWidth={2.2} />
              <Text style={[styles.statusText, { color: paymentStatusColor(paymentStatus) }]}>{formatStatus(paymentStatus)}</Text>
            </View>
          </View>

          {orderQuery.isLoading ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.inlineLoadingText}>Refreshing order details...</Text>
            </View>
          ) : null}
          {orderQuery.isError && !hasCheckoutSnapshot ? (
            <Text style={styles.noticeText}>Latest order details could not refresh right now. Your order is still confirmed.</Text>
          ) : null}
        </View>

        <View style={styles.nextStepsCard}>
          <View style={styles.nextStepRow}>
            <View style={styles.nextStepIcon}>
              <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={24} strokeWidth={2.1} />
            </View>
            <View style={styles.nextStepCopy}>
              <Text style={styles.nextStepTitle}>Current status</Text>
              <Text style={styles.nextStepText}>{formatStatus(orderStatus)}</Text>
            </View>
          </View>
          <View style={styles.nextStepRow}>
            <View style={styles.nextStepIcon}>
              <HugeiconsIcon color={colors.primary} icon={ShoppingCart01Icon} size={24} strokeWidth={2.1} />
            </View>
            <View style={styles.nextStepCopy}>
              <Text style={styles.nextStepTitle}>What happens next</Text>
              <Text style={styles.nextStepText}>Your seller will process the order and update delivery progress.</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={() => router.replace(`/orders/${orderNumber}` as never)}>
            <Text style={styles.primaryButtonText}>View order</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.replace("/" as never)}>
            <Text style={styles.secondaryButtonText}>Continue shopping</Text>
          </Pressable>
        </View>

        <View style={styles.supportCard}>
          <View style={styles.supportIcon}>
            <HugeiconsIcon color={colors.primary} icon={HeadsetIcon} size={26} strokeWidth={2.1} />
          </View>
          <View style={styles.supportCopy}>
            <Text style={styles.supportTitle}>Need help with this order?</Text>
            <Text style={styles.supportText}>Our support team can help with payment, delivery, or seller questions.</Text>
          </View>
          <Pressable style={styles.supportButton} onPress={() => router.push("/support" as never)}>
            <Text style={styles.supportButtonText}>Support</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function paymentStatusColor(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "PAID" || normalized === "CAPTURED") {
    return "#22C55E";
  }

  if (normalized === "FAILED" || normalized === "CANCELLED") {
    return colors.danger;
  }

  return colors.primary;
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 128,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 32,
    borderWidth: 1,
    elevation: 5,
    padding: 22,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 30,
  },
  successIcon: {
    alignItems: "center",
    backgroundColor: "#22C55E",
    borderRadius: 999,
    height: 82,
    justifyContent: "center",
    marginBottom: 16,
    width: 82,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  orderNumberCard: {
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
    width: "100%",
  },
  orderNumberLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
  },
  orderNumber: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 5,
  },
  totalCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    padding: 16,
    width: "100%",
  },
  totalLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
  },
  totalValue: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 3,
  },
  baseTotalText: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  inlineLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  inlineLoadingText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
  },
  noticeText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 14,
    textAlign: "center",
  },
  nextStepsCard: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    marginTop: 18,
    padding: 18,
  },
  nextStepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  nextStepIcon: {
    alignItems: "center",
    backgroundColor: "#FFF4EF",
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  nextStepCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextStepTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  nextStepText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  actionRow: {
    gap: 12,
    marginTop: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    minHeight: 56,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  supportCard: {
    alignItems: "center",
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 16,
  },
  supportIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  supportCopy: {
    flex: 1,
    minWidth: 0,
  },
  supportTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  supportText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  supportButton: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  supportButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
});
