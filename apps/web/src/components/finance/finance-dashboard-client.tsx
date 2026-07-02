"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BadgeIndianRupee, CheckCircle2, CreditCard, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { getFinanceDashboard, type FinanceDashboard } from "@/lib/finance-api";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export function FinanceDashboardClient() {
  const auth = useAdminAuth();
  const dashboardQuery = useQuery({
    queryKey: ["finance-dashboard", auth.authHeaders],
    queryFn: () => getFinanceDashboard(auth.authHeaders),
    enabled: auth.isAuthenticated
  });

  if (dashboardQuery.isLoading) {
    return <FinanceState message="Loading finance dashboard" />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <FinanceState
        message={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "Unable to load finance dashboard."}
        action={<Button onClick={() => dashboardQuery.refetch()}>Retry</Button>}
      />
    );
  }

  return <FinanceDashboardView dashboard={dashboardQuery.data} />;
}

function FinanceDashboardView({ dashboard }: { dashboard: FinanceDashboard }) {
  const metrics = dashboard.metrics;
  const cards = [
    { label: "COD pending", metric: metrics.codPending, icon: BadgeIndianRupee, tone: "orange" },
    { label: "COD collected", metric: metrics.codCollected, icon: CheckCircle2, tone: "green" },
    { label: "Bank transfer pending", metric: metrics.bankTransferPending, icon: Landmark, tone: "blue" },
    { label: "Online paid", metric: metrics.onlinePaid, icon: CreditCard, tone: "green" },
    { label: "Settlement due", metric: metrics.settlementDue, icon: ReceiptText, tone: "blue" },
    { label: "Payout pending", metric: metrics.payoutPending, icon: WalletCards, tone: "orange" },
    { label: "Payout paid", metric: metrics.payoutPaid, icon: CheckCircle2, tone: "green" },
    { label: "Service cash due", metric: metrics.serviceReceivableOpen, icon: ReceiptText, tone: "orange" },
    { label: "Service cash disputed", metric: metrics.serviceReceivableDisputed, icon: AlertCircle, tone: "orange" },
    { label: "Service cash cleared", metric: metrics.serviceReceivableSettled, icon: CheckCircle2, tone: "green" }
  ] as const;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className={iconTone(card.tone)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <StatusBadge tone={card.metric.count > 0 ? "warning" : "success"}>{card.metric.count} records</StatusBadge>
              </div>
              <p className="mt-4 text-sm font-black text-[#667085]">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-[#163B5C]">{money(card.metric.amountPaise)}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Recent payment activity</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">Latest online, COD, bank transfer, and manual payment records.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-xs font-black uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {dashboard.recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3 font-black text-[#163B5C]">{payment.order.orderNumber}</td>
                  <td className="px-4 py-3 font-semibold text-[#667085]">{payment.order.customer.fullName ?? payment.order.customer.email ?? "Customer"}</td>
                  <td className="px-4 py-3 font-semibold text-[#1F2933]">{payment.provider.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={payment.status === "PAID" ? "success" : payment.status === "FAILED" ? "danger" : "warning"}>{payment.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-[#1F2933]">{money(payment.amountPaise)}</td>
                </tr>
              ))}
              {dashboard.recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-semibold text-[#667085]">
                    No payment activity yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FinanceState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-black text-[#1F2933]">{message}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function money(amountPaise: number) {
  return moneyFormatter.format((amountPaise ?? 0) / 100);
}

function iconTone(tone: "orange" | "green" | "blue") {
  if (tone === "green") {
    return "grid h-11 w-11 place-items-center rounded-md bg-[#ECFDF3] text-[#0F8A5F]";
  }
  if (tone === "blue") {
    return "grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]";
  }
  return "grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]";
}
