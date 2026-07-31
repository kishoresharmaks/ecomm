import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  Building2,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { Button, SectionHeading } from "@indihub/ui";
import { AuthActions } from "./auth/auth-actions";

const surfaces: Array<{
  title: string;
  href: Route;
  description: string;
  icon: typeof PackageSearch;
}> = [
  {
    title: "Customer storefront",
    href: "/",
    description:
      "Discover, buy, and track orders from verified sellers and local stores.",
    icon: PackageSearch,
  },
  {
    title: "Seller hub",
    href: "/seller",
    description:
      "Onboard your store, list products, fulfil orders, and grow your retail or service business.",
    icon: Store,
  },
  {
    title: "B2B buyer portal",
    href: "/b2b",
    description:
      "Procure at scale with verified sellers — enquiries, quotations, POs, GST invoicing, and delivery.",
    icon: Building2,
  },
  {
    title: "Admin control panel",
    href: "/admin",
    description:
      "Approvals, orders, content, settings, reports, and email — all in one workspace.",
    icon: ShieldCheck,
  },
  {
    title: "Delivery partner",
    href: "/delivery",
    description:
      "Pickups, local drops, COD settlement, and delivery timeline — all on one workspace.",
    icon: Truck,
  },
];

const valueProps = [
  "Verified sellers, every order",
  "Hyperlocal delivery network",
  "B2B procurement, simplified",
  "Secure checkout and refunds",
  "Transparent policies, no surprises",
  "24×7 customer support",
] as const;

export function LaunchShell() {
  return (
    <main className="min-h-screen bg-[#FFFCFB]">
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#163B5C] text-sm font-black text-white">
              1HI
            </span>
            <span>
              <span className="block text-lg font-black text-[#163B5C]">1HandIndia</span>
              <span className="block text-xs font-semibold text-[#667085]">
                India&apos;s verified marketplace
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#1F2933] md:flex">
            <Link href="/account">Account</Link>
            <Link href="/seller">Seller</Link>
            <Link href="/b2b">B2B</Link>
            <Link href="/delivery">Delivery</Link>
            <Link href="/admin">Admin</Link>
          </nav>
          <AuthActions />
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1fr_420px] lg:py-16">
        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FFF0EC] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#ED3500]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            New on 1HandIndia
          </span>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal text-[#163B5C] md:text-6xl">
            Shop from verified sellers, hyperlocal stores, and trusted B2B partners — all in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#667085]">
            1HandIndia brings the storefront, seller hub, B2B procurement, admin control, mobile apps, and a verified delivery network together as separate experiences on a single trusted platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/seller">
                Open Seller Hub <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin">Admin panel</Link>
            </Button>
          </div>
        </div>

        <aside className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#1F2933]">Why 1HandIndia</h2>
          <div className="mt-6 space-y-4">
            {valueProps.map((prop) => (
              <div
                key={prop}
                className="flex items-start gap-3 border-b border-[#E5E7EB] pb-3 last:border-b-0 last:pb-0"
              >
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ED3500] text-white">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold leading-6 text-[#1F2933]">{prop}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <SectionHeading
          eyebrow="Explore 1HandIndia"
          title="Built around four experiences"
          description="Customer, seller, B2B, and admin experiences are separate so every user gets the tools they need."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {surfaces.map((surface) => {
            const Icon = surface.icon;

            return (
              <Link
                key={surface.title}
                href={surface.href}
                className="group rounded-lg border border-[#E5E7EB] bg-white p-5 transition hover:border-[#ED3500]"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                    <Icon size={21} />
                  </span>
                  <span>
                    <span className="block text-base font-black text-[#1F2933]">{surface.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-[#667085]">
                      {surface.description}
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
