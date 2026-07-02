"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  AdminConfirmationDialog,
  AdminPanel,
  AdminStatusNotice,
  AdminTabs,
} from "@/components/admin/admin-ux";
import { indihubFetch, userFacingApiErrorMessage } from "@/lib/api";
import { openB2BPurchaseOrderDocument } from "@/lib/b2b-po-documents";
import {
  type B2BOrder,
  type B2BOrderStatus,
  type B2BPaymentProof,
  type B2BPaymentStatus,
} from "@/lib/business-buyer-api";
import {
  rejectAdminB2BPaymentProof,
  verifyAdminB2BPaymentProof,
} from "@/lib/admin-b2b-payments-api";

type B2BOrderWithAdminDetail = B2BOrder & {
  paidAt?: string | null;
  fulfilmentUnlockNote?: string | null;
  proformaRevisions?: Array<{
    id: string;
    invoiceNumber: string;
    fileKey: string;
    issuedAt?: string;
    expiresAt?: string | null;
    reason?: string | null;
    createdAt?: string;
    generatedBy?: {
      email?: string | null;
      fullName?: string | null;
    } | null;
  }>;
  adminAuditLogs?: Array<{
    id: string;
    actorType: string;
    action: string;
    reason: string;
    createdAt?: string;
    actor?: {
      email?: string | null;
      fullName?: string | null;
    } | null;
  }>;
};

type ConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "warning" | "info";
  onConfirm: () => void;
};

