"use client";

import { FormEvent, useMemo, useState } from "react";
import { RefreshCw, Search, WalletCards } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  listSellerCashReceivables,
  settleSellerCashReceivable,
  waiveSellerCashReceivable,
  type SellerCashReceivable,
} from "@/lib/admin-finance-api";
import { formatMoney } from "@/lib/storefront-api";

export function SellerCashReceivablesClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const query = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status } : {}),
      limit: 40,
    }),
    [search, status],
  );

  const receivablesQuery = useQuery({
    queryKey: ["finance-seller-cash-receivables", auth.authHeaders, query],
    queryFn: () => listSellerCashReceivables(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
  });
  const action = useMutation({
    mutationFn: ({ receivable, form, type }: { receivable: SellerCashReceivable; form: FormData; type: "settle" | "waive" }) => {
      const amountValue = String(form.get("amountPaise") ?? "").trim();
      const note = String(form.get("note") ?? "").trim();
      const payload = {
        ...(amountValue ? { amountPaise: Number(amountValue) } : {}),
        ...(note ? { note } : {}),
      };
      return type === "settle"
        ? settleSellerCashReceivable(auth.authHeaders, receivable.receivableNumber, payload)
        : waiveSellerCashReceivable(auth.authHeaders, receivable.receivableNumber, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-seller-cash-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-payment-reports"] }),
      ]);
    },
  });

  const receivables = receivablesQuery.data?.items ?? [];
  const outstandingByCurrency = formatCurrencyTotals(receivables, (item) => item.outstandingPaise);
  const openCount = receivables.filter((item) => ["OPEN", "PARTIALLY_OFFSET", "OFFSET_SCHEDULED"].includes(item.status)).length;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Outstanding platform due" value={outstandingByCurrency} />
        <MetricCard label="Open seller COD records" value={openCount.toString()} />
        <MetricCard label="Records loaded" value={receivables.length.toString()} />
      </section>

      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receivable, order, or seller"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="PARTIALLY_OFFSET">Partially offset</option>
            <option value="OFFSET_SCHEDULED">Offset scheduled</option>
            <option value="SETTLED">Settled</option>
            <option value="WAIVED">Waived</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button type="button" variant="outline" onClick={() => void receivablesQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </section>

      {receivablesQuery.isLoading ? <div className="h-40 animate-pulse rounded-lg bg-[#F8FAFC]" /> : null}
      {receivablesQuery.error ? <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{String(receivablesQuery.error)}</p> : null}

      <section className="space-y-3">
        {receivables.map((receivable) => (
          <ReceivableCard
            key={receivable.id}
            receivable={receivable}
            pending={action.isPending}
            onSubmit={(event, type) => {
              event.preventDefault();
              action.mutate({ receivable, form: new FormData(event.currentTarget), type });
            }}
          />
        ))}
      </section>

      {!receivablesQuery.isLoading && receivables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D8E2EA] bg-white p-8 text-center">
          <p className="font-black text-[#1F2933]">No seller-collected COD dues</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Store pickup and manual transport COD receivables will appear here.</p>
        </div>
      ) : null}
    </div>
  );
}

