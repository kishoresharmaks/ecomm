"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import {
  BadgePercent,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  Globe2,
  Grid3X3,
  Heart,
  MapPin,
  Menu as MenuIcon,
  PackageCheck,
  PackageSearch,
  RefreshCcw,
  Search,
  Shirt,
  ShoppingBasket,
  ShoppingCart,
  ShieldCheck,
  Sofa,
  Store,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@indihub/ui";
import { AuthActions } from "@/components/auth/auth-actions";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { useLocationCatalog } from "@/components/locations/location-store";
import { StorefrontLocationPicker } from "@/components/storefront/storefront-location-picker";
import { useStorefrontLocation } from "@/components/storefront/storefront-location-context";
import { browsingLocationLabel } from "@/components/storefront/storefront-location-utils";
import {
  cartTotals,
  getCart,
  listCategories,
  listCmsMenus,
  type CategorySummary,
  type CmsMenuItem,
} from "@/lib/storefront-api";
import { useQuery } from "@tanstack/react-query";

type HeaderNavItem = {
  label: string;
  href: string;
  children?: HeaderNavItem[];
};

const brandLogoSrc = "/brand/1handindia_logo.png";
const categoryIcons = [PackageSearch, Shirt, ShoppingBasket, Sofa, BadgePercent, Store, BookOpen];

