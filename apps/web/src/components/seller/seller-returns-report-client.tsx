"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CalendarDays, Download, Undo2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Button, SectionHeading } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerReturnsReport, getSellerReportCsvUrl } from "@/lib/seller-api";
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
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "./seller-ui";

export function SellerReturnsReportClient({ initialDateFrom = "", initialDateTo = "" }: { initialDateFrom?: string; initialDateTo?: string }) {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [submittedRange, setSubmittedRange] = useState({ dateFrom: initialDateFrom, dateTo: initialDateTo });

  const reportQuery = useQuery({
    queryKey: ["seller-returns-report", sellerAuth.authKey, submittedRange.dateFrom, submittedRange.dateTo],
    queryFn: () => getSellerReturnsReport(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedRange({ dateFrom, dateTo });
  }

  if (!sellerAuth.enabled) return <SellerAuthNotice />;
  if (reportQuery.error && isSellerOnboardingRequiredError(reportQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing returns reports." />;
  }

  const report = reportQuery.data;

  const statusChartData = (report?.byStatus ?? []).map((s) => ({
    name: s.status.replace(/_/g, " "),
    count: s.count,
    requested: s.requestedAmountPaise / 100,
    approved: s.approvedAmountPaise / 100,
  }));

  const csvUrl = getSellerReportCsvUrl("returns", submittedRange);

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <Undo2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="Returns & Refunds Report" description="Return request counts, approved refund amounts, and resolution breakdown." />
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
            <a href={csvUrl} download className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] shadow-sm hover:border-[#ED3500] hover:text-[#ED3500]">
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </div>
        </div>
      </SellerPanel>

      {reportQuery.isLoading ? <SellerSkeleton /> : null}
      {reportQuery.error ? <SellerErrorPanel error={reportQuery.error} onRetry={() => void reportQuery.refetch()} /> : null}

      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric label="Total Returns" value={report.summary.totalCount} note="All return requests" />
            <SellerMetric label="Approved" value={report.summary.approvedCount} note="Approved return requests" />
            <SellerMetric label="Pending Review" value={report.summary.pendingCount} note="Awaiting admin review" />
            <SellerMetric label="Total Items Returned" value={report.summary.itemCount} note="Individual items across requests" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SellerMetric label="Requested Refund Value" value={formatMoney(report.summary.requestedAmountPaise)} note="Total amount customers requested" />
            <SellerMetric label="Approved Refund Value" value={formatMoney(report.summary.approvedAmountPaise)} note="Total amount approved for refund" />
          </div>

          {statusChartData.length > 0 ? (
            <SellerPanel>
              <SectionHeading title="Returns by Status" description="Count of return requests grouped by their current status." />
              <div className="mt-5 h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Count" fill="#163B5C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SellerPanel>
          ) : null}

          <SellerPanel>
            <SectionHeading title="Recent Return Requests" description="Latest return requests from your customers." />
            <div className="mt-5 grid gap-3">
              {report.recentReturns.map((r) => (
                <div key={r.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-sm text-[#1F2933]">{r.requestNumber}</p>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        Order:{" "}
                        <Link href={`/seller/orders/${r.order.orderNumber}`} className="font-semibold text-[#163B5C] hover:text-[#ED3500]">
                          {r.order.orderNumber}
                        </Link>
                        {" · "}
                        {new Date(r.requestedAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <SellerStatusPill status={r.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#667085]">
                    <span className="rounded bg-[#EAF1F7] px-2 py-0.5 font-semibold text-[#163B5C]">{r.resolution.replace(/_/g, " ")}</span>
                    <span>Reason: {r.reason}</span>
                    <span>Requested: <span className="font-bold text-[#ED3500]">{formatMoney(r.requestedAmountPaise)}</span></span>
                    {r.approvedAmountPaise > 0 ? (
                      <span>Approved: <span className="font-bold text-green-600">{formatMoney(r.approvedAmountPaise)}</span></span>
                    ) : null}
                  </div>
                </div>
              ))}
              {report.recentReturns.length === 0 ? (
                <SellerEmptyState title="No returns in this range" message="Any return requests from customers will appear here." />
              ) : null}
            </div>
          </SellerPanel>
        </>
      ) : null}
    </div>
  );
}
