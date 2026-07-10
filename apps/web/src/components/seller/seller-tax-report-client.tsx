"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CalendarDays, Download, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Button, SectionHeading } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { downloadSellerReportCsv, getSellerTaxReport } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerMetric,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "./seller-ui";

export function SellerTaxReportClient({ initialDateFrom = "", initialDateTo = "" }: { initialDateFrom?: string; initialDateTo?: string }) {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [submittedRange, setSubmittedRange] = useState({ dateFrom: initialDateFrom, dateTo: initialDateTo });

  const reportQuery = useQuery({
    queryKey: ["seller-tax-report", sellerAuth.authKey, submittedRange.dateFrom, submittedRange.dateTo],
    queryFn: () => getSellerTaxReport(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedRange({ dateFrom, dateTo });
  }

  if (!sellerAuth.enabled) return <SellerAuthNotice />;
  if (reportQuery.error && isSellerOnboardingRequiredError(reportQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing tax reports." />;
  }

  const report = reportQuery.data;

  const pieData = report
    ? [
        { name: "Commission", value: report.summary.commissionPaise / 100 },
        { name: "GST on Commission", value: report.summary.gstOnCommissionPaise / 100 },
        { name: "TDS (Tax Deducted at Source)", value: report.summary.tdsPaise / 100 },
        { name: "TCS (Tax Collected at Source)", value: report.summary.tcsPaise / 100 },
        { name: "Platform Fee", value: report.summary.platformFeePaise / 100 },
      ].filter((d) => d.value > 0)
    : [];

  const PIE_COLORS = ["#163B5C", "#ED3500", "#3B82F6", "#F59E0B", "#10B981"];

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="Tax & Compliance Report" description="Breakdown of GST on commission, TDS, TCS, and all deductions per order." />
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
            <button type="button" onClick={() => void downloadSellerReportCsv(sellerAuth.authHeaders, "tax", submittedRange)} className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] shadow-sm hover:border-[#ED3500] hover:text-[#ED3500]">
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
            <SellerMetric label="Gross Sales" value={formatMoney(report.summary.grossSalesPaise)} note={`${report.summary.orderCount} orders in period`} />
            <SellerMetric label="Total Deductions" value={formatMoney(report.summary.totalDeductionsPaise)} note="Commission + GST + TDS + TCS + Fee" />
            <SellerMetric label="Net Payable" value={formatMoney(report.summary.netPayablePaise)} note="After all deductions" />
            <SellerMetric label="Coupon Discount" value={formatMoney(report.summary.couponDiscountPaise)} note="Seller-funded coupon cost" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric label="Commission" value={formatMoney(report.summary.commissionPaise)} note="Marketplace service fee" />
            <SellerMetric label="GST on Commission" value={formatMoney(report.summary.gstOnCommissionPaise)} note="GST charged on commission" />
            <SellerMetric label="TDS" value={formatMoney(report.summary.tdsPaise)} note="Tax Deducted at Source" />
            <SellerMetric label="TCS" value={formatMoney(report.summary.tcsPaise)} note="Tax Collected at Source" />
          </div>

          {pieData.length > 0 ? (
            <SellerPanel>
              <SectionHeading title="Deduction Breakdown" description="Visual split of all tax and fee deductions from your gross sales." />
              <div className="mt-5 flex flex-col items-center">
                <div className="h-[280px] w-full max-w-md">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(entry: { name?: string; percent?: number }) => `${(entry.name ?? "").split(" ")[0]} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length] as string} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`₹${value}`, undefined]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </SellerPanel>
          ) : null}

          <SellerPanel>
            <SectionHeading title="Order-level Tax Detail" description="Per-order tax and deduction breakdown for compliance and filing." />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">Order</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4 text-right">Gross (₹)</th>
                    <th className="pb-3 pr-4 text-right">Commission (₹)</th>
                    <th className="pb-3 pr-4 text-right">GST (₹)</th>
                    <th className="pb-3 pr-4 text-right">TDS (₹)</th>
                    <th className="pb-3 pr-4 text-right">TCS (₹)</th>
                    <th className="pb-3 text-right">Net (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.splits.map((split) => {
                    const net = split.sellerSubtotalPaise - split.commissionPaise - split.gstOnCommissionPaise - split.tdsPaise - split.tcsPaise;
                    return (
                      <tr key={split.id} className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC]">
                        <td className="py-3 pr-4">
                          <Link href={`/seller/orders/${split.order.orderNumber}`} className="font-black text-[#163B5C] hover:text-[#ED3500]">
                            {split.order.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-[#667085]">{new Date(split.createdAt).toLocaleDateString("en-IN")}</td>
                        <td className="py-3 pr-4 text-right font-semibold">{(split.sellerSubtotalPaise / 100).toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-[#ED3500]">{(split.commissionPaise / 100).toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-[#ED3500]">{(split.gstOnCommissionPaise / 100).toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-[#ED3500]">{(split.tdsPaise / 100).toFixed(2)}</td>
                        <td className="py-3 pr-4 text-right text-[#ED3500]">{(split.tcsPaise / 100).toFixed(2)}</td>
                        <td className="py-3 text-right font-black text-[#163B5C]">{(net / 100).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {report.splits.length === 0 ? <SellerEmptyState title="No orders in this range" message="Apply a date range or wait for orders to see tax details." /> : null}
            </div>
          </SellerPanel>
        </>
      ) : null}
    </div>
  );
}
