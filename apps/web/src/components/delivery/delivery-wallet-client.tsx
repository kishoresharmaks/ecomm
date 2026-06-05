"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, PackageCheck, Send, Wallet } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, type StatusTone } from "@indihub/ui";
import {
  getDeliveryWallet,
  requestDeliveryWalletPayout,
  type DeliveryPartnerPayout,
  type DeliveryPartnerWalletEntry,
} from "@/lib/delivery-api";
import {
  DeliveryEmptyState,
  DeliveryError,
  DeliveryIconTile,
  DeliveryMetric,
  DeliveryPanel,
  formatDateTime,
  formatPaise,
  humanize,
  useDeliveryAuth,
} from "./delivery-ui";

export function DeliveryWalletClient() {
  const auth = useDeliveryAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const walletQuery = useQuery({
    queryKey: ["delivery-wallet", auth.authKey, "wallet"],
    queryFn: () => getDeliveryWallet(auth.authHeaders, { limit: 50 }),
    enabled: auth.enabled,
    retry: false,
  });
  const requestPayout = useMutation({
    mutationFn: () => requestDeliveryWalletPayout(auth.authHeaders, { note }),
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["delivery-wallet"] });
    },
  });

  if (!auth.enabled) {
    return null;
  }

  const wallet = walletQuery.data;
  const summary = wallet?.summary;
  const payouts = wallet?.payouts ?? [];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DeliveryMetric
          label="Available balance"
          value={formatPaise(summary?.availableBalancePaise ?? 0, summary?.currency ?? "INR")}
          note="Local delivery earnings minus payouts"
        />
        <DeliveryMetric
          label="Total earned"
          value={formatPaise(summary?.totalEarnedPaise ?? 0, summary?.currency ?? "INR")}
          note="Credited from delivered local shipments"
        />
        <DeliveryMetric
          label="Local deliveries"
          value={summary?.localDeliveryCount ?? 0}
          note="Delivered and credited shipments"
        />
        <DeliveryMetric
          label="Pending payout"
          value={formatPaise(summary?.pendingPayoutPaise ?? 0, summary?.currency ?? "INR")}
          note="Requested or approved amount"
        />
        <DeliveryMetric
          label="Paid or adjusted"
          value={formatPaise(summary?.totalDebitedPaise ?? 0, summary?.currency ?? "INR")}
          note="Manual payouts and debit adjustments"
        />
      </div>

      <DeliveryPanel>
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
          <div>
            <SectionHeading
              title="Manual payout request"
              description="Request payout from the available wallet balance after it reaches the admin-set threshold."
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <DeliveryMetric
                label="Threshold"
                value={formatPaise(summary?.minimumPayoutPaise ?? 0, summary?.currency ?? "INR")}
                note="Configured by admin"
              />
              <DeliveryMetric
                label="Request status"
                value={summary?.payoutRequestsEnabled ? "Enabled" : "Disabled"}
                note={summary?.canRequestPayout ? "Eligible now" : "Not eligible yet"}
              />
              <DeliveryMetric
                label="Active requests"
                value={summary?.activePayoutRequestCount ?? 0}
                note="Requested or approved"
              />
            </div>
            {requestPayout.error ? (
              <DeliveryError error={requestPayout.error} onRetry={() => requestPayout.reset()} />
            ) : null}
            {requestPayout.isSuccess ? (
              <p className="mt-4 rounded-md border border-[#BFEAD9] bg-[#E9F7F1] p-3 text-sm font-semibold text-[#064C35]">
                Payout request sent to finance.
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <label className="space-y-2">
              <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">Note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
                placeholder="Optional payout note"
              />
            </label>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => requestPayout.mutate()}
              disabled={!summary?.canRequestPayout || requestPayout.isPending}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {requestPayout.isPending ? "Requesting" : "Request payout"}
            </Button>
          </div>
        </div>
      </DeliveryPanel>

      {payouts.length ? (
        <DeliveryPanel>
          <SectionHeading title="Recent payout requests" description="Finance approves, rejects, or marks these manual payouts as paid." />
          <div className="mt-5 grid gap-3">
            {payouts.map((payout) => (
              <PayoutRow key={payout.id} payout={payout} />
            ))}
          </div>
        </DeliveryPanel>
      ) : null}

      <DeliveryPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            title="Earnings ledger"
            description="Credits are created only for local delivery partner shipments after delivery is completed."
          />
          <StatusBadge tone="info">Third-party courier excluded</StatusBadge>
        </div>

        <div className="mt-5 grid gap-3">
          {walletQuery.isLoading ? <div className="h-56 animate-pulse rounded-md bg-[#F8FAFC]" /> : null}
          {walletQuery.error ? <DeliveryError error={walletQuery.error} onRetry={() => void walletQuery.refetch()} /> : null}
          {!walletQuery.isLoading && wallet?.items.length === 0 ? (
            <DeliveryEmptyState
              title="No wallet entries yet"
              message="Local delivery earnings appear here after an assigned local shipment is marked delivered."
            />
          ) : null}
          {wallet?.items.map((entry) => (
            <WalletEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      </DeliveryPanel>
    </div>
  );
}

function PayoutRow({ payout }: { payout: DeliveryPartnerPayout }) {
  return (
    <div className="grid gap-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-[#123A5A]">{payout.payoutNumber}</p>
          <StatusBadge tone={payoutTone(payout.status)}>{humanize(payout.status)}</StatusBadge>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#667085]">
          {formatDateTime(payout.createdAt ?? payout.requestedAt ?? "")}
        </p>
        {payout.transactionReference ? (
          <p className="mt-1 text-xs font-black uppercase tracking-wide text-[#667085]">
            {payout.paymentMode ?? "Payment"} / {payout.transactionReference}
          </p>
        ) : null}
      </div>
      <p className="text-lg font-black text-[#123A5A]">{formatPaise(payout.amountPaise, payout.currency)}</p>
    </div>
  );
}

function payoutTone(status: DeliveryPartnerPayout["status"]): StatusTone {
  if (status === "PAID") {
    return "success";
  }
  if (status === "REJECTED") {
    return "danger";
  }
  if (status === "APPROVED") {
    return "info";
  }
  return "warning";
}

function WalletEntryRow({ entry }: { entry: DeliveryPartnerWalletEntry }) {
  const isCredit = entry.direction === "CREDIT";
  const tone: StatusTone = isCredit ? "success" : "warning";

  return (
    <div className="grid gap-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <DeliveryIconTile>
          {isCredit ? <ArrowDownLeft className="h-5 w-5" aria-hidden="true" /> : <ArrowUpRight className="h-5 w-5" aria-hidden="true" />}
        </DeliveryIconTile>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black text-[#123A5A]">{entry.description ?? humanize(entry.entryType)}</p>
            <StatusBadge tone={tone}>{humanize(entry.direction)}</StatusBadge>
            <StatusBadge tone="info">{humanize(entry.entryType)}</StatusBadge>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{formatDateTime(entry.createdAt)}</p>
          <p className="mt-1 truncate text-sm font-semibold text-[#667085]">
            {entry.order?.orderNumber ?? "Manual entry"} {entry.shipment?.shipmentNumber ? `/ ${entry.shipment.shipmentNumber}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <span className="inline-flex items-center gap-2 text-lg font-black text-[#123A5A]">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          {isCredit ? "+" : "-"}
          {formatPaise(entry.amountPaise, entry.currency)}
        </span>
        {entry.order?.orderNumber ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/delivery/orders/${entry.order.orderNumber}`}>
              Order <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#536579]">
            <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Manual
          </span>
        )}
      </div>
    </div>
  );
}
