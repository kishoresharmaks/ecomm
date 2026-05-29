"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  Globe2,
  Headset,
  LayoutGrid,
  Menu,
  Search,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  X
} from "lucide-react";
import { Button, cn } from "@indihub/ui";
import { AuthActions } from "@/components/auth/auth-actions";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { StorefrontLocationPicker } from "@/components/storefront/storefront-location-picker";
import { listLocationCountries } from "@/lib/location-api";
import { cartTotals, getCart, listCmsMenus, type CmsMenuItem } from "@/lib/storefront-api";
import { useQuery } from "@tanstack/react-query";

type HeaderNavItem = {
  label: string;
  href: string;
  children?: HeaderNavItem[];
};

type NavIcon = typeof LayoutGrid;

export function StorefrontHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });
  const totals = cartTotals(cartQuery.data);
  const menuQuery = useQuery({
    queryKey: ["cms-menus", "header"],
    queryFn: () => listCmsMenus("header"),
    retry: false
  });
  const navItems = menuQuery.data?.map(menuItemToNavItem) ?? [];
  const countriesQuery = useQuery({
    queryKey: ["locations", "countries"],
    queryFn: listLocationCountries
  });
  const countries = countriesQuery.data ?? [];
  const marketCountries = countries.some((country) => country.code === market.countryCode)
    ? countries
    : [
        {
          code: market.countryCode,
          name: market.market.countryName,
          currency: market.market.currency
        },
        ...countries
      ];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    setMobileOpen(false);
  }

  return (
    <header className="relative z-[60] bg-[#FAF7F0]/94 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6 lg:py-5">
        <div className="relative rounded-[32px] border border-white/90 bg-white/92 p-3 shadow-[0_22px_60px_rgba(22,59,92,0.1)] ring-1 ring-[#F4EADD]">
          <div className="hidden gap-5 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:px-2">
            <BrandBlock />

            <form onSubmit={submitSearch} className="min-w-0 lg:mx-auto lg:w-full lg:max-w-[600px]">
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products, stores..."
                  className="h-14 w-full rounded-full border border-[#D8E2EA] bg-[#FCFDFE] pl-12 pr-32 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white focus:shadow-[0_0_0_4px_rgba(237,53,0,0.08)]"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-2 top-2 h-10 rounded-full px-5 !text-white shadow-[0_10px_26px_rgba(237,53,0,0.18)] hover:!text-white [&_svg]:!text-white"
                >
                  <Search size={15} />
                  <span>Search</span>
                </Button>
              </label>
            </form>

            <div className="ml-auto flex items-center gap-2">
              <MarketPicker marketCountries={marketCountries} value={market.countryCode} onChange={market.setCountryCode} />
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-full border-[#D8E2EA] bg-white/90 px-4 text-[#163B5C] [&_svg]:text-[#163B5C]"
              >
                <Link href="/account">
                  <UserRound size={16} /> Account
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="relative rounded-full bg-[#163B5C] px-4 !text-white shadow-[0_10px_26px_rgba(22,59,92,0.18)] hover:bg-[#0f2d46] hover:!text-white [&_span]:!text-white [&_svg]:!text-white"
              >
                <Link href="/cart" aria-label={`Cart with ${totals.itemCount} items`}>
                  <ShoppingCart size={16} />
                  <span>Cart</span>
                  {totals.itemCount > 0 ? (
                    <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#ED3500] px-1 text-[10px] font-black text-white">
                      {totals.itemCount}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <div className="shrink-0">
                <AuthActions />
              </div>
            </div>
          </div>

          <div className="relative hidden items-center gap-4 border-t border-[#EEF2F6] px-2 pt-4 lg:flex">
            <nav className="flex flex-1 flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <HeaderNavLink key={`${item.href}-${item.label}`} item={item} pathname={pathname} />
              ))}
            </nav>
            <StorefrontLocationPicker compact className="shrink-0" />
          </div>

          <div className="space-y-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen((current) => !current)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D8E2EA] bg-[#FCFDFE] text-[#163B5C] shadow-sm"
                  aria-label="Toggle navigation"
                  aria-expanded={mobileOpen}
                >
                  {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
                <BrandBlock compact />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 rounded-2xl border-[#D8E2EA] bg-white px-0 text-[#163B5C] [&_svg]:text-[#163B5C]"
                >
                  <Link href="/account" aria-label="Account">
                    <UserRound size={18} />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="relative h-11 min-w-[52px] rounded-2xl bg-[#163B5C] px-3 !text-white shadow-[0_10px_24px_rgba(22,59,92,0.16)] hover:bg-[#0f2d46] hover:!text-white [&_svg]:!text-white"
                >
                  <Link href="/cart" aria-label={`Cart with ${totals.itemCount} items`}>
                    <ShoppingCart size={17} />
                    {totals.itemCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ED3500] px-1 text-[10px] font-black text-white">
                        {totals.itemCount}
                      </span>
                    ) : null}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <StorefrontLocationPicker compact className="min-w-0" />
              <MarketPicker
                marketCountries={marketCountries}
                value={market.countryCode}
                onChange={market.setCountryCode}
                className="h-12 rounded-full px-3"
              />
            </div>

            <form onSubmit={submitSearch}>
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products, stores, categories..."
                  className="h-12 w-full rounded-full border border-[#D8E2EA] bg-[#FCFDFE] pl-11 pr-16 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 grid h-9 w-11 place-items-center rounded-full bg-[#ED3500] text-white shadow-[0_8px_22px_rgba(237,53,0,0.18)]"
                  aria-label="Search storefront"
                >
                  <Search size={16} />
                </button>
              </label>
            </form>

            {mobileOpen ? (
              <div className="rounded-[28px] border border-[#E8EDF2] bg-[#FCFDFE] p-4 shadow-[0_18px_46px_rgba(22,59,92,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ED3500]">
                      Browse
                    </p>
                    <h2 className="mt-1 text-lg font-black text-[#163B5C]">
                      Marketplace menu
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#EAF1F7] px-3 py-1 text-xs font-black text-[#163B5C]">
                    Public routes
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {navItems.map((item) => (
                    <MobileNavLink
                      key={`${item.href}-${item.label}`}
                      item={item}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  ))}
                  <MobileNavLink item={{ label: "Account", href: "/account" }} onNavigate={() => setMobileOpen(false)} />
                </div>

                <div className="mt-4 border-t border-[#E5E7EB] pt-4">
                  <AuthActions />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("flex min-w-0 items-center gap-3", compact ? "gap-2.5" : "")}
      aria-label="1HandIndia home"
    >
      <span
        className={cn(
          "grid place-items-center rounded-[18px] bg-[#163B5C] font-black text-white shadow-[0_14px_34px_rgba(22,59,92,0.18)]",
          compact ? "h-11 w-11 text-sm" : "h-14 w-14 text-lg"
        )}
      >
        1HI
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-black uppercase tracking-[0.28em] text-[#ED3500]">
          Seller to shopper
        </span>
        <span className={cn("block font-black leading-none text-[#163B5C]", compact ? "text-xl" : "text-[2rem]")}>
          1HandIndia
        </span>
        {!compact ? (
          <span className="mt-1 block max-w-sm text-xs font-semibold leading-5 text-[#667085]">
            Local stores, trusted catalogue, and serious marketplace operations.
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function MarketPicker({
  marketCountries,
  value,
  onChange,
  className
}: {
  marketCountries: Array<{ code: string; name: string; currency: string }>;
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedMarket =
    marketCountries.find((country) => country.code === value) ?? marketCountries[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function chooseMarket(code: string) {
    onChange(code);
    setIsOpen(false);
  }

  return (
    <div ref={pickerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border border-[#D8E2EA] bg-[#FCFDFE] px-3 text-xs font-black text-[#163B5C] shadow-sm outline-none transition hover:border-[#163B5C]/40 hover:bg-white focus-visible:border-[#ED3500] focus-visible:ring-4 focus-visible:ring-[#ED3500]/10",
          className
        )}
        aria-label="Select market country and currency"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">
          {selectedMarket ? `${selectedMarket.code} / ${selectedMarket.currency}` : "Market"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition", isOpen && "rotate-180")} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-[90] mt-2 w-52 overflow-hidden rounded-2xl border border-[#D8E2EA] bg-white p-1.5 shadow-[0_22px_60px_rgba(22,59,92,0.18)] ring-1 ring-[#F4EADD]">
          <div id={listboxId} role="listbox" aria-label="Market country and currency" className="max-h-72 overflow-y-auto">
            {marketCountries.map((country) => {
              const selected = country.code === value;

              return (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => chooseMarket(country.code)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    selected
                      ? "bg-[#163B5C] text-white shadow-sm"
                      : "text-[#163B5C] hover:bg-[#FFF4EF] hover:text-[#ED3500]"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black">{country.code} / {country.currency}</span>
                    <span className={cn("mt-0.5 block truncate text-[11px] font-semibold", selected ? "text-white/75" : "text-[#667085]")}>
                      {country.name}
                    </span>
                  </span>
                  {selected ? <span className="h-2 w-2 rounded-full bg-[#ED3500]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderNavLink({ item, pathname }: { item: HeaderNavItem; pathname: string }) {
  const hasChildren = Boolean(item.children?.length);
  const Icon = navIconForHref(item.href);

  return (
    <div className="group relative">
      <NavAnchor
        item={item}
        className={cn(
          "flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-black transition",
          isActivePath(pathname, item.href)
            ? "border-[#163B5C] bg-[#163B5C] !text-white shadow-[0_12px_30px_rgba(22,59,92,0.16)] hover:!text-white [&_span]:!text-white [&_svg]:!text-white"
            : "border-[#E8EDF2] bg-[#FCFDFE] text-[#163B5C] hover:border-[#ED3500] hover:text-[#ED3500]"
        )}
      >
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{item.label}</span>
        {hasChildren ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      </NavAnchor>
      {hasChildren ? (
        <div className="invisible absolute left-0 top-full z-[70] w-60 translate-y-2 rounded-[20px] border border-[#D8E2EA] bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-1 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-1 group-focus-within:opacity-100">
          {item.children?.map((child) => (
            <NavAnchor
              key={`${child.href}-${child.label}`}
              item={child}
              className={cn(
                "block rounded-2xl px-3 py-2.5 text-sm font-bold text-[#1F2933] hover:bg-[#FFF4EF]",
                isActivePath(pathname, child.href) ? "bg-[#EAF1F7] text-[#163B5C]" : ""
              )}
            >
              {child.label}
            </NavAnchor>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileNavLink({ item, onNavigate }: { item: HeaderNavItem; onNavigate: () => void }) {
  const Icon = navIconForHref(item.href);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-white shadow-sm">
      <NavAnchor
        item={item}
        onClick={onNavigate}
        className="flex items-center gap-3 px-4 py-3 text-sm font-black text-[#163B5C]"
      >
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#FFF4EF] text-[#ED3500]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
        <span>{item.label}</span>
      </NavAnchor>
      {item.children?.length ? (
        <div className="space-y-1 border-t border-[#FFE0D6] px-3 py-2">
          {item.children.map((child) => (
            <NavAnchor
              key={`${child.href}-${child.label}`}
              item={child}
              onClick={onNavigate}
              className="block rounded-2xl px-3 py-2 text-sm font-bold text-[#4B587C]"
            >
              {child.label}
            </NavAnchor>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavAnchor({
  item,
  className,
  onClick,
  children
}: {
  item: HeaderNavItem;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (isExternalHref(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className} {...(onClick ? { onClick } : {})}>
        {children}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className} {...(onClick ? { onClick } : {})}>
      {children}
    </Link>
  );
}

function menuItemToNavItem(item: CmsMenuItem): HeaderNavItem {
  return {
    label: item.label,
    href: item.href,
    children: item.children?.map(menuItemToNavItem) ?? []
  };
}

function navIconForHref(href: string): NavIcon | null {
  if (href.startsWith("/categories")) {
    return LayoutGrid;
  }

  if (href.startsWith("/stores")) {
    return Store;
  }

  if (href.startsWith("/track-order")) {
    return Truck;
  }

  if (href.startsWith("/contact")) {
    return Headset;
  }

  if (href.startsWith("/seller")) {
    return Store;
  }

  if (href.startsWith("/b2b")) {
    return BriefcaseBusiness;
  }

  return null;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function isActivePath(pathname: string, href: string) {
  return !isExternalHref(href) && (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)));
}
