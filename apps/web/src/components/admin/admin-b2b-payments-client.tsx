"use client";

import { useState } from "react";
import { CheckCircle2, Eye, RefreshCw, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge, type StatusTone } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { openB2BPurchaseOrderDocument } from "@/lib/b2b-po-documents";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  listAdminB2BPaymentProofs,
  rejectAdminB2BPaymentProof,
  verifyAdminB2BPaymentProof,
  type AdminB2BPaymentProof,
} from "@/lib/admin-b2b-payments-api";

const proofStatuses = ["", "SUBMITTED", "VERIFIED", "REJECTED", "RAZORPAY_FAILED"] as const;

export function AdminB2BPaymentsPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof proofStatuses)[number]>("SUBMITTED");
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-b2b-payments", status],
    queryFn: () => listAdminB2BPaymentProofs(auth.authHeaders, { status, limit: 50 }),
    enabled: auth.isAuthenticated,
  });

  const verify = useMutation({
    mutationFn: ({ proofId, note }: { proofId: string; note?: string }) =>
      verifyAdminB2BPaymentProof(auth.authHeaders, proofId, note ? { note } : {}),
    onSuccess: () => {
      setNotice("Payment proof verified.");
      void queryClient.invalidateQueries({ queryKey: ["admin-b2b-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-b2b-orders"] });
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });
  const reject = useMutation({
    mutationFn: ({ proofId, rejectionReason }: { proofId: string; rejectionReason: string }) =>
      rejectAdminB2BPaymentProof(auth.authHeaders, proofId, { rejectionReason }),
    onSuccess: () => {
      setNotice("Payment proof rejected.");
      void queryClient.invalidateQueries({ queryKey: ["admin-b2b-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-b2b-orders"] });
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });

  async function openProof(proofId: string) {
    setNotice(null);
    try {
      await openB2BPurchaseOrderDocument(
        auth.authHeaders,
        `/api/admin/b2b-payments/${encodeURIComponent(proofId)}/document-access`,
        `/api/admin/b2b-payments/${encodeURIComponent(proofId)}/document`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  const items = query.data?.items ?? [];

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Verification queue</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">
              Review B2B bank-transfer proofs, overpayments, and rejection reasons.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Proof status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as (typeof proofStatuses)[number])}
                className="h-10 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-bold text-[#1F2933]"
              >
                {proofStatuses.map((option) => (
                  <option key={option || "ALL"} value={option}>
                    {option ? humanize(option) : "All statuses"}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>
        {notice ? (
          <div className="mt-4">
            <StatusBadge tone={notice.toLowerCase().includes("failed") || notice.toLowerCase().includes("invalid") ? "danger" : "info"}>
              {notice}
            </StatusBadge>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm">
        <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs font-black uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Buyer / seller</th>
              <th className="px-4 py-3">Proof</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {query.isLoading ? (
              <tr>
                <td className="px-4 py-6 font-bold text-[#667085]" colSpan={5}>
                  Loading payment proofs...
                </td>
              </tr>
            ) : null}
            {!query.isLoading && items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 font-bold text-[#667085]" colSpan={5}>
                  No B2B payment proofs found.
                </td>
              </tr>
            ) : null}
            {items.map((proof) => (
              <PaymentProofRow
                key={proof.id}
                proof={proof}
                busy={verify.isPending || reject.isPending}
                onOpen={() => void openProof(proof.id)}
                onVerify={(note) => verify.mutate({ proofId: proof.id, ...(note ? { note } : {}) })}
                onReject={(rejectionReason) => reject.mutate({ proofId: proof.id, rejectionReason })}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentProofRow({
  proof,
  busy,
  onOpen,
  onVerify,
  onReject,
}: {
  proof: AdminB2BPaymentProof;
  busy: boolean;
  onOpen: () => void;
  onVerify: (note?: string) => void;
  onReject: (reason: string) => void;
}) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const overpaid = (proof.overpaymentAmountPaise ?? 0) > 0;

  return (
    <tr className="align-top">
      <td className="px-4 py-4">
        <p className="font-black text-[#1F2933]">{proof.order.orderNumber}</p>
        <p className="mt-1 text-xs font-bold text-[#667085]">Due {formatDate(proof.order.paymentDueAt)}</p>
      </td>
      <td className="px-4 py-4">
        <p className="font-bold text-[#1F2933]">{proof.order.businessBuyer?.companyName ?? "Business buyer"}</p>
        <p className="mt-1 text-xs font-bold text-[#667085]">{proof.order.seller?.storeName ?? "Seller"}</p>
      </td>
      <td className="px-4 py-4">
        <p className="font-black text-[#163B5C]">{formatPaise(proof.amountPaise, proof.currency)}</p>
        <p className="mt-1 text-xs font-bold text-[#667085]">{proof.referenceNumber ?? "No reference"}</p>
        {overpaid ? (
          <p className="mt-2 rounded-md bg-[#FFF7E6] px-2 py-1 text-xs font-black text-[#B54708]">
            Overpaid {formatPaise(proof.overpaymentAmountPaise ?? 0, proof.currency)}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-4">
        <StatusBadge tone={statusTone(proof.status)}>{humanize(proof.status)}</StatusBadge>
        {proof.rejectionReason ? (
          <p className="mt-2 max-w-xs text-xs font-semibold text-[#B42318]">{proof.rejectionReason}</p>
        ) : null}
      </td>
      <td className="px-4 py-4">
        <div className="grid max-w-sm gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onOpen}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            View proof
          </Button>
          {proof.status === "SUBMITTED" ? (
            <>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional verification note"
                className="h-10 rounded-md border border-[#D8E2EA] px-3 text-xs font-semibold"
              />
              <Button type="button" size="sm" disabled={busy} onClick={() => onVerify(note.trim() || undefined)}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Verify
              </Button>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Mandatory rejection reason"
                className="h-10 rounded-md border border-[#D8E2EA] px-3 text-xs font-semibold"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || reason.trim().length < 3}
                onClick={() => onReject(reason.trim())}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject
              </Button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function humanize(value?: string | null) {
  return (value ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPaise(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "not set";
  }
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status?: string | null): StatusTone {
  if (status === "VERIFIED" || status === "PAID") {
    return "success";
  }
  if (status === "REJECTED" || status === "RAZORPAY_FAILED" || status === "OVERDUE") {
    return "danger";
  }
  return "warning";
}
