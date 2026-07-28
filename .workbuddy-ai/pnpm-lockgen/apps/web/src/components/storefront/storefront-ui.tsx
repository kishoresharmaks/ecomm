"use client";

import type { ComponentType, FormHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Minus, Plus, RefreshCw } from "lucide-react";
import { Button, SectionHeading, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { IndihubApiError } from "@/lib/api";

type StorefrontPageHeaderProps = {
  badge?: ReactNode;
  badgeTone?: StatusTone;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  narrow?: boolean;
};

export function StorefrontPageHeader({
  badge,
  badgeTone = "info",
  title,
  description,
  children,
  className,
  narrow = false,
}: StorefrontPageHeaderProps) {
  return (
    <section className={cn("border-b border-[#E5E7EB] bg-white", className)}>
      <div className={cn("mx-auto px-5 py-10 lg:px-6", narrow ? "max-w-5xl" : "max-w-7xl")}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {badge ? <StatusBadge tone={badgeTone}>{badge}</StatusBadge> : null}
            <h1 className={cn("text-4xl font-black tracking-normal text-[#163B5C] md:text-5xl", badge && "mt-4")}>
              {title}
            </h1>
            {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p> : null}
          </div>
          {children ? <div className="w-full lg:max-w-md">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

type StorefrontSectionProps = {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
};

export function StorefrontSection({ children, className, narrow = false }: StorefrontSectionProps) {
  return (
    <section className={cn("mx-auto px-5 py-10 lg:px-6", narrow ? "max-w-5xl" : "max-w-7xl", className)}>
      {children}
    </section>
  );
}

type StorefrontPanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  padded?: boolean;
  subtle?: boolean;
  as?: "div" | "section" | "aside" | "article";
};

export function StorefrontPanel({
  children,
  className,
  padded = true,
  subtle = false,
  as: Comp = "div",
  ...props
}: StorefrontPanelProps) {
  return (
    <Comp
      className={cn(
        "rounded-[28px] border bg-white shadow-sm",
        subtle ? "border-[#E8EDF2] bg-[#FCFDFE]" : "border-[#E5E7EB]",
        padded && "p-5",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

type StorefrontFormPanelProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
  padded?: boolean;
  subtle?: boolean;
};

export function StorefrontFormPanel({
  children,
  className,
  padded = true,
  subtle = false,
  ...props
}: StorefrontFormPanelProps) {
  return (
    <form
      className={cn(
        "rounded-[28px] border bg-white shadow-sm",
        subtle ? "border-[#E8EDF2] bg-[#FCFDFE]" : "border-[#E5E7EB]",
        padded && "p-5",
        className,
      )}
      {...props}
    >
      {children}
    </form>
  );
}

type StorefrontPanelHeaderProps = {
  icon?: ComponentType<{ className?: string; size?: number; "aria-hidden"?: boolean }>;
  iconTone?: "blue" | "orange" | "green";
  title: string;
  description?: string;
  className?: string;
};

export function StorefrontPanelHeader({
  icon: Icon,
  iconTone = "blue",
  title,
  description,
  className,
}: StorefrontPanelHeaderProps) {
  const toneClass = {
    blue: "bg-[#EAF1F7] text-[#163B5C]",
    orange: "bg-[#FFF0EC] text-[#ED3500]",
    green: "bg-[#E9F7F1] text-[#0F8A5F]",
  }[iconTone];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon ? (
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", toneClass)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <SectionHeading title={title} {...(description ? { description } : {})} />
    </div>
  );
}

type StorefrontNoticeTone = "info" | "success" | "warning" | "danger";

const noticeToneClasses: Record<StorefrontNoticeTone, string> = {
  info: "border-[#D8E2EA] bg-[#F8FAFC] text-[#163B5C]",
  success: "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]",
  warning: "border-[#F6D58D] bg-[#FFF8E6] text-[#8A5A00]",
  danger: "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]",
};

export function StorefrontNotice({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: StorefrontNoticeTone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm font-semibold", noticeToneClasses[tone], className)}>
      {children}
    </div>
  );
}

export function StorefrontErrorPanel({
  error,
  onRetry,
  retryLabel = "Retry",
  className,
}: {
  error: Error;
  onRetry: () => void;
  retryLabel?: string;
  className?: string;
}) {
  const message = error instanceof IndihubApiError ? `${error.message} (${error.status})` : error.message;

  return (
    <StorefrontNotice
      tone="danger"
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
    >
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw size={15} /> {retryLabel}
      </Button>
    </StorefrontNotice>
  );
}

export function StorefrontEmptyState({
  icon: Icon,
  title,
  description,
  message,
  action,
  className,
  centered = false,
}: {
  icon?: ComponentType<{ className?: string; size?: number; "aria-hidden"?: boolean }>;
  title?: string;
  description?: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-dashed border-[#D8E2EA] bg-[#FCFDFE] p-6 text-sm font-semibold text-[#667085]",
        centered && "text-center",
        className,
      )}
    >
      {Icon ? (
        <span className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0EC] text-[#ED3500]", centered && "mx-auto")}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      {title ? <h2 className="mt-4 text-2xl font-black text-[#1F2933]">{title}</h2> : null}
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">{description}</p> : null}
      {message ? <p className={cn(title || Icon ? "mt-3" : "")}>{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StorefrontSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[24px] bg-[#F8FAFC]", className)} />;
}

export function StorefrontSummaryRow({
  label,
  value,
  strong = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span>{label}</span>
      <span className={strong ? "text-base font-black text-[#163B5C]" : "font-black text-[#1F2933]"}>{value}</span>
    </div>
  );
}

export function StorefrontInfoItem({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      <span className="mt-1 block font-black text-[#1F2933]">{value}</span>
    </div>
  );
}

export function StorefrontOptionCard({
  selected,
  children,
  className,
  selectedClassName,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  selectedClassName?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
        selected ? selectedClassName ?? "border-[#ED3500] bg-[#FFF0EC] text-[#9F2600]" : "border-[#D8E2EA] bg-white text-[#1F2933] hover:border-[#ED3500]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StorefrontQuantityStepper({
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  increaseDisabled,
  disabled,
  decreaseLabel = "Decrease quantity",
  increaseLabel = "Increase quantity",
  className,
}: {
  value: ReactNode;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-10 items-center rounded-full border border-[#D8E2EA] bg-white", className)}>
      <button
        type="button"
        disabled={disabled || decreaseDisabled}
        onClick={onDecrease}
        className="grid h-9 w-9 place-items-center text-[#163B5C] disabled:opacity-40"
        aria-label={decreaseLabel}
      >
        <Minus size={15} />
      </button>
      <span className="w-9 text-center text-sm font-black text-[#1F2933]">{value}</span>
      <button
        type="button"
        disabled={disabled || increaseDisabled}
        onClick={onIncrease}
        className="grid h-9 w-9 place-items-center text-[#163B5C] disabled:opacity-40"
        aria-label={increaseLabel}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

export const storefrontFieldLabelClassName = "block text-xs font-bold uppercase tracking-wide text-[#667085]";
export const storefrontInputClassName =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white";
export const storefrontTextareaClassName =
  "w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white";
