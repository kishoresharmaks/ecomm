"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, FileText, IndianRupee, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { approvePayout, generateStatement, listPayouts, markPayoutPaid, rejectPayout } from "@/lib/admin-finance-api";
import { formatMoney } from "@/lib/storefront-api";
import { FinanceMetric, FinancePageHeader, FinancePanel, FinanceState, FinanceStatus, MoneyBreakup } from "./finance-ui";

export function AdminPayoutsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState("");
  const [paymentMode, setPaymentMode] = useState("NEFT");
  const [transactionReference, setTransactionReference] = useState("");
  const confirmation = useConfirmationDialog();
  const payoutsQuery = useQuery({
    queryKey: ["admin-finance-payouts", auth.authHeaders],
    queryFn: () => listPayouts(auth.authHeaders),
    enabled: auth.isAuthenticated
  });
  const approve = useMutation({
    mutationFn: (payoutId: string) => approvePayout(auth.authHeaders, payoutId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-finance-payouts"] })
  });
  const reject = useMutation({
    mutationFn: (payoutId: string) => rejectPayout(auth.authHeaders, payoutId, "Rejected by admin."),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-finance-payouts"] })
  });
  const statement = useMutation({
    mutationFn: (payoutId: string) => generateStatement(auth.authHeaders, payoutId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-finance-payouts"] })
  });
  const paid = useMutation({
    mutationFn: (payoutId: string) => markPayoutPaid(auth.authHeaders, payoutId, { paymentMode, transactionReference }),
    onSuccess: async () => {
      setPayingId("");
      setTransactionReference("");
      await queryClient.invalidateQueries({ queryKey: ["admin-finance-payouts"] });
    }
  });

  function submitPaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reference = transactionReference.trim();
    if (payingId && reference) {
      confirmation.requestConfirmation({
        title: "Mark payout as paid?",
        description: `This records ${paymentMode} payment reference ${reference}. The seller ledger and statement trail will treat this payout as paid.`,
        confirmLabel: "Mark paid",
        tone: "warning",
        onConfirm: () => paid.mutate(payingId)
      });
    }
  }

  const payouts = payoutsQuery.data?.items ?? [];
  const payable = payouts.reduce((total, payout) => total + (payout.status === "APPROVED" ? payout.netPayablePaise : 0), 0);
  const paidTotal = payouts.reduce((total, payout) => total + (payout.status === "PAID" ? payout.netPayablePaise : 0), 0);

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <FinancePageHeader title="Payout approvals" description="Approve seller payouts, reject incorrect drafts, and record manual payment references." />
      <div className="grid gap-4 md:grid-cols-3">
        <FinanceMetric label="Payouts" value={payouts.length} note="Current result set" />
        <FinanceMetric label="Approved payable" value={formatMoney(payable)} note="Ready to pay manually" />
        <FinanceMetric label="Paid total" value={formatMoney(paidTotal)} note="Marked paid in this list" />
      </div>
      <FinanceState loading={payoutsQuery.isLoading} error={payoutsQuery.error} onRetry={() => void payoutsQuery.refetch()} />
      <FinanceState error={approve.error ?? reject.error ?? statement.error ?? paid.error} />
      <div className="grid gap-4">
        {payouts.map((payout) => (
          <FinancePanel key={payout.id}>
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-[#1F2933]">{payout.payoutNumber}</h3>
                  <FinanceStatus status={payout.status} />
                </div>
                <p className="mt-2 text-sm font-semibold text-[#667085]">
                  {payout.seller?.storeName ?? payout.sellerId} / {shortDate(payout.periodFrom)} to {shortDate(payout.periodTo)}
                </p>
                <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#667085]">
                  {payout.settlementRunId ? `Settlement cycle ${payout.settlementRun?.runNumber ?? ""}` : "Seller manual payout request"} / {payout._count?.orderSplits ?? 0} eligible order splits
                </p>
                <PayoutMethod seller={payout.seller} />
                <p className="mt-3 text-2xl font-black text-[#163B5C]">{formatMoney(payout.netPayablePaise)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {payout.status === "PENDING_APPROVAL" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          confirmation.requestConfirmation({
                            title: "Approve seller payout?",
                            description: `${payout.payoutNumber} will become payable for ${payout.seller?.storeName ?? "this seller"}. Review deductions before approval.`,
                            confirmLabel: "Approve payout",
                            tone: "warning",
                            onConfirm: () => approve.mutate(payout.id)
                          })
                        }
                        disabled={approve.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          confirmation.requestConfirmation({
                            title: "Reject seller payout?",
                            description: `${payout.payoutNumber} will be rejected and kept in the finance audit trail. A corrected settlement can be generated later.`,
                            confirmLabel: "Reject payout",
                            onConfirm: () => reject.mutate(payout.id)
                          })
                        }
                        disabled={reject.isPending}
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {payout.status === "APPROVED" ? (
                    <Button type="button" size="sm" onClick={() => setPayingId(payingId === payout.id ? "" : payout.id)}>
                      <IndianRupee className="h-4 w-4" aria-hidden="true" />
                      Mark paid
                    </Button>
                  ) : null}
                  {["APPROVED", "PAID"].includes(payout.status) ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => statement.mutate(payout.id)}>
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Generate statement
                    </Button>
                  ) : null}
                </div>
                {payingId === payout.id ? (
                  <form onSubmit={submitPaid} className="mt-4 grid gap-3 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
                    <FinanceInput label="Mode" value={paymentMode} onChange={setPaymentMode} />
                    <FinanceInput label="Transaction reference" value={transactionReference} onChange={setTransactionReference} />
                    <Button type="submit" disabled={paid.isPending || !transactionReference.trim()}>
                      Save paid
                    </Button>
                  </form>
                ) : null}
              </div>
              <MoneyBreakup
                gross={payout.grossSalesPaise}
                commission={payout.commissionPaise}
                gst={payout.gstOnCommissionPaise}
                tds={payout.tdsPaise}
                tcs={payout.tcsPaise}
                platformFee={payout.platformFeePaise}
                refund={payout.refundAdjustmentPaise}
                adjustment={payout.adjustmentPaise}
                net={payout.netPayablePaise}
              />
            </div>
          </FinancePanel>
        ))}
      </div>
      {!payoutsQuery.isLoading && payouts.length === 0 ? <FinanceState empty="No payouts yet" /> : null}
    </div>
  );
}

function FinanceInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]" />
    </label>
  );
}

function PayoutMethod({ seller }: { seller: { payoutProfile?: { accountHolderName?: string | null; bankName?: string | null; accountNumber?: string | null; ifscCode?: string | null; upiId?: string | null } | null } | null | undefined }) {
  const profile = seller?.payoutProfile;
  if (!profile) {
    return <p className="mt-3 rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-semibold text-[#8A1F1F]">Seller payout method is not configured.</p>;
  }

  const bankLine = profile.bankName && profile.accountNumber && profile.ifscCode
    ? `${profile.bankName} / ${maskAccount(profile.accountNumber)} / ${profile.ifscCode}`
    : null;
  const upiLine = profile.upiId ? `UPI: ${profile.upiId}` : null;

  return (
    <div className="mt-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#667085]">
      <p className="font-black text-[#1F2933]">{profile.accountHolderName ?? "Account holder not set"}</p>
      {upiLine ? <p className="mt-1">{upiLine}</p> : null}
      {bankLine ? <p className="mt-1">{bankLine}</p> : null}
      {!upiLine && !bankLine ? <p className="mt-1 text-[#8A1F1F]">Bank or UPI details are incomplete.</p> : null}
    </div>
  );
}

function maskAccount(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }

  return `****${trimmed.slice(-4)}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
