import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, ConfirmDialog, Field, Header, LoadingState, Screen, StatusChip } from "../../src/components/screen";
import { getB2BEnquiry, respondToB2BEnquiry, type B2BEnquiryResponsePayload, type B2BEnquiryStatus } from "../../src/features/seller/seller-api";
import { formatMoney, rupeesToPaise } from "../../src/lib/money";

const statusTones: Record<B2BEnquiryStatus, "info" | "success" | "warning" | "danger"> = {
  SUBMITTED: "warning",
  IN_REVIEW: "warning",
  RESPONDED: "info",
  BUYER_CONFIRMED: "info",
  ADMIN_APPROVED: "success",
  FINALISED: "success",
  CLOSED: "danger",
  CANCELLED: "danger",
};

export default function B2BEnquiryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const enquiryQuery = useQuery({
    queryKey: ["b2b-enquiry", auth.authKey, id],
    queryFn: () => getB2BEnquiry(auth.authHeaders, id),
    enabled: auth.enabled && Boolean(id),
  });

  const responseMutation = useMutation({
    mutationFn: (payload: B2BEnquiryResponsePayload) => respondToB2BEnquiry(auth.authHeaders, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b-enquiry"] });
      queryClient.invalidateQueries({ queryKey: ["b2b-enquiries"] });
      setShowConfirmDialog(false);
      setPrice("");
      setResponseMessage("");
    },
  });

  if (!auth.enabled || enquiryQuery.isLoading) {
    return <LoadingState message="Loading enquiry details..." />;
  }

  const enquiry = enquiryQuery.data;
  const isLocked = enquiry ? ["BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED", "CANCELLED"].includes(enquiry.status) : false;
  const canRespond = enquiry ? ["SUBMITTED", "IN_REVIEW", "RESPONDED"].includes(enquiry.status) : false;

  const handleResponseSubmit = () => {
    if (responseMessage.trim().length < 5) return;
    setShowConfirmDialog(true);
  };

  const confirmResponse = () => {
    const pricePaise = rupeesToPaise(price);
    const payload: B2BEnquiryResponsePayload = {
      responseMessage: responseMessage.trim(),
    };
    if (pricePaise > 0) {
      payload.quotedPricePaise = pricePaise;
    }
    responseMutation.mutate(payload);
  };

  if (!enquiry) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text>Enquiry not found</Text>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="B2B Enquiry" subtitle={enquiry.product?.name ?? "General enquiry"} />
        <Card>
          <StatusChip label={statusLabel(enquiry.status)} tone={statusTones[enquiry.status] || "info"} />
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
            Created: {new Date(enquiry.createdAt).toLocaleDateString()}
          </Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Buyer Company</Text>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{enquiry.businessBuyer?.companyName ?? "Business buyer"}</Text>
          {enquiry.businessBuyer?.contactName ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Contact: {enquiry.businessBuyer.contactName}</Text>
          ) : null}
          {enquiry.businessBuyer?.user?.email ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Email: {enquiry.businessBuyer.user.email}</Text>
          ) : null}
          {enquiry.businessBuyer?.contactPhone ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Phone: {enquiry.businessBuyer.contactPhone}</Text>
          ) : null}
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Requested Product</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 8, marginBottom: 8 }}>
            <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>
              {enquiry.product?.name ?? enquiry.seller?.storeName ?? "General procurement"}
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Qty: {enquiry.quantity ?? 0}</Text>
            {enquiry.product?.variants?.[0]?.pricePaise ? (
              <Text style={{ color: "#6B7280", fontSize: 12 }}>Listed price: {formatMoney(enquiry.product.variants[0].pricePaise)}</Text>
            ) : null}
          </View>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Requirements</Text>
          <Text style={{ color: "#6B7280", fontSize: 14 }}>{enquiry.message}</Text>
        </Card>
        {(enquiry.responses?.length ?? 0) > 0 ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Responses</Text>
            {enquiry.responses?.map((response) => (
              <View key={response.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 8, marginBottom: 8 }}>
                {response.quotedPricePaise ? (
                  <Text style={{ color: "#059669", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
                    Quote: {formatMoney(response.quotedPricePaise)}
                  </Text>
                ) : null}
                <Text style={{ color: "#6B7280", fontSize: 12 }}>{response.responseMessage}</Text>
                {response.createdAt ? (
                  <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 4 }}>
                    Responded: {new Date(response.createdAt).toLocaleString()}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}
        {enquiry.b2bOrder ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>B2B Order</Text>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Order: {enquiry.b2bOrder.orderNumber}</Text>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Status: {statusLabel(enquiry.b2bOrder.status)}</Text>
          </Card>
        ) : null}
        {canRespond ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 12 }}>Respond to Enquiry</Text>
            <Field label="Quoted unit price" placeholder="Enter price in rupees" value={price} onChangeText={setPrice} keyboardType="numeric" />
            <Field
              label="Response"
              placeholder="Share availability, lead time, payment terms, and any offer details."
              value={responseMessage}
              onChangeText={setResponseMessage}
              multiline
              numberOfLines={4}
            />
            <Button title="Submit Response" onPress={handleResponseSubmit} disabled={responseMutation.isPending || responseMessage.trim().length < 5} />
          </Card>
        ) : isLocked ? (
          <Card>
            <Text style={{ color: "#6B7280", fontSize: 14, textAlign: "center" }}>
              This enquiry is locked and cannot be modified.
            </Text>
          </Card>
        ) : null}
        <Button title="Back" tone="secondary" onPress={() => router.back()} />
        <ConfirmDialog
          visible={showConfirmDialog}
          title="Submit Response"
          message="Are you sure you want to submit your quotation response?"
          onConfirm={confirmResponse}
          onCancel={() => setShowConfirmDialog(false)}
        />
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
