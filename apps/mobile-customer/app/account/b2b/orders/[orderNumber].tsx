import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../../../../src/components/screen";
import { EmptyState } from "../../../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../../src/features/b2b/b2b-auth-gate";
import {
  canSubmitPO,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
} from "../../../../src/features/b2b/b2b-enquiry-status";
import {
  validatePOFile,
  uploadPO,
  PO_ALLOWED_EXTENSIONS,
} from "../../../../src/features/b2b/po-upload";
import { MobileApiError } from "../../../../src/lib/api";
import { getB2BOrder, getPODocumentAccess, submitPurchaseOrder } from "../../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../../src/theme";
import type { B2BOrder } from "../../../../src/features/b2b/b2b-types";

// ─── Upload State Machine ─────────────────────────────────────────────────────
type UploadState = "idle" | "uploading" | "done" | "interrupted";
type SubmitState = "idle" | "submitting" | "done" | "error";

function B2BOrderDetailContent({ order }: { order: B2BOrder }) {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();

  // PO form state
  const [poNumber, setPoNumber] = useState(order.purchaseOrderNumber ?? "");
  const [poNote, setPoNote] = useState(order.purchaseOrderNote ?? "");
  const [uploadError, setUploadError] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [assetKey, setAssetKey] = useState<string | null>(null);
  const [viewError, setViewError] = useState("");
  const [isViewLoading, setIsViewLoading] = useState(false);

  const statusColor = ORDER_STATUS_COLOR[order.status];
  const showPOUpload = canSubmitPO(order.status);
  const hasExistingPO = Boolean(order.purchaseOrderFileKey ?? order.purchaseOrderNumber);

  async function handlePickAndUpload() {
    setUploadError("");
    setUploadState("idle");

    // Step 1: Pick file
    let result: Awaited<ReturnType<typeof import("expo-document-picker").getDocumentAsync>>;
    try {
      result = await pickDocument({
        type: [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch (error) {
      setUploadState("interrupted");
      setUploadError(documentPickerErrorMessage(error));
      return;
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const candidate = {
      uri: asset.uri,
      mimeType: asset.mimeType ?? "application/octet-stream",
      name: asset.name ?? "purchase-order",
      size: asset.size ?? 0,
    };

    // Step 2: client-side validate (no network call yet)
    const validationError = validatePOFile(candidate);
    if (validationError) {
      setUploadError(validationError.message);
      return;
    }

    // Step 3–7: upload (stale URL rule enforced inside uploadPO)
    setUploadState("uploading");
    try {
      const { assetKey: key } = await uploadPO(
        customerAuth.authHeaders,
        order.orderNumber,
        candidate,
      );
      setAssetKey(key);
      setUploadState("done");
    } catch (error) {
      setUploadState("interrupted");
      setUploadError(
        error instanceof Error ? error.message : "Upload interrupted. Tap to retry.",
      );
    }
  }

  // Step 8: submit PO (independent from upload)
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!assetKey && !order.purchaseOrderFileKey) {
        throw new Error("Upload a document before submitting.");
      }
      const payload: { purchaseOrderNumber: string; purchaseOrderFileKey?: string; note?: string } = {
        purchaseOrderNumber: poNumber.trim() || order.proformaInvoiceNumber,
      };
      const keyToSubmit = assetKey ?? order.purchaseOrderFileKey;
      if (keyToSubmit) {
        payload.purchaseOrderFileKey = keyToSubmit;
      }
      if (poNote.trim()) {
        payload.note = poNote.trim();
      }
      return submitPurchaseOrder(customerAuth.authHeaders, order.orderNumber, payload);
    },
    onMutate: () => setSubmitState("submitting"),
    onSuccess: () => {
      setSubmitState("done");
      // Invalidate order but do NOT reset upload state
      void queryClient.invalidateQueries({
        queryKey: ["b2b-order", customerAuth.authKey, order.orderNumber],
      });
      void queryClient.invalidateQueries({ queryKey: ["b2b-orders", customerAuth.authKey] });
    },
    onError: (error) => {
      // Upload already succeeded — retry is submit-only
      setSubmitState("error");
      setUploadError(error instanceof Error ? error.message : "Could not submit. Tap to retry.");
    },
  });

  async function handleViewPO() {
    setViewError("");
    setIsViewLoading(true);
    try {
      const access = await getPODocumentAccess(customerAuth.authHeaders, order.orderNumber);
      const url = access.url;
      if (!url) {
        setViewError("PO document is not available.");
        return;
      }

      // Download to temp file
      const fileName = `po-${order.orderNumber}.pdf`;
      const dest = `${FileSystem.cacheDirectory ?? ""}${fileName}`;
      await FileSystem.downloadAsync(url, dest);

      // Open via native sharing
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, { UTI: ".pdf", mimeType: "application/pdf" });
      } else {
        setViewError("Sharing is not available on this device.");
      }
    } catch (error) {
      if (error instanceof MobileApiError && error.status === 404) {
        setViewError("PO document is not available.");
      } else {
        setViewError(error instanceof Error ? error.message : "Could not open document. Try again.");
      }
    } finally {
      setIsViewLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
          {ORDER_STATUS_LABEL[order.status]}
        </Text>
      </View>

      {/* Order header */}
      <InfoCard label="Proforma no." value={order.proformaInvoiceNumber} />
      <InfoCard label="Quantity" value={String(order.quantity)} />
      {order.proformaIssuedAt ? (
        <InfoCard label="Proforma issued" value={formatDate(order.proformaIssuedAt)} />
      ) : null}
      {order.unitPricePaise ? (
        <InfoCard label="Unit price" value={`Rs. ${(order.unitPricePaise / 100).toFixed(2)}`} />
      ) : null}
      {order.subtotalPaise ? (
        <InfoCard label="Subtotal" value={`Rs. ${(order.subtotalPaise / 100).toFixed(2)}`} />
      ) : null}
      {order.proformaExpiresAt ? (
        <InfoCard label="Proforma expires" value={formatDate(order.proformaExpiresAt)} />
      ) : null}

      {/* Product / seller context */}
      {order.product || order.seller ? (
        <InfoCard
          label={order.product ? "Product" : "Seller"}
          value={order.product?.name ?? order.seller?.storeName ?? "—"}
        />
      ) : null}

      {/* PO Section */}
      {showPOUpload ? (
        <View style={styles.poSection}>
          <Text style={styles.poSectionTitle}>Purchase Order</Text>

          {/* PO Number input */}
          <Text style={styles.fieldLabel}>PO Number (optional)</Text>
          <TextInput
            onChangeText={setPoNumber}
            placeholder="Enter your PO reference number"
            placeholderTextColor={colors.muted}
            style={styles.fieldInput}
            value={poNumber}
          />

          {/* Note */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Note (optional)</Text>
          <TextInput
            multiline
            numberOfLines={3}
            onChangeText={setPoNote}
            placeholder="Any additional notes"
            placeholderTextColor={colors.muted}
            style={[styles.fieldInput, styles.noteInput]}
            textAlignVertical="top"
            value={poNote}
          />

          {/* Upload section */}
          <View style={styles.uploadRow}>
            {uploadState === "done" ? (
              <View style={styles.uploadSuccessRow}>
                <Text style={styles.uploadSuccessText}>Done - Document uploaded</Text>
              </View>
            ) : (
              <Pressable
                disabled={uploadState === "uploading"}
                style={[styles.uploadBtn, uploadState === "uploading" && styles.uploadBtnDisabled]}
                onPress={() => void handlePickAndUpload()}
              >
                {uploadState === "uploading" ? (
                  <>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.uploadBtnText}>Uploading…</Text>
                  </>
                ) : (
                  <Text style={styles.uploadBtnText}>
                    {uploadState === "interrupted"
                      ? "Upload interrupted — tap to retry"
                      : `Choose PO document (${PO_ALLOWED_EXTENSIONS})`}
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          {uploadError ? <Text style={styles.uploadError}>{uploadError}</Text> : null}

          {/* Submit button */}
          <Pressable
            disabled={submitMutation.isPending || uploadState === "uploading"}
            style={[
              styles.submitBtn,
              (submitMutation.isPending || uploadState === "uploading") && styles.submitBtnDisabled,
            ]}
            onPress={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {submitState === "error"
                  ? "Could not submit - tap to retry"
                  : submitState === "done"
                    ? "PO submitted - done"
                    : "Submit purchase order"}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* View existing PO */}
      {hasExistingPO ? (
        <View style={styles.poViewSection}>
          <Text style={styles.poSectionTitle}>Purchase Order Document</Text>
          {order.purchaseOrderNumber ? (
            <InfoCard label="PO Reference" value={order.purchaseOrderNumber} />
          ) : null}
          {order.purchaseOrderSubmittedAt ? (
            <InfoCard label="Submitted" value={formatDate(order.purchaseOrderSubmittedAt)} />
          ) : null}
          {viewError ? <Text style={styles.uploadError}>{viewError}</Text> : null}
          <Pressable
            disabled={isViewLoading}
            style={[styles.viewBtn, isViewLoading && styles.submitBtnDisabled]}
            onPress={() => void handleViewPO()}
          >
            {isViewLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.viewBtnText}>Open PO document</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* Timeline */}
      {order.events && order.events.length > 0 ? (
        <View style={styles.timeline}>
          <Text style={styles.poSectionTitle}>Order timeline</Text>
          {order.events.map((ev) => (
            <View key={ev.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineBody}>
                <Text style={styles.timelineStatus}>{ORDER_STATUS_LABEL[ev.status]}</Text>
                {ev.note ? <Text style={styles.timelineNote}>{ev.note}</Text> : null}
                {ev.createdAt ? (
                  <Text style={styles.timelineDate}>{formatDate(ev.createdAt)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function B2BOrderDetailScreen() {
  const customerAuth = useMobileCustomerAuth();
  const params = useLocalSearchParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber ?? "";

  const orderQuery = useQuery({
    queryKey: ["b2b-order", customerAuth.authKey, orderNumber],
    queryFn: () => getB2BOrder(customerAuth.authHeaders, orderNumber),
    enabled: customerAuth.enabled && Boolean(orderNumber),
  });

  if (orderQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "B2B Order" }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "B2B Order" }} />
        <EmptyState title="Could not load order" message="Check your connection and try again." />
        <Pressable style={styles.retryBtn} onPress={() => void orderQuery.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{ headerShown: true, title: orderQuery.data.proformaInvoiceNumber }}
      />
      <B2BAuthGate requireProfile={false}>
        <B2BOrderDetailContent order={orderQuery.data} />
      </B2BAuthGate>
    </Screen>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function pickDocument(options: Parameters<typeof import("expo-document-picker").getDocumentAsync>[0]) {
  const DocumentPicker = await import("expo-document-picker");
  return DocumentPicker.getDocumentAsync(options);
}

function documentPickerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ExpoDocumentPicker") || message.includes("native module")) {
    return "Document picker is not available in this app build. Rebuild the Expo dev app after installing expo-document-picker.";
  }
  return message || "Could not open document picker. Try again.";
}

const styles = StyleSheet.create({
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  statusBadgeText: { fontSize: 14, fontWeight: "800" },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  poSection: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  poViewSection: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  poSectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  fieldInput: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    padding: spacing.sm,
  },
  noteInput: { height: 80 },
  uploadRow: { marginTop: spacing.xs },
  uploadBtn: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.md,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  uploadSuccessRow: {
    alignItems: "center",
    backgroundColor: colors.success + "22",
    borderRadius: 10,
    padding: spacing.md,
  },
  uploadSuccessText: { color: colors.success, fontSize: 14, fontWeight: "700" },
  uploadError: { color: colors.danger, fontSize: 13 },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  viewBtn: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
  },
  viewBtnText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  timeline: { gap: spacing.sm },
  timelineItem: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  timelineBody: { flex: 1 },
  timelineStatus: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  timelineNote: { color: colors.muted, fontSize: 13, marginTop: 2 },
  timelineDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  retryBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  retryBtnText: { color: "#fff", fontWeight: "700" },
});
