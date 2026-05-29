import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button, StatusBadge, type StatusTone, cn } from "@indihub/ui";
import { IndihubApiError } from "@/lib/api";

export function B2BMetric({
  label,
  value,
  note
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#163B5C]">{value}</p>
      {note ? <p className="mt-1 text-xs font-semibold text-[#667085]">{note}</p> : null}
    </div>
  );
}

export function B2BPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function B2BEmptyState({
  title,
  message,
  action
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#D8E2EA] bg-white p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-black text-[#1F2933]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#667085]">{message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function B2BErrorPanel({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const message = error instanceof IndihubApiError ? `${error.message} (${error.status})` : error.message;

  return (
    <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4 text-sm font-semibold text-[#8A1F1F]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </span>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function B2BSkeleton({ className = "h-72" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white", className)} />;
}

export function B2BField({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  placeholder,
  pattern,
  min,
  readOnly = false
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  pattern?: string;
  min?: number;
  readOnly?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        pattern={pattern}
        min={min}
        readOnly={readOnly}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white read-only:cursor-default read-only:bg-[#EEF3F7] read-only:text-[#667085]"
      />
    </label>
  );
}

export function B2BTextArea({
  label,
  name,
  defaultValue,
  required = false,
  placeholder,
  rows = 5,
  minLength
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  minLength?: number;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        minLength={minLength}
        className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
      />
    </label>
  );
}

export function B2BStatusPill({ status }: { status?: string | null }) {
  return <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>;
}

export function statusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Not set";
}

export function statusTone(status?: string | null): StatusTone {
  if (!status) {
    return "neutral";
  }

  if (["ACTIVE", "APPROVED", "RESPONDED", "BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "CLOSED"].includes(status)) {
    return "success";
  }

  if (["PENDING", "SUBMITTED", "IN_REVIEW"].includes(status)) {
    return "warning";
  }

  if (["REJECTED", "SUSPENDED", "CANCELLED"].includes(status)) {
    return "danger";
  }

  return "info";
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatMoney(paise?: number | null) {
  if (paise === null || paise === undefined) {
    return "Not quoted";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(paise / 100);
}

export function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function optionalFormValue(form: FormData, name: string) {
  const value = formValue(form, name);
  return value ? value : undefined;
}
