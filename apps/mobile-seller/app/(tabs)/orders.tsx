import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Field, Header, LoadingState, QueryErrorState, Screen, StatusChip } from "../../src/components/screen";
import { listSellerOrders } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

import { Recycle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";

export default function SellerOrdersScreen() {
  const auth = useMobileSellerAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [_statusFilter, _setStatusFilter] = useState<string>("ALL");
  
  const ordersQuery = useQuery({
    queryKey: ["seller-orders", auth.authKey, searchQuery, _statusFilter],
    queryFn: () => listSellerOrders(auth.authHeaders, { 
      limit: 30,
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(_statusFilter !== "ALL" ? { status: _statusFilter } : {}),
    }),
    enabled: auth.enabled,
  });

  if (!auth.enabled || ordersQuery.isLoading) {
    return <LoadingState message="Loading orders..." />;
  }

  if (ordersQuery.isError) {
    return (
      <Screen scroll={false}>
        <Header title="Orders" subtitle="Inspect seller packages, payment state, and fulfilment actions." />
        <QueryErrorState
          title="Orders could not be loaded"
          message={ordersQuery.error instanceof Error ? ordersQuery.error.message : undefined}
          onRetry={() => {
            void ordersQuery.refetch();
          }}
          retrying={ordersQuery.isFetching}
        />
      </Screen>
    );
  }

  const filteredOrders = ordersQuery.data?.items || [];

  return (
    <Screen scroll={false} contentContainerStyle={{ gap: 16 }}>
      <Header title="Orders" subtitle="Inspect seller packages, payment state, and fulfilment actions." />
      
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <HugeiconsIcon icon={Recycle01Icon} size={24} color="#ED3500" style={{ marginRight: 12 }} />
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>Returns</Text>
        </View>
        <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 12 }}>
          View and manage customer return requests.
        </Text>
        <Button
          title="View Returns"
          onPress={() => router.push("/returns")}
        />
      </Card>

      <Card>
        <Field 
          placeholder="Search orders..." 
          value={searchQuery} 
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </Card>
      {filteredOrders.length ? (
        filteredOrders.map((order) => (
          <Card key={order.id}>
            <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>{order.orderNumber}</Text>
            <StatusChip label={`${order.status ?? "ORDER"} / ${order.deliveryStatus ?? "DELIVERY"}`} />
            <Text style={{ color: "#6B7280" }}>{formatMoney(order.totalPaise, order.currency ?? "INR")}</Text>
            <Button title="Open order" onPress={() => router.push(`/orders/${encodeURIComponent(order.orderNumber)}`)} />
          </Card>
        ))
      ) : (
        <EmptyState title="No seller orders" message={searchQuery ? "Try a different search term." : "Orders containing your products will appear here after checkout."} />
      )}
    </Screen>
  );
}
