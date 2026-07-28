import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BarChart3, Building2, PackageSearch, ShieldCheck, Store, Truck } from "lucide-react";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
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
    description: "Homepage, categories, product detail, cart, checkout, and order tracking.",
    icon: PackageSearch
  },
  {
    title: "Seller center",
    href: "/seller",
    description: "Seller registration, products, stock, seller orders, and delivery updates.",
    icon: Store
  },
  {
    title: "B2B buyer portal",
    href: "/b2b",
    description: "Business registration, company profile, and product enquiry workflow.",
    icon: Building2
  },
  {
    title: "Admin control panel",
    href: "/admin",
    description: "Approvals, orders, CMS, settings, reports, email, and audit controls.",
    icon: ShieldCheck
  },
  {
    title: "Delivery partner",
    href: "/delivery",
    description: "Assigned delivery orders, progress updates, COD visibility, and delivery timeline.",
    icon: Truck
  }
];

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
              <span className="block text-xs font-semibold text-[#667085]">Phase 1 build</span>
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
          <StatusBadge tone="info">Stack locked. Implementation started.</StatusBadge>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal text-[#163B5C] md:text-6xl">
            1HandIndia marketplace foundation is now live in code.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#667085]">
            This first scaffold separates storefront, customer account, seller center, B2B portal,
            admin control, API, worker jobs, Prisma database, shared UI, validators, and typed
            configuration.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/seller">
                Seller center <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin">Admin panel</Link>
            </Button>
          </div>
        </div>

        <aside className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#1F2933]">Phase 1 foundation</h2>
            <BarChart3 className="text-[#ED3500]" size={22} />
          </div>
          <div className="mt-6 space-y-4">
            {[
              ["Web app", "Next.js App Router"],
              ["API", "NestJS REST + OpenAPI"],
              ["Database", "PostgreSQL + Prisma"],
              ["Auth", "Clerk + DB RBAC"],
              ["Delivery", "Pickup, local partner, courier"],
              ["Emails", "Queued transactional templates"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <span className="text-sm font-semibold text-[#667085]">{label}</span>
                <span className="text-sm font-black text-[#1F2933]">{value}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <SectionHeading
          eyebrow="Workspace surfaces"
          title="Separated from the first commit"
          description="Customer, seller, B2B, and admin areas are intentionally split so role-based access and future feature work stay clean."
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
