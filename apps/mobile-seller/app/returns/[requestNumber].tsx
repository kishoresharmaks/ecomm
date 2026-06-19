import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Field, Header, LoadingState, Screen, StatusChip } from "../../src/components/screen";
import { getSellerReturn, addSellerReturnNote } from "../../src/features/seller/seller-api";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  PICKUP_PENDING: "info",
  RECEIVED: "info",
  QC_PASSED: "success",
  RESOLVED: "success",
  REJECTED: "danger",
  CANCELLED: "danger",
};

export default function ReturnDetailScreen() {
  const { requestNumber } = useLocalSearchParams<{ requestNumber: string }>();
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const returnQuery = useQuery({
    queryKey: ["seller-return", auth.authKey, requestNumber],
    queryFn: () => getSellerReturn(auth.authHeaders, requestNumber),
    enabled: auth.enabled && Boolean(requestNumber),
  });

  const noteMutation = useMutation({
    mutationFn: (payload: { note: string }) => addSellerReturnNote(auth.authHeaders, requestNumber, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-return"] });
      queryClient.invalidateQueries({ queryKey: ["seller-returns"] });
      setNote("");
    },
  });

  if (!auth.enabled || returnQuery.isLoading) {
    return <LoadingState message="Loading return details..." />;
  }

  const returnDetail = returnQuery.data;

  if (!returnDetail) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text>Return not found</Text>
        </ScrollView>
      </Screen>
    );
  }

  const handleAddNote = () => {
    if (note.trim()) {
      noteMutation.mutate({ note: note.trim() });
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Return Request" subtitle={returnDetail.requestNumber} />
        <Card>
          <StatusChip label={returnDetail.status.replace(/_/g, " ")} tone={statusTones[returnDetail.status] || "info"} />
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
            Created: {new Date(returnDetail.createdAt).toLocaleDateString()}
          </Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Product</Text>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{returnDetail.product.name}</Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Customer</Text>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{returnDetail.customer.name}</Text>
          {returnDetail.customer.email ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Email: {returnDetail.customer.email}</Text>
          ) : null}
          {returnDetail.customer.phone ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Phone: {returnDetail.customer.phone}</Text>
          ) : null}
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Return Reason</Text>
          <Text style={{ color: "#6B7280", fontSize: 14 }}>{returnDetail.returnReason}</Text>
        </Card>
        {returnDetail.conditionNotes ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Condition Notes</Text>
            <Text style={{ color: "#6B7280", fontSize: 14 }}>{returnDetail.conditionNotes}</Text>
          </Card>
        ) : null}
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Add Seller Note</Text>
          <Field
            placeholder="Add a note about this return..."
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
          <Button
            title="Add Note"
            onPress={handleAddNote}
            disabled={noteMutation.isPending || !note.trim()}
          />
        </Card>
        {returnDetail.sellerNotes && returnDetail.sellerNotes.length > 0 ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Seller Notes</Text>
            {returnDetail.sellerNotes.map((sellerNote) => (
              <View key={sellerNote.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 8, marginBottom: 8 }}>
                <Text style={{ color: "#6B7280", fontSize: 14 }}>{sellerNote.note}</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 10 }}>
                  {new Date(sellerNote.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
        <Button title="Back" tone="secondary" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
