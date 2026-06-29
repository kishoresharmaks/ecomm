import {
  Alert02Icon,
  Calendar03Icon,
  CreditCardIcon,
  FileEditIcon,
  Location01Icon,
  StarIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../../src/components/empty-state";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import {
  AccountLoadingState,
  RetryState,
  SignInRequiredState,
  StatusPill,
  accountErrorMessage,
  formatDate,
  formatDateTime,
  formatStatus,
} from "../../../src/features/account/account-ui";
import { serviceKeys } from "../../../src/features/services/service-query-keys";
import { formatPaiseLocal, InfoLine } from "../../../src/features/services/service-ui";
import {
  acceptCustomerServiceQuote,
  cancelCustomerServiceBooking,
  confirmCustomerServiceCompletion,
  createCustomerServiceReview,
  getCustomerServiceBooking,
  raiseCustomerServiceDispute,
  rejectCustomerServiceQuote,
} from "../../../src/features/services/services-api";
import type { MobileServiceAction, MobileServiceBooking } from "../../../src/features/services/types";
import { getAllowedServiceBookingActions, serviceBookingStatusTone } from "../../../src/features/services/utils/bookingActions";
import {
  cleanCancellationPayload,
  cleanDisputePayload,
  cleanReviewPayload,
} from "../../../src/features/services/utils/payloadCleaners";
import { colors } from "../../../src/theme";

type Sheet = "cancel" | "reject" | "dispute" | "review" | null;

const disputeReasons = ["Work not completed", "Quality issue", "Incorrect charge", "Provider no-show", "Other"] as const;
type DisputeReason = (typeof disputeReasons)[number];

