"use client";

import dynamic from "next/dynamic";
import { FormEvent, useState } from "react";
import { AlertTriangle, BarChart2, CalendarDays, Download, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { downloadSellerReportCsv, getSellerInventoryReport } from "@/lib/seller-api";
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

const SellerInventoryChart = dynamic(
  () => import("./report-charts/seller-inventory-chart"),
  {
    ssr: false,
    loading: () => <SellerChartLoading />,
  },
);

export function SellerInventoryReportClient({ initialDateFrom = "", initialDateTo = "" }: { initialDateFrom?: string; initialDateTo?: string }) {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [submittedRange, setSubmittedRange] = useState({ dateFrom: initialDateFrom, dateTo: initialDateTo });

  const reportQuery = useQuery({
    queryKey: ["seller-inventory-report", sellerAuth.authKey, submittedRange.dateFrom, submittedRange.dateTo],
    queryFn: () => getSellerInventoryReport(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedRange({ dateFrom, dateTo });
  }

  if (!sellerAuth.enabled) return <SellerAuthNotice />;
  if (reportQuery.error && isSellerOnboardingRequiredError(reportQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing inventory reports." />;
  }

  const report = reportQuery.data;
  const topChartData = (report?.topSoldItems ?? []).map((item) => ({
    name: item.productName.length > 20 ? item.productName.slice(0, 20) + "…" : item.productName,
    units: item.quantitySold,
    revenue: item.revenuePaise / 100,
  }));

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <Package className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="Inventory & Stock Report" description="Product counts, low-stock alerts, top selling items, and full variant stock levels." />
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
            <button type="button" onClick={() => void downloadSellerReportCsv(sellerAuth.authHeaders, "inventory", submittedRange)} className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] shadow-sm hover:border-[#ED3500] hover:text-[#ED3500]">
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
            <SellerMetric label="Total Products" value={report.summary.productCount} note="All products in catalogue" />
            <SellerMetric label="Active Products" value={report.summary.activeProductCount} note="Approved and live products" />
            <SellerMetric label="Total Variants" value={report.summary.variantCount} note="All product variants" />
            <SellerMetric label="Low Stock Variants" value={report.summary.lowStockCount} note="Variants with ≤ 5 units" />
          </div>

          {topChartData.length > 0 ? (
            <SellerPanel>
              <SectionHeading title="Top Selling Products" description="Units sold per product in this date range." />
              <div className="mt-5 h-[300px] w-full">
                <SellerInventoryChart data={topChartData} />
              </div>
            </SellerPanel>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            <SellerPanel>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading title="Low Stock Alerts" description="Variants at 5 units or below — restock soon." />
              </div>
              <div className="mt-5 grid gap-2">
                {report.lowStockVariants.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                    <div>
                      <p className="font-black text-[#1F2933]">{v.product.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#667085]">{v.variantName ?? v.sku ?? "Default variant"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.stockQuantity === 0 ? "bg-red-100 text-red-700" : "bg-[#FFF0EC] text-[#ED3500]"}`}>
                      {v.stockQuantity === 0 ? "Out of stock" : `${v.stockQuantity} left`}
                    </span>
                  </div>
                ))}
                {report.lowStockVariants.length === 0 ? <SellerEmptyState title="No low-stock variants" message="All your products have healthy stock levels." /> : null}
              </div>
            </SellerPanel>

            <SellerPanel>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <BarChart2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading title="All Variants" description="Complete stock listing sorted by stock quantity." />
              </div>
              <div className="mt-5 grid gap-2 max-h-[450px] overflow-y-auto pr-1">
                {report.variants.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                    <div>
                      <p className="font-semibold text-sm text-[#1F2933]">{v.product.name}</p>
                      <p className="mt-0.5 text-xs text-[#667085]">{v.variantName ?? v.sku ?? "Default"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.stockQuantity === 0 ? "bg-red-100 text-red-600" : v.stockQuantity <= 5 ? "bg-[#FFF0EC] text-[#ED3500]" : "bg-[#EAF1F7] text-[#163B5C]"}`}>
                      {v.stockQuantity} units
                    </span>
                  </div>
                ))}
                {report.variants.length === 0 ? <SellerEmptyState title="No variants" message="Add products to your catalogue to see stock here." /> : null}
              </div>
            </SellerPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SellerChartLoading() {
  return (
    <div className="grid h-full place-items-center rounded-md bg-[#F8FAFC] text-sm font-bold text-[#667085]">
      Loading chart
    </div>
  );
}
