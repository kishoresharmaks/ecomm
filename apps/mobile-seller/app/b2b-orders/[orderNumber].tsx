import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Linking, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Header, LoadingState, Screen, StatusChip, Toast } from "../../src/components/screen";
import { getB2BOrder, getB2BOrderDocumentAccess, type B2BOrderStatus } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

const statusTones: Record<B2BOrderStatus, "info" | "success" | "warning" | "danger"> = {
  PROFORMA_ISSUED: "warning",
  PO_SUBMITTED: "info",
  PO_ACCEPTED: "info",
  IN_FULFILMENT: "info",
  FULFILLED: "success",
  CANCELLED: "danger",
};

export default function B2BOrderDetailScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const auth = useMobileSellerAuth();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" }>({
    visible: false,
    message: "",
    type: "success",
  });

  const orderQuery = useQuery({
    queryKey: ["b2b-order", auth.authKey, orderNumber],
    queryFn: () => getB2BOrder(auth.authHeaders, orderNumber),
    enabled: auth.enabled && Boolean(orderNumber),
  });

  const documentAccessMutation = useMutation({
    mutationFn: () => getB2BOrderDocumentAccess(auth.authHeaders, orderNumber),
  });

  const handleViewDocument = async () => {
    try {
      const documentAccess = await documentAccessMutation.mutateAsync();
      if (documentAccess?.documentUrl) {
        const canOpen = await Linking.canOpenURL(documentAccess.documentUrl);
        if (!canOpen) {
          throw new Error("No app is available to open this document.");
        }
        await Linking.openURL(documentAccess.documentUrl);
        return;
      }
      throw new Error("Document link is not available yet.");
    } catch (error) {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Could not open the purchase order document.",
        type: "error",
      });
    }
  };

  if (!auth.enabled || orderQuery.isLoading) {
    return <LoadingState message="Loading order details..." />;
  }

  const order = orderQuery.data;

  if (!order) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text>Order not found</Text>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="B2B Order" subtitle={order.orderNumber} />
        <Card>
          <StatusChip label={statusLabel(order.status)} tone={statusTones[order.status] || "info"} />
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
            Created: {new Date(order.createdAt).toLocaleDateString()}
          </Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Buyer Company</Text>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{order.businessBuyer?.companyName ?? "Business buyer"}</Text>
          {order.businessBuyer?.contactPhone ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Phone: {order.businessBuyer.contactPhone}</Text>
          ) : null}
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Commercial Summary</Text>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{order.product?.name ?? "General procurement"}</Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Qty: {order.quantity}</Text>
          {order.unitPricePaise ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Unit price: {formatMoney(order.unitPricePaise, order.currency)}</Text>
          ) : null}
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900", marginTop: 6 }}>
            Subtotal: {formatMoney(order.subtotalPaise ?? 0, order.currency)}
          </Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Proforma and Purchase Order</Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Proforma: {order.proformaInvoiceNumber ?? "Not issued"}</Text>
          {order.proformaIssuedAt ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Issued: {new Date(order.proformaIssuedAt).toLocaleString()}</Text>
          ) : null}
          {order.proformaExpiresAt ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Expires: {new Date(order.proformaExpiresAt).toLocaleDateString()}</Text>
          ) : null}
          <Text style={{ color: "#6B7280", fontSize: 12 }}>PO number: {order.purchaseOrderNumber ?? "Not submitted"}</Text>
          {order.purchaseOrderNote ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>PO note: {order.purchaseOrderNote}</Text>
          ) : null}
        </Card>
        {order.selectedResponse ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Selected Quote</Text>
            {order.selectedResponse.quotedPricePaise ? (
              <Text style={{ color: "#059669", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
                Quote: {formatMoney(order.selectedResponse.quotedPricePaise, order.currency)}
              </Text>
            ) : null}
            <Text style={{ color: "#6B7280", fontSize: 12 }}>{order.selectedResponse.responseMessage}</Text>
          </Card>
        ) : null}
        {(order.events?.length ?? 0) > 0 ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Timeline</Text>
            {order.events?.map((event) => (
              <View key={event.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 8, marginBottom: 8 }}>
                <StatusChip label={statusLabel(event.status)} tone={statusTones[event.status] || "info"} />
                <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>{event.note ?? "Status updated."}</Text>
                {event.createdAt ? (
                  <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 2 }}>{new Date(event.createdAt).toLocaleString()}</Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}
        <Card>
          <Button title="View Purchase Order" onPress={handleViewDocument} disabled={!order.purchaseOrderFileKey || documentAccessMutation.isPending} />
        </Card>
        <Button title="Back" tone="secondary" onPress={() => router.back()} />
        <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))} />
      </ScrollView>
    </Screen>
  );
}

function statusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
