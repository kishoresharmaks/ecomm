"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Heart, LayoutDashboard, LifeBuoy, MapPin, PackageCheck, RotateCcw, UserRound } from "lucide-react";
import { cn } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";

const accountNav = [
  { label: "Overview", href: "/account", icon: LayoutDashboard },
  { label: "Profile", href: "/account/profile", icon: UserRound },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Orders", href: "/account/orders", icon: PackageCheck },
  { label: "Returns", href: "/account/returns", icon: RotateCcw },
  { label: "Support", href: "/account/support", icon: LifeBuoy }
];

export function AccountShell({
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ED3500]">Customer account</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-[#163B5C] md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[260px_1fr] lg:px-6">
          <aside className="h-fit rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm">
            <nav className="grid gap-1">
              {accountNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition",
                      active ? "bg-[#EAF1F7] text-[#163B5C]" : "text-[#667085] hover:bg-[#FFFCFB] hover:text-[#1F2933]"
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
