import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Linking, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Header, LoadingState, QueryErrorState, Screen, StatusChip, Toast } from "../../src/components/screen";
import { SellerHubHandoffButton } from "../../src/components/seller-hub-handoff-button";
import { sellerPortalB2BOrderUrl } from "../../src/features/seller/b2b-navigation";
import {
  getB2BOrder,
  getB2BOrderDocumentAccess,
  getB2BProformaDocumentAccess,
  getB2BTaxInvoiceDocumentAccess,
  type B2BOrderStatus,
} from "../../src/features/seller/seller-api";
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

type B2BDocumentType = "purchase-order" | "proforma" | "tax-invoice";

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
    mutationFn: (type: B2BDocumentType) => {
      if (type === "proforma") return getB2BProformaDocumentAccess(auth.authHeaders, orderNumber);
      if (type === "tax-invoice") return getB2BTaxInvoiceDocumentAccess(auth.authHeaders, orderNumber);
      return getB2BOrderDocumentAccess(auth.authHeaders, orderNumber);
    },
  });

  const handleViewDocument = async (type: B2BDocumentType) => {
    try {
      const documentAccess = await documentAccessMutation.mutateAsync(type);
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
        message: error instanceof Error ? error.message : "Could not open the B2B document.",
        type: "error",
      });
    }
  };

  if (!auth.enabled || orderQuery.isLoading) {
    return <LoadingState message="Loading order details..." />;
  }

  if (orderQuery.isError) {
    return (
      <Screen>
        <QueryErrorState
          title="B2B order could not be loaded"
          message={orderQuery.error instanceof Error ? orderQuery.error.message : undefined}
          onRetry={() => void orderQuery.refetch()}
          retrying={orderQuery.isFetching}
        />
      </Screen>
    );
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
          <Text style={{ color: "#6B7280", fontSize: 12 }}>
            Buyer payable: {formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise ?? 0, order.currency)}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>
            Paid: {formatMoney(order.paidAmountPaise ?? 0, order.currency)}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Payment: {statusLabel(order.paymentStatus ?? "PENDING")}</Text>
          {order.paymentDueAt ? <Text style={{ color: "#6B7280", fontSize: 12 }}>Due: {new Date(order.paymentDueAt).toLocaleDateString()}</Text> : null}
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Settlement: {statusLabel(order.settlementStatus ?? "NOT_ELIGIBLE")}</Text>
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
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Tax invoice: {order.taxInvoiceNumber ?? "Not issued"}</Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Transport</Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Mode: {statusLabel(order.transportMode ?? "SELLER_ARRANGED_TRANSPORT")}</Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Status: {statusLabel(order.transportStatus ?? "REQUESTED")}</Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Charge: {formatMoney(order.transportChargePaise ?? 0, order.currency)}</Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Partner: {order.transportPartnerName ?? "Not added"}</Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Tracking / LR / AWB: {order.transportTrackingRef ?? "Not added"}</Text>
          {order.transportEta ? <Text style={{ color: "#6B7280", fontSize: 12 }}>ETA: {order.transportEta}</Text> : null}
          {order.transportPickupAddress ? <Text style={{ color: "#6B7280", fontSize: 12 }}>Pickup: {order.transportPickupAddress}</Text> : null}
          {order.transportNote ? <Text style={{ color: "#6B7280", fontSize: 12 }}>{order.transportNote}</Text> : null}
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
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Documents</Text>
          <View style={{ gap: 8 }}>
            <Button title="View Proforma Invoice" tone="secondary" onPress={() => void handleViewDocument("proforma")} disabled={!order.proformaInvoiceNumber || documentAccessMutation.isPending} />
            <Button title="View Purchase Order" tone="secondary" onPress={() => void handleViewDocument("purchase-order")} disabled={!order.purchaseOrderFileKey || documentAccessMutation.isPending} />
            <Button title="View Tax Invoice" tone="secondary" onPress={() => void handleViewDocument("tax-invoice")} disabled={!order.taxInvoiceNumber || documentAccessMutation.isPending} />
          </View>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 6 }}>Manage this order</Text>
          <Text style={{ color: "#6B7280", fontSize: 13, marginBottom: 12 }}>
            Fulfilment planning, procurement, production, pick-pack, QC, invoicing, shipment, and dispatch controls are available in Seller Hub.
          </Text>
          <SellerHubHandoffButton
            buttonTitle="Manage in Seller Hub"
            title="Open this B2B order in Seller Hub?"
            message="The exact order will open with its full operational controls. Sign in with the same seller account if requested."
            url={sellerPortalB2BOrderUrl(order.orderNumber)}
          />
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
