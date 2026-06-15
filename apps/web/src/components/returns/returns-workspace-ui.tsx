import type { ReactNode } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Truck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { StatusBadge, cn, type StatusTone } from "@indihub/ui";
import {
  type RefundRequestStatus,
  type ReturnRequestStatus,
  type ReturnRequestResolution,
} from "@/lib/returns-api";
import { formatMoney } from "@/lib/storefront-api";

type StepTone = "success" | "warning" | "danger" | "info" | "neutral";

export function ReturnStatusBadge({ status }: { status?: ReturnRequestStatus | string | null }) {
  return <StatusBadge tone={statusTone(status)}>{humanize(status)}</StatusBadge>;
}

export function RefundStatusBadge({ status }: { status?: RefundRequestStatus | string | null }) {
  return <StatusBadge tone={statusTone(status)}>{humanize(status)}</StatusBadge>;
}

export function ResolutionBadge({ resolution }: { resolution?: ReturnRequestResolution | string | null }) {
  const tone: StatusTone = resolution === "REPLACEMENT" ? "info" : resolution === "REJECTED" ? "danger" : "success";
  return <StatusBadge tone={tone}>{humanize(resolution)}</StatusBadge>;
}

export function ReturnStepTrack({
  status,
  compact = false,
}: {
  status?: ReturnRequestStatus | string | null;
  compact?: boolean;
}) {
  const steps = returnSteps(status);
  return <StepTrack steps={steps} compact={compact} />;
}

export function RefundStepTrack({
  status,
  compact = false,
}: {
  status?: RefundRequestStatus | string | null;
  compact?: boolean;
}) {
  const steps = refundSteps(status);
  return <StepTrack steps={steps} compact={compact} />;
}

export function MoneyMetric({
  label,
  value,
  currency,
  note,
}: {
  label: string;
  value: number;
  currency?: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">{label}</p>
      <p className="mt-2 text-xl font-black text-[#0B1F3A]">{formatMoney(value, currency)}</p>
      {note ? <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">{note}</p> : null}
    </div>
  );
}

export function DetailLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] py-3 last:border-0">
      <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#667085]">
        {icon ? <span className="text-[#ED3500]">{icon}</span> : null}
        {label}
      </span>
      <span className="max-w-[62%] text-right text-sm font-black text-[#1F2933]">{value}</span>
    </div>
  );
}

