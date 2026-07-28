import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Field, Header, LoadingState, QueryErrorState, Screen, SelectField, StatusChip } from "../../src/components/screen";
import { listB2BOrders, type B2BOrderStatus } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

const statusTones: Partial<Record<B2BOrderStatus, "info" | "success" | "warning" | "danger">> = {
  PROFORMA_ISSUED: "warning",
  PO_SUBMITTED: "info",
  PO_ACCEPTED: "info",
  IN_FULFILMENT: "info",
  DISPATCHED: "info",
  IN_TRANSIT: "info",
  DELIVERED: "success",
  DELIVERY_ACCEPTED: "success",
  DELIVERY_DISPUTED: "danger",
  PAYMENT_OVERDUE: "danger",
  ON_HOLD: "warning",
  FULFILMENT_REVIEW_REQUIRED: "warning",
  CLOSED: "success",
  FULFILLED: "success",
  CANCELLED: "danger",
};

const statusFilters: Array<B2BOrderStatus | "ALL"> = [
  "ALL",
  "PROFORMA_ISSUED",
  "PO_SUBMITTED",
  "PO_UNDER_REVIEW",
  "PO_ACCEPTED",
  "CREDIT_CLEARANCE_PENDING",
  "IN_FULFILMENT",
  "PROCUREMENT_IN_PROGRESS",
  "PRODUCTION_IN_PROGRESS",
  "STOCK_READY",
  "PICKING",
  "PACKING",
  "QC_PENDING",
  "PACKED_AND_QC_PASSED",
  "TAX_INVOICE_ISSUED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "DELIVERY_ACCEPTED",
  "DELIVERY_DISPUTED",
  "PAYMENT_OVERDUE",
  "ON_HOLD",
  "FULFILMENT_REVIEW_REQUIRED",
  "CLOSED",
  "FULFILLED",
  "CANCELLED",
];

export default function B2BOrdersScreen() {
  const auth = useMobileSellerAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const ordersQuery = useQuery({
    queryKey: ["b2b-orders", auth.authKey, submittedSearch, statusFilter, page],
    queryFn: () =>
      listB2BOrders(auth.authHeaders, {
        page,
        limit: 30,
        ...(submittedSearch ? { search: submittedSearch } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      }),
    enabled: auth.enabled,
  });

  if (!auth.enabled || ordersQuery.isLoading) {
    return <LoadingState message="Loading B2B orders..." />;
  }

  if (ordersQuery.isError) {
    return (
      <Screen>
        <QueryErrorState
          title="B2B orders could not be loaded"
          message={ordersQuery.error instanceof Error ? ordersQuery.error.message : undefined}
          onRetry={() => void ordersQuery.refetch()}
          retrying={ordersQuery.isFetching}
        />
      </Screen>
    );
  }

  const filteredOrders = ordersQuery.data?.items || [];
  const totalPages = Math.max(1, Math.ceil((ordersQuery.data?.total ?? 0) / (ordersQuery.data?.limit ?? 30)));

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="B2B Orders" subtitle="Track proforma invoices, purchase orders, and fulfilment." />
        <Card>
          <Field
            label="Search B2B orders"
            placeholder="Order, buyer, proforma, or PO reference"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              setPage(1);
              setSubmittedSearch(searchQuery.trim());
            }}
          />
          <Button
            title="Apply search"
            tone="secondary"
            onPress={() => {
              setPage(1);
              setSubmittedSearch(searchQuery.trim());
            }}
          />
        </Card>
        <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700" }}>
          Showing {filteredOrders.length} of {ordersQuery.data?.total ?? 0} orders
        </Text>
        <Card>
          <SelectField
            label="Status filter"
            selectedValue={statusFilter}
            options={statusFilters.map((status) => ({ label: statusLabel(status), value: status }))}
            onSelect={(status) => {
              setPage(1);
              setStatusFilter(status);
            }}
          />
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
        {totalPages > 1 ? (
          <Card>
            <Text style={{ color: "#6B7280", fontSize: 12, textAlign: "center", marginBottom: 8 }}>Page {page} of {totalPages}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Previous" tone="secondary" style={{ flex: 1 }} disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} />
              <Button title="Next" tone="secondary" style={{ flex: 1 }} disabled={page >= totalPages} onPress={() => setPage((current) => Math.min(totalPages, current + 1))} />
            </View>
          </Card>
        ) : null}
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
