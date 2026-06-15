"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  BadgePercent,
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Home,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  WalletCards,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { IndihubApiError, userFacingApiErrorMessage } from "@/lib/api";
import type { IndihubAuthHeaders } from "@/lib/api";
import { uploadPublicImage, type PublicImageUploadPurpose } from "@/lib/public-image-upload";
import { sellerNav } from "@/lib/portal-nav";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const sellerNavIcons: Record<string, ReactNode> = {
  "/seller": <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
  "/seller/profile": <Store className="h-4 w-4" aria-hidden="true" />,
  "/seller/register": <UserRound className="h-4 w-4" aria-hidden="true" />,
  "/seller/products": <Boxes className="h-4 w-4" aria-hidden="true" />,
  "/seller/deals": <BadgePercent className="h-4 w-4" aria-hidden="true" />,
  "/seller/coupons": <BadgePercent className="h-4 w-4" aria-hidden="true" />,
  "/seller/orders": <ShoppingBag className="h-4 w-4" aria-hidden="true" />,
  "/seller/returns": <RotateCcw className="h-4 w-4" aria-hidden="true" />,
  "/seller/reviews": <Star className="h-4 w-4" aria-hidden="true" />,
  "/seller/b2b-enquiries": <MessageSquareText className="h-4 w-4" aria-hidden="true" />,
  "/seller/b2b-orders": <ReceiptText className="h-4 w-4" aria-hidden="true" />,
  "/seller/reports/sales": <BarChart3 className="h-4 w-4" aria-hidden="true" />,
  "/seller/subscription": <CreditCard className="h-4 w-4" aria-hidden="true" />,
  "/seller/finance/wallet": <WalletCards className="h-4 w-4" aria-hidden="true" />,
  "/seller/finance/payouts": <ReceiptText className="h-4 w-4" aria-hidden="true" />,
  "/seller/finance/statements": <ClipboardList className="h-4 w-4" aria-hidden="true" />
};

const sellerFinanceRoutes = new Set(["/seller/subscription", "/seller/finance/wallet", "/seller/finance/payouts", "/seller/finance/statements"]);
const sellerNavGroups = [
  {
    label: "Store",
    items: sellerNav.filter((item) => !sellerFinanceRoutes.has(item.href))
  },
  {
    label: "Finance",
    items: sellerNav.filter((item) => sellerFinanceRoutes.has(item.href))
  }
];

export function SellerWorkspaceShell({
  title,
  description,
  children,
  actions
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#F6F3EC] text-[#1F2933]">
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#D9E2EA] bg-[#123A5A] text-white lg:block">
          <SellerSidebar pathname={pathname} />
        </aside>

        <section className="min-w-0">
          <div className="sticky top-0 z-30 border-b border-[#D9E2EA] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/seller" className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#123A5A] text-sm font-black text-white">1HI</span>
                <span>
                  <span className="block text-base font-black text-[#123A5A]">1HandIndia</span>
                  <span className="block text-xs font-bold text-[#ED3500]">Seller Center</span>
                </span>
              </Link>
              <Button type="button" variant="outline" size="sm" onClick={() => setMobileOpen((current) => !current)} aria-expanded={mobileOpen}>
                {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
                Menu
              </Button>
            </div>
            {mobileOpen ? (
              <nav className="mt-3 grid gap-1 rounded-lg border border-[#D9E2EA] bg-white p-2 shadow-sm">
                {sellerNav.map((item) => (
                  <SellerNavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileOpen(false)} />
                ))}
                <SellerLogoutButton className="mt-1 w-full justify-start" onClick={() => setMobileOpen(false)} />
              </nav>
            ) : null}
          </div>

          <div className="px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
            <header className="mb-6 border-b border-[#D9E2EA] pb-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ED3500]">Seller Center</p>
                  <h1 className="mt-2 max-w-5xl text-3xl font-black tracking-normal text-[#123A5A] md:text-4xl">{title}</h1>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-[#5F6F82] md:text-base">{description}</p>
                </div>
                {actions ? <div className="flex flex-wrap gap-2 xl:justify-end">{actions}</div> : null}
              </div>
            </header>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function SellerSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="sticky top-0 flex h-screen min-h-0 flex-col overflow-hidden px-4 py-4">
      <Link href="/seller" className="flex shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#ED3500] text-sm font-black text-white">1HI</span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-black leading-tight">1HandIndia</span>
          <span className="block truncate text-xs font-semibold text-[#DCE8F2]">Seller Center</span>
        </span>
      </Link>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.28)_transparent] [scrollbar-width:thin]">
        <div className="space-y-4">
          {sellerNavGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#BFD4E5]">{group.label}</p>
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <SellerNavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/[0.06] p-3">
        <p className="text-sm font-black leading-5">Store operations</p>
        <p className="mt-1 text-xs leading-5 text-[#DCE8F2]">Catalogue, orders, delivery, and enquiries in one place.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 border-white/20 bg-white/10 px-3 text-white hover:bg-white/15">
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Storefront
            </Link>
          </Button>
          <SellerLogoutButton className="h-9 border-white/20 bg-white/10 px-3 text-white hover:bg-white/15" />
        </div>
      </div>
    </div>
  );
}

