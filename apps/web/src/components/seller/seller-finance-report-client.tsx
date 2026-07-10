"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Download, IndianRupee, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Button, SectionHeading } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { downloadSellerReportCsv, getSellerFinanceReport } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerMetric,
  SellerOnboardingRequired,
  SellerPanel,
  SellerStatusPill,
  SellerSkeleton,
  formatDateTime,
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "./seller-ui";

export function SellerFinanceReportClient({ initialDateFrom = "", initialDateTo = "" }: { initialDateFrom?: string; initialDateTo?: string }) {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [submittedRange, setSubmittedRange] = useState({ dateFrom: initialDateFrom, dateTo: initialDateTo });

  const reportQuery = useQuery({
    queryKey: ["seller-finance-report", sellerAuth.authKey, submittedRange.dateFrom, submittedRange.dateTo],
    queryFn: () => getSellerFinanceReport(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedRange({ dateFrom, dateTo });
  }

  if (!sellerAuth.enabled) return <SellerAuthNotice />;
  if (reportQuery.error && isSellerOnboardingRequiredError(reportQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing finance reports." />;
  }

  const report = reportQuery.data;

  const payoutChartData = (report?.recentPayouts ?? []).slice(0, 8).reverse().map((p) => ({
    name: new Date(p.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    gross: (p.grossSalesPaise ?? 0) / 100,
    net: (p.netPayablePaise ?? 0) / 100,
  }));

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <IndianRupee className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="Finance & Settlements Report" description="Gross earnings, net payouts, pending settlements, and your full ledger." />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <form onSubmit={submit} className="grid w-full gap-3 md:grid-cols-[1fr_1fr_auto]">
              <SellerField label="Date from" name="dateFrom" type="date" value={dateFrom} onChange={setDateFrom} />
              <SellerField label="Date to" name="dateTo" type="date" value={dateTo} onChange={setDateTo} />
              <Button type="submit" className="self-end">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Apply
              </Button>
            </form>
            <button type="button" onClick={() => void downloadSellerReportCsv(sellerAuth.authHeaders, "finance", submittedRange)} className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] shadow-sm hover:border-[#ED3500] hover:text-[#ED3500]">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>
      </SellerPanel>

      {reportQuery.isLoading ? <SellerSkeleton /> : null}
      {reportQuery.error ? <SellerErrorPanel error={reportQuery.error} onRetry={() => void reportQuery.refetch()} /> : null}

      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric label="Gross Sales" value={formatMoney(report.summary.grossSalesPaise)} note="Total seller subtotal in period" />
            <SellerMetric label="Net Payable" value={formatMoney(report.summary.netPayablePaise)} note="After all deductions" />
            <SellerMetric label="Pending Payouts" value={formatMoney(report.summary.pendingPayoutsPaise)} note={`${report.summary.pendingPayoutsCount} payouts awaiting approval`} />
            <SellerMetric label="Paid Out" value={formatMoney(report.summary.paidPayoutsPaise)} note={`${report.summary.paidPayoutsCount} completed payouts`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric label="Commission" value={formatMoney(report.summary.commissionPaise)} note="Platform commission deducted" />
            <SellerMetric label="Platform Fee" value={formatMoney(report.summary.platformFeePaise)} note="Buyer platform fee impact" />
            <SellerMetric label="Refund Adjustments" value={formatMoney(report.summary.refundAdjustmentPaise)} note="Refund-related deductions" />
            <SellerMetric label="Eligible Balance" value={formatMoney(report.summary.eligiblePaise)} note={`${report.summary.eligibleCount} splits awaiting payout`} />
          </div>

          {payoutChartData.length > 0 ? (
            <SellerPanel>
              <SectionHeading title="Payout History" description="Gross vs. net payable across recent payouts." />
              <div className="mt-5 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payoutChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip formatter={(value) => [`₹${value}`, undefined]} />
                    <Bar dataKey="gross" name="Gross" fill="#163B5C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net Payable" fill="#ED3500" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SellerPanel>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            <SellerPanel>
              <SectionHeading title="Recent Payouts" description="Latest payout records for your account." />
              <div className="mt-5 grid gap-2">
                {report.recentPayouts.map((p) => (
                  <div key={p.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-black text-sm text-[#1F2933]">{p.payoutNumber}</p>
                        <p className="text-xs text-[#667085]">{new Date(p.periodFrom).toLocaleDateString("en-IN")} – {new Date(p.periodTo).toLocaleDateString("en-IN")}</p>
                      </div>
                      <SellerStatusPill status={p.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#667085]">
                      <span>Gross: <span className="font-bold text-[#1F2933]">{formatMoney(p.grossSalesPaise)}</span></span>
                      <span>Net: <span className="font-bold text-[#ED3500]">{formatMoney(p.netPayablePaise)}</span></span>
                      {p.paidAt ? <span>Paid: {new Date(p.paidAt).toLocaleDateString("en-IN")}</span> : null}
                    </div>
                  </div>
                ))}
                {report.recentPayouts.length === 0 ? <SellerEmptyState title="No payouts" message="Your payout history will appear here after your first settlement." /> : null}
              </div>
            </SellerPanel>

            <SellerPanel>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <TrendingDown className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading title="Ledger Entries" description="Recent credit and debit entries in your seller ledger." />
              </div>
              <div className="mt-5 grid gap-2 max-h-[450px] overflow-y-auto pr-1">
                {report.ledgerEntries.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1F2933] truncate">{entry.description}</p>
                        <p className="mt-0.5 text-xs text-[#667085]">{entry.entryType.replace(/_/g, " ")} · {formatDateTime(entry.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {entry.creditPaise > 0 ? <p className="text-sm font-black text-green-600">+{formatMoney(entry.creditPaise)}</p> : null}
                        {entry.debitPaise > 0 ? <p className="text-sm font-black text-[#ED3500]">−{formatMoney(entry.debitPaise)}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
                {report.ledgerEntries.length === 0 ? <SellerEmptyState title="No ledger entries" message="Ledger entries are created when orders are settled or payouts are processed." /> : null}
              </div>
            </SellerPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}
