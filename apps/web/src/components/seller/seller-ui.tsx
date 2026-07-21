"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BadgePercent,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Home,
  Inbox,
  Info,
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
  Sparkles,
  Star,
  Store,
  WalletCards,
  Wrench,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";
import {
  createContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
  startTransition,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { MaintenanceGate } from "@/components/maintenance/maintenance-mode";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { IndihubApiError, userFacingApiErrorMessage } from "@/lib/api";
import type { IndihubAuthHeaders } from "@/lib/api";
import {
  uploadPublicImage,
  validatePublicImageFile,
  type PublicImageUploadPurpose,
} from "@/lib/public-image-upload";
import { getSellerProfile, type SellerCapability, type SellerProfile } from "@/lib/seller-api";
import { sellerNav } from "@/lib/portal-nav";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const SellerWorkspaceRootContext = createContext(false);

const sellerNavIcons: Record<string, ReactNode> = {
  "/seller": <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
  "/seller/profile": <Store className="h-4 w-4" aria-hidden="true" />,
  "/seller/store-profile": <Store className="h-4 w-4" aria-hidden="true" />,
  "/seller/pending-approval": <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  "/seller/register": <UserRound className="h-4 w-4" aria-hidden="true" />,
  "/seller/products": <Boxes className="h-4 w-4" aria-hidden="true" />,
  "/seller/services": <Wrench className="h-4 w-4" aria-hidden="true" />,
  "/seller/service-bookings": <ClipboardList className="h-4 w-4" aria-hidden="true" />,
  "/seller/service-calendar": <BarChart3 className="h-4 w-4" aria-hidden="true" />,
  "/seller/service-reviews": <Star className="h-4 w-4" aria-hidden="true" />,
  "/seller/deals": <BadgePercent className="h-4 w-4" aria-hidden="true" />,
  "/seller/coupons": <BadgePercent className="h-4 w-4" aria-hidden="true" />,
  "/seller/orders": <ShoppingBag className="h-4 w-4" aria-hidden="true" />,
  "/seller/returns": <RotateCcw className="h-4 w-4" aria-hidden="true" />,
  "/seller/reviews": <Star className="h-4 w-4" aria-hidden="true" />,
  "/seller/b2b-enquiries": <MessageSquareText className="h-4 w-4" aria-hidden="true" />,
  "/seller/b2b-orders": <ReceiptText className="h-4 w-4" aria-hidden="true" />,
  "/seller/reports": <BarChart3 className="h-4 w-4" aria-hidden="true" />,
  "/seller/subscription": <CreditCard className="h-4 w-4" aria-hidden="true" />,
  "/seller/finance/wallet": <WalletCards className="h-4 w-4" aria-hidden="true" />,
  "/seller/finance/payouts": <ReceiptText className="h-4 w-4" aria-hidden="true" />,
  "/seller/finance/statements": <ClipboardList className="h-4 w-4" aria-hidden="true" />
};

export function SellerWorkspaceShell({
  title,
  description,
  children,
  actions
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const hasPersistentRoot = useContext(SellerWorkspaceRootContext);
  const page = (
    <SellerWorkspacePage
      {...(title !== undefined ? { title } : {})}
      {...(description !== undefined ? { description } : {})}
      {...(actions !== undefined ? { actions } : {})}
    >
      {children}
    </SellerWorkspacePage>
  );

  return hasPersistentRoot ? page : <SellerWorkspaceRoot>{page}</SellerWorkspaceRoot>;
}

function SellerWorkspacePage({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <>
      {title ? (
        <header className="mb-6 border-b border-[#D9E2EA] pb-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ED3500]">Seller Center</p>
              <h1 className="mt-2 max-w-5xl text-3xl font-black tracking-normal text-[#123A5A] md:text-4xl">{title}</h1>
              {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-[#5F6F82] md:text-base">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2 xl:justify-end">{actions}</div> : null}
          </div>
        </header>
      ) : null}
      {children}
    </>
  );
}

export function SellerWorkspaceRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sellerAuth = useSellerAuth();
  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });
  const visibleNav = filterSellerNav(profileQuery.data);
  const navGroups = sellerNavGroups(visibleNav);

  const isSignedOut = sellerAuth.status === "signed-out";
  const isLoading = sellerAuth.status === "syncing" || profileQuery.isLoading;
  const requiresOnboarding = Boolean(profileQuery.error && isSellerOnboardingRequiredError(profileQuery.error));
  
  // Only show the sidebar if the user is authenticated AND does not explicitly require onboarding.
  // During the loading state, we hide the sidebar if we haven't fetched their profile yet to avoid flashing.
  // We can show it optimistically if we have profileQuery.data, otherwise we wait.
  const showSidebar = !isSignedOut && !requiresOnboarding && (!isLoading || Boolean(profileQuery.data));

  return (
    <SellerWorkspaceRootContext.Provider value>
      <MaintenanceGate scope="seller">
        <main className="min-h-screen bg-[#F6F3EC] text-[#1F2933]">
          <div className={cn("min-h-screen", showSidebar ? "grid lg:grid-cols-[300px_minmax(0,1fr)]" : "flex flex-col")}>
            {showSidebar ? (
              <aside className="hidden border-r border-[#D9E2EA] bg-[#123A5A] text-white lg:block">
                <SellerSidebar pathname={pathname} items={visibleNav} profile={profileQuery.data} />
              </aside>
            ) : null}

            <section className="min-w-0 flex flex-1 flex-col">
            {showSidebar ? (
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
                <nav className="mt-3 max-h-[70vh] overflow-y-auto rounded-lg border border-[#D9E2EA] bg-white p-2 shadow-sm">
                  <div className="grid gap-3">
                    {navGroups.map((group) => (
                      <div key={group.label}>
                        <p className="px-2 pb-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#667085]">{group.label}</p>
                        <div className="grid gap-1">
                          {group.items.map((item) => (
                            <SellerNavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileOpen(false)} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <SellerLogoutButton className="mt-1 w-full justify-start" onClick={() => setMobileOpen(false)} />
                </nav>
              ) : null}
            </div>
            ) : null}

            <div className={cn("flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8", !showSidebar && "mx-auto w-full max-w-5xl")}>
              {children}
            </div>
            {!showSidebar ? <StorefrontFooter /> : null}
            </section>
          </div>
        </main>
      </MaintenanceGate>
    </SellerWorkspaceRootContext.Provider>
  );
}

function SellerSidebar({
  pathname,
  items,
  profile
}: {
  pathname: string;
  items: SellerNavItem[];
  profile?: SellerProfile | undefined;
}) {
  const groups = sellerNavGroups(items);
  const operationCopy = operationSummary(profile);
  const capabilities = sellerCapabilities(profile);
  const storeName = profile?.storeName?.trim() || "Seller Center";
  const logoUrl = profile?.profile?.logoUrl ?? profile?.profile?.bannerUrl ?? null;

  return (
    <div className="sticky top-0 flex h-screen min-h-0 flex-col overflow-hidden px-3 py-3">
      <Link href="/seller" className="flex shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-3">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-[#ED3500] text-sm font-black text-white">
          {logoUrl ? <StorefrontImage src={logoUrl} alt={storeName} sizes="44px" fallbackLabel={storeName} /> : "1HI"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-black leading-tight">{storeName}</span>
          <span className="block truncate text-xs font-semibold text-[#DCE8F2]">1HandIndia Seller Center</span>
        </span>
      </Link>

      <div className="mt-3 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] p-3">
        <div className="flex flex-wrap gap-2">
          {capabilities.map((capability) => (
            <span key={capability} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-white">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {capability === "SERVICE" ? "Services" : "Retail"}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-[#DCE8F2]">{operationCopy.description}</p>
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.28)_transparent] [scrollbar-width:thin]">
        <div className="space-y-3">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`seller-nav-${group.key}`}>
              <p id={`seller-nav-${group.key}`} className="px-2 pb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#BFD4E5]">{group.label}</p>
              <div className="grid gap-1">
                {group.items.map((item) => (
                  <SellerNavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-white/[0.06] p-3">
        <p className="text-sm font-black leading-5">{operationCopy.title}</p>
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
  item: SellerNavItem;
  pathname: string;
  onClick?: () => void;
}) {
  const active = item.href === "/seller" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      {...(onClick ? { onClick } : {})}
      className={cn(
        "group flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition",
        active
          ? "bg-[#EAF1F7] shadow-sm lg:bg-white"
          : "text-[#1F2933] hover:bg-[#F6F3EC] lg:text-[#DCE8F2] lg:hover:bg-white/10"
      )}
      style={active ? { color: "#123A5A" } : undefined}
      aria-current={active ? "page" : undefined}
    >
      <span className={cn("grid h-5 w-5 shrink-0 place-items-center text-current", active ? "text-[#ED3500]" : "lg:text-[#BFD4E5] lg:group-hover:text-white")}>
        {sellerNavIcons[item.href] ?? <ClipboardList className="h-4 w-4" aria-hidden="true" />}
      </span>
      <span className="truncate text-current">{item.label}</span>
    </Link>
  );
}

type SellerNavItem = (typeof sellerNav)[number];

function sellerNavGroups(items: SellerNavItem[]) {
  const order = ["Overview", "Setup", "Retail", "Services", "B2B", "Insights", "Finance"];
  return order
    .map((label) => ({
      key: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      items: items.filter((item) => item.group === label)
    }))
    .filter((group) => group.items.length > 0);
}

function filterSellerNav(profile?: SellerProfile | null) {
  const capabilities = sellerCapabilities(profile);
  return sellerNav.filter((item) => {
    if (item.capability === "ALL") {
      return true;
    }

    return capabilities.includes(item.capability);
  });
}

function sellerCapabilities(profile?: SellerProfile | null): SellerCapability[] {
  if (!profile) {
    return [];
  }

  if (profile.enabledCapabilities?.length) {
    return profile.enabledCapabilities;
  }

  return profile.primaryCapability ? [profile.primaryCapability] : ["RETAIL"];
}

function operationSummary(profile?: SellerProfile | null) {
  const capabilities = sellerCapabilities(profile);
  const retail = capabilities.includes("RETAIL");
  const service = capabilities.includes("SERVICE");

  if (service && !retail) {
    return {
      title: "Service operations",
      description: "Services, bookings, calendar, subscription, and payouts in one place."
    };
  }

  if (retail && service) {
    return {
      title: "Store and service operations",
      description: "Products, orders, services, bookings, and finance in one place."
    };
  }

  return {
    title: "Store operations",
    description: "Catalogue, orders, delivery, and enquiries in one place."
  };
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
    status: "signed-out" as const,
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
            <Link href="/seller/sign-in?redirect_url=/seller/register">
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
          <Button type="button" variant="outline" size="sm" onClick={() => startTransition(() => { sellerAuth.refresh(); })}>
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

export function SellerPanel({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"section"> & { children: ReactNode }) {
  return (
    <section
      className={cn("rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm", className)}
      {...props}
    >
      {children}
    </section>
  );
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

export function SellerStartWelcome({
  message = "Create one seller profile, then choose whether you want to sell products, offer services, or run both from the same seller center."
}: {
  message?: string;
}) {
  const options = [
    {
      href: "/seller/choose-plan?mode=retail",
      title: "Retail Seller",
      label: "Products Only",
      description: "Sell catalogue products with orders, returns, B2B enquiries, stock alerts, and seller payouts.",
      action: "Start retail",
      icon: <Store className="h-7 w-7" aria-hidden="true" />,
      points: ["Product catalogue", "Customer orders", "B2B enquiries"]
    },
    {
      href: "/seller/choose-plan?mode=service",
      title: "Service Provider",
      label: "Services Only",
      description: "List repair, installation, maintenance, inspection, consultation, and local or remote services.",
      action: "Start services",
      icon: <Wrench className="h-7 w-7" aria-hidden="true" />,
      points: ["Service listings", "Bookings and quotes", "Service calendar"]
    },
    {
      href: "/seller/choose-plan?mode=both",
      title: "Retail + Services",
      label: "Combined Profile",
      description: "Use one verified business profile for product selling and service bookings together.",
      action: "Start both",
      icon: <Sparkles className="h-7 w-7" aria-hidden="true" />,
      points: ["Products and services", "Single verification process", "Unified payouts"]
    }
  ];

  return (
    <div className="relative w-screen max-w-[100vw] left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] overflow-hidden bg-[#FFFCFB] pt-16 pb-24 sm:pt-20 sm:pb-32 -mt-5 lg:-mt-8 mb-0 border-b border-[#F1D7CF]">
      {/* Subtle Background Patterns or Glows */}
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#ED3500]/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#ED3500]/5 blur-[130px] pointer-events-none" />

      {/* Hero Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-5 text-center sm:px-7 lg:px-8">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-[0_16px_32px_rgba(237,53,0,0.15)] ring-1 ring-black/5">
          <img src="/brand/1handindia_logo.png" alt="1HandIndia" className="h-full w-full object-cover" fetchPriority="high" />
        </div>
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#ED3500]/20 bg-[#ED3500]/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#ED3500] shadow-sm">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Seller Center
        </span>
        <h2 className="mt-8 text-4xl font-black tracking-tight text-[#111827] sm:text-6xl lg:text-7xl">
          Welcome to <span className="text-[#ED3500]">1HandIndia</span> Seller Hub
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg font-semibold leading-8 text-[#667085] sm:text-xl">
          {message}
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-4 text-sm font-bold text-[#1F2933]">
          {["Secure verification", "Tailored dashboard", "Quality assured marketplace"].map((item) => (
            <span key={item} className="flex items-center gap-2 rounded-full bg-white border border-[#E5E7EB] px-5 py-2.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#ED3500]" aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Modern High-Contrast Cards */}
      <div className="relative z-20 mx-auto mt-20 max-w-7xl px-5 sm:px-7 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm transition-all duration-500 hover:-translate-y-3 hover:border-[#ED3500]/30 hover:shadow-[0_30px_60px_-15px_rgba(237,53,0,0.15)]"
            >
              <div className="relative z-10 flex items-start justify-between gap-3">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#FFF5F2] text-[#ED3500] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-[#ED3500] group-hover:text-white">
                  {option.icon}
                </span>
                <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#667085] group-hover:border-[#ED3500]/20 group-hover:bg-[#FFF5F2] group-hover:text-[#ED3500]">
                  {option.label}
                </span>
              </div>
              <h4 className="relative z-10 mt-8 text-3xl font-black text-[#111827]">{option.title}</h4>
              <p className="relative z-10 mt-4 flex-1 text-base font-medium leading-relaxed text-[#667085]">
                {option.description}
              </p>
              <div className="relative z-10 mt-8 grid gap-3">
                {option.points.map((point) => (
                  <span key={point} className="flex items-center gap-3 text-sm font-bold text-[#1F2933]">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0F8A5F]" aria-hidden="true" />
                    {point}
                  </span>
                ))}
              </div>
              <span className="relative z-10 mt-10 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] px-5 py-4 text-sm font-black text-[#111827] transition-all duration-300 group-hover:bg-[#ED3500] group-hover:border-[#ED3500] group-hover:text-white group-hover:shadow-lg group-hover:gap-4">
                {option.action}
                <ArrowRight className="h-4 w-4 transition-transform" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* App Download Promo */}
      <div className="relative z-20 mx-auto mt-24 max-w-5xl px-5 sm:px-7 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 rounded-[2.5rem] bg-[#FFF5F2] px-8 pt-12 md:px-16 md:pt-0 border border-[#ED3500]/10 overflow-hidden shadow-sm">
          
          {/* Text & QR */}
          <div className="flex-1 max-w-lg md:py-20 pb-12 md:pb-20 text-center md:text-left">
            <h3 className="text-3xl md:text-4xl font-black text-[#111827] tracking-tight">
              Manage your business <br className="hidden md:block"/>on the go
            </h3>
            <p className="mt-5 text-base font-medium leading-relaxed text-[#667085]">
              The 1HandIndia Seller app is packed with features to help you manage and grow your retail or service business wherever you are. Take care of operations right from your phone.
            </p>
            
            <div className="mt-10 flex flex-col md:flex-row items-center gap-6">
              <div className="shrink-0 rounded-2xl bg-white p-3 shadow-md border border-[#E5E7EB]">
                {/* Dynamically generated QR pointing to Playstore */}
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://play.google.com/store/apps/details?id=com.onehandindia.seller" 
                  alt="Scan to download" 
                  className="h-20 w-20"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="text-center md:text-left">
                <p className="text-sm font-black text-[#111827]">Scan to download</p>
                <p className="text-xs font-semibold text-[#667085] mt-1 flex items-center gap-2 justify-center md:justify-start">
                  Available on Android
                  <span className="rounded-full bg-[#FFFCFB] border border-[#ED3500]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ED3500] shadow-sm">
                    Coming Soon
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* AI Mockup Image */}
          <div className="relative w-full md:w-[320px] shrink-0 self-end px-6 md:px-0 mt-8 md:mt-16">
            <img 
              src="/brand/mobile_seller_app_mockup.jpg" 
              alt="1HandIndia Seller App" 
              className="w-full h-auto drop-shadow-2xl rounded-t-[2.5rem] border-x-8 border-t-8 border-[#111827] bg-[#111827]"
              loading="lazy"
              decoding="async"
            />
          </div>

        </div>
      </div>
    </div>
  );
}

export function SellerOnboardingRequired({ message = "Create a seller profile for this account before using seller center tools." }: { message?: string }) {
  return (
    <SellerStartWelcome message={message} />
  );
}

export function isSellerOnboardingRequiredError(error: unknown) {
  return error instanceof IndihubApiError && [403, 404].includes(error.status);
}

export function isSellerApproved(profile?: Pick<SellerProfile, "status" | "approvalStatus"> | null) {
  return profile?.status === "APPROVED" && profile?.approvalStatus === "APPROVED";
}

export function isSellerPendingReview(
  profile?: Pick<SellerProfile, "status" | "approvalStatus"> | null,
) {
  return !isSellerApproved(profile);
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
          <Button type="button" variant="outline" size="sm" onClick={() => startTransition(() => { onRetry(); })}>
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
    hint,
    info,
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
    hint?: string;
    info?: ReactNode;
  min?: number;
  step?: string;
  readOnly?: boolean;
}) {
    const inputId = `seller-field-${name}`;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wide text-[#667085]">
            {label}
          </label>
          {info}
        </div>
        <input
          id={inputId}
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
        {hint ? <span className="block text-xs font-semibold leading-5 text-[#667085]">{hint}</span> : null}
      </div>
    );
  }

export function SellerInfoHint({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const tooltipId = useId();

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Information about ${label}`}
        aria-describedby={tooltipId}
        className="grid h-5 w-5 place-items-center rounded-full text-[#667085] outline-none transition hover:bg-[#FFF0EC] hover:text-[#ED3500] focus-visible:ring-2 focus-visible:ring-[#ED3500] focus-visible:ring-offset-2"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-[180] mt-2 w-72 max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-left text-xs font-semibold normal-case leading-5 tracking-normal text-[#475467] opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

export type SellerNotice = {
  tone: "success" | "danger" | "warning" | "info";
  message: string;
};

export function SellerNoticeBadge({ notice, className }: { notice: SellerNotice | null; className?: string }) {
  if (!notice) {
    return null;
  }

  return (
    <StatusBadge tone={notice.tone} {...(className !== undefined ? { className } : {})}>
      {notice.message}
    </StatusBadge>
  );
}

export function SellerPagination({
  page,
  pageSize,
  total,
  isLoading,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
}: {
  page: number;
  pageSize: number;
  total: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(total, currentPage * pageSize);

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm font-semibold text-[#667085]">
        {isLoading
          ? `Loading ${itemLabel}...`
          : `Showing ${firstItem.toLocaleString("en-IN")}-${lastItem.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} ${itemLabel}`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          disabled={isLoading}
          className="h-9 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] disabled:opacity-50"
        >
          {[10, 20, 30, 50, 100].map((size) => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1 || isLoading} onClick={() => onPageChange(currentPage - 1)}>
          Previous
        </Button>
        <span className="min-w-24 text-center text-sm font-bold text-[#1F2933]">Page {currentPage} of {pageCount}</span>
        <Button type="button" variant="outline" size="sm" disabled={currentPage >= pageCount || isLoading} onClick={() => onPageChange(currentPage + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function SellerCursorPagination({
  hasPreviousPage,
  hasNextPage,
  isLoading,
  onPreviousPage,
  onNextPage,
}: {
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isLoading?: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  if (!hasPreviousPage && !hasNextPage) {
    return null;
  }

  return (
    <div className="flex justify-end gap-2 border-t border-[#E2E8F0] px-4 py-4">
      <Button type="button" variant="outline" size="sm" disabled={!hasPreviousPage || isLoading} onClick={onPreviousPage}>
        Previous
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!hasNextPage || isLoading} onClick={onNextPage}>
        Next
      </Button>
    </div>
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

    try {
      validatePublicImageFile(file);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Image is not valid.");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
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

  if (status === "NEGOTIATING") {
    return "info";
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

export { rupeesToPaise } from "./seller-money";

export function paiseToRupees(value?: number | null) {
  return value ? String(value / 100) : "";
}
