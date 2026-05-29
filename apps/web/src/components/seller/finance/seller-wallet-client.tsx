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

  if (ledgerQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (ledgerQuery.error) {
    if (isSellerOnboardingRequiredError(ledgerQuery.error)) {
      return <SellerOnboardingRequired message="Complete seller onboarding before viewing wallet and ledger entries." />;
    }

    return <SellerErrorPanel error={ledgerQuery.error} onRetry={() => void ledgerQuery.refetch()} />;
  }

  const entries = ledgerQuery.data?.items ?? [];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SellerMetric label="Wallet balance" value={formatMoney(ledgerQuery.data?.balancePaise ?? 0)} note="Credits minus payouts and deductions" />
        <SellerMetric label="Available payout" value={formatMoney(availabilityQuery.data?.netPayablePaise ?? 0)} note={`${availabilityQuery.data?.eligibleSplitCount ?? 0} eligible order splits`} />
        <SellerMetric label="Latest movement" value={entries[0]?.entryType ?? "None"} note="Most recent transaction" />
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
                    <p className="font-black text-[#1F2933]">{entry.description}</p>
                    <SellerStatusPill status={entry.entryType} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">{formatDateTime(entry.createdAt)}</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="font-black text-[#163B5C]">
                  +{formatMoney(entry.creditPaise)} / -{formatMoney(entry.debitPaise)}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">Balance {formatMoney(entry.balanceAfterPaise)}</p>
              </div>
            </div>
          </SellerPanel>
        ))}
      </div>
      {entries.length === 0 ? <SellerEmptyState title="No wallet entries yet" message="Approved seller payouts and manual adjustments will appear here." /> : null}
    </div>
  );
}
