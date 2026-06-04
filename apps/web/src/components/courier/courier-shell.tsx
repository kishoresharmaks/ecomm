"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MapPinned,
  Menu,
  PackageCheck,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { courierNav } from "@/lib/portal-nav";

type CourierNavItem = (typeof courierNav)[number];

const iconByHref: Array<[string, typeof LayoutDashboard]> = [
  ["/courier/cod-remittances", CreditCard],
  ["/courier/providers", Settings],
  ["/courier/local-delivery/partners", Users],
  ["/courier/local-delivery", MapPinned],
  ["/courier/routing-failures", AlertTriangle],
  ["/courier/packages", Boxes],
  ["/courier", LayoutDashboard],
];

export function CourierShell({
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const redirectTo = useMemo(() => (pathname && pathname !== "/courier/login" ? pathname : "/courier"), [pathname]);
  const canAccessCourier = Boolean(auth.user?.roles.some((role) => role === "ADMIN" || role === "COURIER_MANAGER"));

  useEffect(() => {
    if (auth.isReady && auth.isAuthenticated && pathname === "/courier/login") {
      router.replace("/courier");
    }
  }, [auth.isAuthenticated, auth.isReady, pathname, router]);

  if (!auth.isReady || (auth.isAuthenticated && pathname === "/courier/login")) {
    return <CourierLoadingShell />;
  }

  if (!auth.isAuthenticated) {
    return <CourierLoginShell redirectTo={redirectTo} />;
  }

  if (!canAccessCourier) {
    return <CourierForbiddenShell />;
  }

  const activeItem = findActiveItem(pathname);

  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] bg-[#153C55] text-white shadow-2xl transition lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-auto lg:translate-x-0 lg:flex-col lg:shadow-none",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <CourierBrand />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-md border border-white/15 text-white hover:bg-white/10 lg:hidden"
              aria-label="Close courier navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <CourierSidebar pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
        </aside>

        {mobileNavOpen ? (
          <button
            type="button"
            aria-label="Close courier navigation backdrop"
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
                className="grid h-10 w-10 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#153C55] lg:hidden"
                aria-label="Open courier navigation"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="hidden items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-black text-[#153C55] xl:flex">
                <Truck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                Courier operations
              </div>
              <div className="relative max-w-2xl flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
                <input
                  readOnly
                  value={activeItem ? `${activeItem.group} / ${activeItem.label}` : "Courier workspace"}
                  className="h-11 w-full rounded-md border border-[#D8E2EA] bg-white pl-9 pr-3 text-sm font-semibold text-[#667085] outline-none"
                  aria-label="Current courier route"
                />
              </div>
              <CourierSessionMenu />
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 lg:px-6 lg:py-6">
            <div className="mb-5 border-b border-[#E5E7EB] pb-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{activeItem?.group ?? "Courier"}</StatusBadge>
                    <StatusBadge tone="success">Back-office session</StatusBadge>
                  </div>
                  <h1 className="mt-3 text-2xl font-black tracking-normal text-[#1F2933] md:text-3xl">{title}</h1>
                  <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-[#667085]">{description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href="/courier/packages">Packages</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/courier/routing-failures">Failures</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/courier/providers">Providers</Link>
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

function CourierBrand() {
  return (
    <Link href="/courier" className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#ED3500] text-sm font-black text-white shadow-sm">
        1HI
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xl font-black leading-tight text-white">1HandIndia</span>
        <span className="block truncate text-xs font-semibold text-[#DCE8F2]">Courier Workspace</span>
      </span>
    </Link>
  );
}

function CourierSidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const groups = groupNavigation(courierNav);
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
                      active ? "bg-[#ED3500] text-white shadow-sm" : "text-[#EEF6FB] hover:bg-white/10 hover:text-white",
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

function CourierSessionMenu() {
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

function CourierLoginShell({ redirectTo }: { redirectTo: string }) {
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
      setError(loginError instanceof Error ? loginError.message : "Courier sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFCFB] text-[#1F2933]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(320px,0.8fr)_1.2fr]">
        <section className="flex min-h-[320px] flex-col justify-between bg-[#153C55] p-6 text-white lg:min-h-screen lg:p-9">
          <div>
            <CourierBrand />
            <div className="mt-14 max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF8A70]">Courier access</p>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal md:text-5xl">Control packages, labels, pickups, and routing.</h1>
              <p className="mt-5 text-base leading-7 text-[#DCE8F2]">
                Courier Manager users can run logistics operations without full admin, seller, customer, or finance payout access.
              </p>
            </div>
          </div>
          <div className="mt-10 grid gap-3 text-sm font-semibold text-[#DCE8F2]">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-[#FF8A70]">
                <PackageCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              Package booking, labels, and tracking
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-[#FF8A70]">
                <MapPinned className="h-4 w-4" aria-hidden="true" />
              </span>
              Routing failures and local delivery assignment
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-5 lg:p-10">
          <div className="w-full max-w-[520px]">
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#153C55]">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                Courier sign in
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-normal text-[#1F2933]">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">Use a Courier Manager or Admin back-office account.</p>
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
                  {error.includes("401") ? "Invalid courier email or password." : error}
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

function CourierForbiddenShell() {
  const auth = useAdminAuth();

  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFCFB] p-6">
      <section className="w-full max-w-lg rounded-lg border border-[#D8E2EA] bg-white p-6 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-8 w-8 text-[#ED3500]" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-black text-[#1F2933]">Courier access required</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
          This workspace is available only for Admin and Courier Manager users.
        </p>
        <Button type="button" onClick={() => auth.logout()} className="mt-5">
          Sign out
        </Button>
      </section>
    </main>
  );
}

function CourierLoadingShell() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFCFB] p-6">
      <div className="flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-white px-5 py-4 text-sm font-black text-[#153C55] shadow-sm">
        <Truck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
        Loading courier workspace
      </div>
    </main>
  );
}

function groupNavigation(nav: CourierNavItem[]) {
  const groups: Array<{ name: string; items: CourierNavItem[] }> = [];

  for (const item of nav) {
    const name = item.group ?? "Courier";
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
  return [...courierNav]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => (item.href === "/courier" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)));
}

function iconForHref(href: string) {
  return iconByHref.find(([prefix]) => href.startsWith(prefix))?.[1] ?? FileText;
}
