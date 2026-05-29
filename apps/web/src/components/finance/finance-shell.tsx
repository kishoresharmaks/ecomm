"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  BarChart3,
  ChevronRight,
  ClipboardList,
  CreditCard,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  WalletCards,
  X
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { financeNav } from "@/lib/portal-nav";

type FinanceNavItem = (typeof financeNav)[number];

const iconByHref: Array<[string, typeof LayoutDashboard]> = [
  ["/finance/settings", Settings],
  ["/finance/reports", BarChart3],
  ["/finance/commission-rules", Settings],
  ["/finance/statements", ReceiptText],
  ["/finance/ledger", WalletCards],
  ["/finance/payouts", CreditCard],
  ["/finance/settlements", ClipboardList],
  ["/finance/payment-status", BadgeIndianRupee],
  ["/finance/bank-transfers", Landmark],
  ["/finance/cod-collections", IndianRupee],
  ["/finance", LayoutDashboard]
];

export function FinanceShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const auth = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const redirectTo = useMemo(() => (pathname && pathname !== "/finance/login" ? pathname : "/finance"), [pathname]);
  const canAccessFinance = Boolean(auth.user?.roles.some((role) => role === "ADMIN" || role === "FINANCE"));

  useEffect(() => {
    if (auth.isReady && auth.isAuthenticated && pathname === "/finance/login") {
      router.replace("/finance");
    }
  }, [auth.isAuthenticated, auth.isReady, pathname, router]);

  if (!auth.isReady || (auth.isAuthenticated && pathname === "/finance/login")) {
    return <FinanceLoadingShell />;
  }

  if (!auth.isAuthenticated) {
    return <FinanceLoginShell redirectTo={redirectTo} />;
  }

  if (!canAccessFinance) {
    return <FinanceForbiddenShell />;
  }

  const activeItem = findActiveItem(pathname);

  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <div className="grid min-h-screen lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] bg-[#163B5C] text-white shadow-2xl transition lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-auto lg:translate-x-0 lg:flex-col lg:shadow-none",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <FinanceBrand />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-md border border-white/15 text-white hover:bg-white/10 lg:hidden"
              aria-label="Close finance navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <FinanceSidebar pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
        </aside>

        {mobileNavOpen ? (
          <button
            type="button"
            aria-label="Close finance navigation backdrop"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-[#101828]/45 lg:hidden"
          />
        ) : null}

        <section className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-[#FFFCFB]/95 backdrop-blur">
            <div className="flex min-h-16 items-center gap-3 px-4 py-3 lg:px-6">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#163B5C] lg:hidden"
                aria-label="Open finance navigation"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="hidden items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-black text-[#163B5C] xl:flex">
                <ShieldCheck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                Finance control center
              </div>
              <div className="relative max-w-2xl flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
                <input
                  readOnly
                  value={activeItem ? `${activeItem.group} / ${activeItem.label}` : "Finance workspace"}
                  className="h-11 w-full rounded-md border border-[#D8E2EA] bg-white pl-9 pr-3 text-sm font-semibold text-[#667085] outline-none"
                  aria-label="Current finance route"
                />
              </div>
              <FinanceSessionMenu />
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-6 lg:py-6">
            <div className="mb-5 border-b border-[#E5E7EB] pb-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{activeItem?.group ?? "Finance"}</StatusBadge>
                    <StatusBadge tone="success">Back-office session</StatusBadge>
                  </div>
                  <h1 className="mt-3 text-2xl font-black tracking-normal text-[#1F2933] md:text-3xl">{title}</h1>
                  <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-[#667085]">{description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href="/finance/cod-collections">COD collections</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/finance/bank-transfers">Bank transfers</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/finance/payouts">Payouts</Link>
                  </Button>
                </div>
              </div>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function FinanceBrand() {
  return (
    <Link href="/finance" className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#ED3500] text-sm font-black text-white shadow-sm">
        1HI
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xl font-black leading-tight text-white">1HandIndia</span>
        <span className="block truncate text-xs font-semibold text-[#DCE8F2]">Finance Workspace</span>
      </span>
    </Link>
  );
}

function FinanceSidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const groups = groupNavigation(financeNav);
  const activeItem = findActiveItem(pathname);

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="space-y-3">
        {groups.map((group) => (
          <section key={group.name} className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
            <p className="px-2 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#BFD4E5]">{group.name}</p>
            <div className="grid gap-1">
              {group.items.map((item) => {
                const Icon = iconForHref(item.href);
                const active = item.href === activeItem?.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...(onNavigate ? { onClick: onNavigate } : {})}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold leading-5 transition",
                      active ? "bg-[#ED3500] text-white shadow-sm" : "text-[#EEF6FB] hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    {active ? <ChevronRight className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}

function FinanceSessionMenu() {
  const auth = useAdminAuth();
  const isAdmin = auth.user?.roles.includes("ADMIN") ?? false;

  return (
    <div className="flex items-center gap-2">
      {isAdmin ? (
        <Button asChild variant="outline" className="hidden h-11 md:inline-flex">
          <Link href="/admin">Admin</Link>
        </Button>
      ) : null}
      <button
        type="button"
        onClick={() => auth.logout()}
        className="flex h-11 items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:bg-[#FFFCFB]"
      >
        <span className="hidden max-w-40 truncate md:block">{auth.user?.email}</span>
        <LogOut className="h-4 w-4 text-[#B42318]" aria-hidden="true" />
      </button>
    </div>
  );
}

function FinanceLoginShell({ redirectTo }: { redirectTo: string }) {
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
      setError(loginError instanceof Error ? loginError.message : "Finance sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(320px,0.8fr)_1.2fr]">
        <section className="flex min-h-[320px] flex-col justify-between bg-[#163B5C] p-6 text-white lg:min-h-screen lg:p-9">
          <div>
            <FinanceBrand />
            <div className="mt-14 max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF8A70]">Finance access</p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal md:text-5xl">Verify collections, settlements, and payouts.</h1>
              <p className="mt-5 text-base leading-7 text-[#DCE8F2]">
                Finance Manager users can operate payment workflows without access to customer, catalogue, CMS, or user administration.
              </p>
            </div>
          </div>
          <div className="mt-10 grid gap-3 text-sm font-semibold text-[#DCE8F2]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-[#FF8A70]">
                <Landmark className="h-4 w-4" aria-hidden="true" />
              </span>
              COD and bank transfer verification
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-[#FF8A70]">
                <WalletCards className="h-4 w-4" aria-hidden="true" />
              </span>
              Settlements, payouts, ledger, and statements
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-5 lg:p-10">
          <div className="w-full max-w-[520px]">
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#163B5C]">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Finance sign in
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-normal text-[#1F2933]">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">Use a Finance Manager or Admin back-office account.</p>
            </div>
            <form onSubmit={submit} className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm md:p-6">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Email</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="username"
                    className="mt-2 h-12 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Password</span>
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
                  {error.includes("401") ? "Invalid finance email or password." : error}
                </p>
              ) : null}
              <Button type="submit" className="mt-5 h-12 w-full" disabled={loading || !email.trim() || password.length < 8}>
                {loading ? "Signing in..." : "Sign in"}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function FinanceForbiddenShell() {
  const auth = useAdminAuth();

  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFCFB] p-6">
      <section className="w-full max-w-lg rounded-lg border border-[#D8E2EA] bg-white p-6 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-8 w-8 text-[#ED3500]" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-black text-[#1F2933]">Finance access required</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
          This workspace is available only for Admin and Finance Manager users.
        </p>
        <Button type="button" onClick={() => auth.logout()} className="mt-5">
          Sign out
        </Button>
      </section>
    </main>
  );
}

function FinanceLoadingShell() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFCFB] p-6">
      <div className="flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-white px-5 py-4 text-sm font-black text-[#163B5C] shadow-sm">
        <LayoutDashboard className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
        Loading finance workspace
      </div>
    </main>
  );
}

function groupNavigation(nav: FinanceNavItem[]) {
  const groups: Array<{ name: string; items: FinanceNavItem[] }> = [];

  for (const item of nav) {
    const name = item.group ?? "Finance";
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
  return [...financeNav]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => (item.href === "/finance" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)));
}

function iconForHref(href: string) {
  return iconByHref.find(([prefix]) => href.startsWith(prefix))?.[1] ?? LayoutDashboard;
}
