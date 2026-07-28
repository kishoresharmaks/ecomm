"use client";

import { WalletCards } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerPayoutAvailability, listSellerLedger } from "@/lib/seller-finance-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerMetric,
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
      return <SellerOnboardingRequired message="Complete seller onboarding before viewing wallet and ledger entries." />;
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
  const sellerCashDuePaise = availabilityQuery.data?.sellerCashReceivableOutstandingPaise ?? 0;
  const sellerCashOffsetPaise = availabilityQuery.data?.sellerCashReceivableOffsetPaise ?? 0;
  const latestEntry = entries[0] ?? null;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SellerMetric
          label="Earned available balance"
          value={formatMoney(availabilityQuery.data?.netPayablePaise ?? 0, currency)}
          note={`${(availabilityQuery.data?.eligibleSplitCount ?? 0) + (availabilityQuery.data?.eligibleB2BOrderCount ?? 0) + (availabilityQuery.data?.eligibleServiceSettlementCount ?? 0)} eligible order and service records`}
        />
        <SellerMetric label="Settled ledger balance" value={formatMoney(ledgerQuery.data?.balancePaise ?? 0, currency)} note="Updates after payout approval, payout payment, or adjustments" />
        <SellerMetric label="Platform due" value={formatMoney(sellerCashDuePaise, currency)} note={sellerCashOffsetPaise > 0 ? `${formatMoney(sellerCashOffsetPaise, currency)} will be deducted next` : sellerCashDuePaise > 0 ? "Seller-collected COD balance" : "No seller-collected COD due"} />
        <SellerMetric label="Latest movement" value={latestEntry ? sellerLedgerTitle(latestEntry) : "None"} note={latestEntry ? formatDateTime(latestEntry.createdAt) : "No wallet transactions yet"} />
      </div>

      <SellerPanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black text-[#1F2933]">Manual payout request</p>
            <p className="mt-1 text-sm font-semibold text-[#667085]">Use payouts to request the currently eligible delivered and paid order amount.</p>
          </div>
          <Button asChild>
            <Link href="/seller/finance/payouts">Open payouts</Link>
          </Button>
        </div>
      </SellerPanel>

      <div className="grid gap-3">
        {entries.map((entry) => (
          <SellerPanel key={entry.id}>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <WalletCards className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[#1F2933]">{sellerLedgerTitle(entry)}</p>
                    <SellerStatusPill status={entry.entryType} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">{sellerLedgerDescription(entry)}</p>
                  <p className="mt-1 text-xs font-bold text-[#98A2B3]">{formatDateTime(entry.createdAt)}</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="font-black text-[#163B5C]">
                  +{formatMoney(entry.creditPaise, entry.currency || currency)} / -{formatMoney(entry.debitPaise, entry.currency || currency)}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">Balance {formatMoney(entry.balanceAfterPaise, entry.currency || currency)}</p>
              </div>
            </div>
          </SellerPanel>
        ))}
      </div>
      {entries.length === 0 ? <SellerEmptyState title="No wallet entries yet" message="Approved seller payouts and manual adjustments will appear here." /> : null}
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
