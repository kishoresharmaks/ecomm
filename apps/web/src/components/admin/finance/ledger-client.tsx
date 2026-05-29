"use client";

import { FormEvent, useMemo, useState } from "react";
import { PlusCircle, WalletCards } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminListbox, type AdminSelectOption } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";
import { addManualLedgerAdjustment, listAdminLedger, type FinanceSeller, type PageResult } from "@/lib/admin-finance-api";
import { formatMoney } from "@/lib/storefront-api";
import { FinanceMetric, FinancePageHeader, FinancePanel, FinanceState, FinanceStatus } from "./finance-ui";

export function AdminSellerLedgerClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [sellerId, setSellerId] = useState("");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amountPaise, setAmountPaise] = useState("");
  const [description, setDescription] = useState("");
  const sellersQuery = useQuery({
    queryKey: ["admin-finance-ledger-sellers", auth.authHeaders],
    queryFn: () => indihubFetch<PageResult<FinanceSeller>>("/api/admin/sellers?limit=100", undefined, auth.authHeaders),
    enabled: auth.isAuthenticated
  });
  const ledgerQuery = useQuery({
    queryKey: ["admin-finance-ledger", auth.authHeaders, sellerId],
    queryFn: () => listAdminLedger(auth.authHeaders, { sellerId }),
    enabled: auth.isAuthenticated && Boolean(sellerId)
  });
  const adjustment = useMutation({
    mutationFn: () =>
      addManualLedgerAdjustment(auth.authHeaders, {
        sellerId,
        direction,
        amountPaise: Number(amountPaise),
        description
      }),
    onSuccess: async () => {
      setAmountPaise("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["admin-finance-ledger"] });
    }
  });

  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    adjustment.mutate();
  }

  const sellerOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Select seller" },
      ...(sellersQuery.data?.items ?? []).map((seller) => ({ value: seller.id, label: seller.storeName }))
    ],
    [sellersQuery.data?.items]
  );
  const directionOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "CREDIT", label: "Credit" },
      { value: "DEBIT", label: "Debit" }
    ],
    []
  );

  return (
    <div className="grid gap-5">
      <FinancePageHeader title="Seller ledger" description="Review append-only seller wallet entries and add audited manual adjustments." />
      <FinancePanel>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <AdminListbox label="Seller" value={sellerId} options={sellerOptions} onChange={setSellerId} />
          <Button type="button" variant="outline" onClick={() => void ledgerQuery.refetch()} disabled={!sellerId}>
            Refresh
          </Button>
        </div>
      </FinancePanel>

      {sellerId ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FinanceMetric label="Ledger balance" value={formatMoney(ledgerQuery.data?.balancePaise ?? 0)} note="Credits minus debits" />
            <FinanceMetric label="Entries" value={ledgerQuery.data?.total ?? 0} note="For selected seller" />
            <FinanceMetric label="Latest entry" value={ledgerQuery.data?.items[0]?.entryType ?? "None"} note="Most recent ledger movement" />
          </div>

          <FinancePanel>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading title="Manual adjustment" description="Use only for audited corrections. This does not edit old ledger rows." />
            </div>
            <form onSubmit={submitAdjustment} className="mt-5 grid gap-3 lg:grid-cols-[160px_160px_1fr_auto] lg:items-end">
              <AdminListbox
                label="Direction"
                value={direction}
                options={directionOptions}
                onChange={(value) => setDirection(value as "CREDIT" | "DEBIT")}
                compact
                buttonClassName="bg-white"
              />
              <FinanceInput label="Amount paise" value={amountPaise} onChange={setAmountPaise} type="number" />
              <FinanceInput label="Reason" value={description} onChange={setDescription} />
              <Button type="submit" disabled={adjustment.isPending || !amountPaise || !description.trim()}>
                Add
              </Button>
            </form>
          </FinancePanel>
        </>
      ) : null}

      <FinanceState loading={ledgerQuery.isLoading} error={ledgerQuery.error} onRetry={() => void ledgerQuery.refetch()} />

      <div className="grid gap-3">
        {(ledgerQuery.data?.items ?? []).map((entry) => (
          <FinancePanel key={entry.id}>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <WalletCards className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[#1F2933]">{entry.description}</p>
                    <FinanceStatus status={entry.entryType} />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">{entry.payout?.payoutNumber ?? entry.orderSellerSplit?.order?.orderNumber ?? "Manual"}</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="font-black text-[#163B5C]">
                  +{formatMoney(entry.creditPaise)} / -{formatMoney(entry.debitPaise)}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">Balance {formatMoney(entry.balanceAfterPaise)}</p>
              </div>
            </div>
          </FinancePanel>
        ))}
      </div>
      {sellerId && !ledgerQuery.isLoading && (ledgerQuery.data?.items ?? []).length === 0 ? <FinanceState empty="No ledger entries for this seller" /> : null}
    </div>
  );
}

function FinanceInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]" />
    </label>
  );
}
