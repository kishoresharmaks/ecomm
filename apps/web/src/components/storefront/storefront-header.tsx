"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  BadgePercent,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  Download,
  Grid3X3,
  Headphones,
  Heart,
  Home,
  Menu as MenuIcon,
  PackageCheck,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@indihub/ui";
import { AuthActions } from "@/components/auth/auth-actions";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { StorefrontLocationPicker } from "@/components/storefront/storefront-location-picker";
import { StorefrontLocalePicker } from "@/components/storefront/storefront-locale-picker";
import { useFloatingHeaderDropdown } from "@/components/storefront/use-floating-header-dropdown";
import { getWishlist } from "@/lib/account-api";
import {
  cartTotals,
  getCart,
  getSearchSuggestions,
  listCategories,
  listCmsMenus,
  type CategorySummary,
  type CmsMenuItem,
  type SearchSuggestion,
} from "@/lib/storefront-api";
import { useTranslations } from "next-intl";

type HeaderNavItem = {
  label: string;
  href: string;
  children?: HeaderNavItem[];
};

const brandLogoSrc = "/brand/1handindia_logo.png";
const staticStorefrontDataStaleMs = 5 * 60 * 1000;
const categoryIcons = [PackageSearch, Store, ShoppingCart, BadgePercent, PackageCheck, ShieldCheck];

const drawerLinks = [
  { label: "Home", translationKey: "home", href: "/", icon: Home },
  { label: "All Categories", translationKey: "categories", href: "/categories", icon: Grid3X3 },
  { label: "Hyperlocal Stores", translationKey: "stores", href: "/stores", icon: Store },
  { label: "Track Order", href: "/track-order", icon: Truck },
  { label: "Wishlist", translationKey: "wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Help & Support", translationKey: "help_support", href: "/contact", icon: Headphones },
  { label: "Download App", translationKey: "download_app", href: "/contact?topic=download-app", icon: Download },
] as const;
const recentSearchStorageKey = "indihub.recent-searches.v1";
const desktopDropdownCloseDelayMs = 140;
const desktopDropdownViewportMarginPx = 20;
const desktopDropdownMaxWidthPx = 820;