export function AdminB2BOrderDetailPageClient({ orderNumber }: { orderNumber: string }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);

  const query = useQuery({
    queryKey: ["admin-b2b-order", orderNumber, auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () =>
      indihubFetch<B2BOrderWithAdminDetail>(
        `/api/admin/b2b-orders/${encodeURIComponent(orderNumber)}`,
        undefined,
        auth.authHeaders,
      ),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      path,
      method = "PATCH",
      payload,
    }: {
      path: string;
      method?: "PATCH" | "POST";
      payload: Record<string, unknown>;
    }) =>
      indihubFetch<B2BOrderWithAdminDetail>(
        `/api/admin/b2b-orders/${encodeURIComponent(orderNumber)}${path}`,
        { method, body: JSON.stringify(payload) },
        auth.authHeaders,
      ),
    onSuccess: async () => {
      setNotice({ tone: "success", message: "B2B order updated." });
      await invalidateB2BOrderQueries(queryClient, orderNumber);
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  const verifyProofMutation = useMutation({
    mutationFn: ({ proofId, note }: { proofId: string; note?: string }) =>
      verifyAdminB2BPaymentProof(auth.authHeaders, proofId, note ? { note } : {}),
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Payment proof verified." });
      await invalidateB2BOrderQueries(queryClient, orderNumber);
      await queryClient.invalidateQueries({ queryKey: ["admin-b2b-payments"] });
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  const rejectProofMutation = useMutation({
    mutationFn: ({ proofId, reason }: { proofId: string; reason: string }) =>
      rejectAdminB2BPaymentProof(auth.authHeaders, proofId, { rejectionReason: reason }),
    onSuccess: async () => {
      setNotice({ tone: "success", message: "Payment proof rejected." });
      await invalidateB2BOrderQueries(queryClient, orderNumber);
      await queryClient.invalidateQueries({ queryKey: ["admin-b2b-payments"] });
    },
    onError: (error) => setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  async function openDocument(kind: "po" | "proforma" | "tax" | "proof", proofId?: string) {
    setNotice(null);
    try {
      if (kind === "proof") {
        if (!proofId) {
          throw new Error("Payment proof id is required to open this document.");
        }
        await openB2BPurchaseOrderDocument(
          auth.authHeaders,
          `/api/admin/b2b-payments/${encodeURIComponent(proofId)}/document-access`,
          `/api/admin/b2b-payments/${encodeURIComponent(proofId)}/document`,
        );
        return;
      }

      const routes = {
        po: ["purchase-order/document-access", "purchase-order/document"],
        proforma: ["proforma-invoice/document-access", "proforma-invoice"],
        tax: ["tax-invoice/document-access", "tax-invoice"],
      } satisfies Record<"po" | "proforma" | "tax", [string, string]>;
      const [accessPath, documentPath] = routes[kind];
      await openB2BPurchaseOrderDocument(
        auth.authHeaders,
        `/api/admin/b2b-orders/${encodeURIComponent(orderNumber)}/${accessPath}`,
        `/api/admin/b2b-orders/${encodeURIComponent(orderNumber)}/${documentPath}`,
      );
    } catch (error) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    }
  }

  const order = query.data;
  const isBusy = actionMutation.isPending || verifyProofMutation.isPending || rejectProofMutation.isPending;

  return (
    <div className="grid gap-5">
      {confirmation ? (
        <AdminConfirmationDialog
          open
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          tone={confirmation.tone ?? "warning"}
          onClose={() => setConfirmation(null)}
          onConfirm={() => {
            const onConfirm = confirmation.onConfirm;
            setConfirmation(null);
            onConfirm();
          }}
        />
      ) : null}

      <div>
        <Button asChild variant="ghost">
          <Link href="/admin/b2b-orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to B2B orders
          </Link>
        </Button>
      </div>

      <AdminB2BDetailHeader query={query} orderNumber={orderNumber} />

      {notice ? (
        <AdminStatusNotice
          tone={notice.tone}
          title={notice.tone === "danger" ? "Action failed" : "Action saved"}
          message={notice.message}
          className="mb-0"
        />
      ) : null}

      {order ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="grid gap-5">
            <AdminB2BOrderSummaryPanel order={order} />
            <AdminB2BOperationalMap order={order} />
            <AdminB2BDocumentsPanel
              order={order}
              onOpenPo={() => void openDocument("po")}
              onOpenProforma={() => void openDocument("proforma")}
              onOpenTax={() => void openDocument("tax")}
            />
            <AdminB2BCommercialPanel order={order} />
            <AdminB2BTransportPanel order={order} />
            <AdminB2BProofsPanel
              order={order}
              disabled={isBusy}
              onOpenProof={(proofId) => void openDocument("proof", proofId)}
              onVerify={(proofId, note) => verifyProofMutation.mutate({ proofId, ...(note ? { note } : {}) })}
              onReject={(proofId, reason) => verifyRejectableReason(reason, () => rejectProofMutation.mutate({ proofId, reason }))}
            />
            <AdminB2BTimelinePanel order={order} />
          </main>

          <aside className="grid h-fit gap-5">
            <AdminB2BLifecyclePanel
              order={order}
              disabled={isBusy}
              onStatus={(status, note) =>
                setConfirmation({
                  title: `Move B2B order to ${humanize(status)}?`,
                  description: `${order.orderNumber} will move from ${humanize(order.status)} to ${humanize(status)}. This writes an order event and audit trail.`,
                  confirmLabel: humanize(status),
                  tone: status === "CANCELLED" ? "danger" : "warning",
                  onConfirm: () => actionMutation.mutate({ path: "/status", payload: { status, note } }),
                })
              }
            />
            <AdminB2BFinanceOpsPanel
              order={order}
              disabled={isBusy}
              onAction={(path, payload, method = "PATCH") =>
                setConfirmation({
                  title: confirmationTitle(path),
                  description: confirmationDescription(path, order),
                  confirmLabel: confirmationLabel(path),
                  tone: path === "/cancel" || path === "/refund" ? "danger" : "warning",
                  onConfirm: () => actionMutation.mutate({ path, method, payload }),
                })
              }
            />
            <AdminB2BPartiesPanel order={order} />
            <AdminB2BProformaHistoryPanel order={order} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function AdminB2BDetailHeader({
  query,
  orderNumber,
}: {
  query: { isLoading: boolean; isFetching: boolean; error: unknown; refetch: () => unknown };
  orderNumber: string;
}) {
  return (
    <AdminPanel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <FileCheck2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-[#1F2933]">B2B order detail</h2>
              {query.isFetching ? <StatusBadge tone="warning">Refreshing</StatusBadge> : null}
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">
              Use this page for PO acceptance, payment verification support, fulfilment unlocks, proforma revisions, cancellation, refund entries, and final invoice access for {orderNumber}.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {query.isLoading ? (
        <div className="mt-5 grid gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-md bg-[#EEF2F6]" />
          ))}
        </div>
      ) : null}

      {query.error ? (
        <AdminStatusNotice
          title="B2B order request failed"
          tone="danger"
          message={query.error instanceof Error ? query.error.message : "Unable to load B2B order detail."}
          className="mb-0 mt-5"
        />
      ) : null}
    </AdminPanel>
  );
}

function AdminB2BOrderSummaryPanel({ order }: { order: B2BOrderWithAdminDetail }) {
  return (
    <AdminPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black text-[#1F2933]">{order.orderNumber}</h2>
            <StatusBadge tone={statusTone(order.status)}>{humanize(order.status)}</StatusBadge>
            <StatusBadge tone={paymentTone(order.paymentStatus)}>{humanize(order.paymentStatus ?? "PENDING")}</StatusBadge>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
            Proforma {order.proformaInvoiceNumber} / {order.businessBuyer?.companyName ?? "Business buyer"} / {order.seller?.storeName ?? "Seller not assigned"}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-right">
          <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Buyer payable</p>
          <p className="mt-1 text-xl font-black text-[#163B5C]">
            {formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise, order.currency)}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Quantity" value={String(order.quantity)} />
        <Metric label="Unit price" value={formatMoney(order.unitPricePaise, order.currency)} />
        <Metric label="Paid" value={formatMoney(order.paidAmountPaise, order.currency)} />
        <Metric label="Seller payout" value={formatMoney(order.sellerPayoutAmountPaise, order.currency)} />
      </div>
    </AdminPanel>
  );
}

function AdminB2BOperationalMap({ order }: { order: B2BOrderWithAdminDetail }) {
  const steps = b2bOperationSteps(order);
  return (
    <AdminPanel>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-black text-[#1F2933]">How to operate this B2B order</h2>
        <p className="text-sm font-semibold leading-6 text-[#667085]">
          B2B orders are commercial documents first: issue proforma, accept buyer PO, clear payment or approve credit terms, unlock fulfilment, then generate the tax invoice after fulfilment.
        </p>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={cn(
              "rounded-lg border p-4",
              step.state === "done" && "border-[#BFEAD9] bg-[#F2FBF7]",
              step.state === "active" && "border-[#FFC7B8] bg-[#FFF0EC]",
              step.state === "blocked" && "border-[#FEDF89] bg-[#FFFAEB]",
              step.state === "waiting" && "border-[#E5E7EB] bg-[#F8FAFC]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-sm font-black text-[#163B5C]">
                {index + 1}
              </span>
              <StatusBadge tone={stepTone(step.state)}>{stepLabel(step.state)}</StatusBadge>
            </div>
            <p className="mt-3 text-sm font-black text-[#1F2933]">{step.title}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">{step.description}</p>
          </div>
        ))}
      </div>
    </AdminPanel>
  );
}

function AdminB2BDocumentsPanel({
  order,
  onOpenPo,
  onOpenProforma,
  onOpenTax,
}: {
  order: B2BOrderWithAdminDetail;
  onOpenPo: () => void;
  onOpenProforma: () => void;
  onOpenTax: () => void;
}) {
  return (
    <AdminPanel>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-black text-[#1F2933]">Commercial documents</h2>
        <p className="text-sm font-semibold leading-6 text-[#667085]">
          These are the documents used by buyer, seller, admin, and finance to validate the order lifecycle.
        </p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DocumentTile
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          title="Proforma invoice"
          description={`Current PI ${order.proformaInvoiceNumber}`}
          action="Open proforma"
          onClick={onOpenProforma}
        />
        <DocumentTile
          icon={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}
          title="Purchase order"
          description={order.purchaseOrderNumber ? `Buyer PO ${order.purchaseOrderNumber}` : "Waiting for buyer PO upload"}
          action="View PO"
          disabled={!order.purchaseOrderFileKey}
          onClick={onOpenPo}
        />
        <DocumentTile
          icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}
          title="Tax invoice"
          description={order.status === "FULFILLED" ? order.taxInvoiceNumber ?? "Generated on open" : "Available after fulfilment"}
          action="Open invoice"
          disabled={order.status !== "FULFILLED"}
          onClick={onOpenTax}
        />
      </div>
    </AdminPanel>
  );
}

function AdminB2BCommercialPanel({ order }: { order: B2BOrderWithAdminDetail }) {
  return (
    <AdminPanel>
      <h2 className="text-lg font-black text-[#1F2933]">Commercial and settlement mapping</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Info label="Product / request" value={order.product?.name ?? order.enquiry?.message ?? "General procurement"} />
        <Info label="Selected quote" value={formatMoney(order.selectedResponse?.quotedPricePaise ?? order.unitPricePaise, order.currency)} />
        <Info label="Subtotal" value={formatMoney(order.subtotalPaise, order.currency)} />
        <Info label="Buyer payable" value={formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise, order.currency)} />
        <Info label="Commission" value={formatMoney(order.commissionAmountPaise, order.currency)} />
        <Info label="Seller payout" value={formatMoney(order.sellerPayoutAmountPaise, order.currency)} />
        <Info label="Settlement status" value={humanize(order.settlementStatus ?? "NOT_ELIGIBLE")} />
        <Info label="Payment method" value={humanize(order.paymentMethod ?? "Not selected")} />
        <Info label="Payment due" value={formatDateTime(order.paymentDueAt)} />
      </div>
      {order.termsSnapshot ? (
        <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Terms snapshot</p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs font-semibold leading-5 text-[#1F2933]">
            {safeJson(order.termsSnapshot)}
          </pre>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function AdminB2BTransportPanel({ order }: { order: B2BOrderWithAdminDetail }) {
  return (
    <AdminPanel>
      <h2 className="text-lg font-black text-[#1F2933]">B2B transport oversight</h2>
      <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
        This tracks buyer pickup or seller-arranged B2B courier details. It is separate from normal customer delivery and local delivery partner workflows.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Info label="Transport mode" value={transportLabel(order.transportMode)} />
        <Info label="Transport status" value={humanize(order.transportStatus ?? "REQUESTED")} />
        <Info label="Transport charge" value={formatMoney(order.transportChargePaise ?? 0, order.currency)} />
        <Info label="Charge locked" value={order.transportChargeLockedAt ? formatDateTime(order.transportChargeLockedAt) : "Not locked"} />
        <Info label="Partner" value={order.transportPartnerName ?? "Not added"} />
        <Info label="Partner phone" value={order.transportPartnerPhone ?? "Not added"} />
        <Info label="Tracking / LR / AWB" value={order.transportTrackingRef ?? "Not added"} />
        <Info label="ETA" value={order.transportEta ?? "Not provided"} />
        <Info label="Pickup address" value={order.transportPickupAddress ?? "Not provided"} />
      </div>
      {order.transportNote ? (
        <p className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#667085]">
          {order.transportNote}
        </p>
      ) : null}
    </AdminPanel>
  );
}

function AdminB2BLifecyclePanel({
  order,
  disabled,
  onStatus,
}: {
  order: B2BOrderWithAdminDetail;
  disabled: boolean;
  onStatus: (status: B2BOrderStatus, note: string) => void;
}) {
  const options = b2bStatusOptions(order);
  const firstStatusOption = options[0]?.value ?? "";
  const [status, setStatus] = useState<B2BOrderStatus | "">(firstStatusOption as B2BOrderStatus | "");
  const [note, setNote] = useState("");

  useEffect(() => {
    setStatus(firstStatusOption as B2BOrderStatus | "");
  }, [firstStatusOption]);

  return (
    <AdminPanel>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-black text-[#1F2933]">Lifecycle controls</h2>
          <p className="text-xs font-semibold text-[#667085]">Use for normal PO and fulfilment progression.</p>
        </div>
      </div>
      {options.length ? (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (status) {
              onStatus(status, note.trim() || `Admin moved B2B order to ${humanize(status)}.`);
            }
          }}
        >
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Next status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as B2BOrderStatus)}
              className="h-10 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-bold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            >
              {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {options.find((option) => option.value === status)?.description ? (
            <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold leading-5 text-[#667085]">
              {options.find((option) => option.value === status)?.description}
            </p>
          ) : null}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Status update note"
            className="min-h-24 rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
          <Button type="submit" disabled={disabled || !status}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Update status
          </Button>
        </form>
      ) : (
        <p className="mt-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold leading-6 text-[#667085]">
          This order is locked in its current lifecycle state. Use finance controls only when an audited correction is required.
        </p>
      )}
    </AdminPanel>
  );
}

function AdminB2BFinanceOpsPanel({
  order,
  disabled,
  onAction,
}: {
  order: B2BOrderWithAdminDetail;
  disabled: boolean;
  onAction: (path: string, payload: Record<string, unknown>, method?: "PATCH" | "POST") => void;
}) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [dueDate, setDueDate] = useState(dateInputValue(order.paymentDueAt));
  const reasonText = reason.trim();
  const amountPaise = Math.round(Number(amount) * 100);
  const hasReason = reasonText.length >= 3;
  const validAmount = Number.isFinite(amountPaise) && amountPaise > 0;
  const terminal = order.status === "FULFILLED" || order.status === "CANCELLED";
  const canAcceptPayment = !["PAID", "REFUNDED", "NOT_REQUIRED"].includes(order.paymentStatus ?? "PENDING") && !terminal;
  const dueDateIso = isoFromDateTimeLocal(dueDate);

  useEffect(() => {
    setDueDate(dateInputValue(order.paymentDueAt));
  }, [order.paymentDueAt]);

  return (
    <AdminPanel>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <Landmark className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-black text-[#1F2933]">Finance and override controls</h2>
          <p className="text-xs font-semibold text-[#667085]">Every action below requires an audit reason.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required audit reason"
          className="min-h-24 rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount INR"
            inputMode="decimal"
            className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Payment reference"
            className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !hasReason || !dueDateIso}
            onClick={() => {
              if (dueDateIso) {
                onAction("/extend-due-date", { reason: reasonText, newDueAt: dueDateIso });
              }
            }}
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Extend due
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ActionButton disabled={disabled || !hasReason || !canAcceptPayment} onClick={() => onAction("/set-not-required", { reason: reasonText })}>
          No payment required
        </ActionButton>
        <ActionButton disabled={disabled || !hasReason || order.status !== "PO_ACCEPTED"} onClick={() => onAction("/unlock-fulfilment", { reason: reasonText })}>
          Unlock fulfilment
        </ActionButton>
        <ActionButton disabled={disabled || !hasReason} onClick={() => onAction("/regenerate-proforma", { reason: reasonText }, "POST")}>
          Regenerate PI
        </ActionButton>
        <ActionButton disabled={disabled || !hasReason || terminal} onClick={() => onAction("/cancel", { reason: reasonText })}>
          Cancel order
        </ActionButton>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          disabled={disabled || !hasReason || !validAmount || reference.trim().length < 3 || !canAcceptPayment}
          onClick={() =>
            onAction("/manual-payment", {
              amountPaise,
              referenceNumber: reference.trim(),
              reason: reasonText,
            })
          }
        >
          Manual payment
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !hasReason || !validAmount || (order.paidAmountPaise ?? 0) <= 0}
          onClick={() => onAction("/refund", { amountPaise, reason: reasonText }, "POST")}
        >
          Refund
        </Button>
      </div>
    </AdminPanel>
  );
}

function AdminB2BProofsPanel({
  order,
  disabled,
  onOpenProof,
  onVerify,
  onReject,
}: {
  order: B2BOrderWithAdminDetail;
  disabled: boolean;
  onOpenProof: (proofId: string) => void;
  onVerify: (proofId: string, note?: string) => void;
  onReject: (proofId: string, reason: string) => void;
}) {
  const proofs = order.paymentProofs ?? [];
  return (
    <AdminPanel>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-black text-[#1F2933]">Payment proof review</h2>
        <p className="text-sm font-semibold leading-6 text-[#667085]">
          Buyer-submitted bank proofs and finance-recorded manual payments are listed here with review actions.
        </p>
      </div>
      <div className="mt-4 grid gap-3">
        {proofs.length ? (
          proofs.map((proof) => (
            <PaymentProofCard
              key={proof.id}
              proof={proof}
              disabled={disabled}
              onOpen={() => onOpenProof(proof.id)}
              onVerify={(note) => onVerify(proof.id, note)}
              onReject={(reason) => onReject(proof.id, reason)}
            />
          ))
        ) : (
          <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-4 text-sm font-semibold text-[#667085]">
            No payment proof has been submitted or recorded yet.
          </p>
        )}
      </div>
    </AdminPanel>
  );
}

function PaymentProofCard({
  proof,
  disabled,
  onOpen,
  onVerify,
  onReject,
}: {
  proof: B2BPaymentProof;
  disabled: boolean;
  onOpen: () => void;
  onVerify: (note?: string) => void;
  onReject: (reason: string) => void;
}) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const isSubmitted = proof.status === "SUBMITTED";
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={proofTone(proof.status)}>{humanize(proof.status)}</StatusBadge>
            <p className="text-sm font-black text-[#163B5C]">{formatMoney(proof.amountPaise, proof.currency)}</p>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#667085]">
            {humanize(proof.method)} / {proof.referenceNumber ?? "No reference"} / submitted {formatDateTime(proof.submittedAt)}
          </p>
          {proof.rejectionReason ? <p className="mt-2 text-xs font-bold text-[#B42318]">{proof.rejectionReason}</p> : null}
        </div>
        {proof.proofFileKey ? (
          <Button type="button" size="sm" variant="outline" onClick={onOpen}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Proof
          </Button>
        ) : null}
      </div>
      {isSubmitted ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto]">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Verification note"
            className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933]"
          />
          <Button type="button" size="sm" disabled={disabled} onClick={() => onVerify(note.trim() || undefined)}>
            Verify
          </Button>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Rejection reason"
            className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933]"
          />
          <Button type="button" size="sm" variant="outline" disabled={disabled || reason.trim().length < 3} onClick={() => onReject(reason.trim())}>
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AdminB2BPartiesPanel({ order }: { order: B2BOrderWithAdminDetail }) {
  return (
    <AdminPanel>
      <h2 className="text-base font-black text-[#1F2933]">Buyer and seller</h2>
      <div className="mt-4 grid gap-3">
        <Info label="Buyer company" value={order.businessBuyer?.companyName ?? "Business buyer"} />
        <Info label="Buyer GST" value={order.businessBuyer?.gstNumber ?? "Not provided"} />
        <Info label="Buyer contact" value={order.businessBuyer?.contactName ?? "Not available"} />
        <Info label="Buyer phone" value={order.businessBuyer?.contactPhone ?? "Not available"} />
        <Info label="Seller store" value={order.seller?.storeName ?? "Seller not assigned"} />
        <Info label="Seller account" value={order.seller?.user?.email ?? "Not available"} />
      </div>
    </AdminPanel>
  );
}

function AdminB2BProformaHistoryPanel({ order }: { order: B2BOrderWithAdminDetail }) {
  const revisions = order.proformaRevisions ?? [];
  return (
    <AdminPanel>
      <h2 className="text-base font-black text-[#1F2933]">Proforma revisions</h2>
      <div className="mt-4 grid gap-3">
        {revisions.length ? (
          revisions.map((revision) => (
            <div key={revision.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
              <p className="text-sm font-black text-[#1F2933]">{revision.invoiceNumber}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
                Archived {formatDateTime(revision.createdAt)} / issued {formatDateTime(revision.issuedAt)}
              </p>
              <p className="mt-2 text-xs font-bold text-[#667085]">{revision.reason ?? "No reason captured."}</p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold leading-6 text-[#667085]">No archived proforma revisions yet.</p>
        )}
      </div>
    </AdminPanel>
  );
}

function AdminB2BTimelinePanel({ order }: { order: B2BOrderWithAdminDetail }) {
  return (
    <AdminTabs
      tabs={[
        {
          key: "events",
          label: "Order timeline",
          badge: order.events?.length ?? 0,
          panel: (
            <AdminPanel>
              <div className="grid gap-3">
                {(order.events ?? []).length ? (
                  (order.events ?? []).map((event) => (
                    <TimelineItem
                      key={event.id}
                      status={event.status}
                      title={humanize(event.status)}
                      note={event.note ?? "Status updated."}
                      actor={event.actor?.fullName ?? event.actor?.email ?? null}
                      createdAt={event.createdAt ?? null}
                    />
                  ))
                ) : (
                  <p className="text-sm font-semibold text-[#667085]">No order events found.</p>
                )}
              </div>
            </AdminPanel>
          ),
        },
        {
          key: "audit",
          label: "Admin audit",
          badge: order.adminAuditLogs?.length ?? 0,
          panel: (
            <AdminPanel>
              <div className="grid gap-3">
                {(order.adminAuditLogs ?? []).length ? (
                  (order.adminAuditLogs ?? []).map((audit) => (
                    <TimelineItem
                      key={audit.id}
                      status={audit.action}
                      title={humanize(audit.action)}
                      note={audit.reason}
                      actor={audit.actor?.fullName ?? audit.actor?.email ?? humanize(audit.actorType)}
                      createdAt={audit.createdAt ?? null}
                    />
                  ))
                ) : (
                  <p className="text-sm font-semibold text-[#667085]">No admin audit records found.</p>
                )}
              </div>
            </AdminPanel>
          ),
        },
      ]}
    />
  );
}

function TimelineItem({
  status,
  title,
  note,
  actor,
  createdAt,
}: {
  status: string;
  title: string;
  note: string;
  actor?: string | null;
  createdAt?: string | null;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge tone={statusTone(status)}>{title}</StatusBadge>
        <p className="text-xs font-bold text-[#667085]">{formatDateTime(createdAt)}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#1F2933]">{note}</p>
      {actor ? <p className="mt-1 text-xs font-bold text-[#667085]">By {actor}</p> : null}
    </div>
  );
}

function DocumentTile({
  icon,
  title,
  description,
  action,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-[#ED3500]">{icon}</span>
      <p className="mt-3 text-sm font-black text-[#1F2933]">{title}</p>
      <p className="mt-1 min-h-10 text-xs font-semibold leading-5 text-[#667085]">{description}</p>
      <Button type="button" className="mt-4 w-full" variant="outline" disabled={disabled} onClick={onClick}>
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        {action}
      </Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-[#163B5C]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: ReactNode | null }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[#1F2933]">{value || "Not available"}</p>
    </div>
  );
}

function ActionButton({ disabled, onClick, children }: { disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="outline" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

function b2bOperationSteps(order: B2BOrderWithAdminDetail) {
  const paymentStatus = order.paymentStatus ?? "PENDING";
  const poSubmitted = Boolean(order.purchaseOrderNumber || order.status !== "PROFORMA_ISSUED");
  const poAccepted = ["PO_ACCEPTED", "IN_FULFILMENT", "FULFILLED"].includes(order.status);
  const paymentCleared = paymentStatus === "PAID" || paymentStatus === "NOT_REQUIRED";
  const fulfilled = order.status === "FULFILLED";
  const cancelled = order.status === "CANCELLED";

  return [
    {
      title: "Proforma issued",
      description: "Buyer gets the PI and starts internal approval.",
      state: cancelled ? "blocked" : "done",
    },
    {
      title: "Buyer PO submitted",
      description: "Admin verifies PO number and uploaded document.",
      state: cancelled ? "blocked" : poSubmitted ? "done" : "active",
    },
    {
      title: "Payment cleared",
      description: "Finance verifies bank proof, records manual payment, or marks credit terms.",
      state: cancelled ? "blocked" : paymentCleared ? "done" : poSubmitted ? "active" : "waiting",
    },
    {
      title: "Fulfilment unlocked",
      description: "Seller can complete the B2B order after PO and payment checks.",
      state: cancelled ? "blocked" : ["IN_FULFILMENT", "FULFILLED"].includes(order.status) ? "done" : poAccepted && paymentCleared ? "active" : "waiting",
    },
    {
      title: "Tax invoice",
      description: "Final invoice is available only after fulfilment.",
      state: cancelled ? "blocked" : fulfilled ? "done" : "waiting",
    },
  ] as Array<{ title: string; description: string; state: "done" | "active" | "blocked" | "waiting" }>;
}

function b2bStatusOptions(order: B2BOrderWithAdminDetail) {
  const status = order.status;
  if (status === "PROFORMA_ISSUED") {
    return [{ value: "CANCELLED", label: "Cancel order", description: "Use only when buyer will not proceed." }];
  }
  if (status === "PO_SUBMITTED") {
    return [
      { value: "PO_ACCEPTED", label: "Accept PO", description: "Confirms buyer PO matches the proforma commercial state." },
      { value: "CANCELLED", label: "Cancel order", description: "Stops this B2B order before fulfilment." },
    ];
  }
  if (status === "PO_ACCEPTED") {
    const paymentReady = order.paymentStatus === "PAID" || order.paymentStatus === "NOT_REQUIRED";
    return [
      {
        value: "IN_FULFILMENT",
        label: "Move to fulfilment",
        disabled: !paymentReady,
        description: paymentReady ? "Unlocks seller fulfilment." : "Payment must be paid or marked not required first.",
      },
      { value: "CANCELLED", label: "Cancel order", description: "Stops this B2B order before fulfilment." },
    ];
  }
  if (status === "IN_FULFILMENT") {
    return [
      { value: "FULFILLED", label: "Mark fulfilled", description: "Completes fulfilment and makes final tax invoice available." },
      { value: "CANCELLED", label: "Cancel order", description: "Use only for an audited operational reversal before completion." },
    ];
  }
  return [];
}

function confirmationTitle(path: string) {
  switch (path) {
    case "/set-not-required":
      return "Mark payment as not required?";
    case "/unlock-fulfilment":
      return "Override fulfilment lock?";
    case "/regenerate-proforma":
      return "Regenerate proforma invoice?";
    case "/cancel":
      return "Cancel B2B order?";
    case "/manual-payment":
      return "Record manual payment?";
    case "/refund":
      return "Record B2B refund?";
    case "/extend-due-date":
      return "Extend payment due date?";
    default:
      return "Apply B2B order action?";
  }
}

function confirmationLabel(path: string) {
  switch (path) {
    case "/set-not-required":
      return "Mark not required";
    case "/unlock-fulfilment":
      return "Unlock";
    case "/regenerate-proforma":
      return "Regenerate PI";
    case "/cancel":
      return "Cancel order";
    case "/manual-payment":
      return "Record payment";
    case "/refund":
      return "Record refund";
    case "/extend-due-date":
      return "Extend due date";
    default:
      return "Apply action";
  }
}

function confirmationDescription(path: string, order: B2BOrderWithAdminDetail) {
  const base = `${order.orderNumber} will be updated and the reason will be stored in the B2B audit trail.`;
  if (path === "/refund") {
    return `${base} Confirm the refund amount against verified paid amount before continuing.`;
  }
  if (path === "/unlock-fulfilment") {
    return `${base} This overrides the normal payment/PO lock, so use it only after operational approval.`;
  }
  if (path === "/cancel") {
    return `${base} Cancelled orders cannot continue fulfilment.`;
  }
  return base;
}

function verifyRejectableReason(reason: string, onValid: () => void) {
  if (reason.trim().length >= 3) {
    onValid();
  }
}

async function invalidateB2BOrderQueries(queryClient: ReturnType<typeof useQueryClient>, orderNumber: string) {
  await queryClient.invalidateQueries({ queryKey: ["admin-b2b-order", orderNumber] });
  await queryClient.invalidateQueries({ queryKey: ["admin-b2b-orders"] });
}

function stepTone(state: "done" | "active" | "blocked" | "waiting"): StatusTone {
  if (state === "done") {
    return "success";
  }
  if (state === "active") {
    return "warning";
  }
  if (state === "blocked") {
    return "danger";
  }
  return "neutral";
}

function stepLabel(state: "done" | "active" | "blocked" | "waiting") {
  if (state === "done") {
    return "Done";
  }
  if (state === "active") {
    return "Now";
  }
  if (state === "blocked") {
    return "Stopped";
  }
  return "Waiting";
}

function statusTone(status?: string | null): StatusTone {
  if (["PO_ACCEPTED", "IN_FULFILMENT", "FULFILLED", "PAID", "NOT_REQUIRED", "VERIFIED"].includes(status ?? "")) {
    return "success";
  }
  if (["CANCELLED", "REFUNDED", "REJECTED", "OVERDUE", "RAZORPAY_FAILED"].includes(status ?? "")) {
    return "danger";
  }
  if (["SUBMITTED_FOR_VERIFICATION", "PARTIALLY_PAID"].includes(status ?? "")) {
    return "info";
  }
  return "warning";
}

function paymentTone(status?: B2BPaymentStatus | null): StatusTone {
  return statusTone(status ?? "PENDING");
}

function proofTone(status?: string | null): StatusTone {
  if (status === "VERIFIED") {
    return "success";
  }
  if (status === "REJECTED" || status === "RAZORPAY_FAILED") {
    return "danger";
  }
  return "warning";
}

function humanize(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatMoney(value?: number | null, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((value ?? 0) / 100);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isoFromDateTimeLocal(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to render terms snapshot.";
  }
}

function transportLabel(value?: string | null) {
  if (value === "STORE_PICKUP") {
    return "Store pickup by buyer";
  }
  return "Seller-arranged B2B transport";
}
