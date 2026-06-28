"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import {
  Activity,
  ArrowRight,
  BadgePercent,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Database,
  Home,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Menu as MenuIcon,
  Package,
  PanelLeft,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Tags,
  Truck,
  UserCog,
  UserCircle,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { userFacingApiErrorMessage } from "@/lib/api";
import { adminNav } from "@/lib/portal-nav";
import { useAdminAuth } from "./admin-auth-context";

type AdminNavItem = (typeof adminNav)[number];
type AdminNavGroup = { name: string; items: AdminNavItem[] };

const iconByHref: Array<[string, typeof LayoutDashboard]> = [
  ["/admin/settings", Settings],
  ["/admin/audit-logs", ReceiptText],
  ["/admin/storage", Database],
  ["/admin/search", Search],
  ["/admin/payments", Landmark],
  ["/admin/refunds", WalletCards],
  ["/admin/email", Mail],
  ["/admin/push-campaigns", Megaphone],
  ["/admin/notifications", Bell],
  ["/finance", WalletCards],
  ["/admin/finance/ledger", WalletCards],
  ["/admin/finance/payouts", CreditCard],
  ["/admin/finance/statements", ReceiptText],
  ["/admin/finance/settlements", ClipboardList],
  ["/admin/finance/commission-rules", Settings],
  ["/admin/seller-subscriptions", CreditCard],
  ["/admin/reports", Activity],
  ["/admin/delivery-partner-applications", Truck],
  ["/admin/delivery-partners", Truck],
  ["/admin/delivery", Truck],
  ["/admin/locations", Home],
  ["/admin/categories", Tags],
  ["/admin/cms", BookOpen],
  ["/admin/chat", MessageCircle],
  ["/admin/support", ShieldCheck],
  ["/admin/b2b/analytics", BarChart3],
  ["/admin/b2b-enquiries", Building2],
  ["/admin/reviews", Star],
  ["/admin/returns", RotateCcw],
  ["/admin/orders", ClipboardList],
  ["/admin/deals", BadgePercent],
  ["/admin/coupons", BadgePercent],
  ["/admin/products", ShoppingBag],
  ["/admin/sellers", Store],
  ["/admin/business-buyers", Building2],
  ["/admin/users", UserCog],
  ["/admin/customers", UsersRound],
  ["/admin", LayoutDashboard],
];

