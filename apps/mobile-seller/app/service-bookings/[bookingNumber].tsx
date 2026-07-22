import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, ConfirmDialog, Field, Header, LoadingState, QueryErrorState, Screen, SelectField, StatusChip, Toast } from "../../src/components/screen";
import {
  acceptSellerServiceBooking,
  cancelSellerServiceBooking,
  getSellerServiceBooking,
  getSellerServiceCalendar,
  markSellerServiceInProgress,
  recordSellerServiceCashCollection,
  recordSellerServicePayment,
  rejectSellerServiceBooking,
  rescheduleSellerServiceBooking,
  sendSellerServiceQuote,
  submitSellerServiceCompletion,
  updateSellerServiceFieldStatus,
  withdrawSellerServiceQuote,
  type SellerServiceBooking,
  type ProductTaxClassification,
  type ServicePaymentPurpose,
} from "../../src/features/seller/seller-api";
import { availableServiceBookingActions, dueServiceAmountPaise, servicePaymentPurposeOptions } from "../../src/features/seller/service-operations";
import { formatMoney, rupeesToPaise } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

type ToastState = { visible: boolean; message: string; type: "success" | "error" };
type ConfirmState = null | { action: "reject" | "cancel" | "withdrawQuote"; title: string; message: string };
type QuoteLineDraft = {
  id: string;
  lineType: "SERVICE" | "PRODUCT";
  description: string;
  quantity: string;
  unitAmount: string;
  hsnSacCode: string;
  taxClassification: ProductTaxClassification;
  gstRatePercent: string;
  uqc: string;
};

const fieldStatusOptions = [
  { label: "En route", value: "EN_ROUTE" },
  { label: "Arrived", value: "ARRIVED" },
  { label: "Checked in", value: "CHECKED_IN" },
  { label: "Checked out", value: "CHECKED_OUT" },
] as const;