function SellerLogoutButton({ className, onClick }: { className?: string; onClick?: () => void }) {
  const auth = useCustomerAuth();

  if (!clerkEnabled || auth.mode !== "clerk" || !["ready", "error"].includes(auth.status)) {
    return null;
  }

  return (
    <SignOutButton redirectUrl="/">
      <Button type="button" variant="outline" size="sm" className={className} onClick={onClick}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Logout
      </Button>
    </SignOutButton>
  );
}

function SellerNavLink({
  item,
  pathname,
  onClick
}: {
  item: { label: string; href: string };
  pathname: string;
  onClick?: () => void;
}) {
  const active = item.href === "/seller" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      {...(onClick ? { onClick } : {})}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition",
        active
          ? "bg-[#EAF1F7] shadow-sm lg:bg-white"
          : "text-[#1F2933] hover:bg-[#F6F3EC] lg:text-[#EEF6FB] lg:hover:bg-white/10"
      )}
      style={active ? { color: "#123A5A" } : undefined}
      aria-current={active ? "page" : undefined}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center text-current">
        {sellerNavIcons[item.href] ?? <ClipboardList className="h-4 w-4" aria-hidden="true" />}
      </span>
      <span className="truncate text-current">{item.label}</span>
    </Link>
  );
}

export function useSellerAuth() {
  const clerkOrLocalAuth = useCustomerAuth();

  if (clerkOrLocalAuth.mode === "clerk") {
    return {
      mode: "clerk" as const,
      authHeaders: clerkOrLocalAuth.authHeaders,
      authKey: `seller:${clerkOrLocalAuth.authKey}`,
      enabled: clerkOrLocalAuth.enabled,
      status: clerkOrLocalAuth.status,
      error: clerkOrLocalAuth.error,
      refresh: clerkOrLocalAuth.refresh,
      platformUserId: ""
    };
  }

  return {
    mode: "local" as const,
    authHeaders: {},
    authKey: "seller:signed-out",
    enabled: false,
    status: "signed-out",
    error: undefined,
    refresh: () => undefined,
    platformUserId: ""
  };
}

