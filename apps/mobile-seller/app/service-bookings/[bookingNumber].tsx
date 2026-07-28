import {
  Delete02Icon,
  DocumentAttachmentIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { OperationsHeader, OperationsSection } from "../../src/components/operations-ui";
import { Button, CollapsibleSection, ConfirmDialog, Field, LoadingState, QueryErrorState, Screen, SelectField, StatusChip, Toast } from "../../src/components/screen";
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
import {
  uploadSellerPrivateDocument,
  type MobileUploadFile,
} from "../../src/features/seller/mobile-upload";
import {
  dateInputFromIso,
  formatOperationDateTime,
  localDateTimeToIso,
  operationStatus,
  serviceBookingTitle,
  timeInputFromIso,
} from "../../src/features/seller/operations-presentation";
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
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [assignedTechnicianId, setAssignedTechnicianId] = useState("");
  const [fieldStatus, setFieldStatus] = useState<(typeof fieldStatusOptions)[number]["value"]>("EN_ROUTE");
  const [fieldProofKeys, setFieldProofKeys] = useState<string[]>([]);
  const [completionNote, setCompletionNote] = useState("");
  const [completionProofKeys, setCompletionProofKeys] = useState<string[]>([]);
  const [proofUploading, setProofUploading] = useState<"field" | "completion" | null>(null);
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
  const isTablet = width >= 700;
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

  useEffect(() => {
    if (!booking) return;
    setScheduleDate((current) => current || dateInputFromIso(booking.scheduledStartAt));
    setScheduleTime((current) => current || timeInputFromIso(booking.scheduledStartAt));
    setAssignedTechnicianId((current) => current || booking.assignedTechnicianId || "");
  }, [booking]);

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
          scheduledStartAt: requiredScheduleIso(),
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
          fieldProofKeys,
        });
      }
      if (action === "complete") {
        return submitSellerServiceCompletion(auth.authHeaders, decodedBookingNumber, {
          completionNote: completionNote.trim() || "Service completed and submitted for customer confirmation.",
          completionProofKeys,
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
      if (action === "field") setFieldProofKeys([]);
      if (action === "complete") setCompletionProofKeys([]);
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
        <OperationsHeader
          onBack={() => router.back()}
          title={decodedBookingNumber || "Service job"}
          subtitle="Seller service operations"
        />
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
    <Screen
      contentContainerStyle={styles.content}
      refreshing={bookingQuery.isFetching}
      onRefresh={() => {
        void bookingQuery.refetch();
      }}
    >
      <OperationsHeader
        onBack={() => router.back()}
        title={booking.bookingNumber}
        subtitle="Work through the next valid service action, customer quote, field visit, completion, and payment."
      />
      <Summary booking={booking} />

      {actions.includes("ACCEPT") || actions.includes("RESCHEDULE") ? (
        <OperationsSection
          title={actions.includes("ACCEPT") ? "Accept and schedule" : "Schedule and assignment"}
          subtitle="Use local date and time, then assign an active technician when needed."
        >
          <View style={styles.surface}>
            <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
              <View style={styles.column}>
                <Field
                  label="Visit date"
                  value={scheduleDate}
                  onChangeText={setScheduleDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.column}>
                <Field
                  label="Visit time"
                  value={scheduleTime}
                  onChangeText={setScheduleTime}
                  placeholder="HH:mm"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <SelectField label="Technician" options={technicianOptions} selectedValue={assignedTechnicianId} onSelect={setAssignedTechnicianId} />
            <Field label="Schedule note" value={note} onChangeText={setNote} multiline placeholder="Add timing, access, or customer context." />
            <View style={[styles.buttonRow, isTablet ? styles.buttonRowTablet : null]}>
              {actions.includes("ACCEPT") ? <Button title="Accept booking" onPress={() => actionMutation.mutate("accept")} loading={actionMutation.isPending} style={styles.rowButton} /> : null}
              {actions.includes("RESCHEDULE") ? <Button title="Save schedule" tone="secondary" onPress={() => actionMutation.mutate("reschedule")} loading={actionMutation.isPending} style={styles.rowButton} /> : null}
            </View>
          </View>
        </OperationsSection>
      ) : null}

      {actions.includes("START") ? (
        <OperationsSection
          title="Start field work"
          subtitle="Confirm that the technician has begun the service before recording field updates."
        >
          <View style={styles.primaryActionSurface}>
            <Text style={styles.primaryActionTitle}>Ready to begin the service?</Text>
            <Text style={styles.muted}>This moves the booking into active field work.</Text>
            <Button title="Mark in progress" onPress={() => actionMutation.mutate("start")} loading={actionMutation.isPending} />
          </View>
        </OperationsSection>
      ) : null}

      {actions.includes("QUOTE") || actions.includes("WITHDRAW_QUOTE") ? (
        <OperationsSection
          title="Customer quote"
          subtitle="Create GST-ready labour and spare-part lines only when the final scope or price needs approval."
        >
          <View style={styles.surface}>
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
                <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
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
                  placeholder={line.lineType === "SERVICE" ? "Blank uses booking SAC" : "4 to 8 digit HSN"}
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
                <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
                  <View style={styles.column}>
                    <Field
                      label="GST rate %"
                      value={line.gstRatePercent}
                      onChangeText={(gstRatePercent) => updateQuoteLine(setQuoteLines, line.id, { gstRatePercent })}
                      keyboardType="decimal-pad"
                      editable={line.taxClassification === "TAXABLE"}
                      placeholder={line.lineType === "SERVICE" ? "Blank uses booking rate" : "Required for taxable parts"}
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
                <Text style={styles.muted}>Use the SAC or HSN shown on the invoice. Amounts include GST.</Text>
              </View>
            ))}
            <Button
              title="Add quote line"
              tone="secondary"
              disabled={quoteLines.length >= 50}
              onPress={() => setQuoteLines((current) => [...current, newQuoteLine("PRODUCT")])}
            />
            <Field label="Quote valid hours" value={quoteTtlHours} onChangeText={setQuoteTtlHours} keyboardType="number-pad" />
            <Field label="Quote note" value={note} onChangeText={setNote} multiline placeholder="Explain the scope or assumptions for the customer." />
            <View style={[styles.buttonRow, isTablet ? styles.buttonRowTablet : null]}>
              {actions.includes("QUOTE") ? <Button title="Send quote" onPress={() => actionMutation.mutate("quote")} loading={actionMutation.isPending} style={styles.rowButton} /> : null}
              {actions.includes("WITHDRAW_QUOTE") ? (
                <Button
                  title="Withdraw quote"
                  tone="danger"
                  onPress={() => setConfirmState({ action: "withdrawQuote", title: "Withdraw quote", message: "Withdraw the active quote for this booking?" })}
                  style={styles.rowButton}
                />
              ) : null}
            </View>
          </View>
        </OperationsSection>
      ) : null}

      {actions.includes("FIELD_STATUS") ? (
        <OperationsSection
          title="Technician field status"
          subtitle="Record travel, arrival, check-in, or check-out updates for the customer timeline."
        >
          <View style={styles.surface}>
            <SelectField label="Technician status" options={fieldStatusOptions.map((option) => ({ label: option.label, value: option.value }))} selectedValue={fieldStatus} onSelect={(value) => setFieldStatus(value as typeof fieldStatus)} />
            <Field label="Field note" value={note} onChangeText={setNote} multiline placeholder="Add arrival, access, or visit context." />
            <ProofAttachments
              attachments={fieldProofKeys}
              label="Field proof"
              uploading={proofUploading === "field"}
              onAdd={() => void uploadProof("field")}
              onRemove={(key) =>
                setFieldProofKeys((current) => current.filter((item) => item !== key))
              }
            />
            <Button title="Update field status" tone="secondary" onPress={() => actionMutation.mutate("field")} loading={actionMutation.isPending} />
          </View>
        </OperationsSection>
      ) : null}

      {actions.includes("COMPLETE") ? (
        <OperationsSection
          title="Submit completed work"
          subtitle="Explain the completed service and attach proof files for customer confirmation."
        >
          <View style={styles.surface}>
            <Field label="Completion note" value={completionNote} onChangeText={setCompletionNote} multiline placeholder="Explain the completed work and result." />
            <ProofAttachments
              attachments={completionProofKeys}
              label="Completion proof"
              uploading={proofUploading === "completion"}
              onAdd={() => void uploadProof("completion")}
              onRemove={(key) =>
                setCompletionProofKeys((current) => current.filter((item) => item !== key))
              }
            />
            <Button title="Submit completion" onPress={() => actionMutation.mutate("complete")} loading={actionMutation.isPending} />
          </View>
        </OperationsSection>
      ) : null}

      {actions.includes("PAYMENT") ? (
        <OperationsSection
          title="Payment and cash"
          subtitle="Record only a payment that was actually completed or cash that was physically collected."
        >
          <View style={styles.surface}>
            <SelectField
              label="Purpose"
              options={servicePaymentPurposeOptions}
              selectedValue={paymentPurpose}
              onSelect={(value) => setPaymentPurpose(value as ServicePaymentPurpose)}
            />
            <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
              <View style={styles.column}>
                <Field label="Amount" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" />
              </View>
              <View style={styles.column}>
                <Field label="Reference" value={paymentReference} onChangeText={setPaymentReference} placeholder="UPI, receipt, or cash reference" />
              </View>
            </View>
            <Field label="Collection note" value={note} onChangeText={setNote} multiline placeholder="Add receipt or collection context when needed." />
            <View style={[styles.buttonRow, isTablet ? styles.buttonRowTablet : null]}>
              <Button
                title="Record payment"
                tone="secondary"
                onPress={() => actionMutation.mutate("payment")}
                loading={actionMutation.isPending}
                disabled={rupeesToPaise(paymentAmount) <= 0}
                style={styles.rowButton}
              />
              <Button
                title="Record cash collected"
                onPress={() => actionMutation.mutate("cash")}
                loading={actionMutation.isPending}
                disabled={rupeesToPaise(paymentAmount) <= 0}
                style={styles.rowButton}
              />
            </View>
          </View>
        </OperationsSection>
      ) : null}

      {actions.includes("REJECT") || actions.includes("CANCEL") ? (
        <CollapsibleSection title="Reject or cancel booking">
          <Text style={styles.muted}>Use this only when the booking cannot continue. The reason is recorded in service history.</Text>
          <Field label="Reason" value={reason} onChangeText={setReason} multiline placeholder="Explain why this booking cannot continue." />
          <View style={[styles.buttonRow, isTablet ? styles.buttonRowTablet : null]}>
            {actions.includes("REJECT") ? (
              <Button title="Reject booking" tone="danger" onPress={() => setConfirmState({ action: "reject", title: "Reject booking", message: "Reject this service booking request?" })} style={styles.rowButton} />
            ) : null}
            {actions.includes("CANCEL") ? (
              <Button title="Cancel booking" tone="danger" onPress={() => setConfirmState({ action: "cancel", title: "Cancel booking", message: "Cancel this service booking?" })} style={styles.rowButton} />
            ) : null}
          </View>
        </CollapsibleSection>
      ) : null}

      <BookingHistory booking={booking} />
      <ConfirmDialog
        visible={Boolean(confirmState)}
        title={confirmState?.title ?? "Confirm action"}
        message={confirmState?.message ?? "Continue with this service action?"}
        confirmLabel={
          confirmState?.action === "withdrawQuote"
            ? "Withdraw quote"
            : confirmState?.action === "reject"
              ? "Reject booking"
              : "Cancel booking"
        }
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState) actionMutation.mutate(confirmState.action);
        }}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((current) => ({ ...current, visible: false }))} />
    </Screen>
  );

  function optionalSchedulePayload() {
    const scheduledStartAt = optionalScheduleIso();
    return {
      ...(scheduledStartAt ? { scheduledStartAt } : {}),
      ...(assignedTechnicianId ? { assignedTechnicianId } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
  }

  function optionalScheduleIso() {
    if (!scheduleDate.trim() && !scheduleTime.trim()) return undefined;
    return requiredScheduleIso();
  }

  function requiredScheduleIso() {
    return localDateTimeToIso(scheduleDate, scheduleTime);
  }

  async function uploadProof(target: "field" | "completion") {
    if (proofUploading) return;
    setProofUploading(target);
    try {
      const result = await pickServiceProof();
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const file: MobileUploadFile = {
        uri: asset.uri,
        name: asset.name ?? `service-proof-${Date.now()}`,
        mimeType: asset.mimeType ?? "image/jpeg",
        sizeBytes: asset.size,
      };
      const uploaded = await uploadSellerPrivateDocument(
        auth.authHeaders,
        file,
        "SERVICE_COMPLETION_PROOF",
        undefined,
        { serviceBookingNumber: decodedBookingNumber },
      );
      const setAttachments =
        target === "field" ? setFieldProofKeys : setCompletionProofKeys;
      setAttachments((current) =>
        current.includes(uploaded.assetKey)
          ? current
          : [...current, uploaded.assetKey],
      );
      setToast({
        visible: true,
        message: "Proof uploaded and ready to attach.",
        type: "success",
      });
    } catch (error) {
      setToast({
        visible: true,
        message: uploadProofError(error),
        type: "error",
      });
    } finally {
      setProofUploading(null);
    }
  }
}

function Summary({ booking }: { booking: SellerServiceBooking }) {
  const status = operationStatus(booking.status);
  const payment = operationStatus(
    dueServiceAmountPaise(booking) === 0 ? "PAID" : "PENDING",
  );
  return (
    <View style={styles.summarySurface}>
      <View style={styles.badgeRow}>
        <StatusChip label={status.label} tone={status.tone} />
        <StatusChip label={payment.label} tone={payment.tone} />
      </View>
      <Text style={styles.title}>{serviceBookingTitle(booking)}</Text>
      <Text style={styles.muted}>{booking.customerIssue}</Text>
      <View style={styles.summaryGrid}>
        <SummaryItem
          label="Customer"
          value={booking.customer?.displayName ?? booking.customer?.user?.fullName ?? "Customer"}
        />
        <SummaryItem label="Scheduled" value={formatOperationDateTime(booking.scheduledStartAt)} />
        <SummaryItem label="Technician" value={booking.assignedTechnician?.name ?? "Not assigned"} />
        <SummaryItem label="Total" value={formatMoney(booking.totalPayablePaise, booking.currency)} />
        <SummaryItem label="Amount due" value={formatMoney(dueServiceAmountPaise(booking), booking.currency)} />
        <SummaryItem label="Visit mode" value={operationStatus(booking.visitMode ?? "NOT_SET").label} />
      </View>
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function BookingHistory({ booking }: { booking: SellerServiceBooking }) {
  const quote = booking.quotes?.[0];
  return (
    <CollapsibleSection title="Service records">
      <View style={styles.recordList}>
        <RecordRow
          label="Latest quote"
          value={
            quote
              ? `${quote.quoteNumber} | ${operationStatus(quote.status).label} | ${formatMoney(quote.totalPaise, quote.currency)}`
              : "No quote sent"
          }
        />
        {(booking.payments ?? []).length ? (
          booking.payments?.map((payment) => (
            <RecordRow
              key={payment.id}
              label={operationStatus(payment.purpose).label}
              value={`${operationStatus(payment.status).label} | ${formatMoney(payment.amountPaise, payment.currency)}`}
            />
          ))
        ) : (
          <RecordRow label="Payments" value="No payment records" />
        )}
        <RecordRow
          label="Completion"
          value={booking.completionSubmittedAt ? formatOperationDateTime(booking.completionSubmittedAt) : "Not submitted"}
        />
        <RecordRow
          label="Field proof"
          value={`${booking.technicianFieldProofKeys?.length ?? 0} files`}
        />
      </View>
    </CollapsibleSection>
  );
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recordRow}>
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

function ProofAttachments({
  attachments,
  label,
  onAdd,
  onRemove,
  uploading,
}: {
  attachments: string[];
  label: string;
  onAdd: () => void;
  onRemove: (key: string) => void;
  uploading: boolean;
}) {
  return (
    <View style={styles.proofGroup}>
      <Text style={styles.proofLabel}>{label}</Text>
      {attachments.length ? (
        <View style={styles.proofList}>
          {attachments.map((key, index) => (
            <View key={key} style={styles.proofRow}>
              <HugeiconsIcon
                icon={DocumentAttachmentIcon}
                color={colors.primary}
                size={20}
                strokeWidth={2}
              />
              <Text numberOfLines={1} style={styles.proofName}>
                Proof {index + 1} | {proofFileName(key)}
              </Text>
              <Pressable
                accessibilityLabel={`Remove proof ${index + 1}`}
                accessibilityRole="button"
                onPress={() => onRemove(key)}
                style={({ pressed }) => [
                  styles.proofRemoveButton,
                  pressed ? styles.proofRemovePressed : null,
                ]}
              >
                <HugeiconsIcon
                  icon={Delete02Icon}
                  color={colors.danger}
                  size={19}
                  strokeWidth={2.1}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>No proof attached yet.</Text>
      )}
      <Button
        title={uploading ? "Uploading proof..." : "Upload proof"}
        tone="secondary"
        loading={uploading}
        disabled={uploading || attachments.length >= 8}
        onPress={onAdd}
      />
      <Text style={styles.muted}>
        PDF, JPG, PNG, or WebP up to 10 MB. Uploaded proof is linked when this action is saved.
      </Text>
    </View>
  );
}

async function pickServiceProof() {
  const DocumentPicker = await import("expo-document-picker");
  return DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    copyToCacheDirectory: true,
  });
}

function uploadProofError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (message.includes("ExpoDocumentPicker") || message.includes("native module")) {
    return "Proof picker is unavailable in this app build. Rebuild the Expo development app.";
  }
  return message || "Proof upload failed. Please try again.";
}

function proofFileName(key: string) {
  return key.split("/").pop() || "Uploaded proof";
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
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryItem: {
    flexBasis: "46%",
    flexGrow: 1,
    gap: 2,
    minWidth: 135,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  buttonRow: {
    gap: spacing.sm,
  },
  buttonRowTablet: {
    flexDirection: "row",
  },
  rowButton: {
    flex: 1,
  },
  responsiveFields: {
    gap: spacing.md,
  },
  responsiveFieldsTablet: {
    flexDirection: "row",
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  primaryActionSurface: {
    backgroundColor: colors.softSurface,
    borderColor: "#F0B8A8",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  primaryActionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  quoteLine: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
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
  recordList: {
    gap: spacing.sm,
  },
  recordRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 2,
    paddingBottom: spacing.sm,
  },
  recordLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  recordValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  proofGroup: {
    gap: spacing.sm,
  },
  proofLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  proofList: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  proofRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 56,
    padding: spacing.sm,
  },
  proofName: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  proofRemoveButton: {
    alignItems: "center",
    borderColor: "#F4C2C2",
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  proofRemovePressed: {
    opacity: 0.72,
  },
});
