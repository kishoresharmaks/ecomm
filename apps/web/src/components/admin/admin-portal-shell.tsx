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
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  Home,
  ImageIcon,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Megaphone,
  Menu as MenuIcon,
  MessageCircle,
  Package,
  PanelLeft,
  PlugZap,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
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
import { AdminMfaSetupResult, AdminMfaStatus, useAdminAuth } from "./admin-auth-context";

type AdminNavItem = (typeof adminNav)[number];
type AdminNavGroup = { name: string; items: AdminNavItem[] };

const iconByHref: Array<[string, typeof LayoutDashboard]> = [
  ["/admin/settings", Settings],
  ["/admin/audit-logs", ReceiptText],
  ["/admin/storage", Database],
  ["/admin/search", Search],
  ["/admin/b2b-integrations", PlugZap],
  ["/admin/payments", Landmark],
  ["/admin/refunds", WalletCards],
  ["/admin/email", Mail],
  ["/admin/push-campaigns", Megaphone],
  ["/admin/notifications", Bell],
  ["/finance", WalletCards],
  ["/admin/finance/seller-cash-receivables", WalletCards],
  ["/admin/finance/ledger", WalletCards],
  ["/admin/finance/payouts", CreditCard],
  ["/admin/finance/statements", ReceiptText],
  ["/admin/finance/gst-reports", ReceiptText],
  ["/admin/finance/settlements", ClipboardList],
  ["/admin/finance/commission-rules", Settings],
  ["/admin/seller-subscriptions", CreditCard],
  ["/admin/subscribed-sellers", Store],
  ["/admin/reports", Activity],
  ["/admin/delivery-partner-applications", Truck],
  ["/admin/delivery-partners", Truck],
  ["/admin/delivery", Truck],
  ["/admin/locations", Home],
  ["/admin/categories", Tags],
  ["/admin/cms/announcements", Megaphone],
  ["/admin/cms/popup-announcements", ImageIcon],
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
          name="admin-search"
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
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);

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
                onClick={() => setMfaDialogOpen(true)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-black text-[#1F2933]",
                  focus && "bg-[#F8FAFC]",
                )}
              >
                <ShieldCheck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                Two-factor auth (2FA)
              </button>
            )}
          </MenuItem>
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
      <AdminMfaSecurityDialog
        open={mfaDialogOpen}
        onClose={() => setMfaDialogOpen(false)}
      />
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

function AdminMfaSecurityDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const auth = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AdminMfaStatus | null>(null);
  const [view, setView] = useState<"STATUS" | "SETUP" | "RECOVERY_CODES" | "DISABLE" | "REGENERATE">("STATUS");
  const [setupData, setSetupData] = useState<AdminMfaSetupResult | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      void loadStatus();
    } else {
      setView("STATUS");
      setSetupData(null);
      setVerificationCode("");
      setRecoveryCodes([]);
      setPassword("");
      setCopied(false);
      setNotice(null);
    }
  }, [open]);

  async function loadStatus() {
    setLoading(true);
    setNotice(null);
    try {
      const data = await auth.getMfaStatus();
      setStatus(data);
      setView("STATUS");
    } catch (err) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  async function startSetup() {
    setIsProcessing(true);
    setNotice(null);
    try {
      const data = await auth.setupMfa();
      setSetupData(data);
      setView("SETUP");
    } catch (err) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(err) });
    } finally {
      setIsProcessing(false);
    }
  }

  async function submitConfirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setupData) return;
    setIsProcessing(true);
    setNotice(null);
    try {
      const result = await auth.confirmMfa(verificationCode, setupData.secret);
      setRecoveryCodes(result.recoveryCodes);
      setStatus({ mfaEnabled: true, mfaType: "TOTP", remainingRecoveryCodes: result.recoveryCodes.length });
      setView("RECOVERY_CODES");
      setVerificationCode("");
    } catch (err) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(err) });
    } finally {
      setIsProcessing(false);
    }
  }

  async function submitDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsProcessing(true);
    setNotice(null);
    try {
      await auth.disableMfa(password, verificationCode);
      setStatus({ mfaEnabled: false, mfaType: "NONE", remainingRecoveryCodes: 0 });
      setView("STATUS");
      setPassword("");
      setVerificationCode("");
      setNotice({ tone: "success", message: "Two-Factor Authentication has been disabled." });
    } catch (err) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(err) });
    } finally {
      setIsProcessing(false);
    }
  }

  async function submitRegenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsProcessing(true);
    setNotice(null);
    try {
      const result = await auth.regenerateRecoveryCodes(password, verificationCode);
      setRecoveryCodes(result.recoveryCodes);
      setStatus((prev) => (prev ? { ...prev, remainingRecoveryCodes: result.recoveryCodes.length } : null));
      setView("RECOVERY_CODES");
      setPassword("");
      setVerificationCode("");
    } catch (err) {
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(err) });
    } finally {
      setIsProcessing(false);
    }
  }

  function copyAllCodes() {
    if (recoveryCodes.length === 0) return;
    const text = `1HandIndia Emergency Recovery Codes:\n${recoveryCodes.join("\n")}\n\nKeep these codes in a secure, private location.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
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
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ED3500]/10 text-[#ED3500]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-[#0B1F3A]">
                    Two-Factor Authentication (2FA)
                  </DialogTitle>
                  <p className="text-xs font-semibold text-[#667085]">
                    RFC 6238 TOTP Security & Recovery Keys
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#D8E2EA] text-[#667085] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                aria-label="Close MFA dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {notice ? (
              <div className="mt-4">
                <StatusBadge tone={notice.tone}>{notice.message}</StatusBadge>
              </div>
            ) : null}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#64748B]">
                <LayoutDashboard className="h-6 w-6 animate-spin text-[#ED3500]" />
                <p className="mt-2 text-xs font-semibold">Loading security status...</p>
              </div>
            ) : view === "STATUS" ? (
              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-lg text-white",
                        status?.mfaEnabled ? "bg-[#0F8A5F]" : "bg-[#64748B]",
                      )}
                    >
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-[#0F172A]">
                        {status?.mfaEnabled ? "Authenticator App Active" : "Two-Factor Auth Disabled"}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {status?.mfaEnabled
                          ? `${status.remainingRecoveryCodes} backup recovery codes available`
                          : "Protect your account with Google Authenticator or Apple Keychain"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      status?.mfaEnabled ? "bg-[#ECFDF3] text-[#0F8A5F]" : "bg-[#F1F5F9] text-[#64748B]",
                    )}
                  >
                    {status?.mfaEnabled ? "Enabled" : "Off"}
                  </span>
                </div>

                {status?.mfaEnabled ? (
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 justify-center gap-2"
                      onClick={() => {
                        setNotice(null);
                        setView("REGENERATE");
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Regenerate Recovery Codes</span>
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 justify-center gap-2 bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                      onClick={() => {
                        setNotice(null);
                        setView("DISABLE");
                      }}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      <span>Disable 2FA</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="w-full justify-center gap-2 bg-[#ED3500] text-white"
                    disabled={isProcessing}
                    onClick={startSetup}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{isProcessing ? "Starting enrollment..." : "Set Up Two-Factor Authentication"}</span>
                  </Button>
                )}
              </div>
            ) : view === "SETUP" && setupData ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#475569]">
                  <p className="font-bold text-[#0F172A]">Step 1: Link Authenticator App</p>
                  <p className="mt-1">
                    Open Google Authenticator, Apple Passwords / Keychain, 1Password, or Authy, add a new account, and enter this key manually:
                  </p>
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-mono text-sm font-black tracking-wider text-[#0F172A]">
                    <span className="select-all">{setupData.secret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(setupData.secret);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-[#ED3500] hover:bg-[#FFF0EC]"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="mt-2 text-center">
                    <a
                      href={setupData.otpauthUri}
                      className="text-[11px] font-bold text-[#ED3500] hover:underline"
                    >
                      Open directly in authenticator app (otpauth://)
                    </a>
                  </div>
                </div>

                <form onSubmit={submitConfirmSetup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#475569]">
                      Step 2: Enter 6-Digit Code
                    </label>
                    <input
                      name="code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      type="text"
                      autoFocus
                      required
                      placeholder="123456"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] px-4 text-center font-mono text-lg font-black tracking-widest text-[#0F172A] outline-none focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10"
                    />
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setView("STATUS")}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isProcessing || verificationCode.trim().length < 6}
                      className="bg-[#ED3500] text-white"
                    >
                      {isProcessing ? "Activating..." : "Confirm & Activate 2FA"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : view === "RECOVERY_CODES" ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#FEF08A] bg-[#FEFCE8] p-4 text-xs text-[#854D0E]">
                  <p className="font-bold">Important: Save Your Backup Recovery Codes</p>
                  <p className="mt-1">
                    If you lose access to your authenticator device, each recovery code can be used exactly once to log in. Store them in a password manager or safe location.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] p-3 font-mono text-xs font-bold text-[#0F172A]">
                  {recoveryCodes.map((code, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 border border-[#E2E8F0]">
                      <span className="text-[#94A3B8] font-normal">{idx + 1}.</span>
                      <span>{code}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyAllCodes}
                    className="gap-1.5"
                  >
                    {copied ? <Check className="h-4 w-4 text-[#0F8A5F]" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? "Copied to Clipboard!" : "Copy All Codes"}</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setView("STATUS");
                    }}
                    className="bg-[#0F8A5F] text-white hover:bg-[#0B6B4A]"
                  >
                    <span>I Have Saved These Codes</span>
                  </Button>
                </div>
              </div>
            ) : view === "DISABLE" ? (
              <form onSubmit={submitDisable} className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs text-[#991B1B]">
                  <p className="font-bold">Disable Two-Factor Authentication</p>
                  <p className="mt-1">
                    Disabling 2FA reduces account security. You will need your current password and a 6-digit code or recovery code.
                  </p>
                </div>

                <AdminPasswordField
                  label="Current admin password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#475569]">
                    6-Digit Code or Recovery Code
                  </label>
                  <input
                    name="verificationCode"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    type="text"
                    required
                    placeholder="123456 or XXXX-XXXX-XXXX"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] px-4 font-mono text-sm font-semibold text-[#0F172A] outline-none focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10"
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setView("STATUS")}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                    disabled={isProcessing || password.length < 8 || verificationCode.trim().length < 6}
                  >
                    {isProcessing ? "Disabling..." : "Confirm & Disable 2FA"}
                  </Button>
                </div>
              </form>
            ) : view === "REGENERATE" ? (
              <form onSubmit={submitRegenerate} className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#FEF08A] bg-[#FEFCE8] p-4 text-xs text-[#854D0E]">
                  <p className="font-bold">Regenerate Emergency Recovery Codes</p>
                  <p className="mt-1">
                    Generating new recovery codes will immediately invalidate all existing backup codes.
                  </p>
                </div>

                <AdminPasswordField
                  label="Current admin password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-[#475569]">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    name="verificationCode"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    type="text"
                    required
                    placeholder="123456"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] px-4 font-mono text-sm font-semibold text-[#0F172A] outline-none focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10"
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setView("STATUS")}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isProcessing || password.length < 8 || verificationCode.trim().length < 6}
                    className="bg-[#ED3500] text-white"
                  >
                    {isProcessing ? "Regenerating..." : "Generate New Codes"}
                  </Button>
                </div>
              </form>
            ) : null}
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
        name={label.replace(/\s+/g, '-').toLowerCase()}
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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [step, setStep] = useState<"PASSWORD" | "MFA">("PASSWORD");
  const [mfaTicket, setMfaTicket] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleKeyEvent(event: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof event.getModifierState === "function") {
      setCapsLockActive(event.getModifierState("CapsLock"));
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await auth.login(email, password);
      if (result.mfaRequired) {
        setMfaTicket(result.mfaTicket);
        setStep("MFA");
        setMfaCode("");
      } else {
        setPassword("");
        router.replace(redirectTo);
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Admin sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await auth.verifyMfa(mfaTicket, mfaCode, useRecoveryCode);
      setPassword("");
      router.replace(redirectTo);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FFFCFB] p-4 sm:p-6 lg:p-10 text-[#1F2933]">
      {/* Ambient background glow accents adhering to brand palette */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-[#ED3500]/12 via-[#FF8A70]/8 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-[550px] w-[550px] rounded-full bg-gradient-to-tr from-[#163B5C]/10 via-[#0F172A]/5 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:24px_24px] opacity-60"
        aria-hidden="true"
      />

      {/* Main Glassmorphic Curved Container */}
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[28px] border border-black/[0.08] bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-all duration-300 sm:rounded-[36px] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left Brand Showcase */}
        <section className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#162536] to-[#0A101D] p-8 text-center text-white sm:p-10 lg:p-12">
          {/* Subtle warm glow inside dark panel */}
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#ED3500]/25 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col items-center gap-4">
            <Link href="/" className="inline-flex flex-col items-center gap-3.5 transition-opacity hover:opacity-90">
              <img
                src="/brand/1handindia_logo.png"
                alt="1HandIndia"
                className="h-16 w-auto object-contain drop-shadow-md sm:h-20"
              />
              <span className="block text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                1HandIndia
              </span>
            </Link>
          </div>
        </section>

        {/* Right Form Panel */}
        <section className="flex flex-col justify-center bg-white p-8 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            {step === "PASSWORD" ? (
              <>
                <div className="mb-6">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#163B5C]">
                    <LockKeyhole className="h-3.5 w-3.5 text-[#ED3500]" aria-hidden="true" />
                    Administrator Sign In
                  </span>
                  <h2 className="mt-4 text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
                    Welcome back
                  </h2>
                </div>

                <form onSubmit={submitPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#475569]">
                      Admin Email
                    </label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <input
                        name="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        type="email"
                        autoComplete="username"
                        required
                        className="h-12 w-full rounded-2xl border border-[#D8E2EA] bg-[#F8FAFC] pl-11 pr-4 text-sm font-semibold text-[#0F172A] outline-none transition-all duration-200 focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black uppercase tracking-wider text-[#475569]">
                        Password
                      </label>
                      {capsLockActive && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#D97706]">
                          <AlertCircle className="h-3 w-3" /> Caps Lock is ON
                        </span>
                      )}
                    </div>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <input
                        name="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onKeyDown={handleKeyEvent}
                        onKeyUp={handleKeyEvent}
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        className="h-12 w-full rounded-2xl border border-[#D8E2EA] bg-[#F8FAFC] pl-11 pr-11 text-sm font-semibold text-[#0F172A] outline-none transition-all duration-200 focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#94A3B8] transition-colors hover:text-[#475569]"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-xs font-semibold text-[#991B1B]">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
                      <span>{errorMessage(error)}</span>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading || !email.trim() || password.length < 8}
                    className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ED3500] text-sm font-black text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:bg-[#D42F00] hover:shadow-orange-500/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    {loading ? (
                      <>
                        <LayoutDashboard className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Verifying credentials...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("PASSWORD");
                      setError("");
                    }}
                    className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to password</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#163B5C]">
                      <KeyRound className="h-3.5 w-3.5 text-[#ED3500]" aria-hidden="true" />
                      Two-Factor Authentication
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
                    {useRecoveryCode ? "Emergency Recovery" : "Security Verification"}
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                    {useRecoveryCode
                      ? "Enter one of your 12-character emergency backup recovery codes."
                      : "Enter the 6-digit verification code from your authenticator app."}
                  </p>
                </div>

                <form onSubmit={submitMfa} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#475569]">
                      {useRecoveryCode ? "Emergency Recovery Code" : "6-Digit Authenticator Code"}
                    </label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#94A3B8]">
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <input
                        name="mfaCode"
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value)}
                        type="text"
                        autoFocus
                        autoComplete="one-time-code"
                        required
                        className="h-12 w-full rounded-2xl border border-[#D8E2EA] bg-[#F8FAFC] pl-11 pr-4 text-center text-lg font-black tracking-widest text-[#0F172A] outline-none transition-all duration-200 focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10"
                      />
                    </div>
                  </div>

                  {error ? (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-xs font-semibold text-[#991B1B]">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
                      <span>{errorMessage(error)}</span>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading || mfaCode.trim().length < 6}
                    className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ED3500] text-sm font-black text-white shadow-lg shadow-orange-500/25 transition-all duration-200 hover:bg-[#D42F00] hover:shadow-orange-500/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    {loading ? (
                      <>
                        <LayoutDashboard className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Verifying security code...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in to Admin Console</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setUseRecoveryCode(!useRecoveryCode);
                        setMfaCode("");
                        setError("");
                      }}
                      className="text-xs font-bold text-[#ED3500] hover:underline cursor-pointer"
                    >
                      {useRecoveryCode
                        ? "← Use Authenticator App Code"
                        : "Lost access? Use an emergency recovery code"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminLoadingShell() {
  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <div className="grid min-h-screen lg:grid-cols-[288px_minmax(0,1fr)]">
        <aside className="hidden bg-[#163B5C] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
          <div className="border-b border-white/10 p-5">
            <div className="flex min-w-0 items-center gap-3 opacity-50">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/10 text-sm font-black text-transparent shadow-sm">
                1HI
              </span>
              <span className="min-w-0">
                <span className="block h-6 w-32 rounded-md bg-white/10"></span>
                <span className="mt-2 block h-4 w-24 rounded-md bg-white/10"></span>
              </span>
            </div>
          </div>
          <div className="flex-1 p-4">
            <div className="h-8 w-full rounded-md bg-white/10 opacity-50"></div>
          </div>
        </aside>

        <section className="min-w-0 bg-[#FFFCFB]">
          <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FFFCFB]/95 backdrop-blur">
            <div className="flex min-h-16 items-center gap-3 px-4 py-3 lg:px-6">
              <div className="hidden h-10 w-48 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] xl:block"></div>
              <div className="min-w-0 flex-1">
                <div className="h-11 w-full max-w-2xl rounded-md border border-[#D8E2EA] bg-white opacity-50"></div>
              </div>
              <div className="h-11 w-40 rounded-md border border-[#D8E2EA] bg-white opacity-50"></div>
            </div>
          </header>

          <div className="grid min-h-[50vh] place-items-center p-6">
            <div className="flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-white px-5 py-4 text-sm font-black text-[#163B5C] shadow-sm">
              <LayoutDashboard className="h-4 w-4 animate-spin text-[#ED3500]" aria-hidden="true" />
              Loading admin workspace
            </div>
          </div>
        </section>
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