export function SellerAuthNotice() {
  const sellerAuth = useSellerAuth();

  if (sellerAuth.status === "signed-out") {
    return (
      <div className="rounded-lg border border-[#FFC7B8] bg-[#FFF0EC] p-4 text-sm font-semibold text-[#9F2600]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Sign in or create an account to continue with seller onboarding and seller center.
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href="/sign-in?redirect_url=/seller/register">
              <LogIn size={16} /> Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (sellerAuth.status === "error") {
    return (
      <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4 text-sm font-semibold text-[#8A1F1F]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{sellerAuth.error ? userFacingApiErrorMessage(sellerAuth.error) : "Unable to prepare your account session."}</span>
          <Button type="button" variant="outline" size="sm" onClick={sellerAuth.refresh}>
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-white p-4 text-sm font-semibold text-[#667085]">
      <Loader2 className="h-4 w-4 animate-spin text-[#163B5C]" aria-hidden="true" />
      Preparing your seller center
    </div>
  );
}

export function SellerPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function SellerMetric({
  label,
  value,
  note
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#163B5C]">{value}</p>
      {note ? <p className="mt-1 text-xs font-semibold text-[#667085]">{note}</p> : null}
    </div>
  );
}

export function SellerEmptyState({
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
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-black text-[#1F2933]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#667085]">{message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SellerOnboardingRequired({ message = "Create a seller profile for this account before using seller center tools." }: { message?: string }) {
  return (
    <SellerEmptyState
      title="Seller onboarding required"
      message={message}
      action={
        <Button asChild>
          <Link href="/seller/register">Start onboarding</Link>
        </Button>
      }
    />
  );
}

export function isSellerOnboardingRequiredError(error: unknown) {
  return error instanceof IndihubApiError && [403, 404].includes(error.status);
}

export function SellerErrorPanel({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const message = error instanceof IndihubApiError ? `${userFacingApiErrorMessage(error)} (${error.status})` : userFacingApiErrorMessage(error);

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

export function SellerSkeleton({ className = "h-72" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white", className)} />;
}

export function SellerField({
  label,
  name,
  type = "text",
  defaultValue,
  value,
  onChange,
  required = false,
  placeholder,
  min,
  step,
  readOnly = false
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null | undefined;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  min?: number;
  step?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        min={min}
        step={step}
        readOnly={readOnly}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white read-only:bg-[#EEF3F7] read-only:text-[#667085]"
      />
    </label>
  );
}

export function SellerTextArea({
  label,
  name,
  defaultValue,
  value,
  onChange,
  required = false,
  placeholder,
  rows = 4
}: {
  label: string;
  name: string;
  defaultValue?: string | null | undefined;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
      />
    </label>
  );
}

export function SellerSelect({
  label,
  name,
  defaultValue,
  value,
  onChange,
  required = false,
  children
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      <select
        name={name}
        required={required}
        defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
      >
        {children}
      </select>
    </label>
  );
}

export function SellerImageUpload({
  label,
  description,
  value,
  onChange,
  authHeaders,
  purpose,
  previewLabel = "1HI",
  aspectClass = "aspect-[16/9]",
  allowExternalRemote = false,
  disabled = false,
  layout = "responsive"
}: {
  label: string;
  description?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  authHeaders: IndihubAuthHeaders;
  purpose: PublicImageUploadPurpose;
  previewLabel?: string;
  aspectClass?: string;
  allowExternalRemote?: boolean;
  disabled?: boolean;
  layout?: "responsive" | "stacked";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function selectFile(file?: File) {
    if (!file) {
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const uploaded = await uploadPublicImage(authHeaders, file, purpose, {
        onProgress: setProgress
      });
      onChange(uploaded.assetKey);
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="rounded-lg border border-[#D9E2EA] bg-white p-4">
      <div
        className={cn(
          "flex flex-col gap-4",
          layout === "responsive" ? "md:flex-row md:items-start" : ""
        )}
      >
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-md border border-[#D9E2EA] bg-[#EAF1F7]",
            layout === "responsive" ? "md:w-48" : "",
            aspectClass
          )}
        >
          <StorefrontImage src={value ?? null} alt={label} sizes="220px" fallbackLabel={previewLabel} allowExternalRemote={allowExternalRemote} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#1F2933]">{label}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-[#667085]">{description}</p> : null}
          {uploading ? (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-[#EAF1F7]">
                <div className="h-full rounded-full bg-[#ED3500] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs font-bold text-[#667085]">Uploading {progress}%</p>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm font-bold text-[#D64545]">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              {value ? "Replace image" : "Upload image"}
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled || uploading}>
                <X className="h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => void selectFile(event.currentTarget.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}

export function SellerStatusPill({ status }: { status?: string | null | undefined }) {
  return <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>;
}

export function statusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Not set";
}

function statusTone(status?: string | null) {
  if (!status) {
    return "neutral";
  }

  if (["ACTIVE", "APPROVED", "PAID", "DELIVERED", "COMPLETED", "RESPONDED", "BUYER_CONFIRMED", "ADMIN_APPROVED", "FINALISED", "ACCEPTED"].includes(status)) {
    return "success";
  }

  if (["PENDING", "PENDING_APPROVAL", "PLACED", "PROCESSING", "IN_TRANSIT", "SUBMITTED", "IN_REVIEW", "PACKED"].includes(status)) {
    return "warning";
  }

  if (["REJECTED", "SUSPENDED", "CANCELLED", "FAILED", "REFUNDED", "ARCHIVED"].includes(status)) {
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

export function formValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function optionalFormValue(form: FormData, name: string) {
  const value = formValue(form, name);
  return value ? value : undefined;
}

export function rupeesToPaise(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function paiseToRupees(value?: number | null) {
  return value ? String(value / 100) : "";
}
