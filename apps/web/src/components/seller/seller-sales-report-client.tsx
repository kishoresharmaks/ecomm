"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AlertTriangle, BarChart3, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { downloadSellerReportCsv, getSellerProfile, getSellerSalesReport, type SellerCapability, type SellerSalesReport } from "@/lib/seller-api";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
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

const reportCardPageSize = 5;

export function SellerSalesReportClient() {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submittedRange, setSubmittedRange] = useState({ dateFrom: "", dateTo: "" });

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });

  const reportQuery = useQuery({
    queryKey: ["seller-sales-report", sellerAuth.authKey, submittedRange.dateFrom, submittedRange.dateTo],
    queryFn: () => getSellerSalesReport(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled && Boolean(profileQuery.data),
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedRange({ dateFrom, dateTo });
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (profileQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (profileQuery.error) {
    if (isSellerOnboardingRequiredError(profileQuery.error)) {
      return <SellerOnboardingRequired message="Complete seller onboarding before viewing seller sales reports." />;
    }
    return <SellerErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }

  if (reportQuery.error && isSellerOnboardingRequiredError(reportQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing seller sales reports." />;
  }

  const report = reportQuery.data;
  const currency = report?.currency || profileQuery.data?.operatingCurrency || "INR";
  const capabilities = reportCapabilities(report);
  const showRetail = capabilities.includes("RETAIL");
  const showServices = capabilities.includes("SERVICE");

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
          <div className="flex flex-wrap items-end gap-3">
            <form onSubmit={submit} className="grid w-full gap-3 md:grid-cols-[1fr_1fr_auto] lg:max-w-2xl">
              <SellerField label="Date from" name="dateFrom" type="date" value={dateFrom} onChange={setDateFrom} />
              <SellerField label="Date to" name="dateTo" type="date" value={dateTo} onChange={setDateTo} />
              <Button type="submit" className="self-end">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Apply
              </Button>
            </form>
            <button type="button" onClick={() => void downloadSellerReportCsv(sellerAuth.authHeaders, "sales", submittedRange)} className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] shadow-sm hover:border-[#ED3500] hover:text-[#ED3500]">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>
      </SellerPanel>

      {reportQuery.isLoading ? <SellerSkeleton /> : null}
      {reportQuery.error ? <SellerErrorPanel error={reportQuery.error} onRetry={() => void reportQuery.refetch()} /> : null}

      {report ? (
        <>
          {showRetail ? <SellerRetailReportSections report={report} currency={currency} /> : null}
          {showServices ? <SellerServiceSummaryMetrics report={report} currency={currency} /> : null}
          <div className={showRetail && showServices ? "grid gap-5 xl:grid-cols-2" : "grid gap-5"}>
            {showRetail ? <SellerB2BReportPanel report={report} currency={currency} /> : null}
            {showServices ? <SellerServiceReportPanel report={report} currency={currency} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SellerRetailReportSections({ report, currency }: { report: SellerSalesReport; currency: string }) {
  const [recentSalesPage, setRecentSalesPage] = useState(1);
  const recentSalesPageCount = Math.max(1, Math.ceil(report.recentOrders.length / reportCardPageSize));
  const safeRecentSalesPage = Math.min(recentSalesPage, recentSalesPageCount);
  const recentSalesStart = (safeRecentSalesPage - 1) * reportCardPageSize;
  const visibleRecentOrders = report.recentOrders.slice(recentSalesStart, recentSalesStart + reportCardPageSize);
  const chartData = report.recentOrders.slice(0, 10).reverse().map((o) => ({
    name: formatDateTime(o.order.createdAt).split(",")[0],
    sales: o.sellerSubtotalPaise / 100,
  }));

  const currencySymbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "AED" ? "AED " : currency === "SGD" ? "S$" : currency;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SellerMetric label="Gross sales" value={formatMoney(report.summary.totalSalesPaise, currency)} note="Seller order subtotal" />
        <SellerMetric label="Commission" value={formatMoney(report.summary.commissionPaise, currency)} note="Marketplace commission" />
        <SellerMetric label="Net sales" value={formatMoney(report.summary.netSalesPaise, currency)} note="After commission, tax, fees, coupons, and adjustments" />
        <SellerMetric label="Orders" value={report.summary.orderCount} note={`${report.summary.products} products tracked`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SellerMetric label="B2B enquiries" value={report.b2b?.enquiryCount ?? report.summary.b2bEnquiries} note={`${report.b2b?.orderCount ?? report.summary.b2bOrders ?? 0} B2B orders`} />
        <SellerMetric label="B2B payable" value={formatMoney(report.b2b?.buyerPayablePaise ?? report.summary.b2bOrderValuePaise ?? 0, currency)} note={`${formatMoney(report.b2b?.paidAmountPaise ?? 0, currency)} collected`} />
        <SellerMetric label="Low stock" value={report.summary.lowStockCount} note="Variants at five units or below" />
        <SellerMetric label="Products" value={report.summary.products} note="Active seller catalogue records" />
      </div>

      <SellerPanel>
        <SectionHeading title="Sales Trend" description="Recent gross sales amounts over time." />
        <div className="mt-5 h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <Line type="monotone" dataKey="sales" stroke="#ED3500" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `${currencySymbol}${val}`} />
              <Tooltip formatter={(value) => [`${currencySymbol}${value}`, 'Sales']} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SellerPanel>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <SellerPanel>
          <div className="flex items-center justify-between gap-3">
            <SectionHeading title="Recent sales" description="Latest seller order splits included in this report range." />
            <StatusBadge tone="info">{report.summary.b2bEnquiries} B2B enquiries</StatusBadge>
          </div>
          <div className="mt-5 grid gap-3">
            {visibleRecentOrders.map((split) => (
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
                  <span className="font-black text-[#163B5C]">{formatMoney(split.sellerSubtotalPaise, report.currency || currency)}</span>
                </div>
              </Link>
            ))}
            {report.recentOrders.length === 0 ? (
              <SellerEmptyState title="No sales in this range" message="Change the report dates or wait for customer orders containing this seller's products." />
            ) : null}
          </div>
          <CardPagination
            label="Recent sales"
            page={safeRecentSalesPage}
            pageCount={recentSalesPageCount}
            total={report.recentOrders.length}
            onPageChange={setRecentSalesPage}
          />
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
  );
}

function SellerServiceSummaryMetrics({ report, currency }: { report: SellerSalesReport; currency: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SellerMetric label="Service bookings" value={report.services?.bookingCount ?? report.summary.serviceBookings ?? 0} note={`${report.services?.activeListingCount ?? 0} active service listings`} />
      <SellerMetric label="Service revenue" value={formatMoney(report.services?.paidPaymentPaise ?? report.summary.serviceRevenuePaise ?? 0, currency)} note={`${formatMoney(report.services?.totalPayablePaise ?? 0, currency)} payable`} />
      <SellerMetric label="Service collected" value={formatMoney(report.services?.paidAmountPaise ?? 0, currency)} note={`${report.services?.paidPaymentCount ?? 0} paid payment records`} />
      <SellerMetric label="Service listings" value={`${report.services?.activeListingCount ?? 0}/${report.services?.listingCount ?? report.summary.serviceListings ?? 0}`} note="Active / total service listings" />
    </div>
  );
}

function SellerB2BReportPanel({ report, currency }: { report: SellerSalesReport; currency: string }) {
  const b2b = report.b2b;
  const recentOrders = b2b?.recentOrders ?? [];

  return (
    <SellerPanel>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#123A5A]">
          <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
        </span>
        <SectionHeading title="B2B performance" description="Seller B2B enquiry pipeline, proforma orders, payment collection, and payout value." />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <CompactMetric label="Enquiries" value={b2b?.enquiryCount ?? report.summary.b2bEnquiries} />
        <CompactMetric label="Orders" value={b2b?.orderCount ?? report.summary.b2bOrders ?? 0} />
        <CompactMetric label="Paid" value={formatMoney(b2b?.paidAmountPaise ?? 0, currency)} />
        <CompactMetric label="Seller payout" value={formatMoney(b2b?.sellerPayoutPaise ?? 0, currency)} />
      </div>
      <StatusBreakdown title="B2B enquiry status" items={b2b?.byEnquiryStatus ?? []} valueKey="count" currency={currency} />
      <StatusBreakdown title="B2B payment status" items={b2b?.byPaymentStatus ?? []} valueKey="count" amountKey="paidAmountPaise" currency={currency} />
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[#123A5A]">Recent B2B orders</p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/seller/b2b-orders">View all</Link>
          </Button>
        </div>
        <div className="mt-3 grid gap-3">
          {recentOrders.map((order) => (
            <Link key={order.id} href={`/seller/b2b-orders/${encodeURIComponent(order.orderNumber)}`} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 transition hover:border-[#ED3500]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-[#1F2933]">{order.orderNumber}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">{order.businessBuyer?.companyName ?? "Business buyer"}</p>
                </div>
                <SellerStatusPill status={order.status} />
              </div>
              <p className="mt-2 text-sm font-black text-[#123A5A]">{formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise ?? 0, order.currency)}</p>
            </Link>
          ))}
          {!recentOrders.length ? <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">No B2B orders in this report range.</p> : null}
        </div>
      </div>
    </SellerPanel>
  );
}

function SellerServiceReportPanel({ report, currency }: { report: SellerSalesReport; currency: string }) {
  const services = report.services;
  const recentBookings = services?.recentBookings ?? [];
  const [recentBookingsPage, setRecentBookingsPage] = useState(1);
  const recentBookingsPageCount = Math.max(1, Math.ceil(recentBookings.length / reportCardPageSize));
  const safeRecentBookingsPage = Math.min(recentBookingsPage, recentBookingsPageCount);
  const recentBookingsStart = (safeRecentBookingsPage - 1) * reportCardPageSize;
  const visibleRecentBookings = recentBookings.slice(recentBookingsStart, recentBookingsStart + reportCardPageSize);

  return (
    <SellerPanel>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </span>
        <SectionHeading title="Service performance" description="Service listing health, booking pipeline, payments, and recent customer jobs." />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <CompactMetric label="Listings" value={`${services?.activeListingCount ?? 0}/${services?.listingCount ?? report.summary.serviceListings ?? 0}`} />
        <CompactMetric label="Bookings" value={services?.bookingCount ?? report.summary.serviceBookings ?? 0} />
        <CompactMetric label="Paid payments" value={services?.paidPaymentCount ?? 0} />
        <CompactMetric label="Collected" value={formatMoney(services?.paidPaymentPaise ?? report.summary.serviceRevenuePaise ?? 0, currency)} />
      </div>
      <StatusBreakdown title="Service booking status" items={services?.byBookingStatus ?? []} valueKey="count" amountKey="totalPayablePaise" currency={currency} />
      <StatusBreakdown title="Service payment status" items={services?.byPaymentStatus ?? []} valueKey="count" amountKey="amountPaise" currency={currency} />
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[#123A5A]">Recent service bookings</p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/seller/service-bookings">View all</Link>
          </Button>
        </div>
        <div className="mt-3 grid gap-3">
          {visibleRecentBookings.map((booking) => (
            <div key={booking.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-[#1F2933]">{booking.bookingNumber}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">{booking.listing?.title ?? "Service booking"} - {customerName(booking)}</p>
                </div>
                <SellerStatusPill status={booking.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[#667085]">
                <StatusBadge tone="info">{booking.visitMode.replace(/_/g, " ")}</StatusBadge>
                <span>{formatDateTime(booking.scheduledStartAt ?? booking.createdAt)}</span>
                <span className="text-sm font-black text-[#123A5A]">{formatMoney(booking.totalPayablePaise, booking.currency)}</span>
              </div>
            </div>
          ))}
          {!recentBookings.length ? <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">No service bookings in this report range.</p> : null}
        </div>
        <CardPagination
          label="Recent service bookings"
          page={safeRecentBookingsPage}
          pageCount={recentBookingsPageCount}
          total={recentBookings.length}
          onPageChange={setRecentBookingsPage}
        />
      </div>
    </SellerPanel>
  );
}

function CardPagination({
  label,
  page,
  pageCount,
  total,
  onPageChange,
}: {
  label: string;
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= reportCardPageSize) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-[#E5E7EB] pt-3 text-xs font-bold text-[#667085] sm:flex-row sm:items-center sm:justify-between">
      <span>
        {label}: page {page} of {pageCount} ({total} records)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:border-[#ED3500] hover:text-[#ED3500] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#E5E7EB] disabled:hover:text-[#1F2933]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:border-[#ED3500] hover:text-[#ED3500] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#E5E7EB] disabled:hover:text-[#1F2933]"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 break-words text-base font-black text-[#123A5A]">{value}</p>
    </div>
  );
}

function StatusBreakdown({
  title,
  items,
  valueKey,
  amountKey,
  currency,
}: {
  title: string;
  items: Array<Record<string, string | number | null | undefined>>;
  valueKey: string;
  amountKey?: string;
  currency?: string;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm font-black text-[#123A5A]">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.slice(0, 6).map((item) => {
          const status = String(item.status ?? "UNKNOWN");
          const amount = amountKey ? Number(item[amountKey] ?? 0) : 0;
          return (
            <div key={status} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
              <SellerStatusPill status={status} />
              <div className="flex items-center gap-2 text-sm font-black text-[#123A5A]">
                <span>{Number(item[valueKey] ?? 0)}</span>
                {amountKey ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#667085]">
                    {formatMoney(amount, currency)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        {!items.length ? <p className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#667085]">No records in this range.</p> : null}
      </div>
    </div>
  );
}

function customerName(booking: NonNullable<SellerSalesReport["services"]>["recentBookings"][number]) {
  return booking.customer?.displayName?.trim() || booking.customer?.user?.fullName?.trim() || booking.customer?.user?.email?.trim() || "Customer";
}

function reportCapabilities(report?: SellerSalesReport): SellerCapability[] {
  const saved = report?.seller?.enabledCapabilities?.filter((capability): capability is SellerCapability => capability === "RETAIL" || capability === "SERVICE") ?? [];
  if (saved.length) {
    return saved;
  }

  const primary = report?.seller?.primaryCapability;
  if (primary === "RETAIL" || primary === "SERVICE") {
    return [primary];
  }

  return ["RETAIL"];
}
