"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerSalesReport } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerMetric,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  formatDateTime,
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "./seller-ui";

export function SellerSalesReportClient() {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submittedRange, setSubmittedRange] = useState({ dateFrom: "", dateTo: "" });

  const reportQuery = useQuery({
    queryKey: ["seller-sales-report", sellerAuth.authKey, submittedRange.dateFrom, submittedRange.dateTo],
    queryFn: () => getSellerSalesReport(sellerAuth.authHeaders, submittedRange),
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
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing seller sales reports." />;
  }

  const report = reportQuery.data;

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="Sales report" description="Sales, commission, net revenue, recent order splits, B2B volume, and low-stock products." />
          </div>
          <form onSubmit={submit} className="grid w-full gap-3 md:grid-cols-[1fr_1fr_auto] lg:max-w-2xl">
            <SellerField label="Date from" name="dateFrom" type="date" value={dateFrom} onChange={setDateFrom} />
            <SellerField label="Date to" name="dateTo" type="date" value={dateTo} onChange={setDateTo} />
            <Button type="submit" className="self-end">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Apply
            </Button>
          </form>
        </div>
      </SellerPanel>

      {reportQuery.isLoading ? <SellerSkeleton /> : null}
      {reportQuery.error ? <SellerErrorPanel error={reportQuery.error} onRetry={() => void reportQuery.refetch()} /> : null}

      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric label="Gross sales" value={formatMoney(report.summary.totalSalesPaise)} note="Seller order subtotal" />
            <SellerMetric label="Commission" value={formatMoney(report.summary.commissionPaise)} note="Marketplace commission" />
            <SellerMetric label="Net sales" value={formatMoney(report.summary.netSalesPaise)} note="Gross minus commission" />
            <SellerMetric label="Orders" value={report.summary.orderCount} note={`${report.summary.products} products tracked`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <SellerPanel>
              <div className="flex items-center justify-between gap-3">
                <SectionHeading title="Recent sales" description="Latest seller order splits included in this report range." />
                <StatusBadge tone="info">{report.summary.b2bEnquiries} B2B enquiries</StatusBadge>
              </div>
              <div className="mt-5 grid gap-3">
                {report.recentOrders.map((split) => (
                  <Link
                    key={split.id}
                    href={`/seller/orders/${split.order.orderNumber}`}
                    className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="font-black text-[#1F2933]">{split.order.orderNumber}</p>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">{formatDateTime(split.order.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <SellerStatusPill status={split.sellerStatus} />
                      <span className="font-black text-[#163B5C]">{formatMoney(split.sellerSubtotalPaise, split.order.currency)}</span>
                    </div>
                  </Link>
                ))}
                {report.recentOrders.length === 0 ? (
                  <SellerEmptyState title="No sales in this range" message="Change the report dates or wait for customer orders containing this seller's products." />
                ) : null}
              </div>
            </SellerPanel>

            <SellerPanel>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading title="Low stock" description="Variants at five units or below." />
              </div>
              <div className="mt-5 grid gap-3">
                {report.lowStockProducts.map((variant) => (
                  <div key={variant.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    <p className="font-black text-[#1F2933]">{variant.product.name}</p>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">
                      {variant.variantName ?? variant.sku} - {variant.stockQuantity} left
                    </p>
                  </div>
                ))}
                {report.lowStockProducts.length === 0 ? <p className="text-sm font-semibold text-[#667085]">No low-stock products in this report.</p> : null}
              </div>
            </SellerPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}
