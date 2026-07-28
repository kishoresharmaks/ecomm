"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Building2, FilePlus2, FileText, LayoutDashboard, ListChecks, UserRound } from "lucide-react";
import { cn } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";

const b2bNav = [
  { label: "Overview", href: "/b2b", icon: LayoutDashboard },
  { label: "Company profile", href: "/b2b/company-profile", icon: Building2 },
  { label: "New enquiry", href: "/b2b/enquiries/new", icon: FilePlus2 },
  { label: "My enquiries", href: "/b2b/enquiries", icon: ListChecks },
  { label: "B2B orders", href: "/b2b/orders", icon: FileText },
  { label: "Register", href: "/b2b/register", icon: UserRound }
];

export function B2BShell({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <StorefrontFrame>
      <main className="min-h-[calc(100svh-69px)] bg-[#FFFCFB]">
        <section className="border-b border-[#E5E7EB] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-8 lg:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ED3500]">B2B buyer portal</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-[#163B5C] md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_1fr] lg:px-6">
          <aside className="h-fit rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm">
            <nav className="grid gap-1">
              {b2bNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition",
                      active ? "bg-[#FFF0EA] text-[#ED3500]" : "text-[#667085] hover:bg-[#FFFCFB] hover:text-[#1F2933]"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </section>
      </main>
    </StorefrontFrame>
  );
}
