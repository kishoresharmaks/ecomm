"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Banknote, RefreshCw, Search, ShieldCheck, WalletCards } from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import {
  adminDecideServiceReceivableWaiver,
  adminListServiceReceivables,
  adminRequestServiceReceivableWaiver,
  adminResolveServiceReceivable,
  adminSetServiceReceivableOffsetPolicy,
  adminSettleServiceReceivable,
  type ServiceCashDisputeResolution,
  type ServiceReceivableOffsetPolicy,
  type ServiceSellerReceivable,
  type ServiceSellerReceivableStatus,
} from "@/lib/service-marketplace-api";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type ReceivableAction = "resolve" | "settle" | "policy" | "waiver" | "waiverDecision";

export function ServiceReceivablesClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offsetPolicy, setOffsetPolicy] = useState("");

  const query = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status } : {}),
      ...(offsetPolicy ? { offsetPolicy } : {}),
      limit: 40,
    }),
    [offsetPolicy, search, status],
  );

  const receivablesQuery = useQuery({
    queryKey: ["finance-service-receivables", auth.authHeaders, query],
    queryFn: () => adminListServiceReceivables(auth.authHeaders, query),
    enabled: auth.isAuthenticated,
  });

  const mutation = useMutation({
    mutationFn: ({ receivable, action, form }: { receivable: ServiceSellerReceivable; action: ReceivableAction; form: FormData }) =>
      runReceivableAction(auth.authHeaders, receivable, action, form),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-service-receivables"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-payment-reports"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-service-receivables"] }),
      ]);
    },
  });

  const receivables = receivablesQuery.data?.items ?? [];
  const openPaise = receivables.reduce((sum, item) => sum + receivableOutstanding(item), 0);
  const disputed = receivables.filter((item) => item.status === "DISPUTED").length;
  const autoOffset = receivables.filter((item) => item.offsetPolicy === "AUTO_OFFSET_NEXT_PAYOUT").length;

  return (
    <div className="space-y-4">
      {confirmation.confirmationDialog}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Outstanding due" value={money(openPaise)} icon={Banknote} tone="orange" />
        <MetricCard label="Disputed records" value={disputed.toString()} icon={AlertCircle} tone="red" />
        <MetricCard label="Auto-offset enabled" value={autoOffset.toString()} icon={WalletCards} tone="blue" />
      </section>

      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_250px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receivable, booking, or provider"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            <option value="">All statuses</option>
            <option value="PROVISIONAL">Provisional</option>
            <option value="OPEN">Open</option>
            <option value="PARTIALLY_SETTLED">Partially settled</option>
            <option value="DISPUTED">Disputed</option>
            <option value="WAIVER_REQUESTED">Waiver requested</option>
            <option value="OFFSET_SCHEDULED">Offset scheduled</option>
            <option value="SETTLED">Settled</option>
            <option value="WAIVED">Waived</option>
            <option value="REVERSED">Reversed</option>
            <option value="OFFSET_APPLIED">Offset applied</option>
          </select>
          <select
            value={offsetPolicy}
            onChange={(event) => setOffsetPolicy(event.target.value)}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none transition focus:border-[#ED3500]"
          >
            <option value="">All offset policies</option>
            <option value="MANUAL_ONLY">Manual only</option>
            <option value="AUTO_OFFSET_NEXT_PAYOUT">Auto offset next payout</option>
            <option value="HOLD_PAYOUT_UNTIL_SETTLED">Hold payout until settled</option>
          </select>
          <Button type="button" variant="outline" onClick={() => void receivablesQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </section>

      {receivablesQuery.isError ? (
        <FinanceState message={receivablesQuery.error instanceof Error ? receivablesQuery.error.message : "Unable to load service receivables."} error />
      ) : null}
      {receivablesQuery.isLoading ? <FinanceState message="Loading service receivables" /> : null}

      <section className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Provider cash receivables</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Service provider cash is tracked as platform dues and is not added to seller wallet payouts.
            </p>
          </div>
          <StatusBadge tone="info">{receivablesQuery.data?.total ?? 0} records</StatusBadge>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {receivables.map((receivable) => (
            <ReceivableRow
              key={receivable.id}
              receivable={receivable}
              busy={mutation.isPending}
              onSubmit={(action, form) =>
                confirmation.requestConfirmation({
                  title: confirmationTitle(action),
                  description: `${receivable.receivableNumber} for ${receivable.booking?.bookingNumber ?? "this service booking"} will be updated with audit history.`,
                  confirmLabel: confirmationLabel(action),
                  tone: action === "settle" || action === "waiverDecision" ? "info" : "warning",
                  onConfirm: () => mutation.mutate({ receivable, action, form }),
                })
              }
            />
          ))}
          {!receivablesQuery.isLoading && receivables.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-[#667085]">No service cash receivables found.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ReceivableRow({
  receivable,
  busy,
  onSubmit,
}: {
  receivable: ServiceSellerReceivable;
  busy: boolean;
  onSubmit: (action: ReceivableAction, form: FormData) => void;
}) {
  const outstanding = receivableOutstanding(receivable);

  return (
    <article className="grid gap-4 px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={statusTone(receivable.status)}>{label(receivable.status)}</StatusBadge>
            <StatusBadge tone="info">{label(receivable.taxAccrualStatus)}</StatusBadge>
            <StatusBadge tone="neutral">{label(receivable.offsetPolicy)}</StatusBadge>
            {receivable.waiverApprovalStatus !== "NOT_REQUESTED" ? (
              <StatusBadge tone={receivable.waiverApprovalStatus === "APPROVED" ? "success" : "warning"}>
                {label(receivable.waiverApprovalStatus)}
              </StatusBadge>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-black text-[#163B5C]">{receivable.receivableNumber}</h3>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            {receivable.booking?.bookingNumber ?? "Service booking"} / {receivable.seller?.storeName ?? "Service provider"}
          </p>
          {receivable.cashCollectionEventId ? (
            <p className="mt-1 text-xs font-bold text-[#667085]">Event: {receivable.cashCollectionEventId}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-3 text-left xl:min-w-56 xl:text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Outstanding</p>
          <p className="mt-1 text-2xl font-black text-[#163B5C]">{money(outstanding, receivable.currency)}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Info label="Cash collected" value={money(receivable.grossCashCollectedPaise, receivable.currency)} />
        <Info label="Commission" value={money(receivable.commissionPaise, receivable.currency)} />
        <Info label="GST + tax" value={money(receivable.gstOnCommissionPaise + receivable.tdsPaise + receivable.tcsPaise, receivable.currency)} />
        <Info label="Platform fee" value={money(receivable.platformFeePaise, receivable.currency)} />
        <Info label="Cleared" value={money(receivable.settledPaise + receivable.waivedPaise + receivable.reversalPaise + receivable.offsetPaise, receivable.currency)} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ActionForm title="Resolve cash status" onSubmit={(form) => onSubmit("resolve", form)}>
          <select name="resolution" className={inputClass()}>
            <option value="ADMIN_FORCE_CONFIRMED">Force confirm full cash</option>
            <option value="PARTIALLY_ACCEPTED">Partially accept</option>
            <option value="REJECTED">Reject cash record</option>
            <option value="REOPENED_FOR_EVIDENCE">Reopen for evidence</option>
          </select>
          <input name="acceptedCash" type="number" min="0" step="0.01" placeholder="Accepted cash INR for partial only" className={inputClass()} />
          <textarea name="note" required minLength={5} rows={2} placeholder="Resolution note" className={cn(inputClass(), "h-auto py-2")} />
          <Button type="submit" size="sm" disabled={busy}>Resolve</Button>
        </ActionForm>

        <ActionForm title="Settle receivable" onSubmit={(form) => onSubmit("settle", form)}>
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount INR" className={inputClass()} />
          <input name="referenceNumber" placeholder="UPI/bank/reference" className={inputClass()} />
          <input name="note" placeholder="Settlement note" className={inputClass()} />
          <Button type="submit" size="sm" variant="outline" disabled={busy}>Record settlement</Button>
        </ActionForm>

        <ActionForm title="Payout offset policy" onSubmit={(form) => onSubmit("policy", form)}>
          <select name="offsetPolicy" defaultValue={receivable.offsetPolicy} className={inputClass()}>
            <option value="MANUAL_ONLY">Manual only</option>
            <option value="AUTO_OFFSET_NEXT_PAYOUT">Auto offset next payout</option>
            <option value="HOLD_PAYOUT_UNTIL_SETTLED">Hold payout until settled</option>
          </select>
          <input name="note" placeholder="Policy note" className={inputClass()} />
          <Button type="submit" size="sm" variant="outline" disabled={busy}>Save policy</Button>
        </ActionForm>

        <ActionForm
          title={receivable.waiverApprovalStatus === "PENDING" ? "Waiver decision" : "Waiver request"}
          onSubmit={(form) => onSubmit(receivable.waiverApprovalStatus === "PENDING" ? "waiverDecision" : "waiver", form)}
        >
          {receivable.waiverApprovalStatus === "PENDING" ? (
            <select name="decision" className={inputClass()}>
              <option value="APPROVED">Approve waiver</option>
              <option value="REJECTED">Reject waiver</option>
            </select>
          ) : (
            <>
              <input name="amount" type="number" min="0.01" step="0.01" placeholder="Waiver amount INR" className={inputClass()} />
              <input name="reason" required minLength={5} placeholder="Waiver reason" className={inputClass()} />
            </>
          )}
          <input name="note" placeholder="Decision note" className={inputClass()} />
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {receivable.waiverApprovalStatus === "PENDING" ? "Save decision" : "Request waiver"}
          </Button>
        </ActionForm>
      </div>
    </article>
  );
}

async function runReceivableAction(
  authHeaders: Parameters<typeof adminListServiceReceivables>[0],
  receivable: ServiceSellerReceivable,
  action: ReceivableAction,
  form: FormData,
) {
  if (action === "resolve") {
    const acceptedCash = optionalFormValue(form, "acceptedCash");
    return adminResolveServiceReceivable(authHeaders, receivable.receivableNumber, {
      resolution: formValue(form, "resolution") as ServiceCashDisputeResolution,
      ...(acceptedCash ? { acceptedCashPaise: rupeesToPaise(acceptedCash) } : {}),
      note: formValue(form, "note"),
    });
  }
  if (action === "settle") {
    const referenceNumber = optionalFormValue(form, "referenceNumber");
    const note = optionalFormValue(form, "note");
    return adminSettleServiceReceivable(authHeaders, receivable.receivableNumber, {
      amountPaise: rupeesToPaise(formValue(form, "amount")),
      ...(referenceNumber ? { referenceNumber } : {}),
      ...(note ? { note } : {}),
    });
  }
  if (action === "policy") {
    const note = optionalFormValue(form, "note");
    return adminSetServiceReceivableOffsetPolicy(authHeaders, receivable.receivableNumber, {
      offsetPolicy: formValue(form, "offsetPolicy") as ServiceReceivableOffsetPolicy,
      ...(note ? { note } : {}),
    });
  }
  if (action === "waiverDecision") {
    const note = optionalFormValue(form, "note");
    return adminDecideServiceReceivableWaiver(authHeaders, receivable.receivableNumber, {
      decision: formValue(form, "decision") as "APPROVED" | "REJECTED",
      ...(note ? { note } : {}),
    });
  }
  return adminRequestServiceReceivableWaiver(authHeaders, receivable.receivableNumber, {
    amountPaise: rupeesToPaise(formValue(form, "amount")),
    reason: formValue(form, "reason"),
  });
}

function ActionForm({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (form: FormData) => void }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
      className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3"
    >
      <p className="text-sm font-black text-[#163B5C]">{title}</p>
      {children}
    </form>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Banknote;
  tone: "orange" | "red" | "blue";
}) {
  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className={iconTone(tone)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ShieldCheck className="h-4 w-4 text-[#667085]" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-black text-[#667085]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#163B5C]">{value}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function FinanceState({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-white p-4 text-sm font-black shadow-sm", error ? "border-[#F5B7B7] text-[#B42318]" : "border-[#D8E2EA] text-[#1F2933]")}>
      {message}
    </div>
  );
}

function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function optionalFormValue(form: FormData, name: string) {
  const value = formValue(form, name);
  return value || undefined;
}

function rupeesToPaise(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function receivableOutstanding(receivable: {
  amountDueToPlatformPaise: number;
  settledPaise: number;
  waivedPaise: number;
  reversalPaise: number;
  offsetPaise: number;
}) {
  return Math.max(
    0,
    receivable.amountDueToPlatformPaise - receivable.settledPaise - receivable.waivedPaise - receivable.reversalPaise - receivable.offsetPaise,
  );
}

function money(amountPaise: number, currency = "INR") {
  if (currency === "INR") {
    return moneyFormatter.format((amountPaise ?? 0) / 100);
  }
  return `${currency} ${((amountPaise ?? 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function label(value?: string | null) {
  return (value ?? "pending").replace(/_/g, " ");
}

function inputClass() {
  return "h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500]";
}

function statusTone(status: ServiceSellerReceivableStatus): "success" | "danger" | "warning" | "info" {
  if (["SETTLED", "WAIVED", "REVERSED", "OFFSET_APPLIED"].includes(status)) {
    return "success";
  }
  if (status === "DISPUTED") {
    return "danger";
  }
  if (["PROVISIONAL", "OPEN", "PARTIALLY_SETTLED", "WAIVER_REQUESTED", "OFFSET_SCHEDULED"].includes(status)) {
    return "warning";
  }
  return "info";
}

function iconTone(tone: "orange" | "red" | "blue") {
  if (tone === "red") {
    return "grid h-11 w-11 place-items-center rounded-md bg-[#FDECEC] text-[#B42318]";
  }
  if (tone === "blue") {
    return "grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]";
  }
  return "grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]";
}

function confirmationTitle(action: ReceivableAction) {
  switch (action) {
    case "settle":
      return "Record receivable settlement?";
    case "resolve":
      return "Resolve cash receivable?";
    case "policy":
      return "Update payout offset policy?";
    case "waiverDecision":
      return "Save waiver decision?";
    default:
      return "Request receivable waiver?";
  }
}

function confirmationLabel(action: ReceivableAction) {
  switch (action) {
    case "settle":
      return "Record settlement";
    case "resolve":
      return "Resolve receivable";
    case "policy":
      return "Save policy";
    case "waiverDecision":
      return "Save decision";
    default:
      return "Request waiver";
  }
}