export function StorefrontHeader({ initialMenu }: { initialMenu?: CmsMenuItem[] | undefined }) {
  const t = useTranslations("header");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const customerAuth = useCustomerAuth();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [drawerPortal, setDrawerPortal] = useState<HTMLElement | null>(null);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const wishlistQuery = useQuery({
    queryKey: ["account-wishlist", customerAuth.authKey, "header"],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "header"],
    queryFn: listCategories,
    staleTime: staticStorefrontDataStaleMs,
    retry: false,
  });
  const menuQuery = useQuery({
    queryKey: ["cms-menus", "header"],
    queryFn: () => listCmsMenus("header"),
    initialData: initialMenu,
    staleTime: staticStorefrontDataStaleMs,
    retry: false,
  });

  const categories = categoriesQuery.data ?? [];
  const cartProductCount = cartTotals(cartQuery.data).productCount;
  const wishlistCount = wishlistQuery.data?.items.length ?? 0;
  const cmsItems = useMemo(
    () =>
      menuQuery.data
        ?.map(menuItemToNavItem)
        .filter((item) => !drawerLinks.some((link) => link.href === item.href)) ?? [],
    [menuQuery.data],
  );

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    setDrawerPortal(document.body);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen || mobileSearchOpen) {
      setHeaderHidden(false);
      return;
    }

    let ticking = false;

    function updateHeaderVisibility() {
      const currentScrollY = Math.max(window.scrollY, 0);
      const previousScrollY = lastScrollYRef.current;
      const scrollingDown = currentScrollY > previousScrollY + 8;
      const scrollingUp = currentScrollY < previousScrollY - 8;

      if (currentScrollY < 96 || scrollingUp) {
        setHeaderHidden(false);
      } else if (scrollingDown && currentScrollY > 140) {
        setHeaderHidden(true);
      }

      lastScrollYRef.current = currentScrollY;
      ticking = false;
    }

    function handleScroll() {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateHeaderVisibility);
    }

    lastScrollYRef.current = Math.max(window.scrollY, 0);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [mobileMenuOpen, mobileSearchOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    rememberRecentSearch(trimmed);
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-[100] transform-gpu border-b border-[#f2e4dd] bg-white/96 shadow-[0_16px_44px_rgba(17,24,39,0.08)] backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none lg:border-b-0 lg:bg-transparent lg:px-3 lg:pt-2 lg:shadow-none lg:backdrop-blur-none",
        headerHidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      <div className="lg:mx-auto lg:max-w-[1840px] lg:overflow-visible lg:rounded-[18px] lg:border lg:border-[#f2e4dd] lg:bg-white/96 lg:shadow-[0_16px_48px_rgba(17,24,39,0.08)] lg:backdrop-blur-xl">
        <div className="hidden border-b border-[#f2e4dd] bg-[#fffaf7]/88 lg:block lg:rounded-t-[18px]">
          <div className="mx-auto flex h-11 items-center justify-between gap-5 px-5 xl:px-7 2xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <StorefrontLocationPicker utility compact className="w-auto min-w-0 max-w-[360px]" />
              <StorefrontLocalePicker className="hidden xl:block" />
            </div>

            <DeliveryPromoCopy />

            <nav
              className="flex shrink-0 items-center gap-4 text-[13px] font-bold text-[#344054] 2xl:gap-5"
              aria-label="Storefront utility"
            >
              <UtilityLink
                href="/contact?topic=download-app"
                icon={<Smartphone className="h-4 w-4" />}
              >
                {t("download_app")}
              </UtilityLink>
              <UtilityLink href="/contact" icon={<CircleHelp className="h-4 w-4" />}>
                {t("help_support")}
              </UtilityLink>
              <UtilityLink href="/seller/register" icon={<Store className="h-4 w-4" />}>
                {t("sell_on_platform")}
              </UtilityLink>
            </nav>
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="mx-auto flex min-h-[76px] items-center gap-2 px-5 py-3 xl:gap-3 xl:px-7 2xl:gap-4 2xl:px-8">
            <BrandBlock />
            <CategoryMenu categories={categories} />

            <SearchForm
              query={query}
              onQueryChange={setQuery}
              onSubmit={submitSearch}
              floatingSuggestions
              onNavigate={() => {
                setMobileMenuOpen(false);
                setMobileSearchOpen(false);
              }}
              className="mx-1 min-w-[220px] flex-1 xl:mx-2"
              inputClassName="h-[52px] rounded-full border-[#eaded8] bg-white pl-[52px] pr-[112px] text-[15px] shadow-[0_14px_36px_rgba(17,24,39,0.08)]"
              buttonClassName="right-2 top-1.5 h-10 px-6"
            />

            <div className="flex shrink-0 items-center gap-1 xl:gap-2">
              <HeaderIconAction
                href="/account/wishlist"
                label={t("wishlist")}
                icon={<Heart className="h-5 w-5" />}
                badge={wishlistCount}
              />
              <HeaderIconAction
                href="/cart"
                label={t("cart")}
                icon={<ShoppingCart className="h-5 w-5" />}
                badge={cartProductCount}
              />
              <AccountMenu />
            </div>
          </div>
        </div>

        <div className="lg:hidden">
          <div className="mx-auto flex h-[62px] max-w-[760px] items-center gap-1.5 px-2.5 sm:px-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[#101828] transition hover:bg-[#fff1ea] hover:text-[#ff5a1f]"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <MenuIcon className="h-6 w-6" aria-hidden="true" />
            </button>

            <MobileBrandLogo />

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
              <MobileRoundAction
                asButton
                label={t("search_placeholder")}
                icon={<Search className="h-5 w-5" />}
                onClick={() => setMobileSearchOpen((current) => !current)}
                active={mobileSearchOpen}
              />
              <MobileRoundAction
                href="/account/wishlist"
                label={t("wishlist")}
                icon={<Heart className="h-5 w-5" />}
                badge={wishlistCount}
              />
              <MobileRoundAction
                href="/cart"
                label={t("cart")}
                icon={<ShoppingCart className="h-5 w-5" />}
                badge={cartProductCount}
              />
              <MobileRoundAction
                href="/account"
                label={t("my_account")}
                icon={<UserRound className="h-5 w-5" />}
              />
            </div>
          </div>

          {mobileSearchOpen ? (
            <div className="border-t border-[#f2e4dd] bg-white px-3 pb-3">
              <SearchForm
                query={query}
                onQueryChange={setQuery}
                onSubmit={submitSearch}
                onNavigate={() => setMobileSearchOpen(false)}
                inputClassName="h-12 rounded-2xl border-[#eaded8] bg-[#fffaf7] pl-11 pr-[86px] text-sm shadow-sm"
                buttonClassName="right-1.5 top-1.5 h-9 px-4"
              />
            </div>
          ) : null}
        </div>
      </div>

      {mobileMenuOpen && drawerPortal
        ? createPortal(
            <MobileDrawer
              query={query}
              onQueryChange={setQuery}
              onSearchSubmit={submitSearch}
              onClose={() => setMobileMenuOpen(false)}
              cartCount={cartProductCount}
              wishlistCount={wishlistCount}
              cmsItems={cmsItems}
            />,
            drawerPortal,
          )
        : null}
    </header>
  );
}