export function StorefrontHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const storefrontLocation = useStorefrontLocation();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const totals = cartTotals(cartQuery.data);
  const categoriesQuery = useQuery({
    queryKey: ["categories", "header"],
    queryFn: listCategories,
    retry: false,
  });
  const menuQuery = useQuery({
    queryKey: ["cms-menus", "header"],
    queryFn: () => listCmsMenus("header"),
    retry: false,
  });
  const locationCatalog = useLocationCatalog({ countryCode: market.countryCode });
  const countries = locationCatalog.countries;
  const marketCountries = countries.some((country) => country.code === market.countryCode)
    ? countries
    : [
        {
          code: market.countryCode,
          name: market.market.countryName,
          currency: market.market.currency,
        },
        ...countries,
      ];
  const categories = categoriesQuery.data ?? [];
  const primaryCategories = categories.slice(0, 6);
  const cmsItems = menuQuery.data?.map(menuItemToNavItem) ?? [];
  const mobileLocationLabel =
    storefrontLocation.source === "global"
      ? "Set location"
      : browsingLocationLabel(storefrontLocation.activeLocation);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-[80] border-b border-[#F1D7CF] bg-white/96 shadow-[0_10px_32px_rgba(22,59,92,0.04)] backdrop-blur-xl">
      <div className="mx-auto max-w-md px-4 pb-4 pt-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#111827] transition hover:bg-[#FFF0EC] hover:text-[#ED3500]"
            aria-label="Toggle storefront menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>

          <MobileBrandLogo />

          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="hidden max-w-[104px] items-center gap-1.5 rounded-full px-1 text-xs font-black text-[#1F2933] min-[390px]:inline-flex">
              <MapPin className="h-5 w-5 shrink-0 fill-[#ED3500] text-[#ED3500]" aria-hidden="true" />
              <span className="truncate">{mobileLocationLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </span>
            <Link href="/account/wishlist" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#111827]" aria-label="Wishlist">
              <Heart className="h-6 w-6" aria-hidden="true" />
            </Link>
            <Link href="/cart" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#111827]" aria-label="Cart">
              <ShoppingCart className="h-6 w-6" aria-hidden="true" />
              {totals.itemCount > 0 ? (
                <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-[#ED3500] px-1 text-[10px] font-black text-white">
                  {totals.itemCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-4">
          <label className="relative block">
            <span className="sr-only">Search products, stores, or brands</span>
            <Search className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-[#ED3500]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, stores, brands..."
              className="h-16 w-full rounded-full border border-[#FFB9A6] bg-white pl-14 pr-[112px] text-sm font-semibold text-[#111827] shadow-[0_14px_36px_rgba(22,59,92,0.07)] outline-none transition focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 h-12 rounded-full bg-[#ED3500] px-6 text-sm font-black text-white shadow-[0_10px_24px_rgba(237,53,0,0.22)]"
            >
              Search
            </button>
          </label>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-14 shrink-0 items-center gap-2 rounded-[12px] bg-[#ED3500] px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(237,53,0,0.22)]"
          >
            <Grid3X3 className="h-5 w-5" aria-hidden="true" />
            All Categories
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-black text-[#111827] transition hover:bg-[#FFF0EC] hover:text-[#ED3500]"
          >
            More <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="shrink-0">
            <AuthActions />
          </div>
        </div>

        {mobileOpen ? (
          <div className="mt-4 rounded-[22px] border border-[#FFE0D6] bg-[#FFFCFB] p-4 shadow-[0_18px_44px_rgba(22,59,92,0.08)]">
            <div className="grid gap-3">
              <StorefrontLocationPicker mobile compact />
              <MarketPicker
                marketCountries={marketCountries}
                value={market.countryCode}
                onChange={market.setCountryCode}
                className="h-11 rounded-full"
              />
            </div>
            <div className="mt-4 grid gap-2">
              <MobileLink href="/categories" label="All Categories" icon={<Grid3X3 className="h-4 w-4" />} onNavigate={() => setMobileOpen(false)} />
              {primaryCategories.map((category, index) => {
                const Icon = categoryIcons[index % categoryIcons.length] ?? PackageSearch;
                return (
                  <MobileLink
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    label={category.name}
                    icon={<Icon className="h-4 w-4" />}
                    onNavigate={() => setMobileOpen(false)}
                  />
                );
              })}
              {cmsItems.map((item) => (
                <MobileLink
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  label={item.label}
                  icon={<BriefcaseBusiness className="h-4 w-4" />}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
              <MobileLink href="/account/wishlist" label="Wishlist" icon={<Heart className="h-4 w-4" />} onNavigate={() => setMobileOpen(false)} />
              <MobileLink href="/cart" label={`Cart (${totals.itemCount})`} icon={<ShoppingCart className="h-4 w-4" />} onNavigate={() => setMobileOpen(false)} />
              <MobileLink href="/account" label="Account" icon={<UserRound className="h-4 w-4" />} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="mt-4 border-t border-[#FFE0D6] pt-4">
              <AuthActions />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto hidden max-w-[1440px] px-4 py-3 sm:px-6 lg:block lg:px-10">
        <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-center justify-between gap-3">
            <BrandBlock />
          </div>

          <form onSubmit={submitSearch} className="min-w-0">
            <label className="relative block">
              <span className="sr-only">Search products, stores, or brands</span>
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#ED3500]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products, stores, brands..."
                className="h-14 w-full rounded-full border border-[#FFE0D6] bg-white pl-14 pr-28 text-sm font-semibold text-[#111827] shadow-[0_14px_44px_rgba(22,59,92,0.08)] outline-none transition focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 h-10 rounded-full bg-[#ED3500] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(237,53,0,0.22)] transition hover:bg-[#d52f00]"
              >
                Search
              </button>
            </label>
          </form>

          <div className="hidden min-w-0 items-center justify-end gap-2 lg:flex xl:gap-4">
            <StorefrontLocationPicker compact className="w-[168px] shrink-0 xl:w-[190px]" />
            <HeaderAction href="/account/wishlist" label="Wishlist" icon={<Heart className="h-5 w-5" />} />
            <HeaderAction
              href="/cart"
              label="Cart"
              icon={<ShoppingCart className="h-5 w-5" />}
              badge={totals.itemCount}
            />
            <HeaderAction href="/account" label="Account" icon={<UserRound className="h-5 w-5" />} />
          </div>
        </div>

        <div className="mt-3 hidden items-center gap-3 lg:flex">
          <CategoryMenu categories={categories} />
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" aria-label="Storefront quick links">
            <NavPill
              href="/stores"
              label="Hyperlocal Stores"
              active={isActivePath(pathname, "/stores")}
              icon={<Store className="h-4 w-4" />}
            />
          </nav>
          <MoreMenu
            cmsItems={cmsItems}
            marketCountries={marketCountries}
            marketValue={market.countryCode}
            onMarketChange={market.setCountryCode}
          />
          <div className="shrink-0">
            <AuthActions />
          </div>
        </div>

      </div>
    </header>
  );
}

function MobileBrandLogo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="1HandIndia home">
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-[0_10px_22px_rgba(237,53,0,0.16)]">
        <img src={brandLogoSrc} alt="" className="h-full w-full object-cover" loading="eager" />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[22px] font-black leading-none tracking-normal text-[#111827]">
        Hand<span className="text-[#ED3500]">India</span>
        </span>
        <span className="mt-1 block truncate text-[9px] font-semibold leading-none text-[#667085]">
          Smart shopping, verified sellers.
        </span>
      </span>
    </Link>
  );
}

function BrandBlock() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="1HandIndia home">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-[0_12px_26px_rgba(237,53,0,0.18)]">
        <img src={brandLogoSrc} alt="" className="h-full w-full object-cover" loading="eager" />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[22px] font-black leading-none tracking-normal text-[#111827]">
          Hand<span className="text-[#ED3500]">India</span>
        </span>
        <span className="mt-1 hidden truncate text-[10px] font-semibold leading-none text-[#667085] sm:block">
          Smart shopping, verified sellers.
        </span>
      </span>
    </Link>
  );
}

function HeaderAction({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-1.5 text-sm font-black text-[#1F2933] transition hover:text-[#ED3500] xl:px-0"
      aria-label={label}
    >
      <span className="relative text-[#1F2933]">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#ED3500] px-1 text-[10px] font-black text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="hidden xl:inline">{label}</span>
    </Link>
  );
}

function CategoryMenu({ categories }: { categories: CategorySummary[] }) {
  const visibleCategories = categories.slice(0, 6);

  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton className="inline-flex h-12 items-center gap-2 rounded-[12px] bg-[#ED3500] px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(237,53,0,0.22)] transition hover:bg-[#d52f00]">
        <Grid3X3 className="h-4 w-4" aria-hidden="true" />
        All Categories
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-[90] mt-2 w-[min(1120px,calc(100vw-5rem))] origin-top overflow-hidden rounded-[18px] border border-[#FFE0D6] bg-white shadow-[0_22px_70px_rgba(22,59,92,0.16)] outline-none"
      >
        {categories.length ? (
          <>
            <div className="grid gap-0 p-5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
              {visibleCategories.map((category, index) => (
                <MegaCategoryColumn key={category.id} category={category} index={index} />
              ))}
            </div>
            <div className="grid gap-2 border-t border-[#F1D7CF] bg-[#F8FAFC] px-5 py-3 sm:grid-cols-5">
              <MegaMenuBenefit icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} label="Top Quality Products" />
              <MegaMenuBenefit icon={<BadgePercent className="h-4 w-4" aria-hidden="true" />} label="Best Prices & Offers" />
              <MegaMenuBenefit icon={<PackageCheck className="h-4 w-4" aria-hidden="true" />} label="Secure Payments" />
              <MegaMenuBenefit icon={<RefreshCcw className="h-4 w-4" aria-hidden="true" />} label="Easy Returns" />
              <MegaMenuBenefit icon={<Truck className="h-4 w-4" aria-hidden="true" />} label="Fast Delivery" />
            </div>
          </>
        ) : (
          <div className="px-5 py-4 text-sm font-semibold text-[#667085]">No active categories yet.</div>
        )}
      </MenuItems>
    </Menu>
  );
}

function MegaCategoryColumn({ category, index }: { category: CategorySummary; index: number }) {
  const Icon = categoryIcons[index % categoryIcons.length] ?? PackageSearch;
  const children = category.children ?? [];
  const productCount = category._count?.products ?? 0;

  return (
    <div className="min-w-0 border-r border-[#E8EDF2] px-4 py-1 last:border-r-0">
      <MenuItem>
        <Link
          href={`/categories/${category.slug}`}
          className="group flex items-center gap-2 rounded-[12px] px-2 py-2 text-sm font-black text-[#1F2933] data-focus:bg-[#FFF4EF] data-focus:text-[#ED3500]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{category.name}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-[#98A2B3]">
              {productCount ? `${productCount} products` : `${children.length} sections`}
            </span>
          </span>
        </Link>
      </MenuItem>

      <div className="mt-2 grid gap-1">
        {children.length ? (
          children.slice(0, 6).map((child) => (
            <MenuItem key={child.id}>
              <Link
                href={`/categories/${child.slug}`}
                className="block truncate rounded-[10px] px-2 py-1.5 text-sm font-semibold text-[#4B5563] data-focus:bg-[#FFF4EF] data-focus:text-[#ED3500]"
              >
                {child.name}
              </Link>
            </MenuItem>
          ))
        ) : (
          <p className="px-2 py-1.5 text-xs font-semibold leading-5 text-[#667085]">
            {category.description?.trim() || "Browse all products in this category."}
          </p>
        )}
      </div>

      <MenuItem>
        <Link
          href={`/categories/${category.slug}`}
          className="mt-3 inline-flex items-center gap-1 px-2 text-xs font-black text-[#ED3500] data-focus:text-[#C72D00]"
        >
          View all
          <ChevronDown className="-rotate-90 h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </MenuItem>
    </div>
  );
}

function MegaMenuBenefit({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2 text-xs font-bold text-[#4B5563]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[#667085] shadow-sm">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function NavPill({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 border-r border-[#E8EDF2] px-5 text-sm font-black transition last:border-r-0",
        active ? "text-[#ED3500]" : "text-[#1F2933] hover:text-[#ED3500]",
      )}
    >
      <span className={active ? "text-[#ED3500]" : "text-[#667085]"}>{icon}</span>
      <span className="max-w-[140px] truncate">{label}</span>
    </Link>
  );
}

function MoreMenu({
  cmsItems,
  marketCountries,
  marketValue,
  onMarketChange,
}: {
  cmsItems: HeaderNavItem[];
  marketCountries: Array<{ code: string; name: string; currency: string }>;
  marketValue: string;
  onMarketChange: (code: string) => void;
}) {
  const moreLinks = cmsItems.length
    ? cmsItems
    : [
        { label: "Deals", href: "/deals" },
        { label: "Become a Seller", href: "/seller/register" },
        { label: "B2B Buyers", href: "/b2b" },
      ];

  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton className="inline-flex h-11 items-center gap-2 px-4 text-sm font-black text-[#1F2933] transition hover:text-[#ED3500]">
        More <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-[90] mt-2 w-72 origin-top-right rounded-[18px] border border-[#FFE0D6] bg-white p-2 shadow-[0_22px_70px_rgba(22,59,92,0.16)] outline-none"
      >
        {moreLinks.map((item) => (
          <MenuItem key={`${item.href}-${item.label}`}>
            <NavAnchor item={item} className="block rounded-[14px] px-3 py-2.5 text-sm font-bold text-[#1F2933] data-focus:bg-[#FFF4EF] data-focus:text-[#ED3500]">
              {item.label}
            </NavAnchor>
          </MenuItem>
        ))}
        <div className="mt-2 border-t border-[#FFE0D6] pt-2">
          <MarketPicker
            marketCountries={marketCountries}
            value={marketValue}
            onChange={onMarketChange}
            className="w-full justify-between"
          />
        </div>
      </MenuItems>
    </Menu>
  );
}

function MobileLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-[16px] border border-[#FFE0D6] bg-white px-3 py-3 text-sm font-black text-[#1F2933]"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">{icon}</span>
      {label}
    </Link>
  );
}

function MarketPicker({
  marketCountries,
  value,
  onChange,
  className,
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
        className={cn(
          "flex h-10 items-center gap-2 rounded-full border border-[#FFE0D6] bg-white px-3 text-xs font-black text-[#1F2933] shadow-sm outline-none transition hover:border-[#ED3500] focus-visible:ring-4 focus-visible:ring-[#ED3500]/10",
          className,
        )}
        aria-label="Select market country and currency"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <Globe2 className="h-4 w-4 shrink-0 text-[#ED3500]" aria-hidden="true" />
        <span className="whitespace-nowrap">
          {selectedMarket ? `${selectedMarket.code} / ${selectedMarket.currency}` : "Market"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition", isOpen && "rotate-180")} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-[95] mt-2 w-56 overflow-hidden rounded-[18px] border border-[#FFE0D6] bg-white p-1.5 shadow-[0_22px_60px_rgba(22,59,92,0.18)]">
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
                    "flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left transition",
                    selected
                      ? "bg-[#ED3500] text-white shadow-sm"
                      : "text-[#1F2933] hover:bg-[#FFF4EF] hover:text-[#ED3500]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black">
                      {country.code} / {country.currency}
                    </span>
                    <span className={cn("mt-0.5 block truncate text-[11px] font-semibold", selected ? "text-white/75" : "text-[#667085]")}>
                      {country.name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavAnchor({
  item,
  className,
  children,
}: {
  item: HeaderNavItem;
  className: string;
  children: ReactNode;
}) {
  if (isExternalHref(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {children}
    </Link>
  );
}

function menuItemToNavItem(item: CmsMenuItem): HeaderNavItem {
  return {
    label: item.label,
    href: item.href,
    children: item.children?.map(menuItemToNavItem) ?? [],
  };
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isExternalHref(href: string) {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}
