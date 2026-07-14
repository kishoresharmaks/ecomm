"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BarChart3, Package, IndianRupee, FileText, Undo2, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerReportsOverview } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerField,
  SellerOnboardingRequired,
  SellerErrorPanel,
  SellerSkeleton,
  useSellerAuth,
  isSellerOnboardingRequiredError
} from "./seller-ui";

export function SellerReportsHubClient() {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submittedRange, setSubmittedRange] = useState({ dateFrom: "", dateTo: "" });

  const reportQuery = useQuery({
    queryKey: ["seller-reports-overview", sellerAuth.authKey, submittedRange.dateFrom, submittedRange.dateTo],
    queryFn: () => getSellerReportsOverview(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedRange({ dateFrom, dateTo });
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (reportQuery.error && isSellerOnboardingRequiredError(reportQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing seller reports." />;
  }

  const overview = reportQuery.data;
  const currency = overview?.currency || "INR";

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <form onSubmit={submit} className="grid w-full gap-3 md:grid-cols-[1fr_1fr_auto]">
          <SellerField label="Date from" name="dateFrom" type="date" value={dateFrom} onChange={setDateFrom} />
          <SellerField label="Date to" name="dateTo" type="date" value={dateTo} onChange={setDateTo} />
          <Button type="submit" className="self-end">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Apply
          </Button>
        </form>
      </div>

      {reportQuery.isLoading ? <SellerSkeleton /> : null}
      {reportQuery.error ? <SellerErrorPanel error={reportQuery.error} onRetry={() => void reportQuery.refetch()} /> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          title="Sales & Revenue"
          description="Detailed breakdown of your gross sales, net revenue, recent orders, and B2B volume."
          icon={<BarChart3 className="h-6 w-6 text-[#163B5C]" />}
          href="/seller/reports/sales"
          metricLabel="Total Sales"
          metricValue={overview ? formatMoney(overview.totalSalesPaise, currency) : "—"}
          bg="bg-[#EAF1F7]"
          query={submittedRange}
        />
        <ReportCard
          title="Inventory & Stock"
          description="Keep track of your active product catalog and identify low-stock items at risk."
          icon={<Package className="h-6 w-6 text-[#163B5C]" />}
          href="/seller/reports/inventory"
          metricLabel="Active Products"
          metricValue={overview ? overview.products : "—"}
          badge={overview && overview.lowStockCount > 0 ? `${overview.lowStockCount} low stock` : undefined}
          bg="bg-[#EAF1F7]"
          query={submittedRange}
        />
        <ReportCard
          title="Finance & Settlements"
          description="View your upcoming payouts, completed settlements, and marketplace deductions."
          icon={<IndianRupee className="h-6 w-6 text-[#163B5C]" />}
          href="/seller/reports/finance"
          metricLabel="Net Earnings"
          metricValue={overview ? formatMoney(overview.netSalesPaise, currency) : "—"}
          bg="bg-[#EAF1F7]"
          query={submittedRange}
        />
        <ReportCard
          title="Tax & Compliance"
          description="Summary of GST, TDS, and TCS figures to help with your tax filing and compliance."
          icon={<FileText className="h-6 w-6 text-[#163B5C]" />}
          href="/seller/reports/tax"
          metricLabel="Total Tax Deductions"
          metricValue={overview ? formatMoney(overview.commissionPaise + overview.gstOnCommissionPaise, currency) : "—"}
          bg="bg-[#EAF1F7]"
          query={submittedRange}
        />
        <ReportCard
          title="Returns & Refunds"
          description="Track return requests, refund values, and overall return rates for your products."
          icon={<Undo2 className="h-6 w-6 text-[#ED3500]" />}
          href="/seller/reports/returns"
          metricLabel="Total Returns"
          metricValue={overview ? overview.returnCount : "—"}
          bg="bg-[#FFF0EC]"
          query={submittedRange}
        />
      </div>
    </div>
  );
}

function ReportCard({
  title,
  description,
  icon,
  href,
  metricLabel,
  metricValue,
  bg,
  badge,
  query,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  metricLabel: string;
  metricValue: string | number;
  bg: string;
  badge?: string | undefined;
  query: { dateFrom?: string; dateTo?: string };
}) {
  const qs = new URLSearchParams();
  if (query.dateFrom) qs.set("dateFrom", query.dateFrom);
  if (query.dateTo) qs.set("dateTo", query.dateTo);
  const fullHref = qs.size ? `${href}?${qs.toString()}` : href;

  return (
    <Link
      href={fullHref}
      className="group grid gap-4 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:border-[#ED3500] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${bg}`}>
          {icon}
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{metricLabel}</p>
          <p className="mt-1 text-lg font-black text-[#123A5A]">{metricValue}</p>
          {badge ? (
            <span className="mt-1 inline-block rounded-full bg-[#FFF0EC] px-2 py-0.5 text-xs font-bold text-[#ED3500]">{badge}</span>
          ) : null}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-black text-[#1F2933] group-hover:text-[#ED3500]">{title}</h3>
        <p className="mt-1 text-sm font-medium text-[#667085] line-clamp-2">{description}</p>
      </div>
    </Link>
  );
}
