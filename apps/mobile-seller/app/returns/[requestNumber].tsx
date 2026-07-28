import {
  Image01Icon,
  TruckReturnIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  OperationsHeader,
  OperationsSection,
} from "../../src/components/operations-ui";
import {
  Button,
  ConfirmDialog,
  Field,
  LoadingState,
  QueryErrorState,
  Screen,
  StatusChip,
  Toast,
} from "../../src/components/screen";
import {
  formatOperationDate,
  formatOperationDateTime,
  operationStatus,
} from "../../src/features/seller/operations-presentation";
import {
  acceptSellerReturn,
  addSellerReturnNote,
  getSellerReturn,
  rejectSellerReturn,
} from "../../src/features/seller/seller-api";
import { apiBaseUrl, MobileApiError } from "../../src/lib/api";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

type ToastState = { visible: boolean; message: string; type: "success" | "error" };
type Decision = "accept" | "reject";

export default function ReturnDetailScreen() {
  const { requestNumber } = useLocalSearchParams<{ requestNumber: string }>();
  const decodedRequestNumber = decodeURIComponent(requestNumber ?? "");
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [decisionNote, setDecisionNote] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [openingProofKey, setOpeningProofKey] = useState<string | null>(null);
  const [proofOpenError, setProofOpenError] = useState("");
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });
  const isTablet = width >= 700;

  const returnQuery = useQuery({
    queryKey: ["seller-return", auth.authKey, decodedRequestNumber],
    queryFn: () => getSellerReturn(auth.authHeaders, decodedRequestNumber),
    enabled: auth.enabled && Boolean(decodedRequestNumber),
    retry: false,
  });

  const noteMutation = useMutation({
    mutationFn: (note: string) =>
      addSellerReturnNote(auth.authHeaders, decodedRequestNumber, { note }),
    onSuccess: async () => {
      setSellerNote("");
      setToast({ visible: true, message: "Seller note added.", type: "success" });
      await refreshReturnQueries();
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Seller note could not be saved.",
        type: "error",
      });
    },
  });

  const decisionMutation = useMutation({
    mutationFn: ({ action, note }: { action: Decision; note?: string }) =>
      action === "accept"
        ? acceptSellerReturn(auth.authHeaders, decodedRequestNumber, note)
        : rejectSellerReturn(auth.authHeaders, decodedRequestNumber, note),
    onSuccess: async (_result, variables) => {
      setDecision(null);
      setDecisionNote("");
      setToast({
        visible: true,
        message: variables.action === "accept" ? "Return accepted." : "Return rejected.",
        type: "success",
      });
      await refreshReturnQueries();
    },
    onError: (error) => {
      setDecision(null);
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Seller decision could not be saved.",
        type: "error",
      });
    },
  });

  async function refreshReturnQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["seller-return", auth.authKey, decodedRequestNumber],
      }),
      queryClient.invalidateQueries({ queryKey: ["seller-returns", auth.authKey] }),
    ]);
  }

  if (!auth.enabled || returnQuery.isLoading) {
    return <LoadingState message="Loading return details..." />;
  }

  if (returnQuery.isError || !returnQuery.data) {
    return (
      <Screen>
        <OperationsHeader
          onBack={() => router.back()}
          title={decodedRequestNumber || "Return request"}
          subtitle="Review return evidence and seller actions."
        />
        <QueryErrorState
          title="Return could not be loaded"
          message={returnQuery.error instanceof Error ? returnQuery.error.message : undefined}
          onRetry={() => {
            void returnQuery.refetch();
          }}
          retrying={returnQuery.isFetching}
        />
      </Screen>
    );
  }

  const detail = returnQuery.data;
  const status = operationStatus(detail.status);
  const customerName = detail.customer?.name ?? detail.customerName ?? "Customer";
  const customerEmail = detail.customer?.email ?? detail.customerEmail;
  const returnNotes = detail.notes ?? [];
  const qualityProofKeys = detail.qualityProofKeys ?? [];
  const canDecide =
    detail.status === "PENDING_REVIEW"
    && detail.items.some((item) => item.status === "PENDING_REVIEW");
  const amount = detail.approvedAmountPaise ?? detail.requestedAmountPaise;

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
    <Screen
      contentContainerStyle={styles.content}
      refreshing={returnQuery.isFetching}
      onRefresh={() => {
        void returnQuery.refetch();
      }}
    >
      <OperationsHeader
        onBack={() => router.back()}
        title={detail.requestNumber}
        subtitle="Review the customer request, evidence, seller decision, reverse pickup, and QC record."
      />

      <View style={styles.summarySurface}>
        <View style={styles.summaryTopRow}>
          <StatusChip label={status.label} tone={status.tone} />
          <Text style={styles.created}>{formatOperationDate(detail.createdAt)}</Text>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryValue label="Order" value={detail.order.orderNumber} />
          <SummaryValue
            label="Quantity"
            value={`${detail.totalQuantity} ${detail.totalQuantity === 1 ? "item" : "items"}`}
          />
          {typeof amount === "number" ? (
            <SummaryValue label="Return value" value={formatMoney(amount, detail.currency ?? "INR")} />
          ) : null}
          {detail.resolution ? (
            <SummaryValue label="Resolution" value={operationStatus(detail.resolution).label} />
          ) : null}
        </View>
      </View>

      <OperationsSection
        title="Returned items"
        subtitle="Seller-specific products, quantities, decision status, and QC notes."
      >
        <View style={styles.listSurface}>
          {detail.items.map((item, index) => {
            const itemStatus = operationStatus(item.status);
            return (
              <View
                key={item.id}
                style={[styles.itemRow, index > 0 ? styles.divider : null]}
              >
                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>{item.productName}</Text>
                  <Text style={styles.meta}>
                    Quantity {item.quantity}
                    {item.variantSnapshot ? ` | ${item.variantSnapshot}` : ""}
                  </Text>
                  {item.reason ? <Text style={styles.itemNote}>Reason: {item.reason}</Text> : null}
                  {item.sellerNote ? <Text style={styles.itemNote}>Seller note: {item.sellerNote}</Text> : null}
                  {item.qcNote ? <Text style={styles.qcNote}>QC note: {item.qcNote}</Text> : null}
                </View>
                <StatusChip label={itemStatus.label} tone={itemStatus.tone} />
              </View>
            );
          })}
        </View>
      </OperationsSection>

      <View style={[styles.detailGrid, isTablet ? styles.detailGridTablet : null]}>
        <View style={styles.detailSurface}>
          <View style={styles.detailHeading}>
            <HugeiconsIcon icon={UserCircleIcon} color={colors.primary} size={21} strokeWidth={2.1} />
            <Text style={styles.detailTitle}>Customer</Text>
          </View>
          <Text style={styles.detailValue}>{customerName}</Text>
          {customerEmail ? <Text style={styles.meta}>{customerEmail}</Text> : null}
          {detail.customer?.phone ? <Text style={styles.meta}>{detail.customer.phone}</Text> : null}
        </View>
        <View style={styles.detailSurface}>
          <View style={styles.detailHeading}>
            <HugeiconsIcon icon={TruckReturnIcon} color={colors.primary} size={21} strokeWidth={2.1} />
            <Text style={styles.detailTitle}>Return reason</Text>
          </View>
          <Text style={styles.reason}>{detail.reason}</Text>
          {detail.note ? <Text style={styles.customerNote}>Customer note: {detail.note}</Text> : null}
        </View>
      </View>

      <OperationsSection
        title="Customer quality proof"
        subtitle="Inspect product condition, packaging, label, damage, or mismatch evidence before deciding."
      >
        <View style={styles.proofSurface}>
          {qualityProofKeys.length ? (
            <View style={styles.proofGrid}>
              {qualityProofKeys.map((key, index) => (
                <Pressable
                  key={key}
                  accessibilityLabel={`Open proof image ${index + 1}`}
                  accessibilityRole="button"
                  disabled={Boolean(openingProofKey)}
                  onPress={() => {
                    void openQualityProof(key);
                  }}
                  style={({ pressed }) => [
                    styles.proofButton,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  {openingProofKey === key ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <HugeiconsIcon icon={Image01Icon} color={colors.primary} size={24} strokeWidth={2} />
                  )}
                  <Text style={styles.proofLabel}>Proof {index + 1}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.warning}>No quality proof files were attached.</Text>
          )}
          {proofOpenError ? <Text style={styles.error}>{proofOpenError}</Text> : null}
        </View>
      </OperationsSection>

      {canDecide ? (
        <OperationsSection
          title="Seller decision"
          subtitle="Accepting moves the request into reverse pickup. Reject only when the reason or evidence does not meet policy."
        >
          <View style={styles.decisionSurface}>
            <Field
              label="Decision note"
              placeholder="Add a clear reason for the customer and operations team"
              value={decisionNote}
              onChangeText={setDecisionNote}
              multiline
              numberOfLines={3}
            />
            <View style={[styles.actionRow, isTablet ? styles.actionRowTablet : null]}>
              <Button
                title="Accept return"
                disabled={decisionMutation.isPending}
                loading={decisionMutation.isPending && decision === "accept"}
                style={styles.actionButton}
                onPress={() => setDecision("accept")}
              />
              <Button
                title="Reject return"
                tone="danger"
                disabled={decisionMutation.isPending}
                loading={decisionMutation.isPending && decision === "reject"}
                style={styles.actionButton}
                onPress={() => setDecision("reject")}
              />
            </View>
          </View>
        </OperationsSection>
      ) : null}

      <OperationsSection
        title="Seller notes"
        subtitle="Add context for your team without changing the return decision."
      >
        <View style={styles.noteSurface}>
          <Field
            label="New note"
            placeholder="Add handling, inspection, pickup, or QC context"
            value={sellerNote}
            onChangeText={setSellerNote}
            multiline
            numberOfLines={3}
          />
          <Button
            title="Add note"
            tone="secondary"
            loading={noteMutation.isPending}
            disabled={noteMutation.isPending || !sellerNote.trim()}
            onPress={() => noteMutation.mutate(sellerNote.trim())}
          />
        </View>
        {returnNotes.length ? (
          <View style={styles.listSurface}>
            {returnNotes.map((note, index) => (
              <View
                key={note.id}
                style={[styles.noteRow, index > 0 ? styles.divider : null]}
              >
                <Text style={styles.noteText}>{note.note}</Text>
                <Text style={styles.noteDate}>{formatOperationDateTime(note.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>No seller notes have been added.</Text>
        )}
      </OperationsSection>

      <ConfirmDialog
        visible={Boolean(decision)}
        title={decision === "accept" ? "Accept this return?" : "Reject this return?"}
        message={
          decision === "accept"
            ? "The request will move to reverse pickup assignment."
            : "The customer request will be rejected. Include a clear decision note when possible."
        }
        confirmLabel={decision === "accept" ? "Accept return" : "Reject return"}
        onCancel={() => setDecision(null)}
        onConfirm={() => {
          if (decision) {
            decisionMutation.mutate({
              action: decision,
              ...(decisionNote.trim() ? { note: decisionNote.trim() } : {}),
            });
          }
        }}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryValue}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryText}>{value}</Text>
    </View>
  );
}

type PrivateProofAccess =
  | { provider: "s3"; url: string; contentType?: string; fileName?: string }
  | { provider: "local"; contentType?: string; fileName?: string };

async function downloadPrivateProof(
  auth: ReturnType<typeof useMobileSellerAuth>["authHeaders"],
  assetKey: string,
) {
  const token = auth.getBearerToken
    ? (await auth.getBearerToken({ skipCache: true })) ?? auth.bearerToken
    : auth.bearerToken;
  const accessResponse = await fetch(
    `${apiBaseUrl()}/storage/private-document/access?key=${encodeURIComponent(assetKey)}`,
    {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
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

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  summarySurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  created: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryValue: {
    flexBasis: "46%",
    flexGrow: 1,
    gap: 2,
    minWidth: 130,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  listSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  itemRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  divider: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  itemCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  itemNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
  },
  qcNote: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 17,
  },
  detailGrid: {
    gap: spacing.sm,
  },
  detailGridTablet: {
    flexDirection: "row",
  },
  detailSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    padding: spacing.md,
  },
  detailHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  detailValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  reason: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  customerNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  proofSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  proofGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  proofButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 82,
    minWidth: 96,
    padding: spacing.sm,
  },
  proofLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  warning: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  decisionSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  actionRow: {
    gap: spacing.sm,
  },
  actionRowTablet: {
    flexDirection: "row",
  },
  actionButton: {
    flex: 1,
  },
  noteSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  noteRow: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  noteText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  noteDate: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