function DeliveryPromoCopy() {
  const market = useMarket();
  const t = useTranslations("header");

  return (
    <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 text-[13px] font-bold text-[#26364b] xl:flex">
      <Truck className="h-4 w-4 text-[#0f8a5f]" aria-hidden="true" />
      <span className="truncate">
        {t("free_delivery")}{" "}
        <span className="text-[#0f8a5f]">{market.format(49_900)}</span>
      </span>
    </div>
  );
}

function BrandBlock() {
  const t = useTranslations("header");
  return (
    <Link
      href="/"
      className="flex min-w-[178px] items-center gap-2.5 2xl:min-w-[218px] 2xl:gap-3"
      aria-label="1HandIndia home"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_14px_30px_rgba(255,90,31,0.18)] 2xl:h-14 2xl:w-14">
        <img src={brandLogoSrc} alt="" className="h-full w-full object-cover" loading="eager" />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[23px] font-black leading-none tracking-normal text-[#101828] 2xl:text-[26px]">
          1Hand<span className="text-[#ff5a1f]">India</span>
        </span>
        <span className="mt-1 hidden truncate text-xs font-semibold text-[#667085] xl:block">
          {t("smart_shopping")}
        </span>
      </span>
    </Link>
  );
}

function MobileBrandLogo() {
  return (
    <Link href="/" className="flex min-w-0 flex-1 items-center gap-2" aria-label="1HandIndia home">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_12px_24px_rgba(255,90,31,0.16)] sm:h-10 sm:w-10">
        <img src={brandLogoSrc} alt="" className="h-full w-full object-cover" loading="eager" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-black leading-none text-[#101828] sm:text-[18px]">
          1Hand<span className="text-[#ff5a1f]">India</span>
        </span>
      </span>
    </Link>
  );
}

function SearchForm({
  query,
  onQueryChange,
  onSubmit,
  onNavigate,
  className,
  inputClassName,
  buttonClassName,
  floatingSuggestions = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNavigate?: () => void;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  floatingSuggestions?: boolean;
}) {
  const t = useTranslations("header");
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const formRef = useRef<HTMLFormElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const trimmedQuery = query.trim();
  const shouldShowSuggestions = focused && (trimmedQuery.length >= 2 || recentSearches.length > 0);
  const closeSuggestions = useCallback(() => {
    setFocused(false);
    setActiveIndex(-1);
  }, []);
  const suggestionsQuery = useQuery({
    queryKey: ["search-suggestions", debouncedQuery],
    queryFn: () => getSearchSuggestions({ q: debouncedQuery, limit: 8 }),
    enabled: focused && debouncedQuery.length >= 2,
    staleTime: 30_000,
    retry: false,
  });
  const suggestionItems =
    trimmedQuery.length >= 2
      ? (suggestionsQuery.data?.suggestions ?? [])
      : recentSearches.map((term) => ({
          id: term,
          title: term,
          subtitle: "Recent search",
          href: `/search?q=${encodeURIComponent(term)}`,
        }));
  const { portalRoot, floatingStyle, updatePosition } = useFloatingHeaderDropdown({
    open: floatingSuggestions && shouldShowSuggestions,
    onClose: closeSuggestions,
    triggerRef: formRef,
    panelRef: suggestionsRef,
    maxWidth: 720,
    matchTriggerWidth: true,
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, 180);

    return () => window.clearTimeout(handle);
  }, [trimmedQuery]);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery, focused]);

  useEffect(() => {
    if (floatingSuggestions && shouldShowSuggestions) {
      updatePosition();
    }
  }, [floatingSuggestions, shouldShowSuggestions, suggestionItems.length, updatePosition]);

  function navigateToSuggestion(item: SearchSuggestion | { title: string; href: string }) {
    rememberRecentSearch(item.title);
    onQueryChange(item.title);
    onNavigate?.();
    router.push(item.href);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!shouldShowSuggestions || suggestionItems.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestionItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestionItems.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const activeItem = suggestionItems[activeIndex];
      if (activeItem) {
        navigateToSuggestion(activeItem);
      }
    } else if (event.key === "Escape") {
      setFocused(false);
      setActiveIndex(-1);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn("relative min-w-0", className)}>
      <label className="relative block">
        <span className="sr-only">Search products, stores, and brands</span>
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#ff5a1f]" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => {
            setFocused(true);
            updatePosition();
          }}
          onBlur={() => {
            window.setTimeout(() => {
              const activeElement = document.activeElement;
              if (
                floatingSuggestions &&
                activeElement instanceof Node &&
                suggestionsRef.current?.contains(activeElement)
              ) {
                return;
              }

              setFocused(false);
            }, 140);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("search_placeholder")}
          className={cn(
            "w-full border text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#ff5a1f] focus:ring-4 focus:ring-[#ff5a1f]/10",
            inputClassName,
          )}
        />
        <button
          type="submit"
          className={cn(
            "absolute rounded-full bg-[#ff5a1f] text-sm font-black text-white shadow-[0_12px_26px_rgba(255,90,31,0.28)] transition hover:bg-[#e94912]",
            buttonClassName,
          )}
        >
          Search
        </button>
      </label>
      {shouldShowSuggestions ? (
        floatingSuggestions && portalRoot && floatingStyle ? (
          createPortal(
            <SearchSuggestionsPanel
              ref={suggestionsRef}
              style={floatingStyle}
              floating
              trimmedQuery={trimmedQuery}
              isFetching={suggestionsQuery.isFetching}
              suggestionItems={suggestionItems}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onNavigate={navigateToSuggestion}
            />,
            portalRoot,
          )
        ) : (
          <SearchSuggestionsPanel
            trimmedQuery={trimmedQuery}
            isFetching={suggestionsQuery.isFetching}
            suggestionItems={suggestionItems}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onNavigate={navigateToSuggestion}
          />
        )
      ) : null}
    </form>
  );
}

