"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  DetailLine,
  EmptyReturnPanel,
  MoneyMetric,
  RefundStatusBadge,
  RefundStepTrack,
  WorkspaceNotice,
  formatDateTime,
  humanize,
} from "@/components/returns/returns-workspace-ui";
import {
  adjustAdminRefundAmount,
  approveAdminRefund,
  getAdminRefund,
  initiateAdminRefund,
  listAdminRefunds,
  recordManualAdminRefund,
  retryAdminRefund,
  type RefundDetail,
  type RefundMethod,
  type RefundRequestStatus,
  type RefundSummary,
} from "@/lib/returns-api";
import { formatMoney } from "@/lib/storefront-api";

const refundStatusFilters: Array<RefundRequestStatus | "ALL"> = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "RETRY_PENDING",
  "CANCELLED",
];

const refundMethods: RefundMethod[] = ["RAZORPAY", "BANK_TRANSFER", "UPI", "MANUAL"];

export function AdminRefundsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RefundRequestStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedRefundNumber, setSelectedRefundNumber] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<RefundMethod>("RAZORPAY");
  const [manualReference, setManualReference] = useState("");
  const [manualPaidAt, setManualPaidAt] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const refundsQuery = useQuery({
    queryKey: ["admin-refunds", auth.token, status, submittedSearch],
    queryFn: () =>
      listAdminRefunds(auth.authHeaders, {
        ...(status !== "ALL" ? { status } : {}),
        search: submittedSearch,
        limit: 30,
      }),
    enabled: auth.isAuthenticated,
  });

  const refunds = refundsQuery.data?.items ?? [];

  useEffect(() => {
    if (!refunds.length) {
      setSelectedRefundNumber("");
      return;
    }
    if (!selectedRefundNumber || !refunds.some((item) => item.refundNumber === selectedRefundNumber)) {
      setSelectedRefundNumber(refunds[0]?.refundNumber ?? "");
    }
  }, [refunds, selectedRefundNumber]);

  const detailQuery = useQuery({
    queryKey: ["admin-refund-detail", auth.token, selectedRefundNumber],
    queryFn: () => getAdminRefund(auth.authHeaders, selectedRefundNumber),
    enabled: auth.isAuthenticated && Boolean(selectedRefundNumber),
  });

  const approveMutation = useMutation({
    mutationFn: (refundNumber: string) =>
      approveAdminRefund(auth.authHeaders, refundNumber, {
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (detail) => handleRefundUpdated(detail, "Refund approved."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to approve refund."),
  });

  const initiateMutation = useMutation({
    mutationFn: (refundNumber: string) =>
      initiateAdminRefund(auth.authHeaders, refundNumber, {
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (detail) => handleRefundUpdated(detail, "Refund initiation recorded."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to initiate refund."),
  });

  const retryMutation = useMutation({
    mutationFn: (refundNumber: string) =>
      retryAdminRefund(auth.authHeaders, refundNumber, {
        method,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (detail) => handleRefundUpdated(detail, "Refund retry started."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to retry refund."),
  });

  const manualMutation = useMutation({
    mutationFn: (refundNumber: string) =>
      recordManualAdminRefund(auth.authHeaders, refundNumber, {
        method,
        manualReference: manualReference.trim(),
        paidAt: new Date(manualPaidAt).toISOString(),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (detail) => handleRefundUpdated(detail, "Manual refund marked paid."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to record manual refund."),
  });

  const adjustMutation = useMutation({
    mutationFn: (refundNumber: string) =>
      adjustAdminRefundAmount(auth.authHeaders, refundNumber, {
        amountPaise: parseAmountPaise(adjustAmount),
        note: adjustNote.trim(),
      }),
    onSuccess: (detail) => handleRefundUpdated(detail, "Refund payable amount adjusted."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to adjust refund amount."),
  });

  const metrics = useMemo(() => refundMetrics(refunds), [refunds]);

  function handleRefundUpdated(detail: RefundDetail, message: string) {
    setNotice(message);
    setNote("");
    setManualReference("");
    setManualPaidAt("");
    setAdjustAmount("");
    setAdjustNote("");
    setSelectedRefundNumber(detail.refundNumber);
    void queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-refund-detail"] });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  const selectedDetail = detailQuery.data;
  const isBusy =
    approveMutation.isPending ||
    initiateMutation.isPending ||
    retryMutation.isPending ||
    manualMutation.isPending ||
    adjustMutation.isPending;

  useEffect(() => {
    if (selectedDetail?.refundDestination?.method) {
      setMethod(selectedDetail.refundDestination.method);
    }
  }, [selectedDetail?.refundDestination?.method]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RefundMetricCard label="Loaded refunds" value={refunds.length} helper="Current filtered queue" tone="info" />
        <RefundMetricCard label="Needs approval" value={metrics.review} helper="Finance decision needed" tone="warning" />
        <RefundMetricCard label="Processing" value={metrics.processing} helper="Gateway or manual payment moving" tone="info" />
        <RefundMetricCard label="Completed" value={metrics.completed} helper="Buyer refund posted" tone="success" />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#D8E2EA] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#E5E7EB] p-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)_auto] xl:items-center">
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-[#F8FAFC] p-1">
            {refundStatusFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatus(filter)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-sm font-black transition",
                  status === filter
                    ? "bg-white text-[#ED3500] shadow-sm ring-1 ring-[#FFE0D6]"
                    : "text-[#344054] hover:bg-white hover:text-[#ED3500]",
                )}
              >
                {filter === "ALL" ? "All refunds" : humanize(filter)}
              </button>
            ))}
          </div>
          <form onSubmit={submitSearch} className="flex min-w-0 gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search refunds</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search refund, order, or buyer..."
                className="h-12 w-full rounded-md border border-[#D8E2EA] bg-white pl-11 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#667085] focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
              />
            </label>
            <Button type="submit" className="h-12">
              Search
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => void refundsQuery.refetch()}
            disabled={refundsQuery.isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", refundsQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {notice ? (
          <div className="border-b border-[#E5E7EB] p-4">
            <WorkspaceNotice tone="success" title="Saved" message={notice} />
          </div>
        ) : null}

        <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] p-3 lg:border-b-0 lg:border-r">
            <div className="space-y-3">
              {refundsQuery.isLoading ? (
                <QueueSkeleton />
              ) : refundsQuery.error ? (
                <WorkspaceNotice
                  tone="danger"
                  title="Refunds could not be loaded"
                  message={refundsQuery.error instanceof Error ? refundsQuery.error.message : "Try refreshing the queue."}
                />
              ) : !refunds.length ? (
                <EmptyReturnPanel
                  title="No refund requests"
                  message="Refund requests appear here after cancellation, return QC, non-fulfilment, or manual finance adjustment."
                />
              ) : (
                refunds.map((refund) => (
                  <RefundQueueCard
                    key={refund.id}
                    refund={refund}
                    active={refund.refundNumber === selectedRefundNumber}
                    onSelect={() => setSelectedRefundNumber(refund.refundNumber)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="p-4">
            {selectedDetail ? (
              <AdminRefundDetailPanel
                detail={selectedDetail}
                note={note}
                setNote={setNote}
                method={method}
                setMethod={setMethod}
                manualReference={manualReference}
                setManualReference={setManualReference}
                manualPaidAt={manualPaidAt}
                setManualPaidAt={setManualPaidAt}
                isBusy={isBusy}
                onApprove={() => approveMutation.mutate(selectedDetail.refundNumber)}
                onInitiate={() => initiateMutation.mutate(selectedDetail.refundNumber)}
                onRetry={() => retryMutation.mutate(selectedDetail.refundNumber)}
                onManual={() => manualMutation.mutate(selectedDetail.refundNumber)}
                adjustAmount={adjustAmount}
                setAdjustAmount={setAdjustAmount}
                adjustNote={adjustNote}
                setAdjustNote={setAdjustNote}
                onAdjust={() => adjustMutation.mutate(selectedDetail.refundNumber)}
              />
            ) : detailQuery.isLoading ? (
              <QueueSkeleton />
            ) : (
              <EmptyReturnPanel
                title="Select a refund"
                message="Choose a refund request to approve, initiate, retry, or record a manual payout reference."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AdminRefundDetailPanel({
  detail,
  note,
  setNote,
  method,
  setMethod,
  manualReference,
  setManualReference,
  manualPaidAt,
  setManualPaidAt,
  adjustAmount,
  setAdjustAmount,
  adjustNote,
  setAdjustNote,
  isBusy,
  onApprove,
  onInitiate,
  onRetry,
  onManual,
  onAdjust,
}: {
  detail: RefundDetail;
  note: string;
  setNote: (value: string) => void;
  method: RefundMethod;
  setMethod: (value: RefundMethod) => void;
  manualReference: string;
  setManualReference: (value: string) => void;
  manualPaidAt: string;
  setManualPaidAt: (value: string) => void;
  adjustAmount: string;
  setAdjustAmount: (value: string) => void;
  adjustNote: string;
  setAdjustNote: (value: string) => void;
  isBusy: boolean;
  onApprove: () => void;
  onInitiate: () => void;
  onRetry: () => void;
  onManual: () => void;
  onAdjust: () => void;
}) {
  const canApprove = ["PENDING_REVIEW", "FAILED", "RETRY_PENDING"].includes(detail.status);
  const canInitiate = ["APPROVED", "FAILED", "RETRY_PENDING"].includes(detail.status);
  const canRetry = ["FAILED", "RETRY_PENDING"].includes(detail.status);
  const canManual = ["APPROVED", "FAILED", "RETRY_PENDING", "PROCESSING"].includes(detail.status);
  const canAdjust = ["PENDING_REVIEW", "APPROVED", "FAILED", "RETRY_PENDING"].includes(detail.status);
  const manualReady = manualReference.trim().length > 0 && manualPaidAt.trim().length > 0;
  const adjustReady = adjustAmount.trim().length > 0 && adjustNote.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RefundStatusBadge status={detail.status} />
            <StatusBadge tone="info">{humanize(detail.method ?? "METHOD_PENDING")}</StatusBadge>
          </div>
          <h2 className="mt-3 break-words text-2xl font-black text-[#0B1F3A]">{detail.refundNumber}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Order{" "}
            <Link href={`/admin/orders/${detail.order.orderNumber}`} className="font-black text-[#ED3500] hover:underline">
              {detail.order.orderNumber}
            </Link>{" "}
            / {detail.reason ? humanize(detail.reason) : "Refund adjustment"}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 xl:min-w-72">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Customer</p>
          <p className="mt-2 font-black text-[#1F2933]">{detail.customer.name ?? detail.customerName ?? "Customer"}</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{detail.customer.email ?? detail.customerEmail ?? "Email not available"}</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{detail.customer.phone ?? "Phone not available"}</p>
        </div>
      </div>

      <RefundStepTrack status={detail.status} />

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyMetric label="Refund amount" value={detail.amountPaise} currency={detail.currency} />
        <MoneyMetric label="Approved cap" value={detail.approvedAmountPaise ?? detail.amountPaise} currency={detail.currency} />
        <MoneyMetric label="Seller coupon adjustment" value={detail.sellerFundedCouponAdjustmentPaise} currency={detail.currency} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <PanelTitle icon={<CreditCard className="h-5 w-5" />} title="Refund items" description="Amounts are finance snapshots from the original order and return calculation." />
          {detail.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-black leading-6 text-[#1F2933]">{item.productName}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {item.seller?.storeName ?? "Seller"} / Qty {item.quantity}
                  </p>
                </div>
                <p className="text-lg font-black text-[#163B5C]">{formatMoney(item.amountPaise, detail.currency)}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SmallMetric label="Coupon share" value={formatMoney(item.couponAdjustmentPaise, detail.currency)} />
                <SmallMetric label="Seller-funded" value={formatMoney(item.sellerFundedCouponAdjustmentPaise, detail.currency)} />
                <SmallMetric label="Platform-funded" value={formatMoney(item.platformFundedCouponAdjustmentPaise, detail.currency)} />
              </div>
            </div>
          ))}

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<WalletCards className="h-5 w-5" />} title="Seller deduction impact" description="Seller payout or wallet impact is applied only after the customer refund succeeds." />
            <div className="mt-3 grid gap-3">
              {detail.sellerDeductionImpact?.length ? (
                detail.sellerDeductionImpact.map((impact) => (
                  <div key={impact.sellerId} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#1F2933]">{impact.sellerName}</p>
                        <p className="mt-1 text-xs font-bold text-[#667085]">
                          {impact.itemCount} item{impact.itemCount === 1 ? "" : "s"} / Qty {impact.quantity}
                        </p>
                      </div>
                      <StatusBadge tone={impact.applied ? "success" : "warning"}>
                        {impact.applied ? "Applied" : "Pending refund success"}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <SmallMetric label="Customer refund" value={formatMoney(impact.refundAmountPaise, detail.currency)} />
                      <SmallMetric label="Seller deduction" value={formatMoney(impact.deductionPaise, detail.currency)} />
                      <SmallMetric label="Mode" value={sellerDeductionModeLabel(impact.adjustmentMode)} />
                    </div>
                    <p className="mt-3 text-xs font-bold leading-5 text-[#667085]">
                      {impact.adjustmentMode === "WALLET_DEBIT"
                        ? `Paid payout already exists${impact.paidPayoutIds.length ? ` (${impact.paidPayoutIds.length})` : ""}; a seller ledger debit is used after refund success.`
                        : impact.adjustmentMode === "MIXED"
                          ? "Some splits reduce pending payouts while already-paid splits create seller ledger debits."
                          : "Pending/unpaid payout splits are reduced through existing settlement calculation."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                  Seller deduction impact will appear after refund items are linked to seller splits.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<WalletCards className="h-5 w-5" />} title="Provider transactions" description="Gateway and manual refund attempts are kept as separate records." />
            <div className="mt-3 grid gap-2">
              {detail.transactions.length ? (
                detail.transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#1F2933]">{humanize(transaction.provider)}</p>
                      <StatusBadge tone={transaction.status === "SUCCESS" ? "success" : transaction.status === "FAILED" ? "danger" : "warning"}>
                        {humanize(transaction.status)}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">{formatMoney(transaction.amountPaise, transaction.currency)}</p>
                    <p className="mt-1 break-all text-xs font-bold text-[#667085]">
                      Provider refund: {transaction.providerRefundId ?? "Not assigned"}
                    </p>
                    {transaction.errorMessage ?? transaction.failureReason ? (
                      <p className="mt-2 rounded-md border border-[#F4B8B8] bg-[#FDECEC] px-2 py-1 text-xs font-bold text-[#B42318]">
                        {transaction.errorMessage ?? transaction.failureReason}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                  No refund transaction attempt yet.
                </p>
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<WalletCards className="h-5 w-5" />} title="Payable amount" description="Finance may reduce the payable amount, but it cannot exceed the approved cap." />
            <div className="mt-4 grid gap-3">
              <DetailLine label="Approved cap" value={formatMoney(detail.approvedAmountPaise ?? detail.amountPaise, detail.currency)} />
              {detail.amountAdjustmentNote ? (
                <DetailLine label="Last adjustment" value={detail.amountAdjustmentNote} />
              ) : null}
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Payable amount</span>
                <input
                  inputMode="decimal"
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                  placeholder={(detail.amountPaise / 100).toFixed(2)}
                  className="h-11 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Adjustment note</span>
                <textarea
                  value={adjustNote}
                  onChange={(event) => setAdjustNote(event.target.value)}
                  rows={3}
                  placeholder="Required when changing payable amount."
                  className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <Button type="button" variant="outline" onClick={onAdjust} disabled={isBusy || !canAdjust || !adjustReady}>
                <WalletCards className="h-4 w-4" aria-hidden="true" />
                Adjust payable amount
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<ShieldCheck className="h-5 w-5" />} title="Finance action" description="Approve first, then initiate gateway or record manual refund." />
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Refund method</span>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value as RefundMethod)}
                  className="h-11 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                >
                  {refundMethods.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Finance note</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Reason, approval note, or retry instruction."
                  className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              {canApprove ? (
                <Button type="button" onClick={onApprove} disabled={isBusy}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Approve refund
                </Button>
              ) : null}
              {canInitiate ? (
                <Button type="button" onClick={onInitiate} disabled={isBusy}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Initiate refund
                </Button>
              ) : null}
              {canRetry ? (
                <Button type="button" variant="outline" onClick={onRetry} disabled={isBusy}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Retry gateway refund
                </Button>
              ) : null}
              {!canApprove && !canInitiate && !canRetry && detail.status === "SUCCESS" ? (
                <WorkspaceNotice tone="success" title="Refund complete" message="The buyer refund and finance adjustments are already recorded." />
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<Banknote className="h-5 w-5" />} title="Manual record" description="Use only after money is paid outside gateway." />
            {detail.refundDestination ? (
              <div className="mb-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#344054]">
                {formatRefundDestination(detail.refundDestination)}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">UTR / reference</span>
                <input
                  value={manualReference}
                  onChange={(event) => setManualReference(event.target.value)}
                  placeholder="UTR, cash voucher, or bank reference"
                  className="h-11 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Paid date and time</span>
                <input
                  type="datetime-local"
                  value={manualPaidAt}
                  onChange={(event) => setManualPaidAt(event.target.value)}
                  className="h-11 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <Button type="button" variant="outline" onClick={onManual} disabled={isBusy || !canManual || !manualReady}>
                <WalletCards className="h-4 w-4" aria-hidden="true" />
                Mark manual refund paid
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<CreditCard className="h-5 w-5" />} title="Payment context" description="Original payment and return source." />
            <div className="mt-3">
              <DetailLine label="Payment provider" value={humanize(detail.payment?.provider ?? "Not available")} />
              <DetailLine label="Payment status" value={humanize(detail.payment?.status ?? detail.order.paymentStatus)} />
              <DetailLine label="Provider payment ID" value={detail.payment?.providerPaymentId ?? "Not assigned"} />
              <DetailLine
                label="Return request"
                value={
                  detail.returnRequest ? (
                    <span>
                      {detail.returnRequest.requestNumber} / {humanize(detail.returnRequest.status)}
                    </span>
                  ) : (
                    "Not linked"
                  )
                }
              />
              <DetailLine label="Created" value={formatDateTime(detail.createdAt)} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function sellerDeductionModeLabel(mode: NonNullable<RefundDetail["sellerDeductionImpact"]>[number]["adjustmentMode"]) {
  if (mode === "WALLET_DEBIT") return "Wallet debit";
  if (mode === "MIXED") return "Mixed";
  return "Pending payout reduction";
}

function RefundQueueCard({
  refund,
  active,
  onSelect,
}: {
  refund: RefundSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-[#ED3500]",
        active ? "border-[#ED3500] ring-2 ring-[#FFE0D6]" : "border-[#D8E2EA]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <RefundStatusBadge status={refund.status} />
          <p className="mt-3 break-words text-base font-black text-[#0B1F3A]">{refund.refundNumber}</p>
          <p className="mt-1 truncate text-sm font-semibold text-[#667085]">{refund.orderNumber}</p>
        </div>
        <p className="shrink-0 text-right text-sm font-black text-[#163B5C]">
          {formatMoney(refund.amountPaise, refund.currency)}
        </p>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[#344054]">{humanize(refund.reason)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-[#667085]">
        <span>{refund.customerEmail ?? refund.customerName ?? "Customer"}</span>
        <span>/</span>
        <span>{formatDateTime(refund.createdAt)}</span>
      </div>
    </button>
  );
}

function RefundMetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "info" | "warning" | "success";
}) {
  const toneClass =
    tone === "success"
      ? "bg-[#ECFDF3] text-[#0F8A5F]"
      : tone === "warning"
        ? "bg-[#FFF7E6] text-[#B7791F]"
        : "bg-[#F0F7FF] text-[#175CD3]";

  return (
    <div className="rounded-xl border border-[#D8E2EA] bg-white p-5 shadow-sm">
      <span className={cn("grid h-11 w-11 place-items-center rounded-full", toneClass)}>
        <WalletCards className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#0B1F3A]">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{helper}</p>
    </div>
  );
}

function PanelTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">{icon}</span>
      <div>
        <h3 className="text-lg font-black text-[#1F2933]">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{description}</p>
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="h-32 animate-pulse rounded-xl bg-white" />
      <div className="h-32 animate-pulse rounded-xl bg-white" />
      <div className="h-32 animate-pulse rounded-xl bg-white" />
    </div>
  );
}

function refundMetrics(items: RefundSummary[]) {
  return items.reduce(
    (summary, item) => {
      if (item.status === "PENDING_REVIEW") summary.review += 1;
      if (["APPROVED", "INITIATED", "PROCESSING", "FAILED", "RETRY_PENDING"].includes(item.status)) {
        summary.processing += 1;
      }
      if (item.status === "SUCCESS") {
        summary.completed += 1;
      }
      return summary;
    },
    { review: 0, processing: 0, completed: 0 },
  );
}

function parseAmountPaise(value: string) {
  const normalized = value.trim().replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid refund amount.");
  }
  return Math.round(amount * 100);
}

function formatRefundDestination(destination: NonNullable<RefundDetail["refundDestination"]>) {
  if (destination.method === "UPI") {
    return `Pay by UPI to ${destination.accountHolderName} / ${destination.upiId}`;
  }
  return `Pay by bank transfer to ${destination.accountHolderName} / ${destination.bankName} / ${destination.accountNumber} / ${destination.ifsc}`;
}
