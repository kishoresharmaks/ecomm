"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Search, XCircle } from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import {
  listCourierCodRemittances,
  listFinancePaymentCollections,
  upsertCourierCodRemittance,
  verifyCourierCodRemittance,
  type CourierCodRemittance,
  verifyFinanceCodCollection,
  verifyFinanceOfflinePayment,
  type FinancePaymentCollection
} from "@/lib/finance-api";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

type PaymentCollectionMode = "COD" | "BANK_TRANSFER" | "ALL";

export function PaymentCollectionsClient({ mode = "ALL" }: { mode?: PaymentCollectionMode }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [courierReferences, setCourierReferences] = useState<Record<string, string>>({});
  const [courierNotes, setCourierNotes] = useState<Record<string, string>>({});
  const provider = mode === "ALL" ? "" : mode;
  const query = useMemo(
    () => ({
      ...(provider ? { provider } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      limit: 40
    }),
    [paymentStatus, provider, search]
  );

  const collectionsQuery = useQuery({
    queryKey: ["finance-payment-collections", auth.authHeaders, query],
    queryFn: () => listFinancePaymentCollections(auth.authHeaders, query),
    enabled: auth.isAuthenticated
  });
  const courierRemittancesQuery = useQuery({
    queryKey: ["finance-courier-cod-remittances", auth.authHeaders, search],
    queryFn: () =>
      listCourierCodRemittances(auth.authHeaders, {
        ...(search.trim() ? { search: search.trim() } : {}),
        limit: 40
      }),
    enabled: auth.isAuthenticated && (mode === "COD" || mode === "ALL")
  });

  const mutation = useMutation({
    mutationFn: async ({
      payment,
      decision
    }: {
      payment: FinancePaymentCollection;
      decision: "VERIFY" | "REJECT";
    }) => {
      const note = notes[payment.id]?.trim() || undefined;
      if (payment.provider === "COD") {
        return verifyFinanceCodCollection(auth.authHeaders, payment.order.orderNumber, {
          decision,
          ...(note ? { note } : {})
        });
      }

      const transactionReference = references[payment.id]?.trim() || payment.customerReference || payment.providerPaymentId || undefined;
      return verifyFinanceOfflinePayment(auth.authHeaders, payment.order.orderNumber, {
        decision,
        ...(transactionReference ? { transactionReference } : {}),
        ...(note ? { note } : {})
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-payment-collections"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-payment-reports"] })
      ]);
    }
  });
  const courierMutation = useMutation({
    mutationFn: async ({
      remittance,
      decision
    }: {
      remittance: CourierCodRemittance;
      decision: "VERIFY" | "DISPUTE" | "REJECT";
    }) => {
      const note = courierNotes[remittance.id]?.trim() || undefined;
      const reference = courierReferences[remittance.id]?.trim() || remittance.remittanceReference || undefined;
      if (reference && decision === "VERIFY" && remittance.status === "COURIER_COLLECTED") {
        await upsertCourierCodRemittance(auth.authHeaders, {
          shipmentNumber: remittance.orderShipment.shipmentNumber,
          awbNumber: remittance.awbNumber ?? undefined,
          remittedAmountPaise: remittance.expectedAmountPaise,
          remittanceReference: reference,
          notes: note
        });
      }
      return verifyCourierCodRemittance(auth.authHeaders, remittance.id, {
        decision,
        ...(note ? { note } : {})
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-payment-collections"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-courier-cod-remittances"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-payment-reports"] })
      ]);
    }
  });

  const items = collectionsQuery.data?.items ?? [];
  const courierRemittances = courierRemittancesQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      {confirmation.confirmationDialog}
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number, customer email, or customer name"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <select
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            <option value="">All payment statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="NOT_REQUIRED">Not required</option>
          </select>
          <Button type="button" variant="outline" onClick={() => collectionsQuery.refetch()}>
            Refresh
          </Button>
        </div>
      </section>

      {collectionsQuery.isLoading ? <FinanceListState message="Loading payment records" /> : null}
      {collectionsQuery.isError ? (
        <FinanceListState
          message={collectionsQuery.error instanceof Error ? collectionsQuery.error.message : "Unable to load payment records."}
          error
        />
      ) : null}

      {mode === "COD" || mode === "ALL" ? (
        <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Courier COD remittances</h2>
              <p className="mt-1 text-sm font-semibold text-[#667085]">
                Third-party courier COD is verified here after provider collection and bank remittance match.
              </p>
            </div>
            <StatusBadge tone="info">{courierRemittancesQuery.data?.total ?? 0} packages</StatusBadge>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {courierRemittances.map((remittance) => (
              <CourierRemittanceRow
                key={remittance.id}
                remittance={remittance}
                reference={courierReferences[remittance.id] ?? remittance.remittanceReference ?? ""}
                note={courierNotes[remittance.id] ?? ""}
                busy={courierMutation.isPending}
                onReferenceChange={(value) => setCourierReferences((current) => ({ ...current, [remittance.id]: value }))}
                onNoteChange={(value) => setCourierNotes((current) => ({ ...current, [remittance.id]: value }))}
                onDecision={(decision) =>
                  confirmation.requestConfirmation({
                    title: decision === "VERIFY" ? "Verify courier remittance?" : "Flag courier remittance?",
                    description:
                      decision === "VERIFY"
                        ? `${remittance.orderShipment.shipmentNumber} will count toward COD payment completion.`
                        : `${remittance.orderShipment.shipmentNumber} will stay pending for finance follow-up.`,
                    confirmLabel: decision === "VERIFY" ? "Verify remittance" : "Flag remittance",
                    tone: decision === "VERIFY" ? "info" : "warning",
                    onConfirm: () => courierMutation.mutate({ remittance, decision })
                  })
                }
              />
            ))}
            {courierRemittancesQuery.isLoading ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-[#667085]">Loading courier remittances.</div>
            ) : null}
            {!courierRemittancesQuery.isLoading && courierRemittances.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-[#667085]">No courier COD remittances found.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Payment queue</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">
              {collectionsQuery.data?.total ?? 0} records matched. Finance verification is audit logged.
            </p>
          </div>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {items.map((payment) => (
            <PaymentCollectionRow
              key={payment.id}
              payment={payment}
              note={notes[payment.id] ?? ""}
              reference={references[payment.id] ?? payment.customerReference ?? ""}
              onNoteChange={(value) => setNotes((current) => ({ ...current, [payment.id]: value }))}
              onReferenceChange={(value) => setReferences((current) => ({ ...current, [payment.id]: value }))}
              busy={mutation.isPending}
              onDecision={(decision) =>
                confirmation.requestConfirmation({
                  title: decision === "VERIFY" ? "Mark payment as paid?" : "Reject this payment?",
                  description:
                    decision === "VERIFY"
                      ? `${payment.order.orderNumber} will move from pending to paid after finance verification.`
                      : `${payment.order.orderNumber} will be marked failed and kept in the audit trail.`,
                  confirmLabel: decision === "VERIFY" ? "Verify payment" : "Reject payment",
                  tone: decision === "VERIFY" ? "info" : "warning",
                  onConfirm: () => mutation.mutate({ payment, decision })
                })
              }
            />
          ))}
          {!collectionsQuery.isLoading && items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-[#667085]">No payment records found.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PaymentCollectionRow({
  payment,
  note,
  reference,
  busy,
  onNoteChange,
  onReferenceChange,
  onDecision
}: {
  payment: FinancePaymentCollection;
  note: string;
  reference: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onDecision: (decision: "VERIFY" | "REJECT") => void;
}) {
  const isCod = payment.provider === "COD";
  const isOffline = payment.provider === "BANK_TRANSFER" || payment.provider === "MANUAL";
  const canVerifyCod = isCod && payment.status === "PENDING" && payment.order.deliveryDetail?.codCollectionStatus === "COLLECTED";
  const canVerifyOffline = isOffline && payment.status === "PENDING";
  const canAct = canVerifyCod || canVerifyOffline;

  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[1.1fr_0.9fr_1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-black text-[#163B5C]">{payment.order.orderNumber}</p>
          <StatusBadge tone={payment.status === "PAID" ? "success" : payment.status === "FAILED" ? "danger" : "warning"}>{payment.status}</StatusBadge>
          <StatusBadge tone="info">{payment.provider.replace("_", " ")}</StatusBadge>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#667085]">
          {payment.order.customer.fullName ?? payment.order.customer.email ?? "Customer"} / {new Date(payment.order.createdAt).toLocaleString("en-IN")}
        </p>
        <p className="mt-2 text-xl font-black text-[#1F2933]">{money(payment.amountPaise)}</p>
      </div>

      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          Order: <span className="font-black text-[#1F2933]">{payment.order.orderStatus}</span>
        </p>
        <p>
          Delivery: <span className="font-black text-[#1F2933]">{payment.order.deliveryStatus}</span>
        </p>
        {isCod ? (
          <p>
            COD: <span className="font-black text-[#1F2933]">{payment.order.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED"}</span>
          </p>
        ) : (
          <p>
            UTR/reference: <span className="font-black text-[#1F2933]">{payment.customerReference || payment.providerPaymentId || "Not entered"}</span>
          </p>
        )}
      </div>

      <div className="grid gap-2">
        {isOffline ? (
          <input
            value={reference}
            onChange={(event) => onReferenceChange(event.target.value)}
            placeholder="UTR / bank reference"
            className="h-10 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
          />
        ) : null}
        <input
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={isCod ? "COD verification note" : "Finance verification note"}
          className="h-10 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
        />
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        <Button type="button" disabled={!canAct || busy} onClick={() => onDecision("VERIFY")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Mark paid
        </Button>
        <Button type="button" variant="outline" disabled={!canAct || busy} onClick={() => onDecision("REJECT")}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Reject
        </Button>
      </div>

      {!canAct ? (
        <p className="xl:col-span-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#667085]">
          {actionHint(payment)}
        </p>
      ) : null}
    </article>
  );
}

function CourierRemittanceRow({
  remittance,
  reference,
  note,
  busy,
  onReferenceChange,
  onNoteChange,
  onDecision
}: {
  remittance: CourierCodRemittance;
  reference: string;
  note: string;
  busy: boolean;
  onReferenceChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onDecision: (decision: "VERIFY" | "DISPUTE" | "REJECT") => void;
}) {
  const canVerify = remittance.status === "REMITTED" || remittance.status === "COURIER_COLLECTED";
  const needsReference = remittance.status === "COURIER_COLLECTED";

  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[1.1fr_0.9fr_1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-black text-[#163B5C]">{remittance.orderShipment.shipmentNumber}</p>
          <StatusBadge tone={statusTone(remittance.status)}>{remittance.status.replaceAll("_", " ")}</StatusBadge>
          <StatusBadge tone="info">{remittance.providerCode}</StatusBadge>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#667085]">
          {remittance.order.orderNumber} / {remittance.orderShipment.seller?.storeName ?? "Seller"}
        </p>
        <p className="mt-2 text-xl font-black text-[#1F2933]">{money(remittance.expectedAmountPaise)}</p>
      </div>

      <div className="grid gap-1 text-sm font-semibold text-[#667085]">
        <p>
          AWB: <span className="font-black text-[#1F2933]">{remittance.awbNumber ?? "Not assigned"}</span>
        </p>
        <p>
          Remitted: <span className="font-black text-[#1F2933]">{money(remittance.remittedAmountPaise ?? 0)}</span>
        </p>
        <p>
          Reference: <span className="font-black text-[#1F2933]">{remittance.remittanceReference ?? "Pending"}</span>
        </p>
      </div>

      <div className="grid gap-2">
        <input
          value={reference}
          onChange={(event) => onReferenceChange(event.target.value)}
          placeholder="Courier remittance UTR/reference"
          className="h-10 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
        />
        <input
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Finance verification note"
          className="h-10 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
        />
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        <Button type="button" disabled={!canVerify || busy || (needsReference && !reference.trim())} onClick={() => onDecision("VERIFY")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Verify
        </Button>
        <Button type="button" variant="outline" disabled={!canVerify || busy} onClick={() => onDecision("DISPUTE")}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Dispute
        </Button>
      </div>
    </article>
  );
}

function FinanceListState({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-white p-4 shadow-sm", error ? "border-[#F5B7B7]" : "border-[#D8E2EA]")}>
      <div className="flex items-center gap-3">
        <AlertCircle className={cn("h-5 w-5", error ? "text-[#B42318]" : "text-[#ED3500]")} aria-hidden="true" />
        <p className="text-sm font-black text-[#1F2933]">{message}</p>
      </div>
    </div>
  );
}

function actionHint(payment: FinancePaymentCollection) {
  if (payment.status !== "PENDING") {
    return "This payment is already finalised.";
  }
  if (payment.provider === "COD") {
    return "COD can be marked paid only after a delivery partner marks cash as collected.";
  }
  if (payment.provider === "RAZORPAY") {
    return "Razorpay payments are marked paid automatically from checkout verification or webhook events.";
  }
  return "This record is waiting for finance verification.";
}

function statusTone(status: string): "success" | "danger" | "warning" | "info" {
  if (["PAID", "VERIFIED", "DELIVERED", "REMITTED"].includes(status)) {
    return "success";
  }
  if (["FAILED", "REJECTED", "DISPUTED", "CANCELLED"].includes(status)) {
    return "danger";
  }
  if (["PENDING", "COURIER_COLLECTED", "COLLECTED"].includes(status)) {
    return "warning";
  }
  return "info";
}

function money(amountPaise: number) {
  return moneyFormatter.format((amountPaise ?? 0) / 100);
}