const SearchSuggestionsPanel = forwardRef<
  HTMLDivElement,
  {
    trimmedQuery: string;
    isFetching: boolean;
    suggestionItems: Array<SearchSuggestion | { id: string; title: string; subtitle: string; href: string }>;
    activeIndex: number;
    onActiveIndexChange: (index: number) => void;
    onNavigate: (item: SearchSuggestion | { title: string; href: string }) => void;
    floating?: boolean;
    style?: CSSProperties;
  }
>(function SearchSuggestionsPanel(
  {
    trimmedQuery,
    isFetching,
    suggestionItems,
    activeIndex,
    onActiveIndexChange,
    onNavigate,
    floating = false,
    style,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "overflow-hidden rounded-[24px] border border-[#f2dcd1] bg-white shadow-[0_26px_70px_rgba(17,24,39,0.18)]",
        floating ? "fixed z-[140]" : "absolute left-0 right-0 top-[calc(100%+10px)] z-[105]",
      )}
    >
      <div className="max-h-[420px] overflow-y-auto p-2">
        {trimmedQuery.length < 2 ? (
          <p className="px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#ff5a1f]">
            Recent searches
          </p>
        ) : null}

        {isFetching && trimmedQuery.length >= 2 ? (
          <div className="px-3 py-3 text-sm font-semibold text-[#667085]">Searching...</div>
        ) : null}

        {suggestionItems.length ? (
          <div className="grid gap-1">
            {suggestionItems.map((item, index) => (
              <SearchSuggestionRow
                key={`${item.href}-${item.title}`}
                item={item}
                active={activeIndex === index}
                onMouseEnter={() => onActiveIndexChange(index)}
                onNavigate={() => onNavigate(item)}
              />
            ))}
          </div>
        ) : trimmedQuery.length >= 2 && !isFetching ? (
          <div className="px-3 py-4 text-sm font-semibold text-[#667085]">
            No matching products, stores, or categories yet.
          </div>
        ) : null}
      </div>
    </div>
  );
});

