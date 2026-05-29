"use client";

import { useState } from "react";
import { AlertCircle, ReceiptText, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerPayoutAvailability, listSellerPayouts, requestSellerPayout } from "@/lib/seller-finance-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerMetric,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  formatDateTime,
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "../seller-ui";

export function SellerPayoutsClient() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const [note, setNote] = useState("");
  const payoutsQuery = useQuery({
    queryKey: ["seller-finance-payouts", sellerAuth.authKey],
    queryFn: () => listSellerPayouts(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });
  const availabilityQuery = useQuery({
    queryKey: ["seller-payout-availability", sellerAuth.authKey],
    queryFn: () => getSellerPayoutAvailability(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });
  const requestMutation = useMutation({
    mutationFn: () => requestSellerPayout(sellerAuth.authHeaders, { ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: async () => {
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller-finance-payouts"] }),
        queryClient.invalidateQueries({ queryKey: ["seller-payout-availability"] }),
        queryClient.invalidateQueries({ queryKey: ["seller-finance-ledger"] })
      ]);
    }
  });

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (payoutsQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (payoutsQuery.error) {
    if (isSellerOnboardingRequiredError(payoutsQuery.error)) {
      return <SellerOnboardingRequired message="Complete seller onboarding before viewing payout history." />;
    }

    return <SellerErrorPanel error={payoutsQuery.error} onRetry={() => void payoutsQuery.refetch()} />;
  }

  const payouts = payoutsQuery.data?.items ?? [];
  const availability = availabilityQuery.data;
  const pending = payouts.reduce((total, payout) => total + (["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(payout.status) ? payout.netPayablePaise : 0), 0);
  const paid = payouts.reduce((total, payout) => total + (payout.status === "PAID" ? payout.netPayablePaise : 0), 0);

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <div className="grid gap-4 md:grid-cols-3">
        <SellerMetric label="Available to request" value={formatMoney(availability?.netPayablePaise ?? 0)} note={`${availability?.eligibleSplitCount ?? 0} eligible order splits`} />
        <SellerMetric label="Pending payout" value={formatMoney(pending)} note="Draft, pending, and approved" />
        <SellerMetric label="Paid payouts" value={formatMoney(paid)} note="Marked paid by admin" />
      </div>

      <SellerPanel>
        <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <Send className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <SectionHeading title="Request manual payout" description="Request the full currently eligible delivered and paid order amount. Admin will approve and record manual bank or UPI payment." />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Optional note for admin"
                className="mt-4 w-full resize-y rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              />
              {availability?.blockers?.length ? (
                <div className="mt-3 grid gap-2 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
                  {availability.blockers.map((blocker) => (
                    <span key={blocker} className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {blocker}
                    </span>
                  ))}
                </div>
              ) : null}
              {requestMutation.error ? <p className="mt-3 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">{requestMutation.error.message}</p> : null}
            </div>
          </div>
          <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Request amount</p>
            <p className="mt-2 text-3xl font-black text-[#163B5C]">{formatMoney(availability?.netPayablePaise ?? 0)}</p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">Minimum {formatMoney(availability?.minimumPayoutPaise ?? 0)}</p>
            <Button
              type="button"
              className="mt-4 w-full"
              disabled={!availability?.canRequest || requestMutation.isPending || availabilityQuery.isLoading}
              onClick={() =>
                confirmation.requestConfirmation({
                  title: "Request manual payout?",
                  description: `${formatMoney(availability?.netPayablePaise ?? 0)} will be sent to admin for manual approval. Eligible orders are locked to prevent duplicate payout requests.`,
                  confirmLabel: "Request payout",
                  tone: "warning",
                  onConfirm: () => requestMutation.mutate()
                })
              }
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {requestMutation.isPending ? "Requesting" : "Request payout"}
            </Button>
          </div>
        </div>
      </SellerPanel>

      {availabilityQuery.error ? <SellerErrorPanel error={availabilityQuery.error} onRetry={() => void availabilityQuery.refetch()} /> : null}

      <div className="grid gap-3">
        {payouts.map((payout) => (
          <SellerPanel key={payout.id}>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <ReceiptText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[#1F2933]">{payout.payoutNumber}</p>
                    <SellerStatusPill status={payout.status} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {formatDateTime(payout.periodFrom)} to {formatDateTime(payout.periodTo)}
                  </p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xl font-black text-[#163B5C]">{formatMoney(payout.netPayablePaise)}</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">{payout.transactionReference ?? "Payment reference pending"}</p>
              </div>
            </div>
          </SellerPanel>
        ))}
      </div>
      {payouts.length === 0 ? <SellerEmptyState title="No payouts yet" message="Payout records appear after admin generates a seller settlement cycle." /> : null}
    </div>
  );
}
