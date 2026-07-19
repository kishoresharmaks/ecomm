import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../src/theme";
import { Header, Metric, QueryState, Screen, StatusChip, formatPaise, humanize } from "../../src/components/screen";
import {
  listDeliveryOrders,
  getDeliveryProfile,
  getDeliveryWallet,
  findCodPayment,
  sellerToCustomerDistanceLabel,
  type DeliveryOrder,
} from "../../src/features/delivery/delivery-api";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

export default function DeliveryDashboardScreen() {
  const auth = useMobileDeliveryAuth();
  const queryClient = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: ["delivery-orders", auth.authKey, "dashboard"],
    queryFn: () => listDeliveryOrders(auth.authHeaders, { limit: 50 }),
    enabled: auth.enabled,
  });
  const walletQuery = useQuery({
    queryKey: ["delivery-wallet", auth.authKey, "dashboard"],
    queryFn: () => getDeliveryWallet(auth.authHeaders, { limit: 5 }),
    enabled: auth.enabled,
  });
  const profileQuery = useQuery({
    queryKey: ["delivery-profile", auth.authKey, "dashboard"],
    queryFn: () => getDeliveryProfile(auth.authHeaders),
    enabled: auth.enabled,
  });

  const orders = ordersQuery.data?.items ?? [];
  const active = orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus));
  const delivered = orders.filter((order) => order.deliveryStatus === "DELIVERED");
  const codPending = orders.filter((order) => order.paymentStatus === "PENDING" && findCodPayment(order));

  const isRefreshing = ordersQuery.isFetching || walletQuery.isFetching || profileQuery.isFetching;

  const handleRefresh = async () => {
    // invalidateQueries already refetches active queries; calling refetch()
    // after it would fetch every endpoint twice.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-wallet"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-profile"] }),
    ]);
  };

  return (
    <Screen>
      <Header
        title="Delivery dashboard"
        subtitle="Assigned order focus, COD visibility, and wallet summary."
        right={
          <Pressable onPress={handleRefresh} disabled={isRefreshing} style={{ padding: 8, opacity: isRefreshing ? 0.5 : 1 }}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "900" }}>Refresh</Text>
          </Pressable>
        }
      />
      <QueryState loading={ordersQuery.isLoading} error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Metric label="Assigned" value={ordersQuery.data?.total ?? orders.length} note="Orders assigned" />
        <Metric label="Active" value={active.length} note="Needs progress" />
        <Metric label="Delivered" value={delivered.length} note="Completed" />
        <Metric label="COD pending" value={codPending.length} note="Needs verification" />
        <Metric label="Wallet" value={formatPaise(walletQuery.data?.summary.availableBalancePaise ?? 0)} note="Available balance" />
        <Metric label="COD handover" value={profileQuery.data?.deliveryProfile.razorpayVirtualUpiId ? "Ready" : "Pending"} note="Smart Collect UPI" />
      </View>
      <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>Today focus</Text>
      {orders.slice(0, 8).map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </Screen>
  );
}

function OrderRow({ order }: { order: DeliveryOrder }) {
  const distanceLabel = sellerToCustomerDistanceLabel(order);
  return (
    <Link href={`/orders/${encodeURIComponent(order.orderNumber)}` as never} asChild>
      <Pressable style={{ backgroundColor: "#FFFFFF", borderColor: "#F3E7E2", borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: "#123A5A", flex: 1, fontSize: 17, fontWeight: "900" }}>{order.orderNumber}</Text>
          <StatusChip label={humanize(order.deliveryStatus)} tone={order.deliveryStatus === "DELIVERED" ? "success" : "warning"} />
        </View>
        {order.orderKind === "REPLACEMENT" ? <StatusChip label="Replacement delivery" tone="info" /> : null}
        <Text style={{ color: "#6B7280", fontWeight: "700" }}>
          {(order.items ?? []).map((item) => `${item.productNameSnapshot} x${item.quantity}`).join(", ") || "Assigned delivery"}
        </Text>
        <Text style={{ color: distanceLabel ? "#ED3500" : "#9CA3AF", fontSize: 12, fontWeight: "900" }}>
          {distanceLabel ?? "Seller to customer distance unavailable"}
        </Text>
        <Text style={{ color: "#123A5A", fontWeight: "900" }}>
          {formatPaise(order.buyerTotalMinor ?? order.totalPaise, order.buyerCurrency ?? order.currency)}
        </Text>
      </Pressable>
    </Link>
  );
}