export default function SellerServiceBookingDetailScreen() {
  const { bookingNumber } = useLocalSearchParams<{ bookingNumber: string }>();
  const decodedBookingNumber = decodeURIComponent(bookingNumber ?? "");
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [assignedTechnicianId, setAssignedTechnicianId] = useState("");
  const [fieldStatus, setFieldStatus] = useState<(typeof fieldStatusOptions)[number]["value"]>("EN_ROUTE");
  const [fieldProofKeys, setFieldProofKeys] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [completionProofKeys, setCompletionProofKeys] = useState("");
  const [quoteLines, setQuoteLines] = useState<QuoteLineDraft[]>([newQuoteLine("SERVICE")]);
  const [quoteTtlHours, setQuoteTtlHours] = useState("48");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentPurpose, setPaymentPurpose] = useState<ServicePaymentPurpose>("PAY_AT_VISIT");
  const [paymentReference, setPaymentReference] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });

  const bookingQuery = useQuery({
    queryKey: ["seller-service-booking", auth.authKey, decodedBookingNumber],
    queryFn: () => getSellerServiceBooking(auth.authHeaders, decodedBookingNumber),
    enabled: auth.enabled && Boolean(decodedBookingNumber),
  });
  const calendarQuery = useQuery({
    queryKey: ["seller-service-calendar", auth.authKey, "booking-detail"],
    queryFn: () => getSellerServiceCalendar(auth.authHeaders),
    enabled: auth.enabled,
  });
  const booking = bookingQuery.data;
  const actions = useMemo(() => (booking ? availableServiceBookingActions(booking.status) : []), [booking]);
  const technicianOptions = useMemo(
    () => [
      { label: "No technician", value: "" },
      ...((calendarQuery.data?.technicians ?? [])
        .filter((technician) => technician.isActive !== false)
        .map((technician) => ({ label: technician.name, value: technician.id ?? "" }))
        .filter((option) => option.value)),
    ],
    [calendarQuery.data?.technicians],
  );

  const invalidateBooking = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["seller-service-booking", auth.authKey, decodedBookingNumber] }),
      queryClient.invalidateQueries({ queryKey: ["seller-service-bookings", auth.authKey] }),
      queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", auth.authKey] }),
    ]);
  };

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === "accept") {
        return acceptSellerServiceBooking(auth.authHeaders, decodedBookingNumber, optionalSchedulePayload());
      }
      if (action === "reschedule") {
        return rescheduleSellerServiceBooking(auth.authHeaders, decodedBookingNumber, {
          scheduledStartAt: toIsoDateTime(scheduledStartAt),
          ...(assignedTechnicianId ? { assignedTechnicianId } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      }
      if (action === "reject") {
        return rejectSellerServiceBooking(auth.authHeaders, decodedBookingNumber, { reason: reason.trim() || "Rejected by provider." });
      }
      if (action === "cancel") {
        return cancelSellerServiceBooking(auth.authHeaders, decodedBookingNumber, { reason: reason.trim() || "Cancelled by provider." });
      }
      if (action === "quote") {
        return sendSellerServiceQuote(auth.authHeaders, decodedBookingNumber, {
          lineItems: quoteLines.map((line, index) => quoteLinePayload(line, index)),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(Number(quoteTtlHours) > 0 ? { ttlHours: Math.round(Number(quoteTtlHours)) } : {}),
        });
      }
      if (action === "withdrawQuote") {
        return withdrawSellerServiceQuote(auth.authHeaders, decodedBookingNumber, note.trim() ? { note: note.trim() } : {});
      }
      if (action === "start") {
        return markSellerServiceInProgress(auth.authHeaders, decodedBookingNumber);
      }
      if (action === "field") {
        return updateSellerServiceFieldStatus(auth.authHeaders, decodedBookingNumber, {
          status: fieldStatus,
          ...(note.trim() ? { note: note.trim() } : {}),
          fieldProofKeys: proofLines(fieldProofKeys),
        });
      }
      if (action === "complete") {
        return submitSellerServiceCompletion(auth.authHeaders, decodedBookingNumber, {
          completionNote: completionNote.trim() || "Service completed and submitted for customer confirmation.",
          completionProofKeys: proofLines(completionProofKeys),
        });
      }
      if (action === "payment") {
        return recordSellerServicePayment(auth.authHeaders, decodedBookingNumber, {
          provider: "MANUAL",
          purpose: paymentPurpose,
          amountPaise: rupeesToPaise(paymentAmount),
          ...(paymentReference.trim() ? { referenceNumber: paymentReference.trim() } : {}),
          markPaid: true,
        });
      }
      return recordSellerServiceCashCollection(auth.authHeaders, decodedBookingNumber, {
        purpose: paymentPurpose,
        amountPaise: rupeesToPaise(paymentAmount),
        cashCollectionEventId: cashEventId(decodedBookingNumber, paymentReference),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: async (_result, action) => {
      setConfirmState(null);
      setToast({ visible: true, message: successMessage(action), type: "success" });
      await invalidateBooking();
    },
    onError: (error) => setToast({ visible: true, message: error instanceof Error ? error.message : "Service action failed.", type: "error" }),
  });

  if (!auth.enabled || bookingQuery.isLoading) {
    return <LoadingState message="Loading service job..." />;
  }

  if (bookingQuery.isError || !booking) {
    return (
      <Screen>
        <Header title={decodedBookingNumber || "Service job"} subtitle="Seller service operations" />
        <QueryErrorState
          title="Service job could not be loaded"
          message={bookingQuery.error instanceof Error ? bookingQuery.error.message : undefined}
          onRetry={() => void bookingQuery.refetch()}
          retrying={bookingQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <Header title={booking.bookingNumber} subtitle="Accept, schedule, quote, update field work, and complete this service job." />
      <Summary booking={booking} />

      <Card>
        <Text style={styles.sectionTitle}>Schedule and assignment</Text>
        <Field label="Visit time" value={scheduledStartAt} onChangeText={setScheduledStartAt} placeholder="2026-07-12T10:00:00.000Z" />
        <SelectField label="Technician" options={technicianOptions} selectedValue={assignedTechnicianId} onSelect={setAssignedTechnicianId} />
        <Field label="Operation note" value={note} onChangeText={setNote} multiline placeholder="Add context for customer/admin timeline." />
        <View style={styles.buttonRow}>
          {actions.includes("ACCEPT") ? <Button title="Accept" onPress={() => actionMutation.mutate("accept")} loading={actionMutation.isPending} style={styles.rowButton} /> : null}
          {actions.includes("RESCHEDULE") ? <Button title="Reschedule" tone="secondary" onPress={() => actionMutation.mutate("reschedule")} loading={actionMutation.isPending} style={styles.rowButton} /> : null}
        </View>
      </Card>

      {actions.includes("QUOTE") || actions.includes("WITHDRAW_QUOTE") ? (
        <Card>
          <Text style={styles.sectionTitle}>Quote</Text>
          {quoteLines.map((line, index) => (
            <View key={line.id} style={styles.quoteLine}>
              <View style={styles.quoteLineHeader}>
                <Text style={styles.quoteLineTitle}>Line {index + 1}</Text>
                {quoteLines.length > 1 ? (
                  <Button
                    title="Remove"
                    tone="danger"
                    onPress={() => setQuoteLines((current) => current.filter((item) => item.id !== line.id))}
                  />
                ) : null}
              </View>
              <SelectField
                label="Line type"
                options={[
                  { label: "Service / SAC", value: "SERVICE" },
                  { label: "Product or spare part / HSN", value: "PRODUCT" },
                ]}
                selectedValue={line.lineType}
                onSelect={(value) =>
                  updateQuoteLine(setQuoteLines, line.id, {
                    lineType: value as QuoteLineDraft["lineType"],
                    hsnSacCode: "",
                    uqc: value === "PRODUCT" ? "PCS" : "NOS",
                  })
                }
              />
              <Field
                label="Description"
                value={line.description}
                onChangeText={(description) => updateQuoteLine(setQuoteLines, line.id, { description })}
                placeholder={line.lineType === "SERVICE" ? "Repair labour" : "Replacement part"}
              />
              <View style={styles.twoColumn}>
                <View style={styles.column}>
                  <Field
                    label="Quantity"
                    value={line.quantity}
                    onChangeText={(quantity) => updateQuoteLine(setQuoteLines, line.id, { quantity })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.column}>
                  <Field
                    label="GST-inclusive unit amount"
                    value={line.unitAmount}
                    onChangeText={(unitAmount) => updateQuoteLine(setQuoteLines, line.id, { unitAmount })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Field
                label={line.lineType === "SERVICE" ? "SAC code" : "HSN code"}
                value={line.hsnSacCode}
                onChangeText={(hsnSacCode) =>
                  updateQuoteLine(setQuoteLines, line.id, {
                    hsnSacCode: hsnSacCode.replace(/\D/g, "").slice(0, 8),
                  })
                }
                keyboardType="number-pad"
                placeholder={
                  line.lineType === "SERVICE"
                    ? "Leave blank to use booking SAC"
                    : "4 to 8 digit HSN"
                }
              />
              <SelectField
                label="Tax classification"
                options={[
                  { label: "Taxable", value: "TAXABLE" },
                  { label: "Nil rated", value: "NIL_RATED" },
                  { label: "Exempt", value: "EXEMPT" },
                  { label: "Non-GST", value: "NON_GST" },
                ]}
                selectedValue={line.taxClassification}
                onSelect={(value) =>
                  updateQuoteLine(setQuoteLines, line.id, {
                    taxClassification: value as ProductTaxClassification,
                    ...(value === "TAXABLE" ? {} : { gstRatePercent: "0" }),
                  })
                }
              />
              <View style={styles.twoColumn}>
                <View style={styles.column}>
                  <Field
                    label="GST rate %"
                    value={line.gstRatePercent}
                    onChangeText={(gstRatePercent) =>
                      updateQuoteLine(setQuoteLines, line.id, { gstRatePercent })
                    }
                    keyboardType="decimal-pad"
                    editable={line.taxClassification === "TAXABLE"}
                    placeholder={
                      line.lineType === "SERVICE"
                        ? "Blank uses booking rate"
                        : "Required for taxable parts"
                    }
                  />
                </View>
                <View style={styles.column}>
                  <Field
                    label="Unit"
                    value={line.uqc}
                    onChangeText={(uqc) => updateQuoteLine(setQuoteLines, line.id, { uqc: uqc.toUpperCase() })}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
              <Text style={styles.muted}>Use the SAC or HSN that will appear on the invoice. Amounts include GST.</Text>
            </View>
          ))}
          <Button
            title="Add quote line"
            tone="secondary"
            disabled={quoteLines.length >= 50}
            onPress={() => setQuoteLines((current) => [...current, newQuoteLine("PRODUCT")])}
          />
          <Field label="TTL hours" value={quoteTtlHours} onChangeText={setQuoteTtlHours} keyboardType="number-pad" />
          <View style={styles.buttonRow}>
            {actions.includes("QUOTE") ? <Button title="Send quote" onPress={() => actionMutation.mutate("quote")} loading={actionMutation.isPending} style={styles.rowButton} /> : null}
            {actions.includes("WITHDRAW_QUOTE") ? (
              <Button
                title="Withdraw"
                tone="danger"
                onPress={() => setConfirmState({ action: "withdrawQuote", title: "Withdraw quote", message: "Withdraw the active quote for this booking?" })}
                style={styles.rowButton}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {actions.includes("START") || actions.includes("FIELD_STATUS") || actions.includes("COMPLETE") ? (
        <Card>
          <Text style={styles.sectionTitle}>Field work</Text>
          {actions.includes("START") ? <Button title="Mark in progress" onPress={() => actionMutation.mutate("start")} loading={actionMutation.isPending} /> : null}
          <SelectField label="Technician status" options={fieldStatusOptions.map((option) => ({ label: option.label, value: option.value }))} selectedValue={fieldStatus} onSelect={(value) => setFieldStatus(value as typeof fieldStatus)} />
          <Field label="Field proof keys" value={fieldProofKeys} onChangeText={setFieldProofKeys} multiline placeholder="One proof asset key per line" />
          {actions.includes("FIELD_STATUS") ? <Button title="Update field status" tone="secondary" onPress={() => actionMutation.mutate("field")} loading={actionMutation.isPending} /> : null}
          <Field label="Completion note" value={completionNote} onChangeText={setCompletionNote} multiline placeholder="Explain the completed work." />
          <Field label="Completion proof keys" value={completionProofKeys} onChangeText={setCompletionProofKeys} multiline placeholder="One proof asset key per line" />
          {actions.includes("COMPLETE") ? <Button title="Submit completion" onPress={() => actionMutation.mutate("complete")} loading={actionMutation.isPending} /> : null}
        </Card>
      ) : null}

      {actions.includes("PAYMENT") ? (
        <Card>
          <Text style={styles.sectionTitle}>Payment and cash</Text>
          <SelectField
            label="Purpose"
            options={servicePaymentPurposeOptions}
            selectedValue={paymentPurpose}
            onSelect={(value) => setPaymentPurpose(value as ServicePaymentPurpose)}
          />
          <Field label="Amount" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <Field label="Reference" value={paymentReference} onChangeText={setPaymentReference} placeholder="UPI, receipt, or cash event reference" />
          <View style={styles.buttonRow}>
            <Button title="Record payment" tone="secondary" onPress={() => actionMutation.mutate("payment")} loading={actionMutation.isPending} style={styles.rowButton} />
            <Button title="Cash collected" onPress={() => actionMutation.mutate("cash")} loading={actionMutation.isPending} style={styles.rowButton} />
          </View>
        </Card>
      ) : null}

      {actions.includes("REJECT") || actions.includes("CANCEL") ? (
        <Card>
          <Text style={styles.sectionTitle}>Lifecycle action</Text>
          <Field label="Reason" value={reason} onChangeText={setReason} multiline placeholder="Reason shown in service history." />
          <View style={styles.buttonRow}>
            {actions.includes("REJECT") ? (
              <Button title="Reject" tone="danger" onPress={() => setConfirmState({ action: "reject", title: "Reject booking", message: "Reject this service booking request?" })} style={styles.rowButton} />
            ) : null}
            {actions.includes("CANCEL") ? (
              <Button title="Cancel" tone="danger" onPress={() => setConfirmState({ action: "cancel", title: "Cancel booking", message: "Cancel this service booking?" })} style={styles.rowButton} />
            ) : null}
          </View>
        </Card>
      ) : null}

      <BookingHistory booking={booking} />
      <ConfirmDialog
        visible={Boolean(confirmState)}
        title={confirmState?.title ?? "Confirm action"}
        message={confirmState?.message ?? "Continue with this service action?"}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState) {
            actionMutation.mutate(confirmState.action);
          }
        }}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((current) => ({ ...current, visible: false }))} />
    </Screen>
  );

  function optionalSchedulePayload() {
    return {
      ...(scheduledStartAt.trim() ? { scheduledStartAt: toIsoDateTime(scheduledStartAt) } : {}),
      ...(assignedTechnicianId ? { assignedTechnicianId } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
  }
}

function Summary({ booking }: { booking: SellerServiceBooking }) {
  return (
    <Card>
      <View style={styles.badgeRow}>
        <StatusChip label={booking.status} tone={booking.status === "COMPLETED" ? "success" : booking.status.includes("CANCEL") ? "danger" : "info"} />
        <StatusChip label={booking.paymentMode ?? "PAYMENT"} tone="warning" />
      </View>
      <Text style={styles.title}>{booking.listing && "title" in booking.listing ? booking.listing.title ?? "Service job" : "Service job"}</Text>
      <Text style={styles.muted}>{booking.customerIssue}</Text>
      <Text style={styles.muted}>Customer: {booking.customer?.displayName ?? booking.customer?.user?.fullName ?? "Customer"}</Text>
      <Text style={styles.money}>Total: {formatMoney(booking.totalPayablePaise, booking.currency)}</Text>
      <Text style={styles.money}>Due: {formatMoney(dueServiceAmountPaise(booking), booking.currency)}</Text>
      <Text style={styles.muted}>Scheduled: {booking.scheduledStartAt ?? "Not scheduled"}</Text>
      <Text style={styles.muted}>Technician: {booking.assignedTechnician?.name ?? "Not assigned"}</Text>
    </Card>
  );
}

function BookingHistory({ booking }: { booking: SellerServiceBooking }) {
  const quote = booking.quotes?.[0];
  return (
    <Card>
      <Text style={styles.sectionTitle}>Records</Text>
      {quote ? <Text style={styles.muted}>Latest quote: {quote.quoteNumber} / {quote.status} / {formatMoney(quote.totalPaise, quote.currency)}</Text> : <Text style={styles.muted}>No quote sent.</Text>}
      {(booking.payments ?? []).length ? (
        booking.payments?.map((payment) => (
          <Text key={payment.id} style={styles.muted}>
            Payment {payment.purpose}: {payment.status} / {formatMoney(payment.amountPaise, payment.currency)}
          </Text>
        ))
      ) : (
        <Text style={styles.muted}>No payment records.</Text>
      )}
      <Text style={styles.muted}>Completion: {booking.completionSubmittedAt ?? "Not submitted"}</Text>
      <Text style={styles.muted}>Field proof files: {booking.technicianFieldProofKeys?.length ?? 0}</Text>
    </Card>
  );
}

function proofLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function newQuoteLine(lineType: QuoteLineDraft["lineType"]): QuoteLineDraft {
  return {
    id: `${lineType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lineType,
    description: "",
    quantity: "1",
    unitAmount: "",
    hsnSacCode: "",
    taxClassification: "TAXABLE",
    gstRatePercent: "",
    uqc: lineType === "PRODUCT" ? "PCS" : "NOS",
  };
}

function updateQuoteLine(
  setLines: React.Dispatch<React.SetStateAction<QuoteLineDraft[]>>,
  id: string,
  patch: Partial<QuoteLineDraft>,
) {
  setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
}

function quoteLinePayload(line: QuoteLineDraft, index: number) {
  const description = line.description.trim();
  const quantity = Number(line.quantity);
  const unitPaise = rupeesToPaise(line.unitAmount);
  if (!description || !Number.isInteger(quantity) || quantity < 1 || unitPaise < 1) {
    throw new Error(`Complete description, quantity, and amount for quote line ${index + 1}.`);
  }

  return {
    lineType: line.lineType,
    description,
    quantity,
    unitPaise,
    ...(line.hsnSacCode.trim() ? { hsnSacCode: line.hsnSacCode.trim() } : {}),
    taxClassification: line.taxClassification,
    ...(line.gstRatePercent.trim() ? { gstRatePercent: Number(line.gstRatePercent) } : {}),
    uqc: line.uqc.trim().toUpperCase() || (line.lineType === "PRODUCT" ? "PCS" : "NOS"),
  };
}

function toIsoDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();
  if (trimmed.includes("T")) return new Date(trimmed).toISOString();
  return new Date(`${trimmed}T10:00:00.000+05:30`).toISOString();
}

function cashEventId(bookingNumber: string, reference: string) {
  const suffix = reference.trim() || String(Date.now());
  return `${bookingNumber}:${suffix}`.replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 160);
}

function successMessage(action: string) {
  switch (action) {
    case "accept":
      return "Service booking accepted.";
    case "reschedule":
      return "Service schedule updated.";
    case "reject":
      return "Service booking rejected.";
    case "cancel":
      return "Service booking cancelled.";
    case "quote":
      return "Quote sent to customer.";
    case "withdrawQuote":
      return "Quote withdrawn.";
    case "start":
      return "Service marked in progress.";
    case "field":
      return "Field status updated.";
    case "complete":
      return "Completion submitted.";
    case "payment":
      return "Payment recorded.";
    default:
      return "Cash collection recorded.";
  }
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  title: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  money: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowButton: {
    flex: 1,
  },
  twoColumn: {
    flexDirection: "row",
    gap: spacing.md,
  },
  column: {
    flex: 1,
  },
  quoteLine: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  quoteLineHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quoteLineTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
});