function SearchSuggestionRow({
  item,
  active,
  onMouseEnter,
  onNavigate,
}: {
  item: SearchSuggestion | { title: string; subtitle?: string | null; href: string };
  active: boolean;
  onMouseEnter: () => void;
  onNavigate: () => void;
}) {
  const type = "type" in item ? item.type : "recent";
  const Icon =
    type === "store"
      ? Store
      : type === "category"
        ? Grid3X3
        : type === "recent"
          ? Clock
          : PackageSearch;

  return (
    <Link
      href={item.href}
      onMouseEnter={onMouseEnter}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onNavigate}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
        active ? "bg-[#fff4ef] text-[#ff5a1f]" : "text-[#101828] hover:bg-[#fff7f3] hover:text-[#ff5a1f]",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff1ea] text-[#ff5a1f]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-black">{item.title}</span>
        {item.subtitle ? (
          <span className="mt-0.5 block truncate text-xs font-semibold text-[#667085]">
            {item.subtitle}
          </span>
        ) : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" aria-hidden="true" />
    </Link>
  );
}

function CategoryMenu({ categories }: { categories: CategorySummary[] }) {
  const t = useTranslations("header");
  const visibleCategories = categories.slice(0, 8);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const clickPinnedRef = useRef(false);
  const menuId = useId();

  const closeMenu = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    clickPinnedRef.current = false;
    setOpen(false);
  }, []);

  const { portalRoot, floatingStyle, updatePosition } = useFloatingHeaderDropdown({
    open,
    onClose: closeMenu,
    triggerRef,
    panelRef: dropdownRef,
    maxWidth: desktopDropdownMaxWidthPx,
    viewportMargin: desktopDropdownViewportMarginPx,
  });

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openMenu() {
    clearCloseTimer();
    updatePosition();
    setOpen(true);
  }

  function scheduleClose({ force = false }: { force?: boolean } = {}) {
    if (clickPinnedRef.current && !force) {
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      clickPinnedRef.current = false;
      closeTimerRef.current = null;
      setOpen(false);
    }, desktopDropdownCloseDelayMs);
  }

  function toggleMenu() {
    clearCloseTimer();
    if (clickPinnedRef.current) {
      closeMenu();
      return;
    }

    clickPinnedRef.current = true;
    updatePosition();
    setOpen(true);
  }

  function containsActiveMenuElement(target: EventTarget | null) {
    return (
      target instanceof Node &&
      (menuRef.current?.contains(target) || dropdownRef.current?.contains(target))
    );
  }

  return (
    <div
      ref={menuRef}
      className="relative shrink-0"
      onMouseEnter={openMenu}
      onMouseLeave={() => scheduleClose()}
      onFocus={openMenu}
      onBlur={(event) => {
        if (!containsActiveMenuElement(event.relatedTarget)) {
          scheduleClose({ force: true });
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          "inline-flex h-[52px] items-center gap-2 rounded-2xl border border-[#eaded8] bg-white px-3 text-sm font-black text-[#101828] shadow-[0_10px_28px_rgba(17,24,39,0.06)] transition hover:border-[#ffb99f] hover:bg-[#fff7f3] hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff5a1f]/15 xl:px-4",
          open && "border-[#ffb99f] bg-[#fff7f3] text-[#ff5a1f]",
        )}
      >
        <Grid3X3 className="h-5 w-5" aria-hidden="true" />
        <span className="hidden xl:inline">{t("all_categories")}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && portalRoot && floatingStyle
        ? createPortal(
        <div
          ref={dropdownRef}
          id={menuId}
          role="menu"
          className="fixed z-[140] origin-top rounded-[26px] border border-[#f2dcd1] bg-white p-4 opacity-100 shadow-[0_26px_80px_rgba(17,24,39,0.18)] outline-none transition duration-150 ease-out motion-reduce:transition-none"
          style={floatingStyle}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={() => scheduleClose()}
          onFocus={openMenu}
          onBlur={(event) => {
            if (!containsActiveMenuElement(event.relatedTarget)) {
              scheduleClose({ force: true });
            }
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#f2e4dd] pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a1f]">
                Shop by category
              </p>
              <p className="mt-1 text-sm font-semibold text-[#667085]">
                Browse marketplace departments and local store collections.
              </p>
            </div>
            <Link
              href="/categories"
              role="menuitem"
              onClick={closeMenu}
              className="hidden rounded-full bg-[#fff1ea] px-3 py-2 text-xs font-black text-[#ff5a1f] transition hover:bg-[#ff5a1f] hover:text-white focus-visible:bg-[#ff5a1f] focus-visible:text-white focus-visible:outline-none sm:inline-flex"
            >
              View all
            </Link>
          </div>

          {visibleCategories.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {visibleCategories.map((category, index) => (
                <MegaCategoryItem
                  key={category.id}
                  category={category}
                  index={index}
                  onNavigate={closeMenu}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-[#f8fafc] p-4 text-sm font-semibold text-[#667085]">
              No active categories yet.
            </p>
          )}

          <div className="mt-4 grid gap-2 rounded-3xl bg-[#fffaf7] p-3 sm:grid-cols-3">
            <MegaBenefit icon={<Truck className="h-4 w-4" />} label="Fast local delivery" />
            <MegaBenefit icon={<ShieldCheck className="h-4 w-4" />} label="Verified sellers" />
            <MegaBenefit icon={<PackageCheck className="h-4 w-4" />} label="Secure checkout" />
          </div>
        </div>,
        portalRoot,
      )
        : null}
    </div>
  );
}

function MegaCategoryItem({
  category,
  index,
  onNavigate,
}: {
  category: CategorySummary;
  index: number;
  onNavigate?: () => void;
}) {
  const Icon = categoryIcons[index % categoryIcons.length] ?? PackageSearch;
  const productCount = category._count?.products ?? 0;
  const navigationProps = onNavigate ? { onClick: onNavigate } : {};

  return (
    <Link
      href={`/categories/${category.slug}`}
      role="menuitem"
      {...navigationProps}
      className="group flex min-w-0 items-center gap-3 rounded-2xl p-3 transition hover:bg-[#fff4ef] hover:text-[#ff5a1f] focus-visible:bg-[#fff4ef] focus-visible:text-[#ff5a1f] focus-visible:outline-none"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff1ea] text-[#ff5a1f] transition group-hover:bg-[#ff5a1f] group-hover:text-white group-focus-visible:bg-[#ff5a1f] group-focus-visible:text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-[#101828] group-hover:text-[#ff5a1f] group-focus-visible:text-[#ff5a1f]">
          {category.name}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[#667085]">
          {productCount
            ? `${productCount.toLocaleString("en-IN")} products`
            : "Explore collection"}
        </span>
      </span>
    </Link>
  );
}

function MegaBenefit({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-[#344054] shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e9f7f1] text-[#0f8a5f]">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function HeaderIconAction({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number | undefined;
}) {
  return (
    <Link
      href={href}
      className="group relative inline-flex h-[52px] items-center gap-2 rounded-2xl px-2.5 text-sm font-black text-[#101828] transition hover:bg-[#fff7f3] hover:text-[#ff5a1f] 2xl:px-3"
      aria-label={label}
    >
      <span className="relative">
        {icon}
        <BadgeBubble count={badge} />
      </span>
      <span className="hidden 2xl:inline">{label}</span>
    </Link>
  );
}

function AccountMenu() {
  const t = useTranslations("header");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const closeMenu = useCallback(() => setOpen(false), []);
  const { portalRoot, floatingStyle, updatePosition } = useFloatingHeaderDropdown({
    open,
    onClose: closeMenu,
    triggerRef,
    panelRef,
    align: "end",
    minWidth: 288,
    maxWidth: 288,
  });

  function toggleMenu() {
    if (open) {
      closeMenu();
      return;
    }

    updatePosition();
    setOpen(true);
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            updatePosition();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex h-[52px] items-center gap-2 rounded-2xl border border-[#eaded8] bg-white px-2.5 text-left text-[#101828] shadow-[0_10px_28px_rgba(17,24,39,0.06)] transition hover:border-[#ffb99f] hover:bg-[#fff7f3] hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ff5a1f]/15 2xl:gap-3 2xl:px-3",
          open && "border-[#ffb99f] bg-[#fff7f3] text-[#ff5a1f]",
        )}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff1ea] text-[#101828]">
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="hidden 2xl:block">
          <span className="block text-sm font-black">{t("my_account")}</span>
          <span className="block text-xs font-semibold text-[#667085]">{t("profile_orders")}</span>
        </span>
        <ChevronDown className={cn("hidden h-4 w-4 transition-transform 2xl:block", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && portalRoot && floatingStyle ? createPortal(
      <div
        ref={panelRef}
        id={menuId}
        role="menu"
        className="fixed z-[140] w-72 origin-top-right rounded-[26px] border border-[#f2dcd1] bg-white p-3 shadow-[0_26px_80px_rgba(17,24,39,0.16)] outline-none"
        style={floatingStyle}
      >
        <div className="rounded-3xl bg-[#fffaf7] p-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a1f]">Account</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-[#667085]">
            Manage orders, wishlist, addresses, and support.
          </p>
        </div>
        <div className="mt-2 grid gap-1">
          {[
            { label: "Account overview", href: "/account" },
            { label: "My orders", href: "/account/orders" },
            { label: "Wishlist", href: "/account/wishlist" },
            { label: "Addresses", href: "/account/addresses" },
            { label: "Support", href: "/account/support" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={closeMenu}
              className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-bold text-[#101828] transition hover:bg-[#fff4ef] hover:text-[#ff5a1f] focus-visible:bg-[#fff4ef] focus-visible:text-[#ff5a1f] focus-visible:outline-none"
            >
              {item.label}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="mt-3 border-t border-[#f2e4dd] pt-3">
          <AuthActions />
        </div>
      </div>,
      portalRoot,
    ) : null}
    </div>
  );
}

function MobileRoundAction({
  href,
  label,
  icon,
  badge,
  asButton,
  onClick,
  active,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  badge?: number | undefined;
  asButton?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      {icon}
      <BadgeBubble count={badge} />
    </>
  );
  const className = cn(
    "relative grid h-10 w-10 place-items-center rounded-2xl text-[#101828] transition hover:bg-[#fff1ea] hover:text-[#ff5a1f]",
    active && "bg-[#fff1ea] text-[#ff5a1f]",
  );

  if (asButton) {
    return (
      <button type="button" onClick={onClick} className={className} aria-label={label}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href ?? "/"} className={className} aria-label={label}>
      {content}
    </Link>
  );
}

function BadgeBubble({ count }: { count?: number | undefined }) {
  if (!count || count <= 0) {
    return null;
  }

  return (
    <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff5a1f] px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MobileDrawer({
  query,
  onQueryChange,
  onSearchSubmit,
  onClose,
  cartCount,
  wishlistCount,
  cmsItems,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  cartCount: number;
  wishlistCount: number;
  cmsItems: HeaderNavItem[];
}) {
  const t = useTranslations("header");

  return (
    <div className="fixed inset-0 z-[120] lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-[#101828]/36 backdrop-blur-sm"
        aria-label="Close mobile menu"
        onClick={onClose}
      />
      <aside className="indihub-mobile-side-drawer absolute inset-y-3 left-3 flex w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[30px] border border-[#f2dcd1] bg-white shadow-[0_28px_90px_rgba(17,24,39,0.24)]">
        <div className="flex items-center gap-3 border-b border-[#f2e4dd] px-4 py-4">
          <MobileBrandLogo />
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff1ea] text-[#101828] transition hover:bg-[#ff5a1f] hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <SearchForm
            query={query}
            onQueryChange={onQueryChange}
            onSubmit={onSearchSubmit}
            onNavigate={onClose}
            inputClassName="h-12 rounded-2xl border-[#eaded8] bg-[#fffaf7] pl-11 pr-[86px] text-sm shadow-sm"
            buttonClassName="right-1.5 top-1.5 h-9 px-4"
          />

          <div className="mt-4">
            <StorefrontLocationPicker mobile compact />
            <StorefrontLocalePicker mobile />
          </div>

          <div className="mt-5 grid gap-2">
            {drawerLinks.map((item) => {
              const Icon = item.icon;
              const label = "translationKey" in item ? t(item.translationKey as any) : item.label;

              return (
                <DrawerLink
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  label={label}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                  badge={item.href === "/account/wishlist" ? wishlistCount : undefined}
                  onNavigate={onClose}
                />
              );
            })}
            <DrawerLink
              href="/cart"
              label={t("cart")}
              icon={<ShoppingCart className="h-5 w-5" />}
              badge={cartCount}
              onNavigate={onClose}
            />
          </div>

          {cmsItems.length ? (
            <div className="mt-5 border-t border-[#f2e4dd] pt-4">
              <p className="px-1 text-xs font-black uppercase tracking-[0.18em] text-[#ff5a1f]">
                Explore
              </p>
              <div className="mt-2 grid gap-2">
                {cmsItems.slice(0, 4).map((item) => (
                  <DrawerLink
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    label={item.label}
                    icon={<ChevronRight className="h-5 w-5" />}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl bg-[#fffaf7] p-4">
            <p className="text-sm font-black text-[#101828]">Seller partner?</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              List your store and sell to nearby customers.
            </p>
            <Link
              href="/seller/register"
              onClick={onClose}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#ff5a1f] text-sm font-black text-white shadow-[0_14px_30px_rgba(255,90,31,0.25)]"
            >
              Sell on 1HandIndia
            </Link>
          </div>
        </div>

        <div className="border-t border-[#f2e4dd] px-4 py-4">
          <AuthActions />
        </div>
      </aside>
    </div>
  );
}

function DrawerLink({
  href,
  label,
  icon,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number | undefined;
  onNavigate: () => void;
}) {
  return (
    <DrawerAnchor
      href={href}
      onNavigate={onNavigate}
      className="relative flex min-h-[52px] items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm font-black text-[#101828] transition hover:border-[#f2dcd1] hover:bg-[#fff7f3] hover:text-[#ff5a1f]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff1ea] text-[#ff5a1f]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <BadgeBubble count={badge} />
      <ChevronRight className="h-4 w-4 shrink-0 text-[#98a2b3]" aria-hidden="true" />
    </DrawerAnchor>
  );
}

function UtilityLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full transition hover:text-[#ff5a1f]"
    >
      <span className="text-[#667085]">{icon}</span>
      <span>{children}</span>
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

function DrawerAnchor({
  href,
  onNavigate,
  className,
  children,
}: {
  href: string;
  onNavigate: () => void;
  className: string;
  children: ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={onNavigate} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onNavigate} className={className}>
      {children}
    </Link>
  );
}

function isExternalHref(href: string) {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

function readRecentSearches() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentSearchStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === "string" && value.trim().length >= 2)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function rememberRecentSearch(term: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = term.trim();
  if (normalized.length < 2) {
    return;
  }

  const current = readRecentSearches();
  const next = [
    normalized,
    ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
  ].slice(0, 6);

  try {
    window.localStorage.setItem(recentSearchStorageKey, JSON.stringify(next));
  } catch {
    // Browser storage can be disabled. Search still works without recents.
  }
}
