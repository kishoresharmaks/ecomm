"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { createSettlementDraft, listSettlements, submitSettlement } from "@/lib/admin-finance-api";
import { formatMoney } from "@/lib/storefront-api";
import { FinanceMetric, FinancePageHeader, FinancePanel, FinanceState, FinanceStatus, MoneyBreakup } from "./finance-ui";

export function AdminSettlementsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState(defaultDate(-7));
  const [dateTo, setDateTo] = useState(defaultDate(0));
  const [note, setNote] = useState("");
  const confirmation = useConfirmationDialog();
  const settlementsQuery = useQuery({
    queryKey: ["admin-finance-settlements", auth.authHeaders],
    queryFn: () => listSettlements(auth.authHeaders),
    enabled: auth.isAuthenticated
  });
  const createDraft = useMutation({
    mutationFn: () => createSettlementDraft(auth.authHeaders, { dateFrom: startOfDay(dateFrom), dateTo: endOfDay(dateTo), ...(note ? { note } : {}) }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-finance-settlements"] })
  });
  const submit = useMutation({
    mutationFn: (runId: string) => submitSettlement(auth.authHeaders, runId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-finance-settlements"] })
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createDraft.mutate();
  }

  const latest = settlementsQuery.data?.items[0];

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <FinancePageHeader
        title="Settlement cycles"
        description="Generate weekly or custom-date payout drafts from delivered, paid seller order splits."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <FinanceMetric label="Latest run" value={latest?.runNumber ?? "None"} note={latest?.status ?? "No cycle generated"} />
        <FinanceMetric label="Latest net payable" value={formatMoney(latest?.netPayablePaise ?? 0)} note="Across all sellers" />
        <FinanceMetric label="Payouts in latest run" value={latest?.payouts?.length ?? 0} note="Seller payout records" />
      </div>

      <FinancePanel>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <SectionHeading title="Generate settlement draft" description="Default is weekly, but admin can choose any custom date range." />
        </div>
        <form onSubmit={handleCreate} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
          <FinanceDate label="From" value={dateFrom} onChange={setDateFrom} />
          <FinanceDate label="To" value={dateTo} onChange={setDateTo} />
          <label className="space-y-2">
            <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">Note</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]" />
          </label>
          <Button type="submit" disabled={createDraft.isPending}>
            {createDraft.isPending ? "Generating..." : "Generate draft"}
          </Button>
        </form>
        {createDraft.error ? <p className="mt-3 rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">{createDraft.error.message}</p> : null}
      </FinancePanel>

      <FinanceState loading={settlementsQuery.isLoading} error={settlementsQuery.error} onRetry={() => void settlementsQuery.refetch()} />

      <div className="grid gap-4">
        {(settlementsQuery.data?.items ?? []).map((run) => (
          <FinancePanel key={run.id}>
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-[#1F2933]">{run.runNumber}</h3>
                  <FinanceStatus status={run.status} />
                </div>
                <p className="mt-2 text-sm font-semibold text-[#667085]">
                  {shortDate(run.periodFrom)} to {shortDate(run.periodTo)} / {run.payouts?.length ?? 0} sellers
                </p>
                <div className="mt-4 grid gap-2">
                  {(run.payouts ?? []).slice(0, 5).map((payout) => (
                    <div key={payout.id} className="flex flex-col gap-1 rounded-md bg-[#F8FAFC] px-3 py-2 md:flex-row md:items-center md:justify-between">
                      <span className="font-bold text-[#1F2933]">{payout.seller?.storeName ?? payout.sellerId}</span>
                      <span className="font-black text-[#163B5C]">{formatMoney(payout.netPayablePaise)}</span>
                    </div>
                  ))}
                </div>
                {run.status === "DRAFT" ? (
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={() =>
                      confirmation.requestConfirmation({
                        title: "Submit settlement for approval?",
                        description: `${run.runNumber} will create seller payout approval work for ${run.payouts?.length ?? 0} seller records.`,
                        confirmLabel: "Submit settlement",
                        tone: "warning",
                        onConfirm: () => submit.mutate(run.id)
                      })
                    }
                    disabled={submit.isPending}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Submit for approval
                  </Button>
                ) : null}
              </div>
              <MoneyBreakup
                gross={run.grossSalesPaise}
                commission={run.commissionPaise}
                gst={run.gstOnCommissionPaise}
                tds={run.tdsPaise}
                tcs={run.tcsPaise}
                platformFee={run.platformFeePaise}
                refund={run.refundAdjustmentPaise}
                net={run.netPayablePaise}
              />
            </div>
          </FinancePanel>
        ))}
      </div>
      {!settlementsQuery.isLoading && (settlementsQuery.data?.items ?? []).length === 0 ? <FinanceState empty="No settlement runs yet" /> : null}
    </div>
  );
}

function FinanceDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]" />
    </label>
  );
}

function defaultDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return `${value}T00:00:00.000Z`;
}

function endOfDay(value: string) {
  return `${value}T23:59:59.999Z`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