export function AdminPortalShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const auth = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const redirectTo = useMemo(
    () => (pathname && pathname !== "/admin/login" ? pathname : "/admin"),
    [pathname],
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAdminUser = auth.user?.roles.includes("ADMIN") ?? false;
  const isChatSupportUser = auth.user?.roles.includes("CHAT_SUPPORT") ?? false;

  useEffect(() => {
    if (auth.isReady && auth.isAuthenticated && pathname === "/admin/login") {
      router.replace(isAdminUser ? "/admin" : isChatSupportUser ? "/support/chat" : "/finance");
    }
  }, [auth.isAuthenticated, auth.isReady, isAdminUser, isChatSupportUser, pathname, router]);

  useEffect(() => {
    if (auth.isReady && auth.isAuthenticated && !isAdminUser && pathname !== "/admin/login") {
      router.replace(isChatSupportUser ? "/support/chat" : "/finance");
    }
  }, [auth.isAuthenticated, auth.isReady, isAdminUser, isChatSupportUser, pathname, router]);

  if (
    !auth.isReady ||
    (auth.isAuthenticated && pathname === "/admin/login") ||
    (auth.isAuthenticated && !isAdminUser)
  ) {
    return <AdminLoadingShell />;
  }

  if (!auth.isAuthenticated) {
    return <AdminLoginShell redirectTo={redirectTo} />;
  }

  const activeItem = findActiveItem(pathname);
  const breadcrumbs = buildBreadcrumbs(activeItem, title);
  const isDashboardRoute = pathname === "/admin";

  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <Dialog open={mobileNavOpen} onClose={setMobileNavOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-[#101828]/45 transition data-closed:opacity-0"
        />
        <DialogPanel
          transition
          className="fixed inset-y-0 left-0 flex w-[min(21rem,88vw)] flex-col bg-[#163B5C] text-white shadow-2xl transition duration-200 data-closed:-translate-x-full"
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <AdminBrand />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-md border border-white/15 text-white hover:bg-white/10"
              aria-label="Close admin navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <AdminSidebarContent pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
        </DialogPanel>
      </Dialog>

      <div className="grid min-h-screen bg-[#163B5C] lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="hidden bg-[#163B5C] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
          <div className="border-b border-white/10 p-5">
            <AdminBrand />
          </div>
          <AdminSidebarContent pathname={pathname} />
        </aside>

        <section className="min-w-0 bg-[#FFFCFB]">
          <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FFFCFB]/95 backdrop-blur">
            <div className="flex min-h-16 items-center gap-3 px-4 py-3 lg:px-6">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#163B5C] lg:hidden"
                aria-label="Open admin navigation"
              >
                <MenuIcon className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="hidden items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-black text-[#163B5C] xl:flex">
                <PanelLeft className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                Admin control center
              </div>

              <div className="min-w-0 flex-1">
                <AdminRouteSearch onNavigate={() => setMobileNavOpen(false)} />
              </div>

              <AdminSessionMenu />
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 lg:px-6 lg:py-6">
            {!isDashboardRoute ? (
              <div className="mb-5 border-b border-[#E5E7EB] pb-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0">
                    <AdminBreadcrumbs items={breadcrumbs} />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {activeItem?.group ? (
                        <StatusBadge tone="info">{activeItem.group}</StatusBadge>
                      ) : null}
                      <StatusBadge tone="success">Standalone admin session</StatusBadge>
                    </div>
                    <h1 className="mt-3 text-2xl font-black tracking-normal text-[#1F2933] md:text-3xl">
                      {title}
                    </h1>
                    <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-[#667085]">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminBrand() {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#ED3500] text-sm font-black text-white shadow-sm">
        1HI
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xl font-black leading-tight text-white">
          1HandIndia
        </span>
        <span className="block truncate text-xs font-semibold text-[#DCE8F2]">
          Admin Operations
        </span>
      </span>
    </Link>
  );
}

function AdminSidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups = groupNavigation(adminNav);
  const activeItem = findActiveItem(pathname);

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto p-4 [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="space-y-3">
        {groups.map((group) => {
          const groupActive = group.items.some((item) => item.href === activeItem?.href);
          return (
            <Disclosure
              key={`${group.name}-${pathname}`}
              defaultOpen={groupActive || group.name === "Overview"}
            >
              {({ open }) => (
                <div className="rounded-lg border border-white/10 bg-white/[0.04]">
                  <DisclosureButton className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs font-black uppercase tracking-[0.14em] text-[#BFD4E5] hover:bg-white/5">
                    <span>{group.name || "Admin"}</span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition", open && "rotate-180")}
                      aria-hidden="true"
                    />
                  </DisclosureButton>
                  <DisclosurePanel className="grid gap-1 p-2 pt-0">
                    {group.items.map((item) => (
                      <AdminNavLink
                        key={item.href}
                        item={item}
                        active={item.href === activeItem?.href}
                        {...(onNavigate ? { onNavigate } : {})}
                      />
                    ))}
                  </DisclosurePanel>
                </div>
              )}
            </Disclosure>
          );
        })}
      </div>
    </nav>
  );
}

function AdminNavLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const Icon = iconForHref(item.href);

  return (
    <Link
      href={item.href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold leading-5 transition",
        active
          ? "bg-[#ED3500] text-white shadow-sm"
          : "text-[#EEF6FB] hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {active ? <ChevronRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </Link>
  );
}

function AdminRouteSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const activeItem = findActiveItem(pathname);
  const routes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return adminNav;
    }

    return adminNav.filter((item) =>
      `${item.group ?? ""} ${item.label} ${item.href}`.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <Combobox
      value={null as AdminNavItem | null}
      onChange={(item: AdminNavItem | null) => {
        if (!item) {
          return;
        }
        router.push(item.href);
        setQuery("");
        onNavigate?.();
      }}
    >
      <div className="relative max-w-2xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#667085]"
          aria-hidden="true"
        />
        <ComboboxInput
          aria-label="Search admin routes"
          displayValue={() => query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search admin routes, reports, finance, settings..."
          className="h-11 w-full rounded-md border border-[#D8E2EA] bg-white pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
        />
        <ComboboxOptions
          anchor={{ to: "bottom start", gap: "8px", padding: "12px" }}
          modal={false}
          portal
          transition
          className="z-50 max-h-80 w-[var(--input-width)] overflow-auto rounded-lg border border-[#D8E2EA] bg-white p-1 shadow-xl outline-none transition duration-150 data-closed:scale-95 data-closed:opacity-0"
        >
          {routes.map((item) => {
            const Icon = iconForHref(item.href);
            const active = item.href === activeItem?.href;
            return (
              <ComboboxOption
                key={item.href}
                value={item}
                className={({ focus }) =>
                  cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-[#1F2933]",
                    focus && "bg-[#FFF0EC]",
                  )
                }
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-md",
                    active ? "bg-[#ED3500] text-white" : "bg-[#F8FAFC] text-[#163B5C]",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-black">{item.label}</span>
                  <span className="block truncate text-xs font-semibold text-[#667085]">
                    {item.group ?? "Admin"} / {item.href}
                  </span>
                </span>
              </ComboboxOption>
            );
          })}
          {routes.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm font-semibold text-[#667085]">
              No admin route found.
            </div>
          ) : null}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}

function AdminSessionMenu() {
  const auth = useAdminAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  return (
    <>
      <Menu>
        <MenuButton className="flex h-11 items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:bg-[#FFFCFB] focus:outline-none data-focus:ring-2 data-focus:ring-[#ED3500]">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#ECFDF3] text-[#0F8A5F]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="hidden max-w-40 truncate md:block">{auth.user?.email}</span>
          <ChevronDown className="h-4 w-4 text-[#667085]" aria-hidden="true" />
        </MenuButton>
        <MenuItems
          anchor={{ to: "bottom end", gap: "8px", padding: "12px" }}
          modal={false}
          portal
          transition
          className="z-50 w-72 rounded-lg border border-[#D8E2EA] bg-white p-1 shadow-xl outline-none transition duration-150 data-closed:scale-95 data-closed:opacity-0"
        >
          <div className="border-b border-[#E5E7EB] px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                <UserCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#1F2933]">{auth.user?.email}</p>
                <p className="mt-1 text-xs font-semibold text-[#667085]">
                  Expires {formatDate(auth.expiresAt)}
                </p>
              </div>
            </div>
          </div>
          <MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={() => setPasswordDialogOpen(true)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-black text-[#1F2933]",
                  focus && "bg-[#F8FAFC]",
                )}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Change password
              </button>
            )}
          </MenuItem>
          <MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={() => auth.logout()}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-black text-[#B42318]",
                  focus && "bg-[#FFF0EC]",
                )}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            )}
          </MenuItem>
        </MenuItems>
      </Menu>
      <AdminChangePasswordDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      />
    </>
  );
}

function AdminChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const auth = useAdminAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(null);
      setIsSaving(false);
    }
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (newPassword !== confirmPassword) {
      setNotice({ tone: "danger", message: "New password and confirmation do not match." });
      return;
    }

    setIsSaving(true);
    try {
      await auth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice({ tone: "success", message: "Password changed. Other active admin sessions were signed out." });
    } catch (error) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[100]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/50 transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto px-4 py-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-black text-[#0B1F3A]">
                  Change admin password
                </DialogTitle>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  Update your standalone back-office login password.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#D8E2EA] text-[#667085] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                aria-label="Close password dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {notice ? (
              <div className="mt-4">
                <StatusBadge tone={notice.tone}>{notice.message}</StatusBadge>
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-4">
              <AdminPasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
              <AdminPasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <AdminPasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSaving ||
                    currentPassword.length < 8 ||
                    newPassword.length < 8 ||
                    confirmPassword.length < 8
                  }
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {isSaving ? "Saving..." : "Save password"}
                </Button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function AdminPasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
      />
    </label>
  );
}

function AdminBreadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav
      aria-label="Admin breadcrumbs"
      className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#667085]"
    >
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 ? (
            <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" aria-hidden="true" />
          ) : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-[#ED3500]">
              {item.label}
            </Link>
          ) : (
            <span className="text-[#ED3500]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function AdminLoginShell({ redirectTo }: { redirectTo: string }) {
  const auth = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await auth.login(email, password);
      setPassword("");
      router.replace(redirectTo);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Admin sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(320px,0.82fr)_1.18fr]">
        <section className="flex min-h-[320px] flex-col justify-between bg-[#163B5C] p-6 text-white lg:min-h-screen lg:p-9">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-md bg-[#ED3500] text-base font-black shadow-sm">
                1HI
              </span>
              <span>
                <span className="block text-2xl font-black leading-tight">1HandIndia</span>
                <span className="block text-sm font-semibold text-[#CFE0ED]">Admin Panel</span>
              </span>
            </Link>

            <div className="mt-14 max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF8A70]">
                Operations access
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal md:text-5xl">
                Sign in to manage the marketplace.
              </h1>
              <p className="mt-5 text-base leading-7 text-[#DCE8F2]">
                Admin tools are protected separately from customer, seller, and B2B accounts.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 text-sm font-semibold text-[#DCE8F2]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-[#FF8A70]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              Standalone admin session
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-[#FF8A70]">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </span>
              Seller, order, catalogue, and report controls
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-5 lg:p-10">
          <div className="w-full max-w-[520px]">
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#163B5C]">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Admin sign in
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-normal text-[#1F2933]">
                Welcome back
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                Use your admin email and password to continue.
              </p>
            </div>

            <form
              onSubmit={submit}
              className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm md:p-6"
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                    Admin email
                  </span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="username"
                    className="mt-2 h-12 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                    Password
                  </span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    className="mt-2 h-12 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  />
                </label>
              </div>

              {error ? (
                <p className="mt-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-semibold text-[#9B1C1C]">
                  {errorMessage(error)}
                </p>
              ) : null}

              <Button
                type="submit"
                className="mt-5 h-12 w-full"
                disabled={loading || !email.trim() || password.length < 8}
              >
                {loading ? "Signing in..." : "Sign in"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminLoadingShell() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFCFB] p-6">
      <div className="flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-white px-5 py-4 text-sm font-black text-[#163B5C] shadow-sm">
        <LayoutDashboard className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
        Loading admin workspace
      </div>
    </main>
  );
}

function groupNavigation(nav: AdminNavItem[]): AdminNavGroup[] {
  const groups: AdminNavGroup[] = [];

  for (const item of nav) {
    const name = item.group ?? "Admin";
    const group = groups.find((current) => current.name === name);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ name, items: [item] });
    }
  }

  return groups;
}

function findActiveItem(pathname: string) {
  return [...adminNav]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => matchesPath(pathname, item.href));
}

function matchesPath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function iconForHref(href: string) {
  return iconByHref.find(([prefix]) => href.startsWith(prefix))?.[1] ?? Package;
}

function buildBreadcrumbs(activeItem: AdminNavItem | undefined, title: string) {
  const items: Array<{ label: string; href?: string }> = [{ label: "Admin", href: "/admin" }];

  if (activeItem?.group && activeItem.group !== "Overview") {
    items.push({ label: activeItem.group });
  }

  const lastLabel = activeItem?.label ?? title;
  if (lastLabel !== "Dashboard") {
    items.push({ label: lastLabel });
  }

  return items;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(message: string) {
  if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
    return "Invalid admin email or password.";
  }

  return message || "Admin sign in failed.";
}
