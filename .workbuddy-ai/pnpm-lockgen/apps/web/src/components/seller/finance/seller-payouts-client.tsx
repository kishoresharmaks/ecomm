"use client";

import { useState } from "react";
import { AlertCircle, ReceiptText, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { userFacingApiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerPayoutAvailability, listSellerPayouts, requestSellerPayout } from "@/lib/seller-finance-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerMetric,
  SellerOnboardingRequired,
  SellerPagination,
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const payoutsQuery = useQuery({
    queryKey: ["seller-finance-payouts", sellerAuth.authKey, page, pageSize],
    queryFn: () => listSellerPayouts(sellerAuth.authHeaders, { page, limit: pageSize }),
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
  const currency = availability?.currency || "INR";
  const pending = availability?.pendingPayoutsPaise ?? 0;
  const paid = availability?.paidPayoutsPaise ?? 0;
  const eligibleActivity =
    (availability?.eligibleSplitCount ?? 0) +
    (availability?.eligibleB2BOrderCount ?? 0) +
    (availability?.eligibleServiceSettlementCount ?? 0);

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <div className="grid gap-4 md:grid-cols-3">
        <SellerMetric label="Available to request" value={formatMoney(availability?.netPayablePaise ?? 0, currency)} note={`${eligibleActivity} eligible order and service records`} />
        <SellerMetric label="Pending payout" value={formatMoney(pending, currency)} note="Draft, pending, and approved" />
        <SellerMetric label="Paid payouts" value={formatMoney(paid, currency)} note="Marked paid by admin" />
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
              {requestMutation.error ? <p className="mt-3 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">{userFacingApiErrorMessage(requestMutation.error)}</p> : null}
            </div>
          </div>
          <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Request amount</p>
            <p className="mt-2 text-3xl font-black text-[#163B5C]">{formatMoney(availability?.netPayablePaise ?? 0, currency)}</p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">Minimum {formatMoney(availability?.minimumPayoutPaise ?? 0, currency)}</p>
            <Button
              type="button"
              className="mt-4 w-full"
              disabled={!availability?.canRequest || requestMutation.isPending || availabilityQuery.isLoading}
              onClick={() =>
                confirmation.requestConfirmation({
                  title: "Request manual payout?",
                  description: `${formatMoney(availability?.netPayablePaise ?? 0, currency)} will be sent to admin for manual approval. Eligible orders are locked to prevent duplicate payout requests.`,
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

      {availability ? (
        <SellerPanel>
          <SectionHeading title="Payout calculation" description="Review the exact earnings, statutory deductions, platform fees, receivable offsets, and prior wallet debt included in this request." />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <PayoutAmount label="Gross eligible earnings" value={availability.grossSalesPaise} currency={currency} />
            <PayoutAmount label="Marketplace commission" value={-availability.commissionPaise} currency={currency} />
            <PayoutAmount label="GST on marketplace fees" value={-availability.gstOnCommissionPaise} currency={currency} />
            <PayoutAmount label="TDS" value={-availability.tdsPaise} currency={currency} />
            <PayoutAmount label="TCS" value={-availability.tcsPaise} currency={currency} />
            <PayoutAmount label="Seller settlement fee" value={-availability.platformFeePaise} currency={currency} />
            <PayoutAmount label="Refund adjustment" value={availability.refundAdjustmentPaise} currency={currency} />
            <PayoutAmount label="Service cash offset" value={-availability.serviceReceivableOffsetPaise} currency={currency} />
            <PayoutAmount label="Seller-collected COD offset" value={-(availability.sellerCashReceivableOffsetPaise ?? 0)} currency={currency} />
            <PayoutAmount label="Prior wallet debt offset" value={-availability.ledgerDebtOffsetPaise} currency={currency} />
            <PayoutAmount label="Net request amount" value={availability.netPayablePaise} currency={currency} emphasis />
          </div>
        </SellerPanel>
      ) : null}

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
                <p className="text-xl font-black text-[#163B5C]">{formatMoney(payout.netPayablePaise, payout.currency || currency)}</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">{payout.transactionReference ?? "Payment reference pending"}</p>
              </div>
            </div>
          </SellerPanel>
        ))}
      </div>
      {payouts.length === 0 ? <SellerEmptyState title="No payouts yet" message="Payout records appear after admin generates a seller settlement cycle." /> : null}
      {(payoutsQuery.data?.total ?? 0) > 0 ? (
        <SellerPagination
          page={page}
          pageSize={pageSize}
          total={payoutsQuery.data?.total ?? 0}
          isLoading={payoutsQuery.isFetching}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPage(1);
            setPageSize(value);
          }}
          itemLabel="payouts"
        />
      ) : null}
    </div>
  );
}

function PayoutAmount({ label, value, currency, emphasis = false }: { label: string; value: number; currency: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-3 ${emphasis ? "border-[#ED3500] bg-[#FFF0EC]" : "border-[#E5E7EB] bg-[#F8FAFC]"}`}>
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className={`mt-1 text-base font-black ${emphasis ? "text-[#ED3500]" : value < 0 ? "text-[#8A1F1F]" : "text-[#163B5C]"}`}>
        {value > 0 && !emphasis ? "+" : ""}{formatMoney(value, currency)}
      </p>
    </div>
  );
}
