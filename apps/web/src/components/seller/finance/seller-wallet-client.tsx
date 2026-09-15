"use client";

import { WalletCards, ArrowDownLeft, ArrowUpRight, TrendingUp, Clock, Wallet, Receipt } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerPayoutAvailability, listSellerLedger } from "@/lib/seller-finance-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  formatDateTime,
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "../seller-ui";

export function SellerWalletClient() {
  const sellerAuth = useSellerAuth();
  const ledgerQuery = useQuery({
    queryKey: ["seller-finance-ledger", sellerAuth.authKey],
    queryFn: () => listSellerLedger(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });
  const availabilityQuery = useQuery({
    queryKey: ["seller-payout-availability", sellerAuth.authKey],
    queryFn: () => getSellerPayoutAvailability(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (ledgerQuery.isLoading || availabilityQuery.isLoading) {
    return <SellerSkeleton />;
  }

  const pageError = ledgerQuery.error ?? availabilityQuery.error;
  if (pageError) {
    if (isSellerOnboardingRequiredError(pageError)) {
      return (
        <SellerOnboardingRequired message="Complete seller onboarding before viewing wallet and ledger entries." />
      );
    }

    return (
      <SellerErrorPanel
        error={pageError}
        onRetry={() => {
          void ledgerQuery.refetch();
          void availabilityQuery.refetch();
        }}
      />
    );
  }

  const entries = ledgerQuery.data?.items ?? [];
  const currency = availabilityQuery.data?.currency || "INR";
  const netPayablePaise = availabilityQuery.data?.netPayablePaise ?? 0;
  const ledgerBalancePaise = ledgerQuery.data?.balancePaise ?? 0;
  const platformDuePaise = availabilityQuery.data?.sellerCashReceivableOutstandingPaise ?? 0;
  const platformOffsetPaise = availabilityQuery.data?.sellerCashReceivableOffsetPaise ?? 0;
  const latestEntry = entries[0] ?? null;

  const totalCredits = entries.reduce((sum, e) => sum + (e.creditPaise ?? 0), 0);
  const totalDebits = entries.reduce((sum, e) => sum + (e.debitPaise ?? 0), 0);

  return (
    <div className="grid gap-6">
      {/* ─── Hero Balance Card ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#163B5C] via-[#1a4d7a] to-[#0D2B45] px-6 py-8 md:px-8 md:py-10">
        <div className="absolute top-0 right-0 opacity-[0.04]">
          <WalletCards className="h-64 w-64" />
        </div>
        <div className="relative">
          <p className="text-sm font-bold text-white/60 uppercase tracking-widest">Available for payout</p>
          <p className="mt-2 text-4xl font-black text-white md:text-5xl">
            {formatMoney(netPayablePaise, currency)}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="sm" className="bg-[#ED3500] hover:bg-[#c42d00] text-white font-bold border-0">
              <Link href="/seller/finance/payouts">Request Payout</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 font-bold">
              <Link href="/seller/finance/statements">Download Statement</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Stats Grid ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Settled Balance"
          value={formatMoney(ledgerBalancePaise, currency)}
          trend={null}
          accent="blue"
        />
        <StatCard
          icon={<ArrowDownLeft className="h-5 w-5" />}
          label="Total Credits"
          value={formatMoney(totalCredits, currency)}
          trend={null}
          accent="green"
        />
        <StatCard
          icon={<ArrowUpRight className="h-5 w-5" />}
          label="Total Debits"
          value={formatMoney(totalDebits, currency)}
          trend={null}
          accent="red"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Platform Due (COD)"
          value={formatMoney(platformDuePaise, currency)}
          trend={platformOffsetPaise > 0 ? `${formatMoney(platformOffsetPaise, currency)} deducted next` : null}
          accent="amber"
        />
      </div>

      {/* ─── Quick Actions ─── */}
      <SellerPanel>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0EC] text-[#ED3500]">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-[#1F2933]">Manual payout request</p>
              <p className="text-sm font-semibold text-[#667085]">
                Request payout for eligible delivered and paid orders.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 bg-[#ED3500] hover:bg-[#c42d00] text-white font-bold">
            <Link href="/seller/finance/payouts">Open payouts</Link>
          </Button>
        </div>
      </SellerPanel>

      {/* ─── Latest Movement Highlight ─── */}
      {latestEntry && (
        <div className="rounded-xl border border-[#D9E2EA] bg-gradient-to-r from-white to-[#F8FAFC] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[#667085]" />
            <p className="text-xs font-black uppercase tracking-widest text-[#667085]">Latest Movement</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-black text-[#1F2933]">{sellerLedgerTitle(latestEntry)}</p>
              <p className="text-sm font-semibold text-[#667085]">{sellerLedgerDescription(latestEntry)}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-left sm:text-right">
                <p className={`text-lg font-black ${latestEntry.creditPaise > 0 ? "text-[#0F8A5F]" : "text-[#ED3500]"}`}>
                  {latestEntry.creditPaise > 0 ? "+" : ""}{formatMoney(latestEntry.creditPaise - latestEntry.debitPaise, latestEntry.currency || currency)}
                </p>
                <p className="text-xs font-semibold text-[#667085]">{formatDateTime(latestEntry.createdAt)}</p>
              </div>
              <SellerStatusPill status={latestEntry.entryType} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Ledger History ─── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#163B5C]" />
            <h2 className="text-lg font-black text-[#1F2933]">Ledger History</h2>
          </div>
          <span className="text-xs font-bold text-[#667085]">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {entries.length === 0 ? (
          <SellerEmptyState title="No wallet entries yet" message="Approved seller payouts and manual adjustments will appear here." />
        ) : (
          <div className="grid gap-3">
            {entries.map((entry, idx) => (
              <LedgerEntryRow
                key={entry.id}
                entry={entry}
                currency={currency}
                isFirst={idx === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type SellerLedgerEntryView = NonNullable<Awaited<ReturnType<typeof listSellerLedger>>["items"]>[number];

function sellerLedgerTitle(entry: SellerLedgerEntryView) {
  if (entry.entryType === "REFUND_ADJUSTMENT") {
    return "Refund adjustment debit";
  }
  return entry.description;
}

function sellerLedgerDescription(entry: SellerLedgerEntryView) {
  const orderNumber = entry.orderSellerSplit?.order?.orderNumber;
  const reference = orderNumber ?? entry.referenceId;

  if (entry.entryType === "REFUND_ADJUSTMENT") {
    return [
      entry.description,
      reference ? `Reference ${reference}` : null,
      entry.payout?.payoutNumber ? `Recovered after payout ${entry.payout.payoutNumber}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  return [formatDateTime(entry.createdAt), reference ? `Reference ${reference}` : null].filter(Boolean).join(" / ");
}

/* ─────────────────────────────────────────────────
   SUB-COMPONENTS
   ───────────────────────────────────────────────── */

function StatCard({
  accent,
  icon,
  label,
  trend,
  value,
}: {
  accent: "blue" | "green" | "red" | "amber";
  icon: React.ReactNode;
  label: string;
  trend: string | null;
  value: string;
}) {
  const accentStyles = {
    blue: { bg: "bg-[#EEF6FB]", text: "text-[#163B5C]", border: "border-l-[#175CD3]" },
    green: { bg: "bg-[#F0FDF6]", text: "text-[#0F8A5F]", border: "border-l-[#32B877]" },
    red: { bg: "bg-[#FFF8F8]", text: "text-[#B42318]", border: "border-l-[#F5B7B7]" },
    amber: { bg: "bg-[#FFF9EB]", text: "text-[#92400E]", border: "border-l-[#F59E0B]" },
  };
  const style = accentStyles[accent];

  return (
    <div className={`rounded-xl border border-[#D9E2EA] bg-white p-5 shadow-sm border-l-4 ${style.border}`}>
      <div className="flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${style.bg} ${style.text}`}>
          {icon}
        </div>
        <p className="text-xs font-bold text-[#667085]">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-black ${style.text}`}>{value}</p>
      {trend && <p className="mt-1 text-xs font-semibold text-[#667085]">{trend}</p>}
    </div>
  );
}

function LedgerEntryRow({
  entry,
  currency,
  isFirst,
}: {
  entry: SellerLedgerEntryView;
  currency: string;
  isFirst: boolean;
}) {
  const isCredit = entry.creditPaise > 0 && entry.debitPaise === 0;
  const isDebit = entry.debitPaise > 0 && entry.creditPaise === 0;

  return (
    <div
      className={`group rounded-xl border bg-white transition hover:shadow-md ${
        isFirst ? "border-[#175CD3]/20 shadow-sm" : "border-[#D9E2EA]"
      }`}
    >
      <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
        {/* Left: Icon + Info */}
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            isCredit ? "bg-[#F0FDF6] text-[#0F8A5F]" :
            isDebit ? "bg-[#FFF8F8] text-[#B42318]" :
            "bg-[#EAF1F7] text-[#163B5C]"
          }`}>
            {isCredit ? (
              <ArrowDownLeft className="h-5 w-5" />
            ) : isDebit ? (
              <ArrowUpRight className="h-5 w-5" />
            ) : (
              <WalletCards className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-[#1F2933]">{sellerLedgerTitle(entry)}</p>
              {isFirst && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-[#EEF6FB] text-[#175CD3]">
                  Latest
                </span>
              )}
              <SellerStatusPill status={entry.entryType} />
            </div>
            <p className="mt-0.5 text-xs font-semibold text-[#667085]">{sellerLedgerDescription(entry)}</p>
            <p className="mt-0.5 text-[11px] font-bold text-[#98A2B3]">{formatDateTime(entry.createdAt)}</p>
          </div>
        </div>

        {/* Right: Amounts */}
        <div className="text-left md:text-right pl-13 md:pl-0">
          <div className="flex items-center gap-2 md:justify-end">
            {entry.creditPaise > 0 && (
              <span className="inline-flex items-center rounded-md bg-[#F0FDF6] px-2 py-0.5 text-xs font-black text-[#0F8A5F]">
                +{formatMoney(entry.creditPaise, entry.currency || currency)}
              </span>
            )}
            {entry.debitPaise > 0 && (
              <span className="inline-flex items-center rounded-md bg-[#FFF8F8] px-2 py-0.5 text-xs font-black text-[#B42318]">
                -{formatMoney(entry.debitPaise, entry.currency || currency)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-[#667085]">
            Balance <span className="font-black text-[#163B5C]">{formatMoney(entry.balanceAfterPaise, entry.currency || currency)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
