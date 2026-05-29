"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { getFinancePaymentReports, type FinanceReportGroup } from "@/lib/finance-api";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export function PaymentReportsClient() {
  const auth = useAdminAuth();
  const [provider, setProvider] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const query = {
    ...(provider ? { provider } : {}),
    ...(paymentStatus ? { paymentStatus } : {})
  };
  const reportsQuery = useQuery({
    queryKey: ["finance-payment-reports", auth.authHeaders, query],
    queryFn: () => getFinancePaymentReports(auth.authHeaders, query),
    enabled: auth.isAuthenticated
  });

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[240px_240px_auto]">
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
        <ReportPanel title="Settlement status" items={reportsQuery.data?.bySettlementStatus ?? []} />
        <ReportPanel title="Payout status" items={reportsQuery.data?.byPayoutStatus ?? []} />
      </section>
    </div>
  );
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