export function WorkspaceNotice({
  tone = "info",
  title,
  message,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title: string;
  message: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-[#B7EACB] bg-[#ECFDF3] text-[#067647]"
      : tone === "warning"
        ? "border-[#FFD58A] bg-[#FFF7E6] text-[#9A5B00]"
        : tone === "danger"
          ? "border-[#F4B8B8] bg-[#FDECEC] text-[#B42318]"
          : "border-[#B8D7F0] bg-[#F0F7FF] text-[#175CD3]";

  return (
    <div className={cn("rounded-lg border p-4", toneClass)}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-sm font-semibold leading-6">{message}</p>
    </div>
  );
}

export function EmptyReturnPanel({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#D8E2EA] bg-white p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-[#FFF0EC] text-[#ED3500]">
        <RotateCcw className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-black text-[#1F2933]">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">{message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatShortDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function humanize(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusTone(status?: string | null): StatusTone {
  if (!status) {
    return "info";
  }

  if (["AUTO_APPROVED", "APPROVED", "QC_PASSED", "RESOLVED", "SUCCESS", "RECEIVED"].includes(status)) {
    return "success";
  }

  if (["PENDING_REVIEW", "PICKUP_PENDING", "PICKED_UP", "IN_TRANSIT", "INITIATED", "PROCESSING", "RETRY_PENDING"].includes(status)) {
    return "warning";
  }

  if (["QC_FAILED", "REJECTED", "CANCELLED", "FAILED"].includes(status)) {
    return "danger";
  }

  return "info";
}

function StepTrack({
  steps,
  compact,
}: {
  steps: Array<{
    key: string;
    label: string;
    helper: string;
    done: boolean;
    active: boolean;
    tone: StepTone;
    icon: ReactNode;
  }>;
  compact: boolean;
}) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6")}>
      {steps.map((step, index) => (
        <div key={step.key} className="relative min-w-0">
          {!compact && index > 0 ? (
            <span className="absolute right-1/2 top-5 hidden h-px w-full bg-[#D8E2EA] xl:block" aria-hidden="true" />
          ) : null}
          <div
            className={cn(
              "relative z-10 flex min-h-[92px] flex-col items-center rounded-lg border bg-white px-2 py-3 text-center",
              step.active && "border-[#ED3500] ring-2 ring-[#FFE0D6]",
              !step.active && step.done && "border-[#B7EACB]",
              !step.active && !step.done && "border-[#E5E7EB]",
            )}
          >
            <span
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full border text-sm shadow-sm",
                step.tone === "success" && "border-[#A6E9BE] bg-[#ECFDF3] text-[#0F8A5F]",
                step.tone === "warning" && "border-[#FFD58A] bg-[#FFF7E6] text-[#B7791F]",
                step.tone === "danger" && "border-[#F4B8B8] bg-[#FDECEC] text-[#B42318]",
                step.tone === "info" && "border-[#B8D7F0] bg-[#F0F7FF] text-[#175CD3]",
                step.tone === "neutral" && "border-[#D8E2EA] bg-white text-[#98A2B3]",
              )}
            >
              {step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : step.icon}
            </span>
            <p className="mt-2 text-xs font-black leading-4 text-[#1F2933]">{step.label}</p>
            <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-[#667085]">{step.helper}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function returnSteps(status?: string | null) {
  const normalized = status ?? "PENDING_REVIEW";
  const closed = ["REJECTED", "CANCELLED", "QC_FAILED"].includes(normalized);
  const order = ["PENDING_REVIEW", "APPROVED", "PICKUP_PENDING", "PICKED_UP", "RECEIVED", "QC_PASSED", "RESOLVED"];
  const currentIndex = closed ? 1 : Math.max(order.indexOf(normalized), 0);

  const base = [
    {
      key: "review",
      label: "Review",
      helper: "Admin checks policy and request details.",
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "approve",
      label: "Approve",
      helper: "Eligible items move to return processing.",
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "pickup",
      label: "Pickup",
      helper: "Reverse pickup or self-ship is arranged.",
      icon: <Truck className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "receive",
      label: "Receive",
      helper: "Returned package reaches the seller or hub.",
      icon: <PackageCheck className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "qc",
      label: "QC",
      helper: "Quality check confirms refund or replacement.",
      icon: <ReceiptText className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "close",
      label: "Close",
      helper: "Refund, replacement, rejection, or closure is recorded.",
      icon: <WalletCards className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return base.map((step, index) => ({
    ...step,
    done: closed ? index === 0 : index <= currentIndex,
    active: closed ? index === 1 : index === currentIndex,
    tone: (closed && index === 1 ? "danger" : index <= currentIndex ? "success" : "neutral") as StepTone,
  }));
}

function refundSteps(status?: string | null) {
  const normalized = status ?? "PENDING_REVIEW";
  const failed = ["FAILED", "RETRY_PENDING", "CANCELLED"].includes(normalized);
  const order = ["PENDING_REVIEW", "APPROVED", "INITIATED", "PROCESSING", "SUCCESS"];
  const currentIndex = failed ? 3 : Math.max(order.indexOf(normalized), 0);
  const base = [
    {
      key: "review",
      label: "Review",
      helper: "Finance checks amount and reason.",
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "approve",
      label: "Approve",
      helper: "Refund is approved for payment.",
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "initiate",
      label: "Initiate",
      helper: "Gateway or manual payment is started.",
      icon: <WalletCards className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "process",
      label: failed ? "Retry" : "Process",
      helper: failed ? "Retry or record manual payment." : "Waiting for gateway confirmation.",
      icon: failed ? <XCircle className="h-4 w-4" aria-hidden="true" /> : <Clock3 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      key: "success",
      label: "Complete",
      helper: "Buyer refund and seller adjustments are posted.",
      icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return base.map((step, index) => ({
    ...step,
    done: !failed && index <= currentIndex,
    active: index === currentIndex,
    tone: (failed && index === 3 ? "danger" : index <= currentIndex ? "success" : "neutral") as StepTone,
  }));
}
