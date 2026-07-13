import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, Field, Header, QueryState, Screen, SelectField, StatusChip, formatDateTime, formatPaise, humanize } from "../../src/components/screen";
import {
  listDeliveryOrders,
  findCodPayment,
  sellerToCustomerDistanceLabel,
  type DeliveryOrder,
} from "../../src/features/delivery/delivery-api";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

const deliveryStatuses = ["", "PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];
const paymentStatuses = ["", "PENDING", "PAID", "FAILED", "REFUNDED", "NOT_REQUIRED"];

export default function DeliveryOrdersScreen() {
  const auth = useMobileDeliveryAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const ordersQuery = useQuery({
    queryKey: ["delivery-orders", auth.authKey, submittedSearch, deliveryStatus, paymentStatus],
    queryFn: () => listDeliveryOrders(auth.authHeaders, { search: submittedSearch, deliveryStatus, paymentStatus, limit: 40 }),
    enabled: auth.enabled,
  });
  const orders = ordersQuery.data?.items ?? [];

  return (
    <Screen>
      <Header title="Assigned orders" subtitle="Search and update assigned forward deliveries." />
      <View style={{ gap: 12 }}>
        <Field label="Search order" value={search} onChangeText={setSearch} placeholder="Order number" />
        <Button title="Search" onPress={() => setSubmittedSearch(search.trim())} />
        <SelectField
          label="Delivery status"
          selectedValue={deliveryStatus}
          onSelect={setDeliveryStatus}
          options={deliveryStatuses.map((status) => ({ value: status, label: status ? humanize(status) : "All statuses" }))}
        />
        <SelectField
          label="Payment status"
          selectedValue={paymentStatus}
          onSelect={setPaymentStatus}
          options={paymentStatuses.map((status) => ({ value: status, label: status ? humanize(status) : "All payments" }))}
        />
      </View>
      <QueryState loading={ordersQuery.isLoading} error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} />
      {orders.map((order) => <OrderCard key={order.id} order={order} />)}
    </Screen>
  );
}

function OrderCard({ order }: { order: DeliveryOrder }) {
  const cod = findCodPayment(order);
  const distanceLabel = sellerToCustomerDistanceLabel(order);
  return (
    <Link href={`/orders/${encodeURIComponent(order.orderNumber)}` as never} asChild>
      <Pressable style={{ backgroundColor: "#FFFFFF", borderColor: "#F3E7E2", borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
        <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>{order.orderNumber}</Text>
        <Text style={{ color: "#6B7280", fontWeight: "700" }}>{formatDateTime(order.createdAt)} / {order.customer?.fullName ?? order.customer?.email ?? "Customer"}</Text>
        <Text style={{ color: "#6B7280", fontWeight: "700" }}>{(order.items ?? []).map((item) => `${item.productNameSnapshot} x${item.quantity}`).join(", ")}</Text>
        <Text style={{ color: distanceLabel ? "#ED3500" : "#9CA3AF", fontSize: 12, fontWeight: "900" }}>
          {distanceLabel ?? "Seller to customer distance unavailable"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatusChip label={humanize(order.deliveryStatus)} tone={order.deliveryStatus === "DELIVERED" ? "success" : "warning"} />
          {order.orderKind === "REPLACEMENT" ? <StatusChip label="Replacement delivery" tone="info" /> : null}
          <StatusChip label={humanize(order.deliveryDetail?.assignmentStatus ?? "ASSIGNED")} tone={order.deliveryDetail?.assignmentStatus === "ACCEPTED" ? "success" : "warning"} />
          <StatusChip label={humanize(order.paymentStatus)} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
          {cod ? <StatusChip label={`COD ${humanize(order.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED")}`} tone="info" /> : null}
        </View>
        <Text style={{ color: "#123A5A", fontWeight: "900" }}>{formatPaise(order.buyerTotalMinor ?? order.totalPaise, order.buyerCurrency ?? order.currency)}</Text>
      </Pressable>
    </Link>
  );
}
