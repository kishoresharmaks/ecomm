import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../../src/components/screen";
import { EmptyState } from "../../../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import {
  canCancelEnquiry,
  canConfirmEnquiry,
  ENQUIRY_STATUS_COLOR,
  ENQUIRY_STATUS_LABEL,
} from "../../../../src/features/b2b/b2b-enquiry-status";
import { cancelB2BEnquiry, confirmB2BEnquiry, getB2BEnquiry } from "../../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../../src/theme";

export default function B2BEnquiryDetailScreen() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ enquiryId: string }>();
  const enquiryId = params.enquiryId ?? "";

  const enquiryQuery = useQuery({
    queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId],
    queryFn: () => getB2BEnquiry(customerAuth.authHeaders, enquiryId),
    enabled: customerAuth.enabled && Boolean(enquiryId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelB2BEnquiry(customerAuth.authHeaders, enquiryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", customerAuth.authKey] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmB2BEnquiry(customerAuth.authHeaders, enquiryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiry", customerAuth.authKey, enquiryId] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", customerAuth.authKey] });
    },
  });

  if (enquiryQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Enquiry" }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (enquiryQuery.isError || !enquiryQuery.data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Enquiry" }} />
        <EmptyState title="Could not load enquiry" message="Check your connection and try again." />
        <Pressable style={styles.retryBtn} onPress={() => void enquiryQuery.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </Screen>
    );
  }

  const enq = enquiryQuery.data;
  const statusColor = ENQUIRY_STATUS_COLOR[enq.status];
  const statusLabel = ENQUIRY_STATUS_LABEL[enq.status];
  const showCancel = canCancelEnquiry(enq.status);
  const showConfirm = canConfirmEnquiry(enq.status);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: `Enquiry` }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Context */}
        {enq.product || enq.seller ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {enq.product ? "Product" : "Seller"}
            </Text>
            <Text style={styles.sectionValue}>
              {enq.product?.name ?? enq.seller?.storeName ?? "—"}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quantity</Text>
          <Text style={styles.sectionValue}>{enq.quantity}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your message</Text>
          <Text style={styles.messageText}>{enq.message}</Text>
        </View>

        {enq.createdAt ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Submitted</Text>
            <Text style={styles.sectionValue}>{formatDate(enq.createdAt)}</Text>
          </View>
        ) : null}

        {enq.updatedAt && enq.updatedAt !== enq.createdAt ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Last updated</Text>
            <Text style={styles.sectionValue}>{formatDate(enq.updatedAt)}</Text>
          </View>
        ) : null}

        {/* Responses */}
        {enq.responses && enq.responses.length > 0 ? (
          <View style={styles.responsesSection}>
            <Text style={styles.responsesTitle}>Responses</Text>
            {enq.responses.map((resp) => (
              <View key={resp.id} style={styles.responseCard}>
                <View style={styles.responseHeader}>
                  <Text style={styles.responderName}>
                    {resp.responder?.fullName ?? resp.responder?.email ?? "Team"}
                  </Text>
                  {resp.createdAt ? (
                    <Text style={styles.responseDate}>{formatDate(resp.createdAt)}</Text>
                  ) : null}
                </View>
                <Text style={styles.responseMessage}>{resp.responseMessage}</Text>
                {resp.quotedPricePaise ? (
                  <Text style={styles.quotedPrice}>
                    Quoted price: ₹{(resp.quotedPricePaise / 100).toFixed(2)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* B2B order link */}
        {enq.b2bOrder ? (
          <Pressable
            style={styles.orderLink}
            onPress={() =>
              router.push(`/account/b2b/orders/${enq.b2bOrder!.orderNumber}` as never)
            }
          >
            <Text style={styles.orderLinkText}>View B2B Order →</Text>
          </Pressable>
        ) : null}

        {/* Mutation errors */}
        {cancelMutation.isError ? (
          <Text style={styles.errorText}>
            {cancelMutation.error instanceof Error ? cancelMutation.error.message : "Could not cancel."}
          </Text>
        ) : null}
        {confirmMutation.isError ? (
          <Text style={styles.errorText}>
            {confirmMutation.error instanceof Error ? confirmMutation.error.message : "Could not confirm."}
          </Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          {showConfirm ? (
            <Pressable
              disabled={confirmMutation.isPending}
              style={[styles.confirmBtn, confirmMutation.isPending && { opacity: 0.6 }]}
              onPress={() =>
                Alert.alert(
                  "Confirm this quotation?",
                  "The enquiry will move to buyer confirmed. Seller responses and buyer cancellation will be locked while admin approval continues.",
                  [
                    { text: "Keep reviewing", style: "cancel" },
                    { text: "Confirm quotation", style: "default", onPress: () => confirmMutation.mutate() },
                  ],
                )
              }
            >
              {confirmMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm quotation</Text>
              )}
            </Pressable>
          ) : null}

          {showCancel ? (
            <Pressable
              disabled={cancelMutation.isPending}
              style={[styles.cancelBtn, cancelMutation.isPending && { opacity: 0.6 }]}
              onPress={() =>
                Alert.alert(
                  "Cancel this enquiry?",
                  "This enquiry will be closed for seller/admin response. You can submit a new enquiry later if requirements change.",
                  [
                    { text: "Keep open", style: "cancel" },
                    { text: "Cancel enquiry", style: "destructive", onPress: () => cancelMutation.mutate() },
                  ],
                )
              }
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.cancelBtnText}>Cancel enquiry</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md,
  },
  sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  sectionValue: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  messageText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  responsesSection: { gap: spacing.sm },
  responsesTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  responseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  responseHeader: { flexDirection: "row", justifyContent: "space-between" },
  responderName: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  responseDate: { color: colors.muted, fontSize: 12 },
  responseMessage: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  quotedPrice: { color: colors.primary, fontSize: 15, fontWeight: "800", marginTop: 4 },
  orderLink: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  orderLinkText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center" },
  actions: { gap: spacing.sm },
  confirmBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: 14,
    borderWidth: 1.5,
    height: 52,
    justifyContent: "center",
  },
  cancelBtnText: { color: colors.danger, fontSize: 15, fontWeight: "700" },
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
