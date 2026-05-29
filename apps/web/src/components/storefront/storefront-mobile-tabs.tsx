"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headset, Home, LayoutGrid, Store } from "lucide-react";
import { cn } from "@indihub/ui";

const tabs = [
  { label: "Home", href: "/", icon: Home },
  { label: "Stores", href: "/stores", icon: Store },
  { label: "Categories", href: "/categories", icon: LayoutGrid },
  { label: "Contact", href: "/contact", icon: Headset }
] as const;

export function StorefrontMobileTabs() {
  const pathname = usePathname();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <nav className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-[28px] border border-white/80 bg-white/92 p-2 shadow-[0_22px_55px_rgba(22,59,92,0.18)] backdrop-blur-xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[20px] px-2 py-2 text-[11px] font-black transition",
                active
                  ? "bg-[#163B5C] text-white shadow-[0_10px_24px_rgba(22,59,92,0.22)]"
                  : "text-[#667085]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
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