function ReceivableCard({
  receivable,
  pending,
  onSubmit,
}: {
  receivable: SellerCashReceivable;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>, type: "settle" | "waive") => void;
}) {
  const closed = ["SETTLED", "WAIVED", "CANCELLED"].includes(receivable.status);
  const payoutLocked = receivable.status === "OFFSET_SCHEDULED" || Boolean(receivable.payoutOffsetId);
  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <WalletCards className="h-5 w-5 text-[#ED3500]" aria-hidden="true" />
            <p className="font-black text-[#1F2933]">{receivable.receivableNumber}</p>
            <StatusBadge>{receivable.status.replaceAll("_", " ")}</StatusBadge>
          </div>
          <p className="text-sm font-semibold text-[#667085]">
            {receivable.seller?.storeName ?? "Seller"} / {receivable.order?.orderNumber ?? "Order"} / {receivable.source.replaceAll("_", " ")}
          </p>
          <div className="grid gap-2 text-sm font-bold text-[#1F2933] sm:grid-cols-4">
            <span>Cash kept {formatMoney(receivable.grossCashCollectedPaise, receivable.currency)}</span>
            <span>Platform due {formatMoney(receivable.platformDuePaise, receivable.currency)}</span>
            <span>Offset {formatMoney(receivable.offsetPaise, receivable.currency)}</span>
            <span>Outstanding {formatMoney(receivable.outstandingPaise, receivable.currency)}</span>
          </div>
          <ManualTransportReceivableMeta receivable={receivable} />
        </div>
        {payoutLocked ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            Linked to payout {receivable.payoutOffset?.payoutNumber ?? ""}. Settle or waive after the payout is complete.
          </div>
        ) : !closed ? (
          <div className="grid gap-2">
            <ReceivableActionForm label="Settle" pending={pending} onSubmit={(event) => onSubmit(event, "settle")} />
            <ReceivableActionForm label="Waive" pending={pending} onSubmit={(event) => onSubmit(event, "waive")} noteRequired />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ManualTransportReceivableMeta({ receivable }: { receivable: SellerCashReceivable }) {
  if (receivable.orderShipment?.deliveryMode !== "MANUAL_TRANSPORT") {
    return null;
  }

  const snapshot =
    readManualTransportSnapshot(receivable.orderShipment.routingSnapshot) ??
    readManualTransportSnapshot(receivable.orderShipment.shippingChargeSnapshot);

  if (!snapshot) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
        Manual transport pricing snapshot is missing for this shipment.
      </p>
    );
  }

  const sellerCurrency = snapshot.sellerCurrency ?? receivable.currency;
  const baseCurrency = snapshot.baseCurrency ?? receivable.currency;

  return (
    <div className="grid gap-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-xs font-bold text-[#667085] sm:grid-cols-3">
      <span>
        Distance {typeof snapshot.distanceKm === "number" ? `${snapshot.distanceKm.toFixed(2)} km` : "not saved"}
      </span>
      <span>
        Seller charge {formatMoney(snapshot.sellerChargeMinor ?? 0, sellerCurrency)}
      </span>
      <span>
        Checkout shipping {formatMoney(snapshot.baseChargeMinor ?? receivable.orderShipment?.shippingPaise ?? 0, baseCurrency)}
      </span>
      {snapshot.fxRate ? <span>FX 1 {baseCurrency} = {snapshot.fxRate} {sellerCurrency}</span> : null}
      {snapshot.note ? <span className="sm:col-span-3">Note: {snapshot.note}</span> : null}
    </div>
  );
}

function ReceivableActionForm({
  label,
  noteRequired,
  pending,
  onSubmit,
}: {
  label: string;
  noteRequired?: boolean;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-2 sm:grid-cols-[130px_180px_auto]" onSubmit={onSubmit}>
      <input name="amountPaise" type="number" min={1} placeholder="Paise" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]" />
      <input name="note" required={noteRequired} placeholder="Finance note" className="h-10 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]" />
      <Button type="submit" variant={label === "Waive" ? "outline" : "primary"} disabled={pending}>{label}</Button>
    </form>
  );
}

type ManualTransportSnapshot = {
  distanceKm?: number | null;
  sellerChargeMinor?: number | null;
  sellerCurrency?: string | null;
  baseChargeMinor?: number | null;
  baseCurrency?: string | null;
  fxRate?: number | null;
  note?: string | null;
};

function readManualTransportSnapshot(value: unknown): ManualTransportSnapshot | null {
  const root = recordValue(value);
  const manualTransport = recordValue(root?.manualTransport);
  if (!manualTransport) {
    return null;
  }

  return {
    distanceKm: finiteNumber(manualTransport.distanceKm),
    sellerChargeMinor: finiteNumber(manualTransport.sellerChargeMinor),
    sellerCurrency: stringValue(manualTransport.sellerCurrency),
    baseChargeMinor: finiteNumber(manualTransport.baseChargeMinor),
    baseCurrency: stringValue(manualTransport.baseCurrency),
    fxRate: finiteNumber(manualTransport.fxRate),
    note: stringValue(manualTransport.note),
  };
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatCurrencyTotals(
  receivables: SellerCashReceivable[],
  amount: (receivable: SellerCashReceivable) => number,
) {
  const totals = receivables.reduce<Record<string, number>>((current, receivable) => {
    const currency = receivable.currency || "INR";
    current[currency] = (current[currency] ?? 0) + amount(receivable);
    return current;
  }, {});
  const lines = Object.entries(totals).map(([currency, total]) => formatMoney(total, currency));
  return lines.length ? lines.join(" / ") : formatMoney(0);
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#1F2933]">{value}</p>
    </div>
  );
}
