"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type PortalNavItem = {
  group?: string;
  label: string;
  href: string;
};

export function PortalShell({
  area,
  title,
  description,
  nav,
  children
}: {
  area: string;
  title: string;
  description: string;
  nav: PortalNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const navGroups = groupNavigation(nav);

  return (
    <main className="min-h-screen bg-[#FFFCFB]">
      <div className="grid min-h-screen lg:grid-cols-[292px_1fr]">
        <aside className="bg-[#163B5C] text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
          <div className="p-5 lg:p-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-[#ED3500] text-sm font-black">
                1HI
              </span>
              <span>
                <span className="block text-xl font-black leading-tight">1HandIndia</span>
                <span className="block text-xs font-semibold text-[#DCE8F2]">{area}</span>
              </span>
            </Link>
            <nav className="mt-7 space-y-5">
              {navGroups.map((group) => (
                <div key={group.name}>
                  {group.name ? (
                    <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#8FB0CA]">
                      {group.name}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className={navItemClass(pathname, item.href)}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>
        <section className="min-w-0 p-5 lg:p-8">
          <div className="mb-6 border-b border-[#E5E7EB] pb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ED3500]">{area}</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-[#1F2933]">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

function navItemClass(pathname: string, href: string) {
  const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
  return [
    "block rounded-md px-3 py-2 text-sm font-semibold leading-5 transition-colors",
    isActive ? "bg-[#ED3500] text-white shadow-sm" : "text-[#EEF6FB] hover:bg-white/10"
  ].join(" ");
}

function groupNavigation(nav: PortalNavItem[]) {
  const groups: Array<{ name: string; items: PortalNavItem[] }> = [];

  for (const item of nav) {
    const name = item.group ?? "";
    const group = groups.find((current) => current.name === name);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ name, items: [item] });
    }
  }

  return groups;
}
