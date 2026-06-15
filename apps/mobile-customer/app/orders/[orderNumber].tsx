import {
  CreditCardIcon,
  DeliveryBox01Icon,
  HeadsetIcon,
  Home01Icon,
  PackageIcon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import {
  formatMoney,
  formatOrderBaseAmount,
  formatOrderDisplayAmount,
  formatOrderDisplayTotal,
} from "../../src/features/market/mobile-market";
import {
  cancelCustomerOrder,
  getCustomerOrder,
  type MobileOrderDetail,
} from "../../src/features/storefront/storefront-api";
import {
  canRetryRazorpayPayment,
  isPaidRazorpayStatus,
  razorpayStatusRetryMessage,
  runMobileRazorpayPayment,
  type MobileRazorpayPaymentStage,
} from "../../src/features/storefront/razorpay-payment";
import {
  accountErrorMessage,
  formatDate,
  formatDateTime,
  formatStatus,
  orderCanBeCancelled,
  RetryState,
  SignInRequiredState,
  StatusPill,
} from "../../src/features/account/account-ui";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ orderNumber?: string }>();
  const orderNumber = Array.isArray(params.orderNumber) ? params.orderNumber[0] : params.orderNumber;
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [cancelNote, setCancelNote] = useState("");
  const [paymentRetryMessage, setPaymentRetryMessage] = useState("");
  const [paymentRetryProgress, setPaymentRetryProgress] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const retryPaymentMutationResetRef = useRef<() => void>(() => undefined);
  const cancelMutationResetRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      retryPaymentMutationResetRef.current();
      cancelMutationResetRef.current();
    };
  }, []);

  const orderQuery = useQuery({
    queryKey: ["mobile-order-detail", customerAuth.authKey, orderNumber],
    queryFn: () => getCustomerOrder(customerAuth.authHeaders, orderNumber ?? ""),
    enabled: customerAuth.enabled && Boolean(orderNumber),
    refetchOnMount: "always",
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelCustomerOrder(customerAuth.authHeaders, orderNumber ?? "", cancelNote),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-order-detail", customerAuth.authKey, orderNumber] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-orders", customerAuth.authKey] }),
      ]);
      setCancelNote("");
    },
  });

  function setRazorpayStageText(stage: MobileRazorpayPaymentStage) {
    setPaymentRetryProgressIfMounted(
      stage === "provider-order"
        ? "Starting secure payment..."
        : stage === "verification"
          ? "Verifying payment..."
          : "Opening Razorpay...",
    );
  }

  function setPaymentRetryProgressIfMounted(value: string | null) {
    if (mountedRef.current) {
      setPaymentRetryProgress(value);
    }
  }

  function setPaymentRetryMessageIfMounted(value: string) {
    if (mountedRef.current) {
      setPaymentRetryMessage(value);
    }
  }

  async function refreshOrderPaymentState() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mobile-order-detail", customerAuth.authKey, orderNumber] }),
      queryClient.invalidateQueries({ queryKey: ["mobile-orders", customerAuth.authKey] }),
    ]);
  }

  const retryPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!orderNumber) {
        throw new Error("Order number is missing.");
      }

      setPaymentRetryMessageIfMounted("");
      const verification = await runMobileRazorpayPayment({
        auth: customerAuth.authHeaders,
        orderNumber,
        prefill: customerAuth.userProfile,
        onStageChange: setRazorpayStageText,
      });

      if (!isPaidRazorpayStatus(verification.status)) {
        throw new Error(razorpayStatusRetryMessage(verification.status));
      }

      return verification;
    },
    onSuccess: async () => {
      setPaymentRetryProgressIfMounted(null);
      setPaymentRetryMessageIfMounted("Payment verified successfully.");
      await refreshOrderPaymentState();
    },
    onError: async (error) => {
      setPaymentRetryProgressIfMounted(null);
      setPaymentRetryMessageIfMounted(error instanceof Error ? error.message : "Online payment was not completed.");
      await refreshOrderPaymentState();
    },
  });

  retryPaymentMutationResetRef.current = retryPaymentMutation.reset;
  cancelMutationResetRef.current = cancelMutation.reset;

  useEffect(() => {
    if (!retryPaymentMutation.isPending && paymentRetryProgress) {
      setPaymentRetryProgress(null);
    }
  }, [paymentRetryProgress, retryPaymentMutation.isPending]);

  if (!orderNumber) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Order detail" }} />
        <EmptyState title="Order not found" message="Open the order from your orders list." />
      </Screen>
    );
  }

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || orderQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: orderNumber }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading order...</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Order detail" }} />
        <SignInRequiredState title="Sign in to view order" message="Order details are linked to your 1HandIndia account." />
      </>
    );
  }

  if (orderQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: orderNumber }} />
        <RetryState
          title="Order could not load"
          message={accountErrorMessage(orderQuery.error, "Check your connection and refresh order detail.")}
          onRetry={() => void orderQuery.refetch()}
        />
      </>
    );
  }

  const order = orderQuery.data;
  if (!order) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: orderNumber }} />
        <EmptyState title="Order not found" message="This order is not available for this account." />
      </Screen>
    );
  }

  const canCancel = orderCanBeCancelled(order);
  const canRetryPayment = canRetryRazorpayPayment(order);
  const address = readShippingAddress(order);
  const timeline = buildTimeline(order);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: order.orderNumber }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={28} strokeWidth={2.1} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              <Text style={styles.orderMeta}>Placed {formatDate(order.createdAt)}</Text>
            </View>
            <Text style={styles.orderTotal}>{formatOrderDisplayTotal(order)}</Text>
          </View>
          <View style={styles.statusRow}>
            <StatusPill label={order.orderStatus} tone={order.orderStatus === "CANCELLED" ? "danger" : "neutral"} />
            <StatusPill label={order.paymentStatus} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
            <StatusPill label={order.deliveryStatus} tone={order.deliveryStatus === "DELIVERED" ? "success" : "neutral"} />
          </View>
          <OrderProgress order={order} />
        </View>

        <Section icon={ShoppingCart01Icon} title="Items">
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <RemoteImage fallbackLabel={item.productNameSnapshot} style={styles.itemImage} uri={resolveImageUrl(item.product?.imageUrl)} />
              <View style={styles.itemBody}>
                <Text numberOfLines={2} style={styles.itemName}>{item.productNameSnapshot}</Text>
                <Text numberOfLines={1} style={styles.itemMeta}>
                  Qty {item.quantity}
                  {item.seller?.storeName ? ` - ${item.seller.storeName}` : ""}
                </Text>
                <Text style={styles.itemMeta}>{formatMoney(item.unitPricePaise, item.currency ?? order.currency, "en-IN")} each</Text>
              </View>
              <Text style={styles.itemTotal}>{formatMoney(item.lineTotalPaise, item.currency ?? order.currency, "en-IN")}</Text>
            </View>
          ))}
        </Section>

        <Section icon={DeliveryBox01Icon} title="Delivery">
          <View style={styles.detailGrid}>
            <Detail label="Delivery status" value={formatStatus(order.deliveryDetail?.status ?? order.deliveryStatus)} />
            <Detail label="Mode" value={formatStatus(order.deliveryDetail?.deliveryMode ?? "Standard")} />
            <Detail label="Estimated" value={formatDate(order.deliveryDetail?.estimatedDeliveryDate)} />
            <Detail label="Tracking" value={firstTracking(order) ?? "Not assigned"} />
          </View>
          <View style={styles.timeline}>
            {timeline.map((event, index) => (
              <View key={`${event.label}-${event.createdAt ?? index}`} style={styles.timelineRow}>
                <View style={[styles.timelineDot, index === 0 ? styles.timelineDotActive : null]} />
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{event.label}</Text>
                  {event.note ? <Text style={styles.timelineNote}>{event.note}</Text> : null}
                  <Text style={styles.timelineDate}>{formatDateTime(event.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        <Section icon={Home01Icon} title="Delivery address">
          {address ? (
            <View>
              <Text style={styles.addressName}>{address.fullName ?? "Delivery address"}</Text>
              <Text style={styles.addressText}>{[address.line1, address.line2, address.area].filter(Boolean).join(", ")}</Text>
              <Text style={styles.addressText}>{[address.city, address.state, address.pincode].filter(Boolean).join(" - ")}</Text>
              {address.phone ? <Text style={styles.addressText}>{address.phone}</Text> : null}
            </View>
          ) : (
            <Text style={styles.helpText}>Address details are not available for this order.</Text>
          )}
        </Section>

        <Section icon={CreditCardIcon} title="Payment and total">
          <SummaryRow
            label="Subtotal"
            value={formatOrderDisplayAmount(order, order.buyerPayableSubtotalMinor ?? order.buyerSubtotalMinor, order.subtotalPaise)}
          />
          <SummaryRow label="Shipping" value={formatOrderDisplayAmount(order, order.buyerShippingMinor, order.shippingPaise)} />
          <SummaryRow label="Platform fee" value={formatOrderDisplayAmount(order, order.buyerPlatformFeeMinor, order.platformFeePaise)} />
          {order.couponDiscountPaise ? (
            <SummaryRow label="Coupon" value={`-${formatOrderDisplayAmount(order, order.buyerCouponDiscountMinor, order.couponDiscountPaise)}`} />
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total paid</Text>
            <Text style={styles.totalValue}>{formatOrderDisplayTotal(order)}</Text>
          </View>
          {formatOrderBaseAmount(order, order.totalPaise) ? (
            <Text style={styles.helpText}>Base total: {formatOrderBaseAmount(order, order.totalPaise)}</Text>
          ) : null}
          {order.payments?.[0] ? (
            <Text style={styles.helpText}>
              {formatStatus(order.payments[0].method)} payment is {formatStatus(order.payments[0].status)}.
            </Text>
          ) : null}
          {canRetryPayment ? (
            <View style={styles.retryPaymentBox}>
              <Text style={styles.retryPaymentTitle}>Online payment pending</Text>
              <Text style={styles.helpText}>Complete the Razorpay payment to move this order to paid.</Text>
              {paymentRetryMessage ? (
                <Text style={[styles.retryPaymentMessage, paymentRetryMessage.toLowerCase().includes("success") ? styles.retryPaymentSuccess : null]}>
                  {paymentRetryMessage}
                </Text>
              ) : null}
              <Pressable
                disabled={retryPaymentMutation.isPending}
                style={[styles.primaryActionButton, retryPaymentMutation.isPending ? styles.buttonDisabled : null]}
                onPress={() => retryPaymentMutation.mutate()}
              >
                {retryPaymentMutation.isPending ? (
                  <>
                    <ActivityIndicator color={colors.surface} />
                    <Text style={styles.primaryActionButtonText}>{paymentRetryProgress ?? "Processing payment..."}</Text>
                  </>
                ) : (
                  <Text style={styles.primaryActionButtonText}>Retry online payment</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </Section>

        <Section icon={HeadsetIcon} title="Need help">
          <Text style={styles.helpText}>
            Support can review this order number and follow up through your selected contact channel.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.push(`/account/support?orderNumber=${encodeURIComponent(order.orderNumber)}` as never)}>
            <Text style={styles.secondaryButtonText}>Contact support</Text>
          </Pressable>
        </Section>

        <View style={styles.cancelCard}>
          <Text style={styles.cancelTitle}>{canCancel ? "Cancellation available" : "Cancellation locked"}</Text>
          <Text style={styles.helpText}>
            {canCancel
              ? "You can cancel before dispatch. The backend will re-check the order before accepting it."
              : "This order has already moved into dispatch, shipment, delivery, or cancellation state."}
          </Text>
          {canCancel ? (
            <>
              <TextInput
                multiline
                onChangeText={setCancelNote}
                placeholder="Cancellation note optional"
                placeholderTextColor={colors.muted}
                style={styles.noteInput}
                value={cancelNote}
              />
              {cancelMutation.isError ? (
                <Text style={styles.errorText}>{accountErrorMessage(cancelMutation.error, "Cancellation could not be completed.")}</Text>
              ) : null}
              <Pressable
                disabled={cancelMutation.isPending}
                style={[styles.dangerButton, cancelMutation.isPending ? styles.buttonDisabled : null]}
                onPress={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.dangerButtonText}>Cancel order</Text>}
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ children, icon, title }: { children: ReactNode; icon: IconSvgElement; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <HugeiconsIcon color={colors.primary} icon={icon} size={22} strokeWidth={2.1} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function OrderProgress({ order }: { order: MobileOrderDetail }) {
  const activeIndex = orderProgressIndex(order);
  const steps: Array<{ icon: IconSvgElement; label: string; sublabel: string }> = [
    { icon: PackageIcon, label: "Placed", sublabel: formatDate(order.createdAt) },
    { icon: CreditCardIcon, label: "Processing", sublabel: activeIndex >= 1 ? "In progress" : "Pending" },
    { icon: DeliveryBox01Icon, label: "Shipped", sublabel: activeIndex >= 2 ? "On the way" : "Pending" },
    { icon: Home01Icon, label: "Delivered", sublabel: activeIndex >= 3 ? "Completed" : "Pending" },
  ];

  return (
    <View style={styles.progressCard}>
      {steps.map((step, index) => {
        const complete = activeIndex >= index;
        const cancelled = activeIndex < 0;
        return (
          <View key={step.label} style={styles.progressStep}>
            <View style={[styles.progressIcon, complete ? styles.progressIconDone : null, cancelled ? styles.progressIconMuted : null]}>
              <HugeiconsIcon color={complete ? colors.surface : colors.muted} icon={step.icon} size={18} strokeWidth={2.1} />
            </View>
            {index < steps.length - 1 ? <View style={[styles.progressLine, complete && activeIndex > index ? styles.progressLineDone : null]} /> : null}
            <Text numberOfLines={1} style={styles.progressLabel}>{step.label}</Text>
            <Text numberOfLines={1} style={styles.progressSubLabel}>{cancelled ? "Stopped" : step.sublabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

function readShippingAddress(order: MobileOrderDetail) {
  const snapshot = order.shippingAddressSnapshot as Partial<{
    area: string;
    city: string;
    fullName: string;
    line1: string;
    line2: string;
    phone: string;
    pincode: string;
    state: string;
  }> | null | undefined;

  return snapshot ?? null;
}

function firstTracking(order: MobileOrderDetail) {
  return order.deliveryDetail?.trackingReference ?? order.shipments?.find((shipment) => shipment.trackingReference)?.trackingReference ?? null;
}

function buildTimeline(order: MobileOrderDetail) {
  const deliveryTimeline = order.customerDeliveryTimeline ?? [];
  if (deliveryTimeline.length) {
    return deliveryTimeline.map((event) => ({
      label: event.label ?? formatStatus(event.status ?? "Order update"),
      note: event.note,
      createdAt: event.createdAt,
    }));
  }

  const statusEvents = order.statusEvents ?? [];
  if (statusEvents.length) {
    return statusEvents.map((event) => ({
      label: formatStatus(event.newStatus ?? event.statusType ?? "Order update"),
      note: event.note,
      createdAt: event.createdAt,
    }));
  }

  return [{ label: formatStatus(order.orderStatus), note: "Order created.", createdAt: order.createdAt }];
}

function orderProgressIndex(order: MobileOrderDetail) {
  const orderStatus = order.orderStatus?.toUpperCase() ?? "";
  const deliveryStatus = order.deliveryStatus?.toUpperCase() ?? "";
  const deliveryDetailStatus = order.deliveryDetail?.status?.toUpperCase() ?? "";
  const combined = `${orderStatus} ${deliveryStatus} ${deliveryDetailStatus}`;

  if (combined.includes("CANCEL")) {
    return -1;
  }

  if (combined.includes("DELIVER")) {
    return 3;
  }

  if (combined.includes("SHIP") || combined.includes("DISPATCH") || combined.includes("TRANSIT") || combined.includes("OUT_FOR_DELIVERY")) {
    return 2;
  }

  if (combined.includes("PROCESS") || combined.includes("ACCEPT") || combined.includes("CONFIRM") || combined.includes("PACK")) {
    return 1;
  }

  return 0;
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 128,
  },
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
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.055,
    shadowRadius: 24,
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EB",
    borderRadius: 999,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  orderMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  orderTotal: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  progressCard: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  progressIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginBottom: 8,
    width: 42,
  },
  progressIconDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressIconMuted: {
    backgroundColor: "#F3F4F6",
    borderColor: colors.border,
  },
  progressLabel: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  progressLine: {
    borderColor: colors.border,
    borderStyle: "dashed",
    borderTopWidth: 1,
    height: 1,
    left: "64%",
    position: "absolute",
    top: 21,
    width: "72%",
  },
  progressLineDone: {
    borderColor: colors.primary,
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    position: "relative",
  },
  progressSubLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
    textAlign: "center",
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  itemRow: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    padding: 12,
  },
  itemImage: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    height: 70,
    width: 70,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  itemTotal: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailBox: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 70,
    padding: 12,
    width: "48.5%",
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 5,
  },
  timeline: {
    marginTop: 12,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  timelineDot: {
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 12,
    marginTop: 3,
    width: 12,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
  },
  timelineTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  timelineNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  timelineDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  addressName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  addressText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  totalRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 13,
  },
  totalLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  totalValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  retryPaymentBox: {
    backgroundColor: "#FFF7F3",
    borderColor: "#FFD7CA",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  retryPaymentTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  retryPaymentMessage: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 8,
  },
  retryPaymentSuccess: {
    color: colors.success,
  },
  primaryActionButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 46,
  },
  primaryActionButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#FFD7CA",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  cancelCard: {
    backgroundColor: "#FFF7F3",
    borderColor: "#FFD7CA",
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.035,
    shadowRadius: 20,
  },
  cancelTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 5,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: 999,
    marginTop: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  dangerButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  buttonDisabled: {
    backgroundColor: "#A8AFBA",
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
  },
});
