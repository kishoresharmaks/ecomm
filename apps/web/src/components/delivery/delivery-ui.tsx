"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  LayoutDashboard,
  Loader2,
  LogIn,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
  Wallet,
  UserRound
} from "lucide-react";
import { Button, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { DevAuthPanel } from "@/components/dev-auth/dev-auth-panel";
import { useDevAuth } from "@/components/dev-auth/dev-auth-context";
import { DeliveryMaintenanceGate } from "@/components/maintenance/maintenance-mode";
import { userFacingApiErrorMessage, type IndihubAuthHeaders } from "@/lib/api";
import { getOwnDeliveryPartnerApplication } from "@/lib/delivery-partner-application-api";

export type DeliveryAuthState = {
  mode: "clerk" | "local";
  authHeaders: IndihubAuthHeaders;
  authKey: string;
  enabled: boolean;
  status: "signed-out" | "syncing" | "ready" | "error";
  error?: string;
  refresh: () => void;
};

const deliveryNav = [
  { href: "/delivery", label: "Dashboard", icon: LayoutDashboard },
  { href: "/delivery/orders", label: "Assigned orders", icon: ClipboardList },
  { href: "/delivery/returns", label: "Return pickups", icon: RotateCcw },
  { href: "/delivery/wallet", label: "Wallet", icon: Wallet },
  { href: "/delivery/profile", label: "Profile", icon: UserRound }
];

type DeliveryAccessStatus = "signed-out" | "checking" | "ready" | "needs-application" | "error";

export function useDeliveryAuth(): DeliveryAuthState {
  const customerAuth = useCustomerAuth();
  const devAuth = useDevAuth();
  const localAuthEnabled = customerAuth.mode === "local" || process.env.NEXT_PUBLIC_INDIHUB_ENABLE_LOCAL_AUTH === "true";

  if (localAuthEnabled) {
    const platformUserId = devAuth.userIds.deliveryPartner.trim();

    return {
      mode: "local",
      authHeaders: platformUserId ? { platformUserId } : {},
      authKey: platformUserId ? `local:delivery:${platformUserId}` : "local:delivery:anonymous",
      enabled: Boolean(platformUserId),
      status: platformUserId ? "ready" : "signed-out",
      refresh: () => undefined
    };
  }

  return customerAuth;
}

export function DeliveryShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useDeliveryAuth();
  const accessQuery = useQuery({
    queryKey: ["delivery-access", auth.authKey],
    queryFn: () => getOwnDeliveryPartnerApplication(auth.authHeaders),
    enabled: auth.enabled && auth.status === "ready",
    retry: false,
  });
  const isDeliveryPartner = Boolean(accessQuery.data?.isDeliveryPartner);
  const needsApplication =
    auth.enabled &&
    auth.status === "ready" &&
    accessQuery.isSuccess &&
    !isDeliveryPartner;
  const accessStatus = deliveryAccessStatus(auth, accessQuery.isLoading, Boolean(accessQuery.error), isDeliveryPartner, needsApplication);

  useEffect(() => {
    if (needsApplication && pathname !== "/delivery/register") {
      router.replace("/delivery/register");
    }
  }, [needsApplication, pathname, router]);

  return (
    <DeliveryMaintenanceGate>
      <div className="min-h-screen bg-[#F7F4EE]">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/10 bg-[#123A5A] text-white lg:block">
          <DeliverySidebar pathname={pathname} accessStatus={accessStatus} />
        </aside>
        <main className="lg:pl-72">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
            <div className="mb-6 border-b border-[#D8E2EA] pb-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ED3500]">Delivery partner</p>
              <h1 className="mt-2 text-3xl font-black text-[#123A5A] sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#536579]">{description}</p>
              <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
                {deliveryNav.map((item) => (
                  <Button key={item.href} asChild variant={pathname === item.href ? "primary" : "outline"} size="sm">
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
            <DeliveryAuthNotice />
            {isDeliveryPartner ? (
              children
            ) : (
              <DeliveryAccessGate
                status={accessStatus}
                error={accessQuery.error}
                onRetry={() => void accessQuery.refetch()}
              />
            )}
          </div>
        </main>
      </div>
    </DeliveryMaintenanceGate>
  );
}

function DeliverySidebar({ pathname, accessStatus }: { pathname: string; accessStatus: DeliveryAccessStatus }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-5">
      <Link href="/delivery" className="flex shrink-0 items-center gap-3 rounded-md border border-white/10 bg-white/[0.05] p-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#ED3500] text-sm font-black text-white">1HI</span>
        <span className="min-w-0">
          <span className="block truncate text-xl font-black leading-tight">1HandIndia</span>
          <span className="block truncate text-[11px] font-black uppercase tracking-[0.18em] text-[#FFB19B]">Delivery</span>
        </span>
      </Link>

      <DeliverySidebarStatus accessStatus={accessStatus} />

      <nav className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.28)_transparent] [scrollbar-width:thin]">
        <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#BFD4E5]">Workspace</p>
        <div className="grid gap-1">
          {deliveryNav.map((item) => (
            <DeliveryNavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function DeliverySidebarStatus({ accessStatus }: { accessStatus: DeliveryAccessStatus }) {
  const auth = useDeliveryAuth();
  const ready = accessStatus === "ready";
  const label = sidebarStatusLabel(accessStatus, auth);
  const tone: StatusTone =
    accessStatus === "ready" ? "success" : accessStatus === "error" ? "danger" : "warning";

  return (
    <div className="mt-5 rounded-md border border-white/10 bg-white text-[#123A5A] shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <Truck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">Partner session</p>
            <StatusBadge tone={tone}>{label}</StatusBadge>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[#667085]">
            {ready ? "Assigned delivery workspace" : "Delivery account required"}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeliveryNavLink({
  item,
  pathname
}: {
  item: (typeof deliveryNav)[number];
  pathname: string;
}) {
  const Icon = item.icon;
  const active = item.href === "/delivery" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex min-h-12 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-black transition",
        active ? "bg-[#ED3500] text-white shadow-sm" : "text-[#EEF6FB] hover:bg-white/10 hover:text-white"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md", active ? "bg-white/15 text-white" : "bg-white/10 text-white")}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-current">{item.label}</span>
    </Link>
  );
}

export function DeliveryAuthNotice() {
  const auth = useDeliveryAuth();

  if (auth.enabled) {
    return null;
  }

  if (auth.mode === "local") {
    return <DevAuthPanel role="deliveryPartner" />;
  }

  if (auth.status === "signed-out") {
    return (
      <DeliveryPanel className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#123A5A]" aria-hidden="true" />
              <p className="text-sm font-black text-[#1F2933]">Delivery partner sign in required</p>
              <StatusBadge tone="warning">Signed out</StatusBadge>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#667085]">Sign in with the account assigned by admin to view delivery tasks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/sign-in?redirect_url=/delivery">
                <LogIn size={16} /> Sign in
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/delivery/register">Apply now</Link>
            </Button>
          </div>
        </div>
      </DeliveryPanel>
    );
  }

  if (auth.status === "error") {
    return (
      <DeliveryPanel className="mb-5 border-[#F5B7B7] bg-[#FDECEC]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#8A1F1F]">Delivery account sync failed</p>
            <p className="mt-1 text-xs leading-5 text-[#8A1F1F]">{auth.error ?? "Unable to sync this account."}</p>
          </div>
          <Button type="button" variant="outline" onClick={auth.refresh}>
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      </DeliveryPanel>
    );
  }

  return (
    <DeliveryPanel className="mb-5">
      <div className="flex items-center gap-3 text-sm font-semibold text-[#667085]">
        <Loader2 className="h-4 w-4 animate-spin text-[#123A5A]" aria-hidden="true" />
        Syncing delivery partner account
      </div>
    </DeliveryPanel>
  );
}

function DeliveryAccessGate({
  status,
  error,
  onRetry,
}: {
  status: DeliveryAccessStatus;
  error: unknown;
  onRetry: () => void;
}) {
  if (status === "signed-out") {
    return null;
  }

  if (status === "error") {
    return (
      <DeliveryPanel className="border-[#F5B7B7] bg-[#FDECEC]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#8A1F1F]">Delivery access check failed</p>
            <p className="mt-1 text-xs leading-5 text-[#8A1F1F]">
              {userFacingApiErrorMessage(error)}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      </DeliveryPanel>
    );
  }

  if (status === "needs-application") {
    return (
      <DeliveryPanel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#123A5A]" aria-hidden="true" />
              <p className="text-sm font-black text-[#1F2933]">Delivery partner profile not active</p>
              <StatusBadge tone="warning">Application required</StatusBadge>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#667085]">
              Redirecting to the delivery partner application page. Admin approval is required before this workspace opens.
            </p>
          </div>
          <Button asChild>
            <Link href="/delivery/register">Apply now</Link>
          </Button>
        </div>
      </DeliveryPanel>
    );
  }

  return (
    <DeliveryPanel>
      <div className="flex items-center gap-3 text-sm font-semibold text-[#667085]">
        <Loader2 className="h-4 w-4 animate-spin text-[#123A5A]" aria-hidden="true" />
        Checking delivery partner approval
      </div>
    </DeliveryPanel>
  );
}

export function DeliveryPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-md border border-[#D8E2EA] bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function DeliveryMetric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <DeliveryPanel>
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#123A5A]">{value}</p>
      <p className="mt-1 text-sm font-semibold text-[#667085]">{note}</p>
    </DeliveryPanel>
  );
}

export function DeliveryStatusPill({ status }: { status?: string | null }) {
  const normalized = status ?? "UNKNOWN";
  const tone: StatusTone = normalized === "DELIVERED" ? "success" : normalized === "CANCELLED" ? "danger" : normalized === "PENDING" ? "warning" : "info";

  return <StatusBadge tone={tone}>{humanize(normalized)}</StatusBadge>;
}

export function DeliveryEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <DeliveryPanel>
      <div className="grid min-h-40 place-items-center text-center">
        <div>
          <PackageCheck className="mx-auto h-8 w-8 text-[#ED3500]" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-black text-[#123A5A]">{title}</h2>
          <p className="mt-1 max-w-md text-sm font-semibold leading-6 text-[#667085]">{message}</p>
        </div>
      </div>
    </DeliveryPanel>
  );
}

export function DeliveryError({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const message = userFacingApiErrorMessage(error);

  return (
    <DeliveryPanel className="border-[#F5B7B7] bg-[#FDECEC]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-black text-[#8A1F1F]">{message}</p>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw size={16} /> Retry
          </Button>
        ) : null}
      </div>
    </DeliveryPanel>
  );
}

export function DeliveryIconTile({ children }: { children: ReactNode }) {
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">{children}</span>;
}

export function DeliveryTruckIcon() {
  return <Truck className="h-5 w-5" aria-hidden="true" />;
}

export function humanize(value?: string | null) {
  return (value ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deliveryAccessStatus(
  auth: DeliveryAuthState,
  checking: boolean,
  hasError: boolean,
  isDeliveryPartner: boolean,
  needsApplication: boolean,
): DeliveryAccessStatus {
  if (!auth.enabled || auth.status === "signed-out") {
    return "signed-out";
  }
  if (auth.status === "error" || hasError) {
    return "error";
  }
  if (isDeliveryPartner) {
    return "ready";
  }
  if (needsApplication) {
    return "needs-application";
  }
  if (checking || auth.status === "syncing") {
    return "checking";
  }

  return "checking";
}

function sidebarStatusLabel(status: DeliveryAccessStatus, auth: DeliveryAuthState) {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "needs-application") {
    return "Apply";
  }
  if (status === "checking") {
    return "Checking";
  }
  if (status === "error") {
    return "Error";
  }

  return auth.mode === "local" ? "Setup needed" : humanize(auth.status);
}

export function formatPaise(value?: number | null, currency = "INR") {
  const amount = (value ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
