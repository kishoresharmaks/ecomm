"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, ExternalLink, MapPin, Navigation, Truck, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import {
  coordinatesFromSnapshot,
  formatCoordinates,
  googleMapsDirectionsUrl,
  googleMapsSearchUrl,
} from "@/lib/map-navigation";
import {
  createDeliveryAttempt,
  getDeliveryOrder,
  respondDeliveryAssignment,
  updateDeliveryOrder,
  type DeliveryOrder
} from "@/lib/delivery-api";
import {
  DeliveryError,
  DeliveryIconTile,
  DeliveryPanel,
  DeliveryStatusPill,
  formatDateTime,
  formatPaise,
  humanize,
  useDeliveryAuth
} from "./delivery-ui";

const deliveryStatuses = ["PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;
const attemptReasons = ["CUSTOMER_NOT_REACHABLE", "ADDRESS_ISSUE", "RESCHEDULED", "REFUSED_DELIVERY", "FAILED_ATTEMPT", "OTHER"];

type DeliveryStatusValue = (typeof deliveryStatuses)[number];

export function DeliveryOrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const auth = useDeliveryAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "danger" } | null>(null);
  const [status, setStatus] = useState<DeliveryStatusValue>("PENDING");
  const [trackingReference, setTrackingReference] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [codCollected, setCodCollected] = useState(false);
  const [codCollectedAmount, setCodCollectedAmount] = useState("");
  const [codCollectionNote, setCodCollectionNote] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [attemptReason, setAttemptReason] = useState("CUSTOMER_NOT_REACHABLE");
  const [attemptNote, setAttemptNote] = useState("");
  const [nextAttemptDate, setNextAttemptDate] = useState("");

  const orderQuery = useQuery({
    queryKey: ["delivery-order", auth.authKey, orderNumber],
    queryFn: () => getDeliveryOrder(auth.authHeaders, orderNumber),
    enabled: auth.enabled,
    retry: false
  });

  const updateMutation = useMutation({
    mutationFn: (codCollectedAmountPaise?: number) =>
      updateDeliveryOrder(auth.authHeaders, orderNumber, {
        status,
        trackingReference: trackingReference.trim() || undefined,
        estimatedDeliveryDate: estimatedDeliveryDate || undefined,
        deliveryNote: deliveryNote.trim() || undefined,
        receiverName: receiverName.trim() || undefined,
        proofNote: proofNote.trim() || undefined,
        proofReference: proofReference.trim() || undefined,
        ...(codCollected && codCollectedAmountPaise
          ? {
              codCollected: true,
              codCollectedAmountPaise,
              codCollectionNote: codCollectionNote.trim() || deliveryNote.trim() || undefined
            }
          : {})
      }),
    onSuccess: () => {
      setNotice({ message: "Delivery progress updated.", tone: "success" });
      void queryClient.invalidateQueries({ queryKey: ["delivery-order", auth.authKey, orderNumber] });
      void queryClient.invalidateQueries({ queryKey: ["delivery-orders", auth.authKey] });
    },
    onError: (error) => setNotice({ message: error instanceof Error ? error.message : "Delivery update failed.", tone: "danger" })
  });

  const assignmentMutation = useMutation({
    mutationFn: (decision: "ACCEPT" | "REJECT") =>
      respondDeliveryAssignment(auth.authHeaders, orderNumber, {
        decision,
        note: assignmentNote.trim() || undefined
      }),
    onSuccess: (_data, decision) => {
      setNotice({
        message: decision === "ACCEPT" ? "Assignment accepted." : "Assignment rejected.",
        tone: "success"
      });
      setAssignmentNote("");
      void queryClient.invalidateQueries({ queryKey: ["delivery-order", auth.authKey, orderNumber] });
      void queryClient.invalidateQueries({ queryKey: ["delivery-orders", auth.authKey] });
    },
    onError: (error) =>
      setNotice({
        message: error instanceof Error ? error.message : "Assignment update failed.",
        tone: "danger"
      })
  });

  const attemptMutation = useMutation({
    mutationFn: () =>
      createDeliveryAttempt(auth.authHeaders, orderNumber, {
        reason: attemptReason,
        note: attemptNote.trim() || undefined,
        nextAttemptDate: nextAttemptDate || undefined
      }),
    onSuccess: () => {
      setNotice({ message: "Delivery attempt recorded.", tone: "success" });
      setAttemptNote("");
      setNextAttemptDate("");
      void queryClient.invalidateQueries({ queryKey: ["delivery-order", auth.authKey, orderNumber] });
    },
    onError: (error) =>
      setNotice({
        message: error instanceof Error ? error.message : "Attempt could not be recorded.",
        tone: "danger"
      })
  });

  const order = orderQuery.data;
  const codPayment = useMemo(() => findCodPayment(order), [order]);

  useEffect(() => {
    const nextStatus = order?.deliveryDetail?.status ?? order?.deliveryStatus;
    if (nextStatus && isDeliveryStatus(nextStatus)) {
      setStatus(nextStatus);
    }
    setTrackingReference(order?.deliveryDetail?.trackingReference ?? "");
    setEstimatedDeliveryDate(toDateInput(order?.deliveryDetail?.estimatedDeliveryDate));
    setDeliveryNote(order?.deliveryDetail?.deliveryNote ?? "");
    const collectionStatus = order?.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED";
    setCodCollected(collectionStatus === "COLLECTED" || collectionStatus === "VERIFIED");
    setCodCollectedAmount(formatMinorForInput(order?.deliveryDetail?.codCollectedAmountPaise ?? codPayment?.amountPaise ?? null));
    setCodCollectionNote(order?.deliveryDetail?.codCollectionNote ?? "");
    setReceiverName(order?.deliveryDetail?.receiverName ?? "");
    setProofNote(order?.deliveryDetail?.proofNote ?? "");
    setProofReference(order?.deliveryDetail?.proofReference ?? "");
  }, [codPayment?.amountPaise, order]);

  const timeline = useMemo(() => buildTimeline(order), [order]);
  const assignmentStatus = order?.deliveryDetail?.assignmentStatus ?? "UNASSIGNED";
  const canUpdateProgress = assignmentStatus === "ACCEPTED";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdateProgress) {
      setNotice({ message: "Accept the delivery assignment before updating progress.", tone: "danger" });
      return;
    }

    const collectionStatus = order?.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED";
    const shouldRecordCod = Boolean(codPayment) && codCollected && order?.paymentStatus === "PENDING" && collectionStatus !== "VERIFIED";
    const codCollectedAmountPaise = shouldRecordCod ? parseMinorFromInput(codCollectedAmount) : undefined;

    setNotice(null);
    if (shouldRecordCod && !codCollectedAmountPaise) {
      setNotice({ message: "Enter a valid COD collected amount greater than zero.", tone: "danger" });
      return;
    }

    updateMutation.mutate(codCollectedAmountPaise ?? undefined);
  }

  if (!auth.enabled) {
    return null;
  }

  if (orderQuery.isLoading) {
    return <div className="h-72 animate-pulse rounded-md bg-white" />;
  }

  if (orderQuery.error) {
    return <DeliveryError error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />;
  }

  if (!order) {
    return null;
  }

  return (
    <div className="grid gap-5">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/delivery/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to assigned orders
          </Link>
        </Button>
      </div>

      {notice ? <StatusBadge tone={notice.tone}>{notice.message}</StatusBadge> : null}

      <DeliveryPanel>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-sm font-bold text-[#667085]">Placed on {formatDateTime(order.createdAt)}</p>
            <h2 className="mt-2 text-2xl font-black text-[#1F2933]">{order.orderNumber}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge tone="info">{humanize(order.orderStatus)}</StatusBadge>
              <StatusBadge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>{humanize(order.paymentStatus)}</StatusBadge>
              <DeliveryStatusPill status={order.deliveryStatus} />
              <StatusBadge tone={assignmentStatus === "ACCEPTED" ? "success" : assignmentStatus === "REJECTED" ? "danger" : "warning"}>
                Assignment {humanize(assignmentStatus)}
              </StatusBadge>
            </div>
          </div>
          <div className="rounded-md bg-[#FFFCFB] p-4 text-left lg:text-right">
            <p className="text-sm font-bold text-[#667085]">Order value</p>
            <p className="mt-1 text-3xl font-black text-[#123A5A]">
              {formatPaise(order.buyerTotalMinor ?? order.totalPaise, order.buyerCurrency ?? order.currency)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">Payment is controlled by admin/payment flow.</p>
          </div>
        </div>
      </DeliveryPanel>

      {assignmentStatus === "ASSIGNED" ? (
        <DeliveryPanel>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-start gap-3">
              <DeliveryIconTile>
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </DeliveryIconTile>
              <div>
                <SectionHeading title="Accept this assignment" description="Accept before pickup, handover, COD, or delivery updates." />
                <DeliveryTextArea label="Response note" value={assignmentNote} onChange={setAssignmentNote} rows={2} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:min-w-64 md:grid-cols-1">
              <Button type="button" onClick={() => assignmentMutation.mutate("ACCEPT")} disabled={assignmentMutation.isPending}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Accept
              </Button>
              <Button type="button" variant="outline" onClick={() => assignmentMutation.mutate("REJECT")} disabled={assignmentMutation.isPending}>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject
              </Button>
            </div>
          </div>
        </DeliveryPanel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          <DeliveryPanel>
            <SectionHeading title="Items to deliver" description="Product and seller context for this assigned order." />
            <div className="mt-5 overflow-hidden rounded-md border border-[#E5E7EB]">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="grid gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] p-4 last:border-b-0 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-black text-[#1F2933]">{item.productNameSnapshot}</p>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">
                      {item.seller?.storeName ?? "Seller"} / Qty {item.quantity}
                    </p>
                  </div>
                  <StatusBadge tone="info">{item.seller?.slug ?? "seller"}</StatusBadge>
                </div>
              ))}
            </div>
          </DeliveryPanel>

          <DeliveryPanel>
            <SectionHeading title="Status timeline" description="Delivery and order status events for this order." />
            <div className="mt-5 grid gap-3">
              {timeline.map((event) => (
                <div key={event.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{event.kind}</StatusBadge>
                    <p className="font-black text-[#1F2933]">{humanize(event.newStatus)}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#667085]">{formatDateTime(event.createdAt)}</p>
                  {event.note ? <p className="mt-2 text-sm leading-6 text-[#667085]">{event.note}</p> : null}
                </div>
              ))}
              {timeline.length === 0 ? <p className="text-sm font-semibold text-[#667085]">No timeline events yet.</p> : null}
            </div>
          </DeliveryPanel>
        </div>

        <div className="grid gap-5">
          <DeliveryPanel>
            <div className="flex items-center gap-3">
              <DeliveryIconTile>
                <Truck className="h-5 w-5" aria-hidden="true" />
              </DeliveryIconTile>
              <SectionHeading title="Delivery progress" description="Update only dispatch and delivery progress for this assigned order." />
            </div>
            <form onSubmit={submit} className="mt-5 grid gap-4">
              {!canUpdateProgress ? (
                <p className="rounded-md border border-[#FFC7B8] bg-[#FFF0EC] p-3 text-sm font-bold leading-6 text-[#9F2600]">
                  Accept the assignment before updating pickup, out-for-delivery, COD, or proof details.
                </p>
              ) : null}
              <DeliverySelect label="Delivery status" value={status} onChange={(value) => setStatus(value as DeliveryStatusValue)} disabled={!canUpdateProgress} />
              <DeliveryField
                label="Tracking reference"
                value={trackingReference}
                onChange={setTrackingReference}
                placeholder="Auto-generated on partner assignment if left blank"
                disabled={!canUpdateProgress}
              />
              <DeliveryField label="Estimated delivery date" type="date" value={estimatedDeliveryDate} onChange={setEstimatedDeliveryDate} disabled={!canUpdateProgress} />
              <DeliveryTextArea label="Delivery note" value={deliveryNote} onChange={setDeliveryNote} rows={3} disabled={!canUpdateProgress} />
              <div className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                <p className="text-sm font-black text-[#1F2933]">Proof details</p>
                <DeliveryField label="Receiver name" value={receiverName} onChange={setReceiverName} disabled={!canUpdateProgress} />
                <DeliveryTextArea label="Delivery proof note" value={proofNote} onChange={setProofNote} rows={2} disabled={!canUpdateProgress} />
                <DeliveryField label="Manual proof reference" value={proofReference} onChange={setProofReference} disabled={!canUpdateProgress} placeholder="Image/signature upload later" />
              </div>
              {codPayment ? (
                <CodCollectionFields
                  order={order}
                  codPayment={codPayment}
                  collected={codCollected}
                  amount={codCollectedAmount}
                  note={codCollectionNote}
                  onCollectedChange={setCodCollected}
                  onAmountChange={setCodCollectedAmount}
                  onNoteChange={setCodCollectionNote}
                  disabled={!canUpdateProgress}
                />
              ) : null}
              <Button type="submit" disabled={updateMutation.isPending || !canUpdateProgress} className="sticky bottom-3 z-10 h-12 shadow-lg shadow-[#ED3500]/15 md:static md:shadow-none">
                {updateMutation.isPending ? "Saving..." : "Save delivery update"}
              </Button>
            </form>
          </DeliveryPanel>

          <DeliveryPanel>
            <SectionHeading title="Delivery attempts" description="Record failed attempt, unreachable customer, address issue, reschedule, or refusal." />
            <form
              className="mt-5 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice(null);
                attemptMutation.mutate();
              }}
            >
              <DeliverySelect label="Attempt reason" value={attemptReason} values={attemptReasons} onChange={setAttemptReason} disabled={!canUpdateProgress} />
              <DeliveryTextArea label="Attempt note" value={attemptNote} onChange={setAttemptNote} rows={2} disabled={!canUpdateProgress} />
              <DeliveryField label="Next attempt date" type="date" value={nextAttemptDate} onChange={setNextAttemptDate} disabled={!canUpdateProgress} />
              <Button type="submit" variant="outline" disabled={!canUpdateProgress || attemptMutation.isPending}>
                {attemptMutation.isPending ? "Recording..." : "Record attempt"}
              </Button>
            </form>
            <div className="mt-5 grid gap-2">
              {(order.deliveryDetail?.attempts ?? []).map((attempt) => (
                <div key={attempt.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge tone="warning">{humanize(attempt.reason)}</StatusBadge>
                    <span className="font-semibold text-[#667085]">{formatDateTime(attempt.attemptedAt ?? attempt.createdAt)}</span>
                  </div>
                  {attempt.note ? <p className="mt-2 font-semibold leading-6 text-[#667085]">{attempt.note}</p> : null}
                  {attempt.nextAttemptDate ? <p className="mt-1 text-xs font-bold text-[#163B5C]">Next attempt {formatDateTime(attempt.nextAttemptDate)}</p> : null}
                </div>
              ))}
              {(order.deliveryDetail?.attempts ?? []).length === 0 ? <p className="text-sm font-semibold text-[#667085]">No attempts recorded.</p> : null}
            </div>
          </DeliveryPanel>

          <DeliveryPanel>
            <div className="flex items-center gap-3">
              <DeliveryIconTile>
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </DeliveryIconTile>
              <SectionHeading title="Payment check" description="Delivery partners do not change payment state." />
            </div>
            <div className="mt-4 grid gap-3">
              {(order.payments ?? []).map((payment) => (
                <div key={payment.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-[#1F2933]">{humanize(payment.provider)}</p>
                    <StatusBadge tone={payment.status === "PAID" ? "success" : "warning"}>{humanize(payment.status)}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">{formatPaise(payment.amountPaise, payment.currency)}</p>
                </div>
              ))}
              {isCodPending(order) ? (
                <p className="rounded-md border border-[#FFC7B8] bg-[#FFF0EC] p-3 text-sm font-bold leading-6 text-[#9F2600]">
                  COD cash can be recorded from the delivery form. Admin verification marks the payment paid.
                </p>
              ) : null}
            </div>
          </DeliveryPanel>

          <DeliveryPanel>
            <div className="flex items-center gap-3">
              <DeliveryIconTile>
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </DeliveryIconTile>
              <SectionHeading title="Delivery address" description="Checkout snapshot for delivery coordination." />
            </div>
            <AddressBlock order={order} />
          </DeliveryPanel>
        </div>
      </div>
    </div>
  );
}

function CodCollectionFields({
  order,
  codPayment,
  collected,
  amount,
  note,
  onCollectedChange,
  onAmountChange,
  onNoteChange,
  disabled = false
}: {
  order: DeliveryOrder;
  codPayment: NonNullable<DeliveryOrder["payments"]>[number];
  collected: boolean;
  amount: string;
  note: string;
  onCollectedChange: (value: boolean) => void;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  disabled?: boolean;
}) {
  const collectionStatus = order.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED";
  const recorded = collectionStatus === "COLLECTED" || collectionStatus === "VERIFIED";
  const checked = recorded || collected;
  const canRecord = !disabled && order.paymentStatus === "PENDING" && collectionStatus !== "VERIFIED";

  return (
    <div className="rounded-md border border-[#FFC7B8] bg-[#FFFCFB] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge tone={codCollectionTone(collectionStatus)}>COD {humanize(collectionStatus)}</StatusBadge>
        <span className="text-sm font-black text-[#123A5A]">{formatPaise(codPayment.amountPaise, codPayment.currency)}</span>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-md border border-[#E5E7EB] bg-white p-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={recorded || !canRecord}
          onChange={(event) => onCollectedChange(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#ED3500]"
        />
        <span>
          <span className="block text-sm font-black text-[#1F2933]">COD cash collected</span>
          <span className="block text-xs font-semibold leading-5 text-[#667085]">Admin verification will update payment status.</span>
        </span>
      </label>

      {checked ? (
        <div className="mt-4 grid gap-3">
          <DeliveryField label={`Collected amount (${codPayment.currency})`} value={amount} onChange={onAmountChange} disabled={!canRecord} />
          <DeliveryTextArea label="COD collection note" value={note} onChange={onNoteChange} rows={2} disabled={!canRecord} />
        </div>
      ) : null}

      {order.deliveryDetail?.codCollectedAt ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-[#667085]">
          Collected by {order.deliveryDetail.codCollectedBy?.fullName || order.deliveryDetail.codCollectedBy?.email || "delivery user"} on{" "}
          {formatDateTime(order.deliveryDetail.codCollectedAt)}.
        </p>
      ) : null}
      {order.deliveryDetail?.codVerifiedAt ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-[#667085]">
          Verified by {order.deliveryDetail.codVerifiedBy?.fullName || order.deliveryDetail.codVerifiedBy?.email || "admin"} on{" "}
          {formatDateTime(order.deliveryDetail.codVerifiedAt)}.
        </p>
      ) : null}
      {order.deliveryDetail?.codVerificationNote ? (
        <p className="mt-3 rounded-md bg-[#F8FAFC] p-3 text-xs font-semibold leading-5 text-[#667085]">{order.deliveryDetail.codVerificationNote}</p>
      ) : null}
    </div>
  );
}

function DeliverySelect({
  label,
  value,
  onChange,
  values = deliveryStatuses,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  values?: readonly string[];
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {values.map((deliveryStatus) => (
          <option key={deliveryStatus} value={deliveryStatus}>
            {humanize(deliveryStatus)}
          </option>
        ))}
      </select>
    </label>
  );
}

function DeliveryField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      />
    </label>
  );
}

function DeliveryTextArea({
  label,
  value,
  onChange,
  rows = 4,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      />
    </label>
  );
}

function AddressBlock({ order }: { order: DeliveryOrder }) {
  const address = order.shippingAddressSnapshot;
  const coordinates = coordinatesFromSnapshot(address);

  return (
    <div className="mt-4 text-sm font-semibold leading-6 text-[#667085]">
      <p className="font-black text-[#1F2933]">{address?.fullName ?? order.customer?.fullName ?? "Customer"}</p>
      {address?.phone || order.customer?.phone ? <p>{address?.phone ?? order.customer?.phone}</p> : null}
      {address?.line1 ? <p>{address.line1}</p> : null}
      {address?.line2 ? <p>{address.line2}</p> : null}
      {address?.area ? <p>{address.area}</p> : null}
      <p>{[address?.city, address?.state, address?.pincode].filter(Boolean).join(", ") || "Address not available"}</p>
      {address?.country || address?.countryCode ? <p>{address.country ?? address.countryCode}</p> : null}
      {coordinates ? (
        <div className="mt-4 rounded-xl border border-[#D8E2EA] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="success">Coordinates available</StatusBadge>
            {address?.locationSource ? <StatusBadge tone="info">{humanize(address.locationSource)}</StatusBadge> : null}
            {address?.accuracyMeters ? <StatusBadge tone="info">Accuracy {address.accuracyMeters} m</StatusBadge> : null}
          </div>
          <p className="mt-2 text-xs font-semibold text-[#667085]">{formatCoordinates(coordinates)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={googleMapsDirectionsUrl(coordinates)} target="_blank" rel="noreferrer">
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Open route
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={googleMapsSearchUrl(coordinates)} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                View pin
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-[#FFE0D6] bg-[#FFFCFB] px-3 py-2 text-xs font-bold text-[#8A4B32]">
          No coordinate pin was saved for this order; use the written address.
        </p>
      )}
    </div>
  );
}

function buildTimeline(order?: DeliveryOrder) {
  if (!order) {
    return [];
  }

  return [
    ...(order.deliveryDetail?.events ?? []).map((event) => ({
      id: `delivery-${event.id}`,
      kind: "Delivery",
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null
    })),
    ...(order.statusEvents ?? []).map((event) => ({
      id: `status-${event.id}`,
      kind: humanize(event.statusType),
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null
    }))
  ].sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime());
}

function isDeliveryStatus(value: string): value is DeliveryStatusValue {
  return deliveryStatuses.includes(value as DeliveryStatusValue);
}

function isCodPending(order: DeliveryOrder) {
  return (
    order.paymentStatus === "PENDING" &&
    (order.payments ?? []).some((payment) => payment.provider === "COD" || payment.method === "COD")
  );
}

function findCodPayment(order?: DeliveryOrder) {
  return order?.payments?.find((payment) => payment.provider === "COD" || payment.method === "COD") ?? null;
}

function codCollectionTone(status?: string | null) {
  if (status === "VERIFIED") {
    return "success";
  }
  if (status === "REJECTED") {
    return "danger";
  }
  if (status === "COLLECTED") {
    return "warning";
  }
  return "neutral";
}

function formatMinorForInput(value?: number | null) {
  if (!value) {
    return "";
  }

  const whole = Math.floor(value / 100);
  const fraction = Math.abs(value % 100);
  return fraction > 0 ? `${whole}.${fraction.toString().padStart(2, "0")}` : String(whole);
}

function parseMinorFromInput(value: string) {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || normalized.split(".").length > 2) {
    return null;
  }

  const parts = normalized.split(".");
  const whole = parts[0] ?? "";
  const fraction = parts[1] ?? "";
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) {
    return null;
  }

  const amount = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return amount > 0 ? amount : null;
}

function toDateInput(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}
