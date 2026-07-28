"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileClock, RefreshCw } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { OperationalReportWorkspace } from "@/components/reporting/reporting-workspace";
import { getFinancePaymentReports, type FinanceReportGroup } from "@/lib/finance-api";
import type { ReportExportType } from "@/lib/report-exports-api";

type FinanceExportType = Extract<ReportExportType, `FINANCE_${string}`>;

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export function PaymentReportsClient() {
  const auth = useAdminAuth();
  const [provider, setProvider] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [reportType, setReportType] = useState<FinanceExportType>("FINANCE_PAYMENTS");
  const query = {
    ...(provider ? { provider } : {}),
    ...(paymentStatus ? { paymentStatus } : {})
  };
  const reportsQuery = useQuery({
    queryKey: ["finance-payment-reports", auth.authHeaders, query],
    queryFn: () => getFinancePaymentReports(auth.authHeaders, query),
    enabled: auth.isAuthenticated
  });
  const selectedReport = financeReportTypes.find((item) => item.value === reportType) ?? financeReportTypes[0]!;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px_220px_auto_auto]">
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value as FinanceExportType)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            {financeReportTypes.map((report) => <option key={report.value} value={report.value}>{report.label}</option>)}
          </select>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            <option value="">All methods</option>
            <option value="RAZORPAY">Razorpay</option>
            <option value="COD">COD</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="MANUAL">Manual</option>
          </select>
          <select
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
            <option value="NOT_REQUIRED">Not required</option>
          </select>
          <Button type="button" variant="outline" onClick={() => reportsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button asChild variant="secondary">
            <Link href="/finance/exports">
              <FileClock className="h-4 w-4" aria-hidden="true" />
              Exports
            </Link>
          </Button>
        </div>
      </section>

      {reportsQuery.isError ? (
        <section className="rounded-lg border border-[#F5B7B7] bg-white p-4 text-sm font-black text-[#B42318] shadow-sm">
          {reportsQuery.error instanceof Error ? reportsQuery.error.message : "Unable to load finance reports."}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <ReportPanel title="Payment method summary" items={reportsQuery.data?.byProvider ?? []} />
        <ReportPanel title="Payment status summary" items={reportsQuery.data?.byPaymentStatus ?? []} />
        <ReportPanel title="COD collection status" items={reportsQuery.data?.codByCollectionStatus ?? []} />
        <ReportPanel title="Order settlement status" items={reportsQuery.data?.bySettlementStatus ?? []} />
        <ReportPanel title="Service settlement status" items={reportsQuery.data?.byServiceSettlementStatus ?? []} />
        <ReportPanel title="Payout status" items={reportsQuery.data?.byPayoutStatus ?? []} />
        <ReportPanel title="Service cash receivables" items={reportsQuery.data?.serviceReceivablesByStatus ?? []} />
        <ReportPanel title="Service receivable tax state" items={reportsQuery.data?.serviceReceivablesByTaxStatus ?? []} />
        <ReportPanel title="Service offset policy" items={reportsQuery.data?.serviceReceivablesByOffsetPolicy ?? []} />
      </section>

      <section className="border-l-4 border-[#ED3500] bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-black text-[#1F2933]">{selectedReport.label}</p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">
          Activity date: {activityBasis(reportsQuery.data?.activityBasis, reportType)}
        </p>
      </section>

      <OperationalReportWorkspace
        auth={auth.authHeaders}
        endpoint={`/api/admin/finance/report-data/${reportType}`}
        exportType={reportType}
        audience="finance"
        exportsHref="/finance/exports"
        searchPlaceholder={selectedReport.searchPlaceholder}
        statusOptions={statusOptions(reportType)}
      />
    </div>
  );
}

const financeReportTypes: Array<{ value: FinanceExportType; label: string; searchPlaceholder: string }> = [
  { value: "FINANCE_PAYMENTS", label: "Payments", searchPlaceholder: "Payment ID, order, customer or provider reference" },
  { value: "FINANCE_COD_COLLECTIONS", label: "COD collections", searchPlaceholder: "Order, collection note or staff member" },
  { value: "FINANCE_ORDER_SETTLEMENTS", label: "Order settlements", searchPlaceholder: "Order, seller, split or payout" },
  { value: "FINANCE_SERVICE_SETTLEMENTS", label: "Service settlements", searchPlaceholder: "Booking, seller, settlement or payout" },
  { value: "FINANCE_PAYOUTS", label: "Seller payouts", searchPlaceholder: "Payout, seller or transaction reference" },
  { value: "FINANCE_SERVICE_RECEIVABLES", label: "Service receivables", searchPlaceholder: "Receivable, booking or seller" },
];

export const financeExportTypes: Array<{ value: ReportExportType; label: string }> = [
  ...financeReportTypes.map(({ value, label }) => ({ value, label })),
  { value: "GSTR1_REVIEW_SELLER_XLSX", label: "GSTR-1 seller review workbook" },
  { value: "GSTR1_REVIEW_ALL_SELLERS_ZIP", label: "GSTR-1 all-seller workbook ZIP" },
  { value: "GSTR1_REVIEW_PLATFORM_XLSX", label: "GSTR-1 platform review workbook" },
];

function statusOptions(type: FinanceExportType) {
  const values =
    type === "FINANCE_PAYMENTS"
      ? ["PENDING", "PAID", "FAILED", "REFUNDED", "NOT_REQUIRED"]
      : type === "FINANCE_COD_COLLECTIONS"
        ? ["NOT_COLLECTED", "COLLECTED", "VERIFIED", "REJECTED"]
        : type === "FINANCE_PAYOUTS"
          ? ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PAID", "REJECTED", "FAILED"]
          : ["PENDING", "ELIGIBLE", "PROCESSING", "SETTLED", "PAID", "DISPUTED", "WAIVED"];
  return values.map((value) => ({ value, label: value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }));
}

function activityBasis(
  basis: import("@/lib/finance-api").FinancePaymentReports["activityBasis"] | undefined,
  type: FinanceExportType,
) {
  if (!basis) return "Loading";
  const key = {
    FINANCE_PAYMENTS: "payments",
    FINANCE_COD_COLLECTIONS: "codCollections",
    FINANCE_ORDER_SETTLEMENTS: "orderSettlements",
    FINANCE_SERVICE_SETTLEMENTS: "serviceSettlements",
    FINANCE_PAYOUTS: "payouts",
    FINANCE_SERVICE_RECEIVABLES: "serviceReceivables",
  }[type] as keyof typeof basis | undefined;
  return key ? basis[key] : "Report activity date";
}

function ReportPanel({ title, items }: { title: string; items: FinanceReportGroup[] }) {
  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-black text-[#1F2933]">{title}</h2>
        </div>
        <StatusBadge tone="info">{items.length} groups</StatusBadge>
      </div>
      <div className="divide-y divide-[#E5E7EB]">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm">
            <p className="font-black text-[#1F2933]">{item.label.replace("_", " ")}</p>
            <StatusBadge tone={item.count > 0 ? "warning" : "success"}>{item.count}</StatusBadge>
            <p className="min-w-28 text-right font-black text-[#163B5C]">{money(item.amountPaise)}</p>
          </div>
        ))}
        {items.length === 0 ? <p className="px-4 py-8 text-center text-sm font-semibold text-[#667085]">No records yet.</p> : null}
      </div>
    </article>
  );
}

function money(amountPaise: number) {
  return moneyFormatter.format((amountPaise ?? 0) / 100);
}
