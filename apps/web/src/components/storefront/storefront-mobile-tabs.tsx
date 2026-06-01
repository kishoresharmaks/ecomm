"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgePercent, Home, LayoutGrid, Store, UserRound } from "lucide-react";
import { cn } from "@indihub/ui";

const tabs = [
  { label: "Home", href: "/", icon: Home },
  { label: "Categories", href: "/categories", icon: LayoutGrid },
  { label: "Stores", href: "/stores", icon: Store },
  { label: "Offers", href: "/deals", icon: BadgePercent },
  { label: "Account", href: "/account", icon: UserRound },
] as const;

export function StorefrontMobileTabs() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#EEF0F4] bg-white/96 px-3 pt-2 shadow-[0_-12px_34px_rgba(22,59,92,0.08)] backdrop-blur-xl lg:hidden">
      <nav
        className="mx-auto flex max-w-md items-center justify-between gap-1"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.45rem)" }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[18px] px-2 py-1.5 text-[11px] font-bold transition",
                active
                  ? "text-[#ED3500]"
                  : "text-[#667085] hover:text-[#ED3500]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-5 w-5", active && "fill-[#ED3500]/10")} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
