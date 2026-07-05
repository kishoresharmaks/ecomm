import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Field, Header, LoadingState, QueryErrorState, Screen, StatusChip } from "../../src/components/screen";
import { acceptSellerReturn, addSellerReturnNote, getSellerReturn, rejectSellerReturn } from "../../src/features/seller/seller-api";
import { apiBaseUrl, MobileApiError } from "../../src/lib/api";

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

export default function ReturnDetailScreen() {
  const { requestNumber } = useLocalSearchParams<{ requestNumber: string }>();
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [openingProofKey, setOpeningProofKey] = useState<string | null>(null);
  const [proofOpenError, setProofOpenError] = useState("");

  const returnQuery = useQuery({
    queryKey: ["seller-return", auth.authKey, requestNumber],
    queryFn: () => getSellerReturn(auth.authHeaders, requestNumber),
    enabled: auth.enabled && Boolean(requestNumber),
  });

  const noteMutation = useMutation({
    mutationFn: (payload: { note: string }) => addSellerReturnNote(auth.authHeaders, requestNumber, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-return"] });
      void queryClient.invalidateQueries({ queryKey: ["seller-returns"] });
      setNote("");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptSellerReturn(auth.authHeaders, requestNumber, note.trim() || undefined),
    onSuccess: () => refreshReturnQueries(queryClient, setNote),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectSellerReturn(auth.authHeaders, requestNumber, note.trim() || undefined),
    onSuccess: () => refreshReturnQueries(queryClient, setNote),
  });

  if (!auth.enabled || returnQuery.isLoading) {
    return <LoadingState message="Loading return details..." />;
  }

  if (returnQuery.isError) {
    return (
      <Screen scroll={false}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
          <Header title="Return Request" subtitle={requestNumber} />
          <QueryErrorState
            title="Return could not be loaded"
            message={returnQuery.error instanceof Error ? returnQuery.error.message : undefined}
            onRetry={() => {
              void returnQuery.refetch();
            }}
            retrying={returnQuery.isFetching}
          />
          <Button title="Back" tone="secondary" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
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

  const customerName = returnDetail.customer?.name ?? returnDetail.customerName ?? "Customer";
  const customerEmail = returnDetail.customer?.email ?? returnDetail.customerEmail;
  const returnNotes = returnDetail.notes ?? [];
  const qualityProofKeys = returnDetail.qualityProofKeys ?? [];
  const canDecide = returnDetail.status === "PENDING_REVIEW" && returnDetail.items.some((item) => item.status === "PENDING_REVIEW");
  const decisionError = acceptMutation.error ?? rejectMutation.error;

  const handleAddNote = () => {
    if (note.trim()) {
      noteMutation.mutate({ note: note.trim() });
    }
  };

  async function openQualityProof(assetKey: string) {
    setOpeningProofKey(assetKey);
    setProofOpenError("");
    try {
      const uri = await downloadPrivateProof(auth.authHeaders, assetKey);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        setProofOpenError("Proof viewer is not available on this device.");
      }
    } catch (error) {
      setProofOpenError(error instanceof Error ? error.message : "Could not open quality proof.");
    } finally {
      setOpeningProofKey(null);
    }
  }

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Return Request" subtitle={returnDetail.requestNumber} />
        <Card>
          <StatusChip label={returnDetail.status.replace(/_/g, " ")} tone={statusTones[returnDetail.status] || "info"} />
          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
            Created: {new Date(returnDetail.createdAt).toLocaleDateString()}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>
            Order: {returnDetail.order.orderNumber}
          </Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Return Items</Text>
          {returnDetail.items.map((item) => (
            <View key={item.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 8, marginBottom: 8 }}>
              <Text style={{ color: "#374151", fontSize: 14, fontWeight: "800" }}>{item.productName}</Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Qty: {item.quantity} / Status: {item.status.replace(/_/g, " ")}
              </Text>
              {item.variantSnapshot ? <Text style={{ color: "#6B7280", fontSize: 12 }}>Variant: {item.variantSnapshot}</Text> : null}
              {item.sellerNote ? <Text style={{ color: "#6B7280", fontSize: 12 }}>Seller note: {item.sellerNote}</Text> : null}
              {item.qcNote ? <Text style={{ color: "#6B7280", fontSize: 12 }}>QC note: {item.qcNote}</Text> : null}
            </View>
          ))}
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Customer</Text>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{customerName}</Text>
          {customerEmail ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Email: {customerEmail}</Text>
          ) : null}
          {returnDetail.customer?.phone ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Phone: {returnDetail.customer.phone}</Text>
          ) : null}
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Return Reason</Text>
          <Text style={{ color: "#6B7280", fontSize: 14 }}>{returnDetail.reason}</Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Customer Quality Proof</Text>
          <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            Check clear product, packaging, label, and damage/mismatch photos before accepting.
          </Text>
          {qualityProofKeys.length ? (
            qualityProofKeys.map((key, index) => (
              <View key={key} style={{ marginBottom: 8 }}>
                <Text style={{ color: "#0F8A5F", fontSize: 12, fontWeight: "800", marginBottom: 6 }}>
                  Image {index + 1}: {key}
                </Text>
                <Button
                  title={openingProofKey === key ? "Opening..." : "Open proof"}
                  tone="secondary"
                  loading={openingProofKey === key}
                  onPress={() => void openQualityProof(key)}
                />
              </View>
            ))
          ) : (
            <Text style={{ color: "#B42318", fontSize: 12, fontWeight: "800" }}>No quality proof images were attached.</Text>
          )}
          {proofOpenError ? (
            <Text style={{ color: "#B42318", fontSize: 12, fontWeight: "800", marginTop: 8 }}>{proofOpenError}</Text>
          ) : null}
        </Card>
        {returnDetail.note ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Customer Note</Text>
            <Text style={{ color: "#6B7280", fontSize: 14 }}>{returnDetail.note}</Text>
          </Card>
        ) : null}
        {canDecide ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Seller Decision</Text>
            <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", marginBottom: 12 }}>
              Verify the customer reason and quality photos before accepting. Accepted returns move to reverse pickup assignment.
            </Text>
            <Field
              placeholder="Decision note for customer/admin"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                title="Accept Return"
                loading={acceptMutation.isPending}
                disabled={rejectMutation.isPending}
                style={{ flex: 1 }}
                onPress={() => acceptMutation.mutate()}
              />
              <Button
                title="Reject"
                tone="danger"
                loading={rejectMutation.isPending}
                disabled={acceptMutation.isPending}
                style={{ flex: 1 }}
                onPress={() => rejectMutation.mutate()}
              />
            </View>
            {decisionError ? (
              <Text style={{ color: "#B42318", fontSize: 12, fontWeight: "800", marginTop: 8 }}>
                {decisionError instanceof Error ? decisionError.message : "Could not save seller decision."}
              </Text>
            ) : null}
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
            title={noteMutation.isPending ? "Saving..." : "Add Note"}
            onPress={handleAddNote}
            disabled={noteMutation.isPending || !note.trim()}
          />
        </Card>
        {returnNotes.length > 0 ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Notes</Text>
            {returnNotes.map((sellerNote) => (
              <View key={sellerNote.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 8, marginBottom: 8 }}>
                <Text style={{ color: "#6B7280", fontSize: 14 }}>{sellerNote.note}</Text>
                <Text style={{ color: "#9CA3AF", fontSize: 10 }}>
                  {sellerNote.createdAt ? new Date(sellerNote.createdAt).toLocaleString() : "Just now"}
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

function refreshReturnQueries(queryClient: ReturnType<typeof useQueryClient>, setNote: (value: string) => void) {
  void queryClient.invalidateQueries({ queryKey: ["seller-return"] });
  void queryClient.invalidateQueries({ queryKey: ["seller-returns"] });
  setNote("");
}

type PrivateProofAccess =
  | { provider: "s3"; url: string; contentType?: string; fileName?: string }
  | { provider: "local"; contentType?: string; fileName?: string };

async function downloadPrivateProof(auth: ReturnType<typeof useMobileSellerAuth>["authHeaders"], assetKey: string) {
  const token = auth.getBearerToken ? (await auth.getBearerToken({ skipCache: true })) ?? auth.bearerToken : auth.bearerToken;
  const accessResponse = await fetch(`${apiBaseUrl()}/storage/private-document/access?key=${encodeURIComponent(assetKey)}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!accessResponse.ok) {
    throw new MobileApiError(await proofErrorMessage(accessResponse), accessResponse.status);
  }
  const access = (await accessResponse.json()) as PrivateProofAccess;
  const sourceUrl =
    access.provider === "s3"
      ? access.url
      : `${apiBaseUrl()}/storage/private-document?key=${encodeURIComponent(assetKey)}`;
  const fileName = safeProofFileName(access.fileName, access.contentType);
  const destination = `${FileSystem.cacheDirectory ?? ""}${Date.now()}-${fileName}`;
  const downloaded = await FileSystem.downloadAsync(sourceUrl, destination, {
    headers: access.provider === "local" && token ? { Authorization: `Bearer ${token}` } : {},
  });
  return downloaded.uri;
}

function safeProofFileName(fileName?: string, contentType?: string) {
  const clean = (fileName ?? "return-quality-proof").replace(/[^a-zA-Z0-9._-]/g, "-");
  if (/\.[a-zA-Z0-9]+$/.test(clean)) return clean;
  if (contentType === "image/png") return `${clean}.png`;
  if (contentType === "image/webp") return `${clean}.webp`;
  if (contentType === "application/pdf") return `${clean}.pdf`;
  return `${clean}.jpg`;
}

async function proofErrorMessage(response: Response) {
  const details = await response.json().catch(() => null);
  if (details && typeof details === "object" && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return "Could not open quality proof.";
}
