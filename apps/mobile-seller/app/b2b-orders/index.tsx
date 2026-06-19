import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Field, Header, LoadingState, Screen, StatusChip } from "../../src/components/screen";
import { listB2BOrders, type B2BOrderStatus } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

const statusTones: Record<B2BOrderStatus, "info" | "success" | "warning" | "danger"> = {
  PROFORMA_ISSUED: "warning",
  PO_SUBMITTED: "info",
  PO_ACCEPTED: "info",
  IN_FULFILMENT: "info",
  FULFILLED: "success",
  CANCELLED: "danger",
};

const statusFilters: Array<B2BOrderStatus | "ALL"> = [
  "ALL",
  "PROFORMA_ISSUED",
  "PO_SUBMITTED",
  "PO_ACCEPTED",
  "IN_FULFILMENT",
  "FULFILLED",
  "CANCELLED",
];

export default function B2BOrdersScreen() {
  const auth = useMobileSellerAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const ordersQuery = useQuery({
    queryKey: ["b2b-orders", auth.authKey, searchQuery, statusFilter],
    queryFn: () =>
      listB2BOrders(auth.authHeaders, {
        limit: 30,
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      }),
    enabled: auth.enabled,
  });

  if (!auth.enabled || ordersQuery.isLoading) {
    return <LoadingState message="Loading B2B orders..." />;
  }

  const filteredOrders = ordersQuery.data?.items || [];

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="B2B Orders" subtitle="Track proforma invoices, purchase orders, and fulfilment." />
        <Card>
          <Field placeholder="Search orders..." value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
        </Card>
        <Card>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Status Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 8 }}>
            {statusFilters.map((status) => (
              <Button
                key={status}
                title={statusLabel(status)}
                tone={statusFilter === status ? "primary" : "secondary"}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </ScrollView>
        </Card>
        {filteredOrders.length ? (
          filteredOrders.map((order) => (
            <Card key={order.id}>
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>{order.orderNumber}</Text>
              <StatusChip label={statusLabel(order.status)} tone={statusTones[order.status] || "info"} />
              <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600", marginTop: 4 }}>
                {order.businessBuyer?.companyName ?? "Business buyer"}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                {order.product?.name ?? "General procurement"} - Qty {order.quantity}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                {formatMoney(order.subtotalPaise ?? 0, order.currency)} - {new Date(order.createdAt).toLocaleDateString()}
              </Text>
              <Button title="View details" onPress={() => router.push(`/b2b-orders/${encodeURIComponent(order.orderNumber)}` as Href)} />
            </Card>
          ))
        ) : (
          <EmptyState title="No Orders" message="No B2B orders found" />
        )}
      </ScrollView>
    </Screen>
  );
}

function statusLabel(status: string) {
  if (status === "ALL") {
    return "All";
  }
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
