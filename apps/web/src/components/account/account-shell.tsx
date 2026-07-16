"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Heart, LayoutDashboard, LifeBuoy, MapPin, PackageCheck, RotateCcw, UserRound, Wrench } from "lucide-react";
import { cn } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";

const accountNav = [
  { label: "Overview", href: "/account", icon: LayoutDashboard },
  { label: "Profile", href: "/account/profile", icon: UserRound },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Orders", href: "/account/orders", icon: PackageCheck },
  { label: "Service bookings", href: "/account/service-bookings", icon: Wrench },
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
          <div className="mx-auto max-w-7xl px-5 py-6 lg:px-6 lg:py-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ED3500] lg:text-xs">Customer account</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-[#163B5C] md:text-5xl lg:mt-2 lg:text-3xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-[#667085] lg:mt-3 lg:text-sm lg:leading-6">{description}</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-0 py-6 lg:grid-cols-[260px_1fr] lg:px-6">
          <aside className="h-fit bg-transparent px-5 shadow-none lg:rounded-lg lg:border lg:border-[#E5E7EB] lg:bg-white lg:p-3 lg:shadow-sm">
            <nav className="grid grid-cols-4 gap-3 lg:grid-cols-1 lg:gap-1">
              {accountNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/account" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] p-2.5 text-center shadow-sm transition lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:border-transparent lg:p-3 lg:text-left lg:shadow-none",
                      active ? "bg-[#EAF1F7] text-[#163B5C]" : "bg-white text-[#667085] hover:bg-[#FFFCFB] hover:text-[#1F2933] lg:bg-transparent"
                    )}
                  >
                    <Icon className="h-5 w-5 lg:h-4 lg:w-4" aria-hidden="true" />
                    <span className="text-[10px] font-bold leading-tight lg:text-sm">{item.label}</span>
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
