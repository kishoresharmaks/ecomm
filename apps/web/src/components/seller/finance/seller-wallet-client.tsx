"use client";

import { useState } from "react";
import {
  WalletCards,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Wallet,
  Receipt,
  Eye,
  X,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import {
  getSellerPayoutAvailability,
  listSellerLedger,
  getSellerCashReceivable,
} from "@/lib/seller-finance-api";
import type { SellerCashReceivableDetail } from "@/lib/seller-finance-api";
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
  useSellerAuth,
} from "../seller-ui";

type LedgerEntryView = NonNullable<Awaited<ReturnType<typeof listSellerLedger>>["items"]>[number];

/* ─────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────── */

interface LedgerRowProps {
  entry: LedgerEntryView;
  currency: string;
  isFirst: boolean;
  onViewReceivable?: (() => void) | undefined;
}

/* ─────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────── */

export function SellerWalletClient() {
  const sellerAuth = useSellerAuth();
  const ledgerQuery = useQuery({
    queryKey: ["seller-finance-ledger", sellerAuth.authKey],
    queryFn: () => listSellerLedger(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });
  const availabilityQuery = useQuery({
    queryKey: ["seller-payout-availability", sellerAuth.authKey],
    queryFn: () => getSellerPayoutAvailability(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const [selectedReceivableNumber, setSelectedReceivableNumber] = useState<string | null>(null);

  if (!sellerAuth.enabled) return <SellerAuthNotice />;
  if (ledgerQuery.isLoading || availabilityQuery.isLoading) return <SellerSkeleton />;

  const pageError = ledgerQuery.error ?? availabilityQuery.error;
  if (pageError) {
    if (isSellerOnboardingRequiredError(pageError)) {
      return <SellerOnboardingRequired message="Complete seller onboarding before viewing wallet and ledger entries." />;
    }
    return <SellerErrorPanel error={pageError} onRetry={() => { void ledgerQuery.refetch(); void availabilityQuery.refetch(); }} />;
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
          <p className="mt-2 text-4xl font-black text-white md:text-5xl">{formatMoney(netPayablePaise, currency)}</p>
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
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Settled Balance" value={formatMoney(ledgerBalancePaise, currency)} trend={null} accent="blue" />
        <StatCard icon={<ArrowDownLeft className="h-5 w-5" />} label="Total Credits" value={formatMoney(totalCredits, currency)} trend={null} accent="green" />
        <StatCard icon={<ArrowUpRight className="h-5 w-5" />} label="Total Debits" value={formatMoney(totalDebits, currency)} trend={null} accent="red" />
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
              <p className="text-sm font-semibold text-[#667085]">Request payout for eligible delivered and paid orders.</p>
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
              <p className="text-lg font-black text-[#1F2933]">{latestMovementTitle(latestEntry)}</p>
              <p className="text-sm font-semibold text-[#667085]">{latestMovementDescription(latestEntry)}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-left sm:text-right">
                <p className={`text-lg font-black ${latestEntry.creditPaise > 0 ? "text-[#0F8A5F]" : "text-[#ED3500]"}`}>
                  {latestEntry.creditPaise > 0 ? "+" : ""}
                  {formatMoney(latestEntry.creditPaise - latestEntry.debitPaise, latestEntry.currency || currency)}
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
            {entries.map((entry, idx) => {
              const receivableNumber = entry.sellerCashReceivable?.receivableNumber;
              return (
                <LedgerEntryRow
                  key={entry.id}
                  entry={entry}
                  currency={currency}
                  isFirst={idx === 0}
                  onViewReceivable={
                    receivableNumber ? () => setSelectedReceivableNumber(receivableNumber) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Receivable Detail Modal ─── */}
      {selectedReceivableNumber && (
        <ReceivableDetailModal
          receivableNumber={selectedReceivableNumber}
          currency={currency}
          onClose={() => setSelectedReceivableNumber(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   LEDGER ENTRY ROW
   ───────────────────────────────────────────────── */

function LedgerEntryRow({ entry, currency, isFirst, onViewReceivable }: LedgerRowProps) {
  const amount = entry.creditPaise - entry.debitPaise;
  const isCredit = amount >= 0;
  const receivableNumber = entry.sellerCashReceivable?.receivableNumber;

  return (
    <div className={`rounded-xl border ${isFirst ? "border-[#163B5C]/10 bg-[#F0F8FF]" : "border-[#D9E2EA] bg-white"} p-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0EC] text-[#ED3500]">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-[#1F2933]">{entry.description}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#667085]">
              <span>{formatDateTime(entry.createdAt)}</span>
              {entry.orderSellerSplit?.order?.orderNumber && (
                <>
                  <span className="hidden sm:inline">/</span>
                  <span>Order {entry.orderSellerSplit.order.orderNumber}</span>
                </>
              )}
              {entry.payout?.payoutNumber && (
                <>
                  <span className="hidden sm:inline">/</span>
                  <span>Payout {entry.payout.payoutNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amounts + View button */}
        <div className="flex items-center gap-2 md:justify-end">
          <div className="text-left md:text-right">
            <p className={`text-sm font-black ${isCredit ? "text-[#0F8A5F]" : "text-[#ED3500]"}`}>
              {isCredit ? "+" : ""}{formatMoney(amount, entry.currency || currency)}
            </p>
            <div className="mt-0.5 flex items-center gap-2 md:justify-end">
              {entry.creditPaise > 0 && (
                <span className="text-[10px] font-bold text-[#0F8A5F] bg-[#F0FDF6] rounded px-1">+{formatMoney(entry.creditPaise, currency)}</span>
              )}
              {entry.debitPaise > 0 && (
                <span className="text-[10px] font-bold text-[#B42318] bg-[#FFF8F8] rounded px-1">-{formatMoney(entry.debitPaise, currency)}</span>
              )}
            </div>
          </div>

          {onViewReceivable && (
            <button
              onClick={onViewReceivable}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#D9E2EA] text-[#163B5C] hover:border-[#163B5C] hover:bg-[#EEF6FB] transition"
              title={`View ${receivableNumber}`}
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   RECEIVABLE DETAIL MODAL
   ───────────────────────────────────────────────── */

function ReceivableDetailModal({
  receivableNumber,
  currency,
  onClose,
}: {
  receivableNumber: string;
  currency: string;
  onClose: () => void;
}) {
  const sellerAuth = useSellerAuth();
  const { data: receivable, isLoading } = useQuery({
    queryKey: ["seller-cash-receivable-detail", sellerAuth.authKey, receivableNumber],
    queryFn: () => getSellerCashReceivable(sellerAuth.authHeaders, receivableNumber),
    enabled: !!receivableNumber && sellerAuth.enabled,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          <div className="p-6">
            <SellerSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!receivable) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 text-center">
          <p className="text-sm font-semibold text-[#667085]">Unable to load receivable details.</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </div>
    );
  }

  const r = receivable;

  const deductionLines: Array<{ label: string; amountPaise: number }> = [];
  if (r.commissionPaise > 0) deductionLines.push({ label: "Commission", amountPaise: r.commissionPaise });
  if (r.gstOnCommissionPaise > 0) deductionLines.push({ label: "GST on commission", amountPaise: r.gstOnCommissionPaise });
  if (r.tdsPaise > 0) deductionLines.push({ label: "TDS", amountPaise: r.tdsPaise });
  if (r.tcsPaise > 0) deductionLines.push({ label: "TCS", amountPaise: r.tcsPaise });
  if (r.sellerPlatformFeePaise > 0) deductionLines.push({ label: "Platform fee", amountPaise: r.sellerPlatformFeePaise });
  if (r.buyerPlatformFeePaise > 0) deductionLines.push({ label: "Buyer platform fee", amountPaise: r.buyerPlatformFeePaise });

  const sourceLabel: Record<string, string> = {
    STORE_PICKUP_COD: "Store Pickup COD",
    MANUAL_TRANSPORT_COD: "Manual Transport COD",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D9E2EA] bg-white px-6 py-4">
          <div>
            <h3 className="text-base font-black text-[#1F2933]">Cash Receivable Detail</h3>
            <p className="text-xs font-semibold text-[#667085]">{r.receivableNumber}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100 transition">
            <X className="h-4 w-4 text-[#667085]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Info */}
          <section>
            <p className="text-xs font-black uppercase tracking-widest text-[#667085] mb-3">Order Details</p>
            <div className="grid gap-2 rounded-xl border border-[#D9E2EA] bg-[#F8FAFC] p-4">
              <DetailRow label="Order" value={r.order?.orderNumber ?? "—"} />
              <DetailRow label="Shipment" value={r.orderShipment?.shipmentNumber ?? "—"} />
              <DetailRow label="Source" value={sourceLabel[r.source] ?? r.source} />
              <DetailRow label="Delivery Status" value={humanize(r.orderShipment?.status)} status={r.orderShipment?.status} />
            </div>
          </section>

          {/* Payment Info */}
          <section>
            <p className="text-xs font-black uppercase tracking-widest text-[#667085] mb-3">Payment</p>
            <div className="grid gap-2 rounded-xl border border-[#D9E2EA] bg-[#F8FAFC] p-4">
              <DetailRow
                label="Method"
                value={`${r.payment?.provider ?? "—"}${r.payment?.method ? ` · ${r.payment.method}` : ""}`}
              />
              <DetailRow label="COD Amount" value={formatMoney(r.payment?.amountPaise ?? 0, currency)} />
              <DetailRow label="Payment Status" value={humanize(r.payment?.status)} status={r.payment?.status} />
              <DetailRow label="Cash Collected" value={formatMoney(r.grossCashCollectedPaise, currency)} />
            </div>
          </section>

          {/* Platform Due Breakdown */}
          <section>
            <p className="text-xs font-black uppercase tracking-widest text-[#667085] mb-3">Platform Due Breakdown</p>
            <div className="rounded-xl border border-[#ED3500]/20 bg-[#FFF8F6] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#ED3500]/10 px-4 py-2 bg-[#FFF0EC]">
                <p className="text-xs font-bold text-[#92400E]">Deduction Type</p>
                <p className="text-xs font-bold text-[#92400E]">Amount</p>
              </div>

              {deductionLines.map((line) => (
                <div key={line.label} className="flex items-center justify-between border-b border-[#ED3500]/5 last:border-b-0 px-4 py-2.5">
                  <p className="text-sm font-semibold text-[#1F2933]">{line.label}</p>
                  <p className="text-sm font-black text-[#ED3500]">-{formatMoney(line.amountPaise, currency)}</p>
                </div>
              ))}

              <div className="flex items-center justify-between bg-[#FFF0EC] px-4 py-3">
                <p className="text-sm font-black text-[#1F2933]">Total Platform Due</p>
                <p className="text-base font-black text-[#ED3500]">{formatMoney(r.platformDuePaise, currency)}</p>
              </div>
            </div>
          </section>

          {/* Settlement Status */}
          <section>
            <p className="text-xs font-black uppercase tracking-widest text-[#667085] mb-3">Settlement</p>
            <div className="grid gap-2 rounded-xl border border-[#D9E2EA] bg-[#F8FAFC] p-4">
              <DetailRow label="Status" value={humanize(r.status)} status={r.status} />
              <DetailRow label="Outstanding" value={formatMoney(r.outstandingPaise, currency)} />
              <DetailRow label="Settled" value={formatMoney(r.settledPaise, currency)} />
              <DetailRow label="Waived" value={formatMoney(r.waivedPaise, currency)} />
              <DetailRow label="Offset" value={formatMoney(r.offsetPaise, currency)} />
              {r.payoutOffset && <DetailRow label="Linked Payout" value={r.payoutOffset.payoutNumber} />}
            </div>
          </section>

          {/* Events */}
          {r.events && r.events.length > 0 && (
            <section>
              <p className="text-xs font-black uppercase tracking-widest text-[#667085] mb-3">Events</p>
              <div className="rounded-xl border border-[#D9E2EA] overflow-hidden">
                {r.events.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between border-b border-[#D9E2EA] last:border-b-0 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-[#1F2933]">{humanize(evt.eventType)}</p>
                      <p className="text-xs text-[#667085]">{formatDateTime(evt.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      {evt.amountDeltaPaise !== 0 ? (
                        <p className={`text-sm font-black ${evt.amountDeltaPaise > 0 ? "text-[#B42318]" : "text-[#0F8A5F]"}`}>
                          {evt.amountDeltaPaise > 0 ? "-" : "+"}{formatMoney(Math.abs(evt.amountDeltaPaise), currency)}
                        </p>
                      ) : (
                        <p className="text-xs text-[#667085]">--</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   STAT CARD
   ───────────────────────────────────────────────── */

function StatCard({ accent, icon, label, trend, value }: { accent: "blue" | "green" | "red" | "amber"; icon: React.ReactNode; label: string; trend: string | null; value: string }) {
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
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${style.bg} ${style.text}`}>{icon}</div>
        <p className="text-xs font-bold text-[#667085]">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-black ${style.text}`}>{value}</p>
      {trend && <p className="mt-1 text-xs font-semibold text-[#667085]">{trend}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────── */

function humanize(value?: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status?: string | null): "success" | "warning" | "danger" | "info" {
  if (["ACTIVE", "APPROVED", "COMPLETED", "VERIFIED", "PAID", "SETTLED"].includes(status ?? "")) return "success";
  if (["PENDING", "PENDING_APPROVAL", "SUBMITTED", "OFFSET_SCHEDULED", "OPEN"].includes(status ?? "")) return "warning";
  if (["REJECTED", "SUSPENDED", "CANCELLED", "FAILED"].includes(status ?? "")) return "danger";
  return "info";
}

function DetailRow({ label, value, status }: { label: string; value: string; status?: string | null }) {
  const tone = status ? statusTone(status) : undefined;
  const toneColors: Record<string, string> = {
    success: "text-[#0F8A5F] bg-[#F0FDF6]",
    warning: "text-[#92400E] bg-[#FFF9EB]",
    danger: "text-[#B42318] bg-[#FFF8F8]",
    info: "text-[#163B5C] bg-[#EEF6FB]",
  };

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      {tone ? (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-black ${toneColors[tone]}`}>{value}</span>
      ) : (
        <p className="text-sm font-black text-[#1F2933]">{value}</p>
      )}
    </div>
  );
}

function latestMovementTitle(entry: LedgerEntryView) {
  if (entry.entryType === "REFUND_ADJUSTMENT") return "Refund adjustment debit";
  return entry.description;
}

function latestMovementDescription(entry: LedgerEntryView) {
  const orderNumber = entry.orderSellerSplit?.order?.orderNumber;
  const reference = orderNumber ?? entry.referenceId;

  if (entry.entryType === "REFUND_ADJUSTMENT") {
    return [entry.description, reference ? `Reference ${reference}` : null, entry.payout?.payoutNumber ? `Recovered after payout ${entry.payout.payoutNumber}` : null]
      .filter(Boolean)
      .join(" / ");
  }

  return [formatDateTime(entry.createdAt), reference ? `Reference ${reference}` : null].filter(Boolean).join(" / ");
}
