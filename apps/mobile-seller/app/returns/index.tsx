import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Field, Header, LoadingState, QueryErrorState, Screen, StatusChip } from "../../src/components/screen";
import { listSellerReturns } from "../../src/features/seller/seller-api";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  PENDING_REVIEW: "warning",
  AUTO_APPROVED: "success",
  APPROVED: "success",
  PICKUP_PENDING: "info",
  PICKED_UP: "info",
  IN_TRANSIT: "info",
  RECEIVED: "info",
  QC_PASSED: "success",
  QC_FAILED: "danger",
  RESOLVED: "success",
  REJECTED: "danger",
  CANCELLED: "danger",
};

const statusFilters = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "QC_PASSED",
  "QC_FAILED",
  "RESOLVED",
  "REJECTED",
  "CANCELLED",
];

export default function ReturnsScreen() {
  const auth = useMobileSellerAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const returnsQuery = useQuery({
    queryKey: ["seller-returns", auth.authKey, searchQuery, statusFilter],
    queryFn: () => listSellerReturns(auth.authHeaders, {
      limit: 30,
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    }),
    enabled: auth.enabled,
  });

  if (!auth.enabled || returnsQuery.isLoading) {
    return <LoadingState message="Loading returns..." />;
  }

  if (returnsQuery.isError) {
    return (
      <Screen scroll={false}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
          <Header title="Returns" subtitle="View and manage customer return requests." />
          <QueryErrorState
            title="Returns could not be loaded"
            message={returnsQuery.error instanceof Error ? returnsQuery.error.message : undefined}
            onRetry={() => {
              void returnsQuery.refetch();
            }}
            retrying={returnsQuery.isFetching}
          />
        </ScrollView>
      </Screen>
    );
  }

  const filteredReturns = returnsQuery.data?.items || [];

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Returns" subtitle="View and manage customer return requests." />
        <Card>
          <Field
            placeholder="Search returns..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </Card>
        <Card>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Status Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 8 }}>
            {statusFilters.map((status) => (
              <Button
                key={status}
                title={status.replace(/_/g, " ")}
                tone={statusFilter === status ? "primary" : "secondary"}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </ScrollView>
        </Card>
        {filteredReturns.length ? (
          filteredReturns.map((ret) => {
            const firstItem = ret.items[0];
            const productLabel = firstItem
              ? `${firstItem.productName}${ret.items.length > 1 ? ` +${ret.items.length - 1} more` : ""}`
              : "Return item";
            const customerLabel = ret.customer?.name ?? ret.customerName ?? "Customer";

            return (
              <Card key={ret.id}>
                <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>{ret.requestNumber}</Text>
                <StatusChip
                  label={ret.status.replace(/_/g, " ")}
                  tone={statusTones[ret.status] || "info"}
                />
                <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600", marginTop: 4 }}>
                  {productLabel}
                </Text>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>
                  Customer: {customerLabel} / Order: {ret.order.orderNumber}
                </Text>
                <Text style={{ color: "#6B7280", fontSize: 10 }}>
                  {new Date(ret.createdAt).toLocaleDateString()}
                </Text>
                <Button title="View details" onPress={() => router.push(`/returns/${encodeURIComponent(ret.requestNumber)}` as Href)} />
              </Card>
            );
          })
        ) : (
          <EmptyState title="No Returns" message="No return requests found" />
        )}
      </ScrollView>
    </Screen>
  );
}
