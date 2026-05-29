"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";

export function FinancePanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function FinanceMetric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <FinancePanel>
      <p className="text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#163B5C]">{value}</p>
      {note ? <p className="mt-1 text-xs font-semibold text-[#667085]">{note}</p> : null}
    </FinancePanel>
  );
}

export function FinancePageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <FinancePanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading title={title} description={description} />
        {actions ? <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
      </div>
    </FinancePanel>
  );
}

export function FinanceState({
  loading,
  error,
  empty,
  onRetry
}: {
  loading?: boolean;
  error?: unknown;
  empty?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <FinancePanel>
        <div className="flex items-center gap-2 text-sm font-bold text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin text-[#ED3500]" aria-hidden="true" />
          Loading finance records
        </div>
      </FinancePanel>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4 text-sm font-semibold text-[#8A1F1F]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error instanceof Error ? error.message : "Finance request failed."}
          </span>
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-lg border border-dashed border-[#D8E2EA] bg-white p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <Inbox className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-lg font-black text-[#1F2933]">{empty}</p>
      </div>
    );
  }

  return null;
}

export function FinanceStatus({ status }: { status?: string | null }) {
  return <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>;
}

export function MoneyBreakup({
  gross,
  commission,
  gst,
  tds,
  tcs,
  platformFee,
  refund,
  adjustment,
  net
}: {
  gross: number;
  commission: number;
  gst: number;
  tds: number;
  tcs: number;
  platformFee: number;
  refund: number;
  adjustment?: number;
  net: number;
}) {
  const rows = [
    ["Gross", gross],
    ["Commission", -commission],
    ["GST", -gst],
    ["TDS", -tds],
    ["TCS", -tcs],
    ["Seller settlement fee", -platformFee],
    ["Refund adjustment", refund],
    ["Manual adjustment", adjustment ?? 0],
    ["Net payable", net]
  ];

  return (
    <div className="grid gap-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-[#F8FAFC] px-3 py-2">
          <span className="font-semibold text-[#667085]">{label}</span>
          <span className="font-black text-[#163B5C]">{formatMoney(Number(value))}</span>
        </div>
      ))}
    </div>
  );
}

export function statusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Not set";
}

function statusTone(status?: string | null) {
  if (!status) {
    return "neutral";
  }

  if (["APPROVED", "PAID", "GENERATED", "ELIGIBLE"].includes(status)) {
    return "success";
  }

  if (["DRAFT", "PENDING_APPROVAL", "DRAFTED", "HELD"].includes(status)) {
    return "warning";
  }

  if (["REJECTED", "CANCELLED", "VOID", "ADJUSTED"].includes(status)) {
    return "danger";
  }

  return "info";
}