export default function ServiceBookingDetailScreen() {
  const params = useLocalSearchParams<{ bookingNumber?: string }>();
  const bookingNumber = Array.isArray(params.bookingNumber) ? params.bookingNumber[0] : params.bookingNumber;
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [disputeReason, setDisputeReason] = useState<DisputeReason>(disputeReasons[0]);
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeEvidence, setDisputeEvidence] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const bookingQuery = useQuery({
    queryKey: serviceKeys.booking(customerAuth.authKey, bookingNumber ?? ""),
    queryFn: () => getCustomerServiceBooking(customerAuth.authHeaders, bookingNumber ?? ""),
    enabled: customerAuth.enabled && Boolean(bookingNumber),
    refetchOnMount: "always",
  });

  async function invalidateBooking(booking?: MobileServiceBooking) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: serviceKeys.booking(customerAuth.authKey, bookingNumber ?? "") }),
      queryClient.invalidateQueries({ queryKey: ["mobile-service-bookings", customerAuth.authKey] }),
      booking ? queryClient.invalidateQueries({ queryKey: ["mobile-service", booking.serviceSlug], exact: false }) : Promise.resolve(),
    ]);
  }

  const actionMutation = useMutation({
    mutationFn: async (action: MobileServiceAction) => {
      if (!bookingNumber) throw new Error("Booking number is missing.");
      if (action === "accept_quote") return acceptCustomerServiceQuote(customerAuth.authHeaders, bookingNumber);
      if (action === "reject_quote") return rejectCustomerServiceQuote(customerAuth.authHeaders, bookingNumber);
      if (action === "confirm_completion") return confirmCustomerServiceCompletion(customerAuth.authHeaders, bookingNumber);
      throw new Error("Unsupported action.");
    },
    onMutate: () => {
      setActionError("");
      setActionMessage("");
    },
    onSuccess: async (booking, action) => {
      setSheet(null);
      setActionMessage(successMessage(action));
      await invalidateBooking(booking);
    },
    onError: (error) => setActionError(accountErrorMessage(error, "Action could not be completed.")),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelCustomerServiceBooking(customerAuth.authHeaders, bookingNumber ?? "", cleanCancellationPayload({ reason: cancelReason })),
    onMutate: () => setActionError(""),
    onSuccess: async (booking) => {
      setSheet(null);
      setCancelReason("");
      setActionMessage("Your booking has been cancelled.");
      await invalidateBooking(booking);
    },
    onError: (error) => setActionError(accountErrorMessage(error, "Booking could not be cancelled.")),
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      raiseCustomerServiceDispute(
        customerAuth.authHeaders,
        bookingNumber ?? "",
        cleanDisputePayload({ selectedReason: disputeReason, description: disputeDescription, rawEvidence: disputeEvidence }),
      ),
    onMutate: () => setActionError(""),
    onSuccess: async (booking) => {
      setSheet(null);
      setDisputeDescription("");
      setDisputeEvidence("");
      setActionMessage("Your dispute has been raised. Our team will review it shortly.");
      await invalidateBooking(booking);
    },
    onError: (error) => setActionError(accountErrorMessage(error, "Dispute could not be raised.")),
  });

  const reviewMutation = useMutation({
    mutationFn: () => createCustomerServiceReview(customerAuth.authHeaders, bookingNumber ?? "", cleanReviewPayload({ rating: reviewRating, body: reviewBody })),
    onMutate: () => setActionError(""),
    onSuccess: async () => {
      setSheet(null);
      setReviewRating(0);
      setReviewBody("");
      setActionMessage("Thanks for your review!");
      await invalidateBooking(bookingQuery.data);
    },
    onError: (error) => setActionError(accountErrorMessage(error, "Review could not be submitted.")),
  });

  if (!bookingNumber) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Service Booking" }} />
        <EmptyState title="Booking not found" message="Open the booking from your service bookings list." />
      </Screen>
    );
  }

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || bookingQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: bookingNumber }} />
        <AccountLoadingState title="Loading service booking..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Service Booking" }} />
        <SignInRequiredState title="Sign in to view service booking" message="Service booking detail is linked to your 1HandIndia account." />
      </>
    );
  }

  if (bookingQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: bookingNumber }} />
        <RetryState
          title="Booking could not load"
          message={accountErrorMessage(bookingQuery.error, "Check your connection and refresh booking detail.")}
          onRetry={() => void bookingQuery.refetch()}
        />
      </>
    );
  }

  const booking = bookingQuery.data;
  if (!booking) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: bookingNumber }} />
        <EmptyState title="Booking not found" message="This service booking is not available for this account." />
      </Screen>
    );
  }

  const actions = getAllowedServiceBookingActions(booking.status, { hasReview: Boolean(booking.review) });
  const busy = actionMutation.isPending || cancelMutation.isPending || disputeMutation.isPending || reviewMutation.isPending;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: booking.bookingNumber }} />
      <Screen padded={false}>
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headerCard}>
              <StatusPill label={booking.status} tone={serviceBookingStatusTone(booking.status)} />
              <Text style={styles.title}>{booking.serviceName}</Text>
              <Text style={styles.subtitle}>#{booking.bookingNumber} · Created {formatDate(booking.createdAt)}</Text>
              {booking.status === "closed_after_inspection" ? (
                <Text style={styles.inspectionNote}>Closed after inspection. Pricing reflects the inspection fee and recorded payment state.</Text>
              ) : null}
            </View>

            {actionMessage ? <Text style={styles.successNotice}>{actionMessage}</Text> : null}
            {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

            <DetailSection title="Service summary">
              <InfoLine icon={FileEditIcon} text={booking.packageName ?? "No package selected"} />
              <InfoLine icon={Location01Icon} text={formatStatus(booking.visitMode)} />
            </DetailSection>

            <DetailSection title="Provider">
              <InfoLine icon={UserCircleIcon} text={booking.providerName ?? "Not yet assigned"} />
            </DetailSection>

            <DetailSection title="Schedule and location">
              <InfoLine icon={Calendar03Icon} text={booking.scheduledStartAt ? formatDateTime(booking.scheduledStartAt) : "Awaiting schedule"} />
              {booking.location ? (
                <Text style={styles.bodyText}>
                  {[booking.location.line1, booking.location.line2, booking.location.area, booking.location.city, booking.location.state, booking.location.pincode].filter(Boolean).join(", ")}
                </Text>
              ) : (
                <Text style={styles.bodyText}>No customer address required for this booking.</Text>
              )}
            </DetailSection>

            <DetailSection title="Pricing summary">
              <AmountRow label="Subtotal" value={booking.subtotalPaise} currency={booking.currency} />
              {booking.inspectionFeePaise > 0 ? <AmountRow label="Inspection fee" value={booking.inspectionFeePaise} currency={booking.currency} /> : null}
              {booking.advanceAmountPaise > 0 ? <AmountRow label="Advance" value={booking.advanceAmountPaise} currency={booking.currency} /> : null}
              <AmountRow strong label="Total payable" value={booking.totalPayablePaise} currency={booking.currency} />
              <AmountRow label="Paid" value={booking.paidAmountPaise} currency={booking.currency} />
            </DetailSection>

            {booking.quote ? (
              <DetailSection title="Quote details">
                <AmountRow strong label="Quote amount" value={booking.quote.amountPaise} currency={booking.quote.currency} />
                <Text style={styles.bodyText}>{booking.quote.note ?? "No quote note added."}</Text>
                <Text style={styles.metaText}>Status: {formatStatus(booking.quote.status)}</Text>
                {booking.quote.sentAt ? <Text style={styles.metaText}>Sent: {formatDateTime(booking.quote.sentAt)}</Text> : null}
              </DetailSection>
            ) : null}

            {booking.payments.length ? (
              <DetailSection title="Payments">
                {booking.payments.map((payment) => (
                  <View key={payment.id} style={styles.paymentRow}>
                    <HugeiconsIcon color={colors.primary} icon={CreditCardIcon} size={20} strokeWidth={2.1} />
                    <View style={styles.paymentBody}>
                      <Text style={styles.rowTitle}>{formatPaiseLocal(payment.amountPaise, payment.currency)}</Text>
                      <Text style={styles.metaText}>{[payment.provider, payment.purpose, formatStatus(payment.status)].filter(Boolean).join(" · ")}</Text>
                    </View>
                  </View>
                ))}
              </DetailSection>
            ) : null}

            {booking.dispute ? (
              <DetailSection title="Dispute">
                <InfoLine icon={Alert02Icon} text={formatStatus(booking.dispute.status)} />
                <Text style={styles.bodyText}>{booking.dispute.reason}</Text>
                {booking.dispute.evidence?.length ? <Text style={styles.metaText}>Evidence: {booking.dispute.evidence.join(", ")}</Text> : null}
              </DetailSection>
            ) : null}

            {booking.review ? (
              <DetailSection title="Review">
                <InfoLine icon={StarIcon} text={`${booking.review.rating} / 5 stars`} />
                <Text style={styles.bodyText}>{booking.review.body ?? "No written review."}</Text>
              </DetailSection>
            ) : null}
          </ScrollView>

          {actions.length ? (
            <View style={styles.footer}>
              {actions.map((action) => (
                <Pressable key={action} disabled={busy} style={[styles.actionButton, destructiveAction(action) ? styles.secondaryAction : null]} onPress={() => handleAction(action, setSheet, actionMutation.mutate)}>
                  <Text style={[styles.actionButtonText, destructiveAction(action) ? styles.secondaryActionText : null]}>{actionLabel(action)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Screen>

      <ActionSheet visible={sheet === "cancel"} title="Cancel Booking" onClose={() => setSheet(null)}>
        <TextInput multiline placeholder="Reason for cancellation" placeholderTextColor={colors.muted} style={styles.sheetInput} value={cancelReason} onChangeText={setCancelReason} />
        <SheetButton busy={cancelMutation.isPending} label="Cancel Booking" onPress={() => cancelMutation.mutate()} />
      </ActionSheet>

      <ActionSheet visible={sheet === "reject"} title="Reject Quote" onClose={() => setSheet(null)}>
        <Text style={styles.bodyText}>This quote will be marked as rejected. You can still contact support if you need help.</Text>
        <SheetButton busy={actionMutation.isPending} label="Reject Quote" onPress={() => actionMutation.mutate("reject_quote")} />
      </ActionSheet>

      <ActionSheet visible={sheet === "dispute"} title="Raise a Dispute" onClose={() => setSheet(null)}>
        <View style={styles.reasonGrid}>
          {disputeReasons.map((reason) => (
            <Pressable key={reason} style={[styles.reasonChip, disputeReason === reason ? styles.reasonChipActive : null]} onPress={() => setDisputeReason(reason)}>
              <Text style={[styles.reasonChipText, disputeReason === reason ? styles.reasonChipTextActive : null]}>{reason}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput multiline maxLength={500} placeholder="Describe the issue" placeholderTextColor={colors.muted} style={styles.sheetInput} value={disputeDescription} onChangeText={setDisputeDescription} />
        <TextInput placeholder="Evidence links or references, comma-separated" placeholderTextColor={colors.muted} style={styles.sheetInput} value={disputeEvidence} onChangeText={setDisputeEvidence} />
        <SheetButton busy={disputeMutation.isPending} label="Submit Dispute" onPress={() => disputeMutation.mutate()} />
      </ActionSheet>

      <ActionSheet visible={sheet === "review"} title="Rate Your Experience" onClose={() => setSheet(null)}>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <Pressable key={rating} onPress={() => setReviewRating(rating)}>
              <HugeiconsIcon color={rating <= reviewRating ? colors.warning : colors.border} icon={StarIcon} size={32} strokeWidth={2.4} />
            </Pressable>
          ))}
        </View>
        <TextInput multiline maxLength={300} placeholder="Tell us more (optional)" placeholderTextColor={colors.muted} style={styles.sheetInput} value={reviewBody} onChangeText={setReviewBody} />
        <SheetButton busy={reviewMutation.isPending} label="Submit Review" onPress={() => reviewMutation.mutate()} />
      </ActionSheet>
    </>
  );
}

function handleAction(action: MobileServiceAction, setSheet: (sheet: Sheet) => void, mutate: (action: MobileServiceAction) => void) {
  if (action === "cancel") setSheet("cancel");
  else if (action === "reject_quote") setSheet("reject");
  else if (action === "raise_dispute") setSheet("dispute");
  else if (action === "submit_review") setSheet("review");
  else mutate(action);
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AmountRow({ currency, label, strong = false, value }: { currency: string; label: string; strong?: boolean; value: number }) {
  return (
    <View style={styles.amountRow}>
      <Text style={[styles.amountLabel, strong ? styles.strongText : null]}>{label}</Text>
      <Text style={[styles.amountValue, strong ? styles.strongText : null]}>{formatPaiseLocal(value, currency)}</Text>
    </View>
  );
}

function ActionSheet({ children, onClose, title, visible }: { children: React.ReactNode; onClose: () => void; title: string; visible: boolean }) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function SheetButton({ busy, label, onPress }: { busy: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={busy} style={[styles.sheetButton, busy ? styles.disabled : null]} onPress={onPress}>
      {busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.sheetButtonText}>{label}</Text>}
    </Pressable>
  );
}

function actionLabel(action: MobileServiceAction) {
  const labels: Record<MobileServiceAction, string> = {
    accept_quote: "Accept Quote",
    reject_quote: "Reject Quote",
    cancel: "Cancel",
    confirm_completion: "Confirm Completion",
    raise_dispute: "Raise Dispute",
    submit_review: "Submit Review",
  };
  return labels[action];
}

function successMessage(action: MobileServiceAction) {
  if (action === "accept_quote") return "Quote accepted.";
  if (action === "confirm_completion") return "Completion confirmed.";
  return "Action completed.";
}

function destructiveAction(action: MobileServiceAction) {
  return action === "cancel" || action === "reject_quote" || action === "raise_dispute";
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 150,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 12,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  inspectionNote: {
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 12,
    padding: 10,
  },
  successNotice: {
    backgroundColor: "#ECFDF3",
    borderRadius: 8,
    color: "#047857",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
    padding: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 8,
  },
  bodyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 7,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  amountLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  amountValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  strongText: {
    color: colors.primary,
    fontSize: 16,
  },
  paymentRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    padding: 10,
  },
  paymentBody: {
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  footer: {
    backgroundColor: "rgba(255,252,251,0.98)",
    borderColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    left: 0,
    padding: 12,
    position: "absolute",
    right: 0,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexGrow: 1,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  secondaryActionText: {
    color: colors.danger,
  },
  modalBackdrop: {
    backgroundColor: "rgba(17,24,39,0.38)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
  },
  closeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  sheetInput: {
    backgroundColor: "#FFFCFB",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
    minHeight: 48,
    padding: 12,
    textAlignVertical: "top",
  },
  sheetButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  sheetButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.7,
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  reasonChipActive: {
    backgroundColor: "#FFF2EE",
    borderColor: colors.primary,
  },
  reasonChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  reasonChipTextActive: {
    color: colors.primary,
  },
  stars: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
});
