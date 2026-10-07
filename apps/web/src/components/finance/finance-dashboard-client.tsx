"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BadgeIndianRupee, CheckCircle2, CreditCard, Landmark, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
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
    enabled: auth.isAuthenticated,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
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
    { label: "COD pending", metric: metrics.codPending, icon: BadgeIndianRupee, tone: "orange", href: "/finance/cod-collections" },
    { label: "COD collected", metric: metrics.codCollected, icon: CheckCircle2, tone: "green", href: "/finance/cod-collections" },
    { label: "Bank transfer pending", metric: metrics.bankTransferPending, icon: Landmark, tone: "blue", href: "/finance/bank-transfers" },
    { label: "Manual payment pending", metric: metrics.manualPending, icon: ReceiptText, tone: "orange", href: "/finance/payment-status" },
    { label: "Online paid", metric: metrics.onlinePaid, icon: CreditCard, tone: "green", href: "/finance/payment-status" },
    { label: "Refunds pending", metric: metrics.refundsPending ?? { count: 0, amountPaise: 0 }, icon: RotateCcw, tone: "orange", href: "/finance/refunds" },
    { label: "Refunds settled", metric: metrics.refundsPaid ?? { count: 0, amountPaise: 0 }, icon: CheckCircle2, tone: "blue", href: "/finance/refunds" },
    { label: "Settlement due", metric: metrics.settlementDue, icon: ReceiptText, tone: "blue", href: "/finance/settlements" },
    { label: "Payout pending", metric: metrics.payoutPending, icon: WalletCards, tone: "orange", href: "/finance/payouts" },
    { label: "Payout paid", metric: metrics.payoutPaid, icon: CheckCircle2, tone: "green", href: "/finance/payouts" },
    { label: "Seller COD due", metric: metrics.sellerCashReceivableOpen, icon: WalletCards, tone: "orange", href: "/finance/seller-cash-receivables" },
    { label: "Seller COD cleared", metric: metrics.sellerCashReceivableSettled, icon: CheckCircle2, tone: "green", href: "/finance/seller-cash-receivables" },
    { label: "Service cash due", metric: metrics.serviceReceivableOpen, icon: ReceiptText, tone: "orange", href: "/finance/service-receivables" },
    { label: "Service cash disputed", metric: metrics.serviceReceivableDisputed, icon: AlertCircle, tone: "orange", href: "/finance/service-receivables" },
    { label: "Service cash cleared", metric: metrics.serviceReceivableSettled, icon: CheckCircle2, tone: "green", href: "/finance/service-receivables" }
  ] as const;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="group block rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm transition hover:border-[#ED3500] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={iconTone(card.tone)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <StatusBadge tone={card.metric.count > 0 ? "warning" : "success"}>{card.metric.count} records</StatusBadge>
              </div>
              <p className="mt-4 text-sm font-black text-[#667085] group-hover:text-[#163B5C]">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-[#163B5C]">{money(card.metric.amountPaise)}</p>
            </Link>
          );
        })}
      </section>

      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Recent payment activity</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">Latest online, COD, bank transfer, and manual payment records.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/finance/payment-status">View all payments</Link>
          </Button>
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
              {dashboard.recentPayments.map((payment) => {
                const effectiveStatus = payment.effectiveStatus || payment.status;
                const isRefunded = effectiveStatus === "REFUNDED" || payment.status === "REFUNDED";
                const isRefundPending = effectiveStatus === "REFUND_APPROVED" || effectiveStatus === "REFUND_PENDING";
                const isCancelled = payment.isCancelled || payment.order.orderStatus === "CANCELLED";
                const refundAmount = payment.refundAmountPaise ?? payment.order.refundAmountPaise ?? 0;

                const tone = isRefunded
                  ? "danger"
                  : isRefundPending
                    ? "warning"
                    : payment.status === "PAID"
                      ? "success"
                      : payment.status === "FAILED"
                        ? "danger"
                        : "warning";

                const badgeText = isRefunded
                  ? "REFUNDED"
                  : isRefundPending
                    ? effectiveStatus.replace("_", " ")
                    : isCancelled
                      ? "CANCELLED"
                      : payment.status;

                return (
                  <tr key={payment.id} className={isCancelled || isRefunded ? "bg-[#FEF2F2]/30" : undefined}>
                    <td className="px-4 py-3 font-black text-[#163B5C]">
                      <div>{payment.order.orderNumber}</div>
                      {isCancelled && (
                        <span className="text-[11px] font-bold text-[#DC2626]">Package Cancelled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#667085]">
                      {payment.order.customer.fullName ?? payment.order.customer.email ?? "Customer"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#1F2933]">
                      {payment.provider.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone={tone}>{badgeText}</StatusBadge>
                        {refundAmount > 0 && !isRefunded && (
                          <span className="rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-black text-[#DC2626]">
                            Refund Pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isRefunded || isCancelled ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-semibold text-[#98A2B3] line-through">
                            {money(payment.amountPaise)}
                          </span>
                          {refundAmount > 0 && (
                            <span className="text-xs font-black text-[#DC2626]">
                              - {money(refundAmount)} Refund
                            </span>
                          )}
                          <span className="text-xs font-bold text-[#0B1F3A]">
                            Net: {money(Math.max(0, payment.amountPaise - refundAmount))}
                          </span>
                        </div>
                      ) : (
                        <span className="font-black text-[#1F2933]">{money(payment.amountPaise)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
