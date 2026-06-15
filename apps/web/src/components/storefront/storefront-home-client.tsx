"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  BadgePercent,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  Headphones,
  LocateFixed,
  MapPin,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  type LucideIcon,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { listCustomerOrders } from "@/lib/account-api";
import { composePersonalizedHomeRails } from "@/lib/personalized-home-ranking";
import { readRecentProducts, type RecentProductSnapshot } from "@/lib/recent-products";
import { useStorefrontLocation } from "@/components/storefront/storefront-location-context";
import {
  formatMoney,
  getCart,
  getStorefrontHome,
  primaryImage,
  primaryVariant,
  type CartSummary,
  type CategorySummary,
  type HomepageBanner,
  type HomepageSection,
  type HomepageSectionItem,
  type OrderSummary,
  type ProductSummary,
  type StoreProfile,
  type StorefrontHomePayload,
} from "@/lib/storefront-api";
import {
  browsingLocationHeadline,
  browsingLocationLabel,
  browsingLocationQuery,
} from "./storefront-location-utils";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { StorefrontLocationPicker } from "./storefront-location-picker";
import { getStorefrontStockStatus, storefrontStockBadgeClass } from "./storefront-stock-status";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontSkeleton,
} from "./storefront-ui";
import { useStorefrontWishlist } from "./use-storefront-wishlist";

const HERO_CAROUSEL_INTERVAL_MS = 5000;
const QUICK_CATEGORY_LIMIT = 8;
// empirical minimum to distinguish tap drift from intentional swipe
const SWIPE_THRESHOLD_PX = 12;

type CustomerQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  desktopDescription: string;
};

// hardcoded for now; promote to CMS only if customer quick actions need admin control
const customerQuickActions = [
  {
    label: "Track order",
    href: "/track-order",
    icon: Truck,
    desktopDescription: "Check delivery updates",
  },
  {
    label: "Reorder",
    href: "/account/orders",
    icon: RotateCcw,
    desktopDescription: "Buy again from past orders",
  },
  {
    label: "Wishlist",
    href: "/account/wishlist",
    icon: Heart,
    desktopDescription: "Saved products",
  },
  {
    label: "Support",
    href: "/contact",
    icon: Headphones,
    desktopDescription: "Get help fast",
  },
  {
    label: "Offers",
    href: "/deals",
    icon: BadgePercent,
    desktopDescription: "Live deals",
  },
  {
    label: "Nearby stores",
    href: "/stores",
    icon: Store,
    desktopDescription: "Local shops",
  },
] satisfies CustomerQuickAction[];

export function StorefrontHomeClient({
  initialHome = null,
}: {
  initialHome?: StorefrontHomePayload | null;
}) {
  const customerAuth = useCustomerAuth();
  const storefrontLocation = useStorefrontLocation();
  const useInitialHome =
    storefrontLocation.source === "global" && !storefrontLocation.activeLocation && initialHome;
  const homeQuery = useQuery({
    queryKey: [
      "storefront-home",
      storefrontLocation.activeLocation?.countryCode ?? "",
      storefrontLocation.activeLocation?.stateCode ?? "",
      storefrontLocation.activeLocation?.cityCode ?? "",
      storefrontLocation.activeLocation?.localAreaCode ?? "",
      storefrontLocation.activeLocation?.pincode ?? "",
    ],
    queryFn: () => getStorefrontHome(browsingLocationQuery(storefrontLocation.activeLocation, 6)),
    initialData: useInitialHome ? initialHome : undefined,
    retry: false,
  });

  const home = homeQuery.data;
  const heroProducts = home?.productRails.featured.length
    ? home.productRails.featured
    : home?.productRails.latest ?? [];
  const productRailSections = useMemo(() => buildStorefrontProductRails(home), [home]);
  const topCategories = home?.categories ?? [];
  const liveCategorySection = findSection(home?.homepageSections, "featured_categories");
  const categorySectionTitle = liveCategorySection?.title || "Shop by Category";
  const categorySectionDescription =
    stringValue(liveCategorySection?.config?.subtitle) ||
    stringValue(liveCategorySection?.config?.description) ||
    "Explore our top categories and find what you need";
  const storesLocationLabel =
    storefrontLocation.source === "global"
      ? "Top rated stores"
      : `Top rated stores in and around ${browsingLocationHeadline(storefrontLocation.activeLocation)}`;
  const serviceItems = normalizeHomepageItems(home?.serviceBadges?.config?.items);
  const sellerCtaConfig = home?.sellerCta?.config ?? null;
  const customSections = standaloneHomepageSections(home?.homepageSections);

  return (
    <StorefrontFrame initialMenus={home?.menus}>
      <main className="bg-[#FFFCFB] pb-8">
        <MobileCustomerAppTop categories={topCategories} isLoading={homeQuery.isLoading} />

        <HomepageHero
          home={home}
          isLoading={homeQuery.isLoading}
          products={heroProducts}
          browsingLocation={storefrontLocation.activeLocation}
          locationSource={storefrontLocation.source}
        />

        <CustomerQuickActions variant="desktop" />

        {homeQuery.isError ? (
          <section className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-10">
            <StorefrontErrorPanel error={homeQuery.error} onRetry={() => void homeQuery.refetch()} />
          </section>
        ) : null}

        <StatsStrip home={home} isLoading={homeQuery.isLoading} />

        <PersonalizedHomeSections
          home={home}
          isLoading={homeQuery.isLoading}
        />

        <div className="flex flex-col">
          <CategoryShowcase
            categories={topCategories}
            isLoading={homeQuery.isLoading}
            title={categorySectionTitle}
            description={categorySectionDescription}
          />

          {productRailSections.map((rail) =>
            rail.products.length || homeQuery.isLoading ? (
              <div key={rail.id}>
                <ProductRailSection
                  title={rail.title}
                  description={rail.description}
                  href={rail.href}
                  products={rail.products}
                  isLoading={homeQuery.isLoading}
                  promoProduct={rail.products[0]}
                  promoTone={rail.promoTone}
                />
              </div>
            ) : null,
          )}

          <div>
            <StoresNearYou
              stores={home?.storesNearYou ?? []}
              isLoading={homeQuery.isLoading}
              locationLabel={storesLocationLabel}
            />
          </div>

          <CustomHomepageSections sections={customSections} />
        </div>

        <SellerCta section={home?.sellerCta ?? null} config={sellerCtaConfig} />

        {serviceItems.length ? <ServiceBadges items={serviceItems} /> : null}

        {!customerAuth.enabled ? (
          <section className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10">
            <CustomerAuthNotice />
          </section>
        ) : null}
      </main>
    </StorefrontFrame>
  );
}

function MobileCustomerAppTop({
  categories,
  isLoading,
}: {
  categories: CategorySummary[];
  isLoading: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const quickCategories = categories.slice(0, QUICK_CATEGORY_LIMIT);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push((trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search") as Route);
  }

  return (
    <section className="mx-auto max-w-[760px] px-3 pb-1 pt-3 sm:px-4 lg:hidden">
      <div className="rounded-[24px] border border-[#FFE0D6] bg-white p-3 shadow-[0_16px_38px_rgba(22,59,92,0.07)]">
        <div className="flex min-w-0 items-center gap-2">
          <StorefrontLocationPicker mobile compact className="min-w-0 flex-1" />
        </div>

        <form onSubmit={submitSearch} className="relative mt-3">
          <label htmlFor="mobile-home-search" className="sr-only">
            Search products, stores, or brands
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#ED3500]" aria-hidden="true" />
          <input
            id="mobile-home-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, stores, brands..."
            className="h-12 w-full rounded-[18px] border border-[#FFE0D6] bg-[#FFF9F6] pl-11 pr-[88px] text-sm font-bold text-[#111827] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:bg-white focus:ring-4 focus:ring-[#ED3500]/10"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 h-9 rounded-full bg-[#ED3500] px-4 text-xs font-black text-white shadow-[0_12px_22px_rgba(237,53,0,0.22)]"
          >
            Search
          </button>
        </form>

        <CustomerQuickActions variant="mobile" />

        <div className="mt-3 overflow-hidden">
          <div
            className={cn(
              "indihub-scroll-rail flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              quickCategories.length < 4 ? "justify-start" : "",
            )}
            aria-label="Quick categories"
          >
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <StorefrontSkeleton key={index} className="h-20 w-[74px] shrink-0 rounded-[18px] bg-[#FFF4EF]" />
                ))
              : quickCategories.map((category, index) => (
                  <MobileQuickCategoryItem
                    key={category.id}
                    category={category}
                    accent={categoryAccent(index)}
                  />
                ))}
            <HomepageItemLink
              href="/categories"
              className="flex h-20 w-[74px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[18px] border border-[#FFE0D6] bg-[#FFF7F3] text-center text-[11px] font-black text-[#ED3500]"
              aria-label="View all categories"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>All</span>
            </HomepageItemLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomerQuickActions({ variant }: { variant: "desktop" | "mobile" }) {
  if (variant === "mobile") {
    return (
      <nav className="mt-3" aria-label="Customer quick actions">
        <div className="indihub-scroll-rail flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {customerQuickActions.map((action) => (
            <HomepageItemLink
              key={action.href}
              href={action.href}
              className="flex h-[78px] w-[76px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[18px] border border-[#FFE0D6] bg-[#FFF9F6] px-2 text-center text-[11px] font-black leading-[13px] text-[#1F2933] transition active:scale-[0.98]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#ED3500] shadow-sm">
                <action.icon className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={2.4} />
              </span>
              <span className="line-clamp-2">{action.label}</span>
            </HomepageItemLink>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <section className="hidden bg-[#FFFCFB] px-4 pt-5 sm:px-6 lg:block lg:px-10" aria-label="Customer quick actions">
      <div className="mx-auto grid max-w-[1360px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {customerQuickActions.map((action) => (
          <HomepageItemLink
            key={action.href}
            href={action.href}
            className="group flex min-h-[86px] items-center gap-3 rounded-[18px] border border-[#F1D7CF] bg-white px-4 py-3 shadow-[0_14px_38px_rgba(22,59,92,0.06)] transition hover:-translate-y-0.5 hover:border-[#ED3500]/40 hover:shadow-[0_20px_46px_rgba(22,59,92,0.09)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500] transition group-hover:bg-[#ED3500] group-hover:text-white">
              <action.icon className="h-5 w-5" aria-hidden="true" strokeWidth={2.3} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-[#1F2933]">{action.label}</span>
              <span className="mt-1 block truncate text-xs font-bold text-[#667085]">{action.desktopDescription}</span>
            </span>
          </HomepageItemLink>
        ))}
      </div>
    </section>
  );
}

function MobileQuickCategoryItem({
  category,
  accent,
}: {
  category: CategorySummary;
  accent: CategoryAccent;
}) {
  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className="flex h-20 w-[74px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[18px] border border-[#F4E5DE] bg-white px-2 text-center shadow-[0_8px_20px_rgba(22,59,92,0.05)] active:scale-[0.98]"
    >
      <span
        className={cn(
          "grid h-10 w-10 place-items-center overflow-hidden rounded-full",
          accent.imageBg,
        )}
      >
        <StorefrontImage
          src={category.imageUrl?.trim() || null}
          alt={category.name}
          sizes="40px"
          fallbackLabel={category.name}
          showFallbackLabel={false}
          allowExternalRemote
          className="object-contain p-2"
        />
      </span>
      <span className="line-clamp-2 min-h-7 text-[11px] font-black leading-[14px] text-[#1F2933]">
        {category.name}
      </span>
    </Link>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function updatePreference() {
      setPrefersReducedMotion(mediaQuery.matches);
    }

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function HomepageHero({
  home,
  isLoading,
  products,
  browsingLocation,
  locationSource,
}: {
  home: StorefrontHomePayload | undefined;
  isLoading: boolean;
  products: ProductSummary[];
  browsingLocation: ReturnType<typeof useStorefrontLocation>["activeLocation"];
  locationSource: ReturnType<typeof useStorefrontLocation>["source"];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const banners = home?.banners ?? [];
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const hasMultipleBanners = banners.length > 1;
  const normalizedBannerIndex = banners.length ? activeBannerIndex % banners.length : 0;
  const banner = banners[normalizedBannerIndex] ?? null;
  const title = banner?.title?.trim() || "";
  const subtitle =
    banner?.subtitle?.trim() ||
    statsSentence(home?.stats);
  const eyebrow = banner?.eyebrow?.trim() || "";
  const ctaLabel = banner?.ctaLabel?.trim() || "Shop Now";
  const ctaHref = banner?.linkUrl?.trim() || "/categories";
  const secondaryCtaLabel = banner?.secondaryCtaLabel?.trim() || "";
  const secondaryCtaHref = banner?.secondaryLinkUrl?.trim() || "";
  const locationText =
    locationSource === "global"
      ? "Set your location"
      : browsingLocationLabel(browsingLocation);

  useEffect(() => {
    if (!banners.length) {
      setActiveBannerIndex(0);
      return;
    }

    setActiveBannerIndex((current) => Math.min(current, banners.length - 1));
  }, [banners.length]);

  useEffect(() => {
    if (!hasMultipleBanners || isCarouselPaused || prefersReducedMotion) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveBannerIndex((current) => (current + 1) % banners.length);
    }, HERO_CAROUSEL_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeBannerIndex,
    banners.length,
    hasMultipleBanners,
    isCarouselPaused,
    prefersReducedMotion,
  ]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push((trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search") as Route);
  }

  function setDesktopPauseState(next: boolean) {
    if (typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches) {
      setIsCarouselPaused(next);
    }
  }

  function selectBanner(index: number) {
    setActiveBannerIndex(index);
  }

  function moveBanner(direction: -1 | 1) {
    if (!banners.length) {
      return;
    }

    setActiveBannerIndex((current) => (current + direction + banners.length) % banners.length);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!hasMultipleBanners) {
      return;
    }

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    suppressNextClickRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || !hasMultipleBanners) {
      return;
    }

    const horizontalDelta = event.clientX - start.x;
    const verticalDelta = event.clientY - start.y;
    const absHorizontalDelta = Math.abs(horizontalDelta);
    const absVerticalDelta = Math.abs(verticalDelta);

    if (absHorizontalDelta >= SWIPE_THRESHOLD_PX && absHorizontalDelta > absVerticalDelta) {
      suppressNextClickRef.current = true;
      moveBanner(horizontalDelta < 0 ? 1 : -1);
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 350);
    }

    event.currentTarget.releasePointerCapture?.(start.pointerId);
  }

  function handleClickCapture(event: MouseEvent<HTMLElement>) {
    if (!suppressNextClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = false;
  }

  if (!banner) {
    return isLoading ? (
      <section className="mx-auto max-w-[1440px] px-4 pt-2 sm:px-6 lg:px-10 lg:pt-4">
        <StorefrontSkeleton className="min-h-[270px] rounded-[22px] bg-white/70 lg:min-h-[540px]" />
      </section>
    ) : null;
  }

  return (
    <section
      className="mx-auto max-w-[1440px] px-4 pt-2 sm:px-6 lg:px-10 lg:pt-4"
      aria-roledescription={hasMultipleBanners ? "carousel" : undefined}
      aria-label={hasMultipleBanners ? "Homepage promotions" : undefined}
      onMouseEnter={() => setDesktopPauseState(true)}
      onMouseLeave={() => setDesktopPauseState(false)}
      onFocusCapture={() => setDesktopPauseState(true)}
      onBlurCapture={() => setDesktopPauseState(false)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeStartRef.current = null;
      }}
      onClickCapture={handleClickCapture}
    >
      <div className="relative isolate min-h-[270px] overflow-hidden rounded-[22px] border border-[#FFE4DC] bg-[linear-gradient(104deg,#fff_0%,#fff_42%,#fff1ec_100%)] shadow-[0_18px_50px_rgba(237,53,0,0.07)] sm:rounded-[18px] lg:min-h-[540px] lg:shadow-[0_24px_80px_rgba(237,53,0,0.08)]">
        <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_18%_62%,rgba(237,53,0,0.14)_0,transparent_16%),radial-gradient(circle_at_78%_24%,rgba(237,53,0,0.10)_0,transparent_18%)]" />
        <div className="absolute right-[12%] top-8 hidden h-16 w-24 bg-[radial-gradient(#ED3500_1.2px,transparent_1.2px)] [background-size:10px_10px] opacity-25 lg:block" />

        <div className="relative grid min-h-[270px] grid-cols-[minmax(0,1fr)_108px] gap-2 px-5 py-6 sm:grid-cols-[minmax(0,1fr)_180px] sm:gap-3 sm:px-8 lg:min-h-[540px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6 lg:px-16 lg:py-14">
          <div className="flex max-w-[620px] flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow ? (
                <span className="rounded-full bg-[#FFF0EC] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#ED3500] lg:text-[11px] lg:tracking-[0.14em]">
                  {eyebrow}
                </span>
              ) : null}
              <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#163B5C] shadow-sm lg:inline-flex">
                <LocateFixed className="h-3.5 w-3.5 text-[#ED3500]" aria-hidden="true" />
                {locationText}
              </span>
            </div>

            <h1 className="mt-4 max-w-[12ch] text-[30px] font-black leading-[1.03] tracking-normal text-[#111827] sm:text-5xl lg:mt-5 lg:text-7xl">
              {splitMarketplaceTitle(title)}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-[20ch] text-sm font-semibold leading-6 text-[#596276] sm:text-base sm:leading-7 lg:mt-5 lg:max-w-md">
                {subtitle}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-4 lg:mt-7">
              <HomepageItemLink
                href={ctaHref}
                className="inline-flex h-12 items-center gap-3 rounded-full bg-[#ED3500] px-5 text-sm font-black text-white shadow-[0_18px_36px_rgba(237,53,0,0.28)] transition hover:-translate-y-0.5 hover:bg-[#d52f00]"
              >
                {ctaLabel}
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#ED3500]">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </HomepageItemLink>
              {secondaryCtaLabel && secondaryCtaHref ? (
                <HomepageItemLink
                  href={secondaryCtaHref}
                  className="inline-flex h-12 items-center rounded-full border border-[#FFE0D6] bg-white px-5 text-sm font-black text-[#163B5C] shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500]/40 hover:text-[#ED3500]"
                >
                  {secondaryCtaLabel}
                </HomepageItemLink>
              ) : null}
              <form onSubmit={submitSearch} className="hidden h-12 min-w-[260px] overflow-hidden rounded-full border border-[#FFE0D6] bg-white shadow-sm lg:flex">
                <label htmlFor="home-search" className="sr-only">
                  Search products, stores, or brands
                </label>
                <span className="grid w-11 place-items-center text-[#ED3500]">
                  <Search className="h-4 w-4" aria-hidden="true" />
                </span>
                <input
                  id="home-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search marketplace"
                  className="min-w-0 flex-1 bg-transparent pr-4 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3]"
                />
              </form>
            </div>
          </div>

          <MobileHeroVisual banner={banner} products={products} isLoading={isLoading} />
          <HeroVisual banner={banner} products={products} isLoading={isLoading} />
        </div>

        {hasMultipleBanners ? (
          <>
            <button
              type="button"
              onClick={() => moveBanner(-1)}
              aria-label="Previous homepage banner"
              className="absolute bottom-4 left-5 z-20 grid h-9 w-9 place-items-center rounded-full border border-[#FFE0D6] bg-white/94 text-[#ED3500] shadow-[0_12px_24px_rgba(22,59,92,0.10)] transition hover:-translate-x-0.5 hover:border-[#ED3500] lg:bottom-auto lg:left-6 lg:top-1/2 lg:h-11 lg:w-11 lg:-translate-y-1/2"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveBanner(1)}
              aria-label="Next homepage banner"
              className="absolute bottom-4 right-5 z-20 grid h-9 w-9 place-items-center rounded-full border border-[#FFE0D6] bg-white/94 text-[#ED3500] shadow-[0_12px_24px_rgba(22,59,92,0.10)] transition hover:translate-x-0.5 hover:border-[#ED3500] lg:bottom-auto lg:right-6 lg:top-1/2 lg:h-11 lg:w-11 lg:-translate-y-1/2"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-2 shadow-[0_10px_22px_rgba(22,59,92,0.10)] lg:bottom-7">
              {banners.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectBanner(index)}
                  className={cn(
                    "h-2.5 rounded-full transition",
                    index === normalizedBannerIndex
                      ? "w-6 bg-[#ED3500]"
                      : "w-2.5 bg-[#F2B8A7] hover:bg-[#ED3500]/70",
                  )}
                  aria-label={`Show banner ${index + 1}`}
                  aria-current={index === normalizedBannerIndex ? "true" : undefined}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function MobileHeroVisual({
  banner,
  products,
  isLoading,
}: {
  banner: HomepageBanner | null;
  products: ProductSummary[];
  isLoading: boolean;
}) {
  const bannerImage = banner?.mobileImageUrl || banner?.imageUrl || null;
  const bannerTitle = banner?.title || "Homepage banner";
  const bannerImageAlt = banner?.imageAlt || bannerTitle;
  const fallbackProduct = products.find((product) => primaryImage(product)) ?? products[0] ?? null;
  const fallbackProductImage = fallbackProduct ? primaryImage(fallbackProduct) : null;
  const visualImage = bannerImage || fallbackProductImage;
  const visualAlt = bannerImage ? bannerImageAlt : (fallbackProduct?.name ?? bannerTitle);
  const visualLabel = bannerImage ? bannerTitle : (fallbackProduct?.category.name ?? bannerTitle);

  if (visualImage || !isLoading) {
    const content = (
      <span className="relative block h-full w-full">
        <StorefrontImage
          src={visualImage}
          alt={visualAlt}
          sizes="(max-width: 640px) 108px, 180px"
          fallbackLabel={visualLabel}
          showFallbackLabel={false}
          allowExternalRemote
          className={cn(
            "transition duration-500",
            bannerImage ? "object-cover" : "object-contain p-3"
          )}
        />
      </span>
    );

    return fallbackProduct && !bannerImage ? (
      <Link
        href={`/products/${fallbackProduct.slug}` as Route}
        className="relative my-auto block aspect-[4/5] min-w-0 overflow-hidden rounded-[18px] border border-white/80 bg-white/80 shadow-[0_18px_42px_rgba(22,59,92,0.10)] lg:hidden"
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(237,53,0,0.10),transparent_54%)]" />
        {content}
      </Link>
    ) : (
      <div className="relative my-auto aspect-[4/5] min-w-0 overflow-hidden rounded-[18px] border border-white/80 bg-white/80 shadow-[0_18px_42px_rgba(22,59,92,0.10)] lg:hidden">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(237,53,0,0.10),transparent_54%)]" />
        {content}
      </div>
    );
  }

  return isLoading ? <StorefrontSkeleton className="h-36 rounded-[18px] bg-white/70 lg:hidden" /> : <span className="lg:hidden" />;
}

function HeroVisual({
  banner,
  products,
  isLoading,
}: {
  banner: HomepageBanner | null;
  products: ProductSummary[];
  isLoading: boolean;
}) {
  const bannerImage = banner?.imageUrl || banner?.mobileImageUrl || null;
  const bannerTitle = banner?.title || "Homepage banner";
  const bannerImageAlt = banner?.imageAlt || bannerTitle;
  const visualProducts = products.slice(0, 4);
  const hasProductCards = visualProducts.length > 0;

  return (
    <div className="relative hidden min-h-[420px] items-center justify-center lg:flex">
      <div className="absolute bottom-11 left-1/2 h-16 w-[420px] -translate-x-1/2 rounded-[50%] bg-white shadow-[0_22px_70px_rgba(22,59,92,0.16)]" />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ED3500]" />
      <div className="absolute left-[16%] top-[26%] h-16 w-16 rounded-full bg-[#ED3500]/18 blur-sm" />

      {bannerImage ? (
        <div className="relative z-10 h-[340px] w-[440px] rotate-[-3deg] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(22,59,92,0.16)]">
          <StorefrontImage
            src={bannerImage}
            alt={bannerImageAlt}
            sizes="440px"
            fallbackLabel={bannerTitle}
            showFallbackLabel={false}
            allowExternalRemote
            className="object-cover"
          />
        </div>
      ) : hasProductCards ? (
        visualProducts.map((product, index) => (
          <HeroProductCard
            key={product.id}
            product={product}
            className={heroProductPosition(index)}
          />
        ))
      ) : isLoading ? (
        <StorefrontSkeleton className="relative z-10 h-[320px] w-[420px] bg-white/70" />
      ) : null}
    </div>
  );
}

function HeroProductCard({ product, className }: { product: ProductSummary; className: string }) {
  const market = useMarket();
  const variant = primaryVariant(product);
  const activeDeal = getActiveDeal(product, variant);

  return (
    <Link
      href={`/products/${product.slug}` as Route}
      className={cn(
        "absolute z-10 block w-40 overflow-hidden rounded-[18px] border border-white/80 bg-white p-3 shadow-[0_24px_70px_rgba(22,59,92,0.16)] transition hover:-translate-y-1",
        className,
      )}
    >
      <div className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-white text-[#9AA4B2] shadow-sm">
        <Heart className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#FFF4EF]">
        {activeDeal ? (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[#ED3500] px-2 py-1 text-[9px] font-black uppercase text-white shadow-sm">
            Deal
          </span>
        ) : null}
        <StorefrontImage
          src={primaryImage(product)}
          alt={product.name}
          sizes="160px"
          fallbackLabel={product.category.name}
          allowExternalRemote
        />
      </div>
      <p className="mt-3 line-clamp-1 text-xs font-black text-[#1F2933]">{product.name}</p>
      {variant ? (
        <p className="mt-1 text-[11px] font-black text-[#ED3500]">
          From {market.format(variant.pricePaise)}
        </p>
      ) : null}
    </Link>
  );
}

function StatsStrip({ home, isLoading }: { home: StorefrontHomePayload | undefined; isLoading: boolean }) {
  const stats = home?.stats;
  const items = [
    { label: "Stores", value: stats?.approvedStores, icon: Store },
    { label: "Verified Sellers", value: stats?.verifiedSellerPercent, suffix: "%", icon: ShieldCheck },
    { label: "Categories", value: stats?.activeCategories, icon: ShoppingBag },
  ];

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-4 sm:px-6 lg:px-10 lg:py-6">
      <div className="indihub-scroll-rail grid auto-cols-[minmax(78px,1fr)] grid-flow-col gap-0 overflow-x-auto rounded-[18px] border border-[#F1D7CF] bg-white p-3 shadow-[0_14px_42px_rgba(22,59,92,0.06)] [scrollbar-width:none] sm:grid-cols-2 lg:flex lg:min-h-[112px] lg:flex-wrap lg:items-center lg:justify-center lg:gap-y-3 lg:overflow-visible lg:px-5 lg:py-4 lg:shadow-[0_20px_60px_rgba(22,59,92,0.07)] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "flex min-h-[72px] min-w-[78px] items-center gap-2 border-r border-[#E8EDF2] px-2 py-2 last:border-r-0 lg:min-h-[78px] lg:w-[250px] lg:min-w-[250px] lg:justify-center lg:gap-3 lg:px-5 lg:py-3",
              index < items.length - 1 ? "lg:border-r" : "lg:border-r-0",
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500] lg:h-11 lg:w-11">
              <item.icon className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-black leading-none text-[#ED3500] lg:text-xl">
                {isLoading ? "..." : `${formatCompactCount(item.value ?? 0)}${item.suffix ?? ""}`}
              </span>
              <span className="mt-1 block text-[11px] font-semibold leading-4 text-[#596276] lg:text-xs">{item.label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

type PersonalizedProduct = {
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sellerId?: string | null;
  sellerName: string;
  sellerSlug?: string | null;
  pricePaise: number | null;
  mrpPaise: number | null;
  badge?: string;
  viewedAt?: string | null;
};

function PersonalizedHomeSections({
  home,
  isLoading,
}: {
  home: StorefrontHomePayload | undefined;
  isLoading: boolean;
}) {
  const customerAuth = useCustomerAuth();
  const [recentProducts, setRecentProducts] = useState<RecentProductSnapshot[]>([]);
  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
    staleTime: 30_000,
  });
  const ordersQuery = useQuery({
    queryKey: ["account-orders", customerAuth.authKey, "home-personalized"],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, { limit: 8 }),
    enabled: customerAuth.enabled,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    function refreshRecentProducts() {
      setRecentProducts(readRecentProducts());
    }

    refreshRecentProducts();
    window.addEventListener("focus", refreshRecentProducts);
    window.addEventListener("storage", refreshRecentProducts);
    return () => {
      window.removeEventListener("focus", refreshRecentProducts);
      window.removeEventListener("storage", refreshRecentProducts);
    };
  }, []);

  const cartProducts = useMemo(() => productsFromCart(cartQuery.data), [cartQuery.data]);
  // Recent history is platform-local; storage differs, but both surfaces normalize to the same in-memory shape before filtering.
  const recentlyViewedProducts = useMemo(() => recentProducts.map(productFromRecentSnapshot), [recentProducts]);
  const buyAgainProducts = useMemo(() => productsFromOrders(ordersQuery.data?.items ?? []), [ordersQuery.data?.items]);
  const baseRecommendedProducts = useMemo(
    () =>
      uniquePersonalizedProducts(
        [
          ...(home?.productRails.deals ?? []),
          ...(home?.productRails.featured ?? []),
          ...(home?.productRails.latest ?? []),
        ].map((product) => productFromSummary(product, product.activeDeal ? "Deal" : undefined)),
      ).slice(0, 10),
    [home?.productRails.deals, home?.productRails.featured, home?.productRails.latest],
  );
  const personalizedRails = useMemo(
    () =>
      composePersonalizedHomeRails({
        buyAgainProducts,
        cartProducts,
        recentlyViewedProducts,
        recommendedProducts: baseRecommendedProducts,
      }),
    [baseRecommendedProducts, buyAgainProducts, cartProducts, recentlyViewedProducts],
  );
  const hasAnySection =
    (cartQuery.data?.items.length ?? 0) > 0 ||
    personalizedRails.continueProducts.length > 0 ||
    personalizedRails.recentlyViewedProducts.length > 0 ||
    personalizedRails.buyAgainProducts.length > 0 ||
    personalizedRails.recommendedProducts.length > 0 ||
    isLoading;

  if (!hasAnySection) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10 lg:py-6" aria-label="Personalized shopping">
      <CartReminder cart={cartQuery.data} />
      <div className="grid gap-5">
        <PersonalizedProductRail
          title="Continue shopping"
          description="Pick up items still in your cart."
          href="/cart"
          icon={ShoppingCart}
          products={personalizedRails.continueProducts.slice(0, 8)}
          isLoading={cartQuery.isLoading && customerAuth.enabled}
        />
        <PersonalizedProductRail
          title="Recently viewed"
          description="Products you checked on this device."
          href="/search"
          icon={Clock3}
          products={personalizedRails.recentlyViewedProducts}
          isLoading={false}
        />
        <PersonalizedProductRail
          title="Recommended for you"
          description="Fresh picks from current marketplace rails."
          href="/search"
          icon={Sparkles}
          products={personalizedRails.recommendedProducts}
          isLoading={isLoading}
        />
        <PersonalizedProductRail
          title="Buy again from previous orders"
          description="Open products from your recent orders."
          href="/account/orders"
          icon={RotateCcw}
          products={personalizedRails.buyAgainProducts}
          isLoading={ordersQuery.isLoading && customerAuth.enabled}
        />
      </div>
    </section>
  );
}

function CartReminder({ cart }: { cart: CartSummary | undefined }) {
  const items = cart?.items ?? [];
  if (!items.length) {
    return null;
  }

  const itemCount = items.reduce((total, item) => total + Math.max(0, item.quantity), 0);
  const subtotal = items.reduce((total, item) => total + Math.max(0, item.quantity) * Math.max(0, item.unitPricePaise ?? 0), 0);
  const currency = items[0]?.currency ?? "INR";

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-[20px] border border-[#FFE0D6] bg-white p-4 shadow-[0_18px_46px_rgba(22,59,92,0.07)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-black text-[#1F2933]">Cart reminder</h2>
          <p className="mt-1 text-sm font-bold text-[#667085]">
            {itemCount} item{itemCount === 1 ? "" : "s"} waiting in cart
            {subtotal > 0 ? ` - ${formatMoney(subtotal, currency)}` : ""}.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <HomepageItemLink href="/cart" className="inline-flex h-10 items-center rounded-full border border-[#FFE0D6] bg-white px-4 text-sm font-black text-[#ED3500]">
          View cart
        </HomepageItemLink>
        <HomepageItemLink href="/checkout" className="inline-flex h-10 items-center rounded-full bg-[#ED3500] px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(237,53,0,0.20)]">
          Checkout
        </HomepageItemLink>
      </div>
    </div>
  );
}

function PersonalizedProductRail({
  description,
  href,
  icon: Icon,
  isLoading,
  products,
  title,
}: {
  description: string;
  href: string;
  icon: LucideIcon;
  isLoading: boolean;
  products: PersonalizedProduct[];
  title: string;
}) {
  if (!isLoading && !products.length) {
    return null;
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-[#111827]">{title}</h2>
            <p className="mt-0.5 hidden text-sm font-semibold text-[#667085] sm:block">{description}</p>
          </div>
        </div>
        <HomepageItemLink href={href} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-[#ED3500]">
          View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </HomepageItemLink>
      </div>
      <ScrollRail ariaLabel={title} controls={false}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <StorefrontSkeleton key={index} className="h-[258px] w-[154px] shrink-0 rounded-[20px] bg-white sm:w-[176px]" />
            ))
          : products.map((product) => <PersonalizedProductCard key={`${title}-${product.id}-${product.slug}`} product={product} />)}
      </ScrollRail>
    </div>
  );
}

function PersonalizedProductCard({ product }: { product: PersonalizedProduct }) {
  const market = useMarket();

  return (
    <Link
      href={`/products/${product.slug}` as Route}
      className="group flex h-[258px] w-[154px] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border border-[#E8EDF2] bg-white p-2.5 shadow-[0_10px_24px_rgba(22,59,92,0.05)] transition hover:border-[#ED3500] hover:shadow-[0_18px_38px_rgba(22,59,92,0.09)] sm:w-[176px]"
    >
      <span className="relative h-[118px] shrink-0 overflow-hidden rounded-[16px] border border-[#F7ECE7] bg-[#FFF8F5] sm:h-[126px]">
        {product.badge ? (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[#ED3500] px-2 py-0.5 text-[9px] font-black uppercase text-white">
            {product.badge}
          </span>
        ) : null}
        <StorefrontImage
          src={product.imageUrl}
          alt={product.name}
          sizes="164px"
          fallbackLabel={product.categoryName ?? "Marketplace"}
          allowExternalRemote
          className="object-contain p-3 transition group-hover:scale-105"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col px-1 pb-0.5 pt-3">
        <span className="line-clamp-2 min-h-10 text-[13px] font-black leading-5 text-[#1F2933] sm:text-sm">{product.name}</span>
        <span className="mt-2 line-clamp-1 min-h-4 text-[11px] font-bold text-[#98A2B3]">{product.sellerName}</span>
        <span className="mt-auto flex min-h-6 items-baseline gap-2">
          <span className="truncate text-[15px] font-black text-[#ED3500]">
            {product.pricePaise !== null ? market.format(product.pricePaise) : "View price"}
          </span>
          {product.mrpPaise && product.pricePaise && product.mrpPaise > product.pricePaise ? (
            <span className="truncate text-[11px] font-bold text-[#98A2B3] line-through">{market.format(product.mrpPaise)}</span>
          ) : null}
        </span>
        <span className="mt-1.5 line-clamp-1 min-h-4 text-[11px] font-extrabold text-[#98A2B3]">
          {product.categoryName ?? "Marketplace"}
        </span>
      </span>
    </Link>
  );
}

function productsFromCart(cart: CartSummary | undefined) {
  return uniquePersonalizedProducts(
    (cart?.items ?? [])
      .map((item) =>
        item.productVariant?.product
          ? productFromSummary(item.productVariant.product, "In cart", {
              mrpPaise: item.productVariant.mrpPaise ?? null,
              pricePaise: item.productVariant.pricePaise ?? item.unitPricePaise ?? null,
            })
          : null,
      )
      .filter((item): item is PersonalizedProduct => Boolean(item)),
  );
}

function productsFromOrders(orders: OrderSummary[]) {
  const orderedProducts = orders.flatMap((order, orderIndex) =>
    order.items
      .map((item): { orderIndex: number; orderedAtMs: number; product: PersonalizedProduct } | null => {
        if (!item.product?.slug) {
          return null;
        }

        const product = productFromSummary(item.product, "Ordered", {
          mrpPaise: item.originalUnitPricePaise ?? null,
          pricePaise: item.unitPricePaise,
        });

        return {
          orderIndex,
          orderedAtMs: timestampMs(order.createdAt),
          product: {
            ...product,
            sellerId: item.sellerId ?? item.seller?.id ?? product.sellerId ?? null,
            sellerName: item.seller?.storeName ?? product.sellerName,
            sellerSlug: item.seller?.slug ?? product.sellerSlug ?? null,
          },
        };
      })
      .filter((item): item is { orderIndex: number; orderedAtMs: number; product: PersonalizedProduct } => Boolean(item)),
  );

  orderedProducts.sort((left, right) => right.orderedAtMs - left.orderedAtMs || left.orderIndex - right.orderIndex);

  return orderedProducts.map((item) => item.product).slice(0, 20);
}

function timestampMs(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function productFromSummary(
  product: ProductSummary,
  badge?: string,
  priceOverride: { mrpPaise?: number | null; pricePaise?: number | null } = {},
): PersonalizedProduct {
  const variant = primaryVariant(product);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: primaryImage(product),
    categoryId: product.categoryId ?? product.category?.id ?? null,
    categoryName: product.category?.name ?? "Marketplace",
    categorySlug: product.category?.slug ?? null,
    sellerId: product.sellerId ?? product.seller?.id ?? null,
    sellerName: product.seller?.storeName ?? "1HandIndia seller",
    sellerSlug: product.seller?.slug ?? null,
    pricePaise: priceOverride.pricePaise ?? variant?.pricePaise ?? null,
    mrpPaise: priceOverride.mrpPaise ?? variant?.mrpPaise ?? null,
    ...(badge ? { badge } : {}),
  };
}

function productFromRecentSnapshot(product: RecentProductSnapshot): PersonalizedProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId ?? null,
    categoryName: product.categoryName ?? "Marketplace",
    categorySlug: product.categorySlug ?? null,
    sellerId: product.sellerId ?? null,
    sellerName: product.sellerName ?? "1HandIndia seller",
    sellerSlug: product.sellerSlug ?? null,
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise,
    badge: "Viewed",
    viewedAt: product.viewedAt,
  };
}

function uniquePersonalizedProducts(products: PersonalizedProduct[]) {
  const seen = new Set<string>();
  const unique: PersonalizedProduct[] = [];

  for (const product of products) {
    const key = product.id || product.slug;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(product);
  }

  return unique;
}

function CategoryShowcase({
  categories,
  isLoading,
  title,
  description,
}: {
  categories: CategorySummary[];
  isLoading: boolean;
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10 lg:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-4 hidden items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#ED3500] sm:inline-flex">
            <span className="h-1 w-5 rounded-full bg-[#ED3500]" aria-hidden="true" />
            Categories
          </span>
          <h2 className="text-3xl font-black tracking-normal text-[#111827] sm:text-4xl lg:text-[40px] lg:leading-none">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-base font-semibold text-[#7A8496] sm:text-lg">{description}</p>
          ) : null}
        </div>
        <HomepageItemLink
          href="/categories"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-[#FFE0D6] bg-white px-4 text-sm font-black !text-[#ED3500] shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500]/50 hover:bg-[#FFF7F3] hover:!text-[#c92b00]"
        >
          View all categories <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </HomepageItemLink>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <StorefrontSkeleton key={index} className="h-[132px] rounded-[16px] bg-white" />
            ))
          : categories.slice(0, 4).map((category, index) => (
              <MobileCategoryTile key={category.id} category={category} accent={categoryAccent(index)} />
            ))}
      </div>
      <div className="mt-7 hidden gap-5 sm:grid sm:grid-cols-2 lg:mt-9 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <StorefrontSkeleton key={index} className="h-[348px] rounded-[20px] bg-white" />
            ))
          : categories.slice(0, 8).map((category, index) => (
              <CategoryTile key={category.id} category={category} accent={categoryAccent(index)} />
            ))}
      </div>
      {!isLoading && !categories.length ? (
        <StorefrontEmptyState className="mt-5" message="No active categories are available yet." />
      ) : null}
    </section>
  );
}

function MobileCategoryTile({ category, accent }: { category: CategorySummary; accent: CategoryAccent }) {
  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className="group flex min-h-[132px] min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#E8EDF2] bg-white p-3 text-left shadow-[0_10px_24px_rgba(22,59,92,0.05)] transition active:scale-[0.98]"
    >
      <span
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full",
          accent.imageBg,
        )}
      >
        <StorefrontImage
          src={category.imageUrl?.trim() || null}
          alt={category.name}
          sizes="48px"
          fallbackLabel={category.name}
          showFallbackLabel={false}
          allowExternalRemote
          className="object-contain p-2 transition duration-300 group-active:scale-105"
        />
      </span>
      <span className="mt-3 line-clamp-2 min-h-8 text-[13px] font-black leading-4 text-[#111827]">
        {category.name}
      </span>
      <span className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-2 text-[10px] font-bold text-[#7A8496]">
        <span className="truncate">Explore category</span>
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full",
            accent.buttonBg,
            accent.text,
          )}
          aria-hidden="true"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </Link>
  );
}

type CategoryAccent = {
  imageBg: string;
  text: string;
  buttonBg: string;
  glow: string;
};

const CATEGORY_ACCENTS: CategoryAccent[] = [
  {
    imageBg: "bg-[radial-gradient(circle_at_50%_42%,#FFEFF5_0%,#FFE8EF_50%,#FFF7F9_100%)]",
    text: "text-[#F43F7D]",
    buttonBg: "bg-[#FFF0F4]",
    glow: "shadow-[0_18px_44px_rgba(244,63,125,0.14)]",
  },
  {
    imageBg: "bg-[radial-gradient(circle_at_50%_42%,#F3ECFF_0%,#EEE4FF_52%,#FBF8FF_100%)]",
    text: "text-[#7C3AED]",
    buttonBg: "bg-[#F4EDFF]",
    glow: "shadow-[0_18px_44px_rgba(124,58,237,0.13)]",
  },
  {
    imageBg: "bg-[radial-gradient(circle_at_50%_42%,#ECFCEB_0%,#E1F8DF_52%,#F7FFF6_100%)]",
    text: "text-[#2FAE3D]",
    buttonBg: "bg-[#EEF9EE]",
    glow: "shadow-[0_18px_44px_rgba(47,174,61,0.12)]",
  },
  {
    imageBg: "bg-[radial-gradient(circle_at_50%_42%,#ECF5FF_0%,#E4F0FF_52%,#F7FBFF_100%)]",
    text: "text-[#2F80ED]",
    buttonBg: "bg-[#EEF6FF]",
    glow: "shadow-[0_18px_44px_rgba(47,128,237,0.12)]",
  },
];

const DEFAULT_CATEGORY_ACCENT: CategoryAccent = {
  imageBg: "bg-[radial-gradient(circle_at_50%_42%,#FFEFF5_0%,#FFE8EF_50%,#FFF7F9_100%)]",
  text: "text-[#F43F7D]",
  buttonBg: "bg-[#FFF0F4]",
  glow: "shadow-[0_18px_44px_rgba(244,63,125,0.14)]",
};

function categoryAccent(index: number) {
  return CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length] ?? DEFAULT_CATEGORY_ACCENT;
}

function CategoryTile({ category, accent }: { category: CategorySummary; accent: CategoryAccent }) {
  const productCount = category._count?.products ?? 0;
  const childCount = category.children?.length ?? 0;
  const detail = productCount
    ? `${productCount.toLocaleString("en-IN")} products`
    : childCount
      ? `${childCount.toLocaleString("en-IN")} sections`
      : "Curated picks";
  const summary =
    category.description?.trim() ||
    (productCount
      ? ""
      : "Explore curated picks and popular marketplace collections.");

  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className="group relative flex min-h-[348px] min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#E8EDF2] bg-white p-6 text-left shadow-[0_12px_28px_rgba(22,59,92,0.05)] outline outline-1 outline-transparent transition hover:-translate-y-1 hover:border-[#FFD8CC] hover:shadow-[0_22px_52px_rgba(22,59,92,0.10)] focus-visible:outline-[#ED3500]"
    >
      <span className="flex items-start justify-between gap-4">
        <span
          className={cn(
            "relative grid h-[112px] w-[112px] shrink-0 place-items-center overflow-hidden rounded-full",
            accent.imageBg,
          )}
        >
          <StorefrontImage
            src={category.imageUrl?.trim() || null}
            alt={category.name}
            sizes="112px"
            fallbackLabel={category.name}
            showFallbackLabel={false}
            allowExternalRemote
            className="object-contain p-5 transition duration-500 group-hover:scale-110"
          />
        </span>
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full transition group-hover:translate-x-0.5 group-hover:scale-105",
            accent.buttonBg,
            accent.text,
          )}
          aria-hidden="true"
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </span>

      <span className="mt-5 min-w-0">
        <span className="line-clamp-2 text-xl font-black leading-6 text-[#111827] lg:text-[22px]">
          {category.name}
        </span>
        <span className="mt-2 flex items-center gap-2 text-sm font-bold text-[#7A8496]">
          <ShoppingBag className={cn("h-4 w-4", accent.text)} aria-hidden="true" />
          {detail}
        </span>
        <span className="mt-4 line-clamp-2 min-h-11 text-sm font-semibold leading-6 text-[#667085]">
          {summary}
        </span>
      </span>

      <span
        className={cn(
          "mt-auto flex h-12 items-center justify-center gap-2 rounded-[12px] border border-[#FFE0D6] text-sm font-black transition group-hover:border-current",
          accent.buttonBg,
          accent.text,
        )}
      >
        Explore category
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

function StoresNearYou({
  stores,
  isLoading,
  locationLabel,
}: {
  stores: StoreProfile[];
  isLoading: boolean;
  locationLabel: string;
}) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
      <MobileSectionHeader title="Stores Near You" href="/stores" accent={false} />
      <div className="hidden lg:block">
        <SectionTitle title="Stores Near You" description={locationLabel} href="/stores" action="View all stores" />
      </div>
      <div className="relative mt-2 lg:mt-5">
        <span className="pointer-events-none absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500] shadow-[0_10px_24px_rgba(22,59,92,0.10)] lg:grid">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500] shadow-[0_10px_24px_rgba(22,59,92,0.10)] lg:grid">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <StorefrontSkeleton key={index} className="h-[250px] rounded-[18px] bg-white" />
          ))
        ) : stores.length ? (
          stores.slice(0, 2).map((store) => <WideStoreCard key={store.id} store={store} />)
        ) : (
          <StorefrontEmptyState className="lg:col-span-2" message="No approved stores are available for this view yet." />
        )}
        </div>
      </div>
    </section>
  );
}

function WideStoreCard({ store }: { store: StoreProfile }) {
  const productCount = store._count?.products ?? 0;
  const address = store.addresses?.[0];
  const chips = [
    store.sellerType ? humanize(store.sellerType) : null,
    productCount ? `${productCount.toLocaleString("en-IN")} products` : null,
    store.locationMatchLevel && store.locationMatchLevel !== "NONE"
      ? humanize(store.locationMatchLevel)
      : null,
  ].filter((chip): chip is string => Boolean(chip));

  return (
    <Link
      href={`/stores/${store.slug}` as Route}
      className="group grid min-h-[116px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-[18px] border border-[#E8EDF2] bg-white shadow-[0_10px_24px_rgba(22,59,92,0.05)] transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-[0_22px_60px_rgba(22,59,92,0.10)] lg:min-h-[250px] lg:grid-cols-[0.98fr_1.08fr]"
    >
      <span className="relative min-h-[116px] bg-[#163B5C] lg:min-h-[214px]">
        <StorefrontImage
          src={store.profile?.bannerUrl ?? store.profile?.logoUrl ?? null}
          alt={`${store.storeName} storefront`}
          sizes="(max-width: 1024px) 100vw, 420px"
          fallbackLabel={store.storeName}
          allowExternalRemote
          className="transition duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(22,59,92,0.02)_0%,rgba(255,255,255,0.04)_48%,rgba(255,255,255,0.92)_100%)]" />
      </span>
      <span className="relative flex min-w-0 flex-col justify-center p-3 lg:p-7">
        <span className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-black text-[#0FAD63] lg:absolute lg:right-5 lg:top-5 lg:mb-0 lg:text-xs">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Verified Seller
        </span>
        <span className="block truncate text-base font-black leading-tight text-[#1F2933] lg:pr-24 lg:text-xl">{store.storeName}</span>
        <span className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#7A8496]">
          <Sparkles className="h-3.5 w-3.5 text-[#F59E0B]" aria-hidden="true" />
          {productCount.toLocaleString("en-IN")} live {productCount === 1 ? "product" : "products"}
        </span>
        <span className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#98A2B3] lg:mt-3">
          <MapPin className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
          {address
            ? [address.area, address.city, address.state]
                .filter(Boolean)
                .join("  /  ")
            : "Marketplace store"}
        </span>
        <span className="mt-5 hidden flex-wrap gap-2 lg:flex">
          {chips.slice(0, 3).map((chip) => (
            <span key={chip} className="rounded-full bg-[#F5F7FA] px-3 py-1.5 text-[11px] font-black text-[#596276]">
              {chip}
            </span>
          ))}
        </span>
        <span className="mt-5 hidden h-10 w-fit items-center gap-2 self-end rounded-full bg-[#ED3500] px-5 text-sm font-black text-white shadow-[0_10px_18px_rgba(237,53,0,0.22)] lg:inline-flex">
          Visit Store <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

function ProductRailSection({
  title,
  description,
  href,
  products,
  isLoading,
  promoProduct,
  promoTone,
}: {
  title: string;
  description: string;
  href: string;
  products: ProductSummary[];
  isLoading: boolean;
  promoProduct: ProductSummary | undefined;
  promoTone: "orange" | "soft";
}) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
      <MobileSectionHeader title={title} href={href} />
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <PromoPanel product={promoProduct} tone={promoTone} title={title} description={description} />
        </div>
        <div className="min-w-0">
          <ScrollRail ariaLabel={title} controls={false}>
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <StorefrontSkeleton key={index} className="h-[268px] w-[154px] shrink-0 rounded-[16px] bg-white sm:h-[292px] sm:w-[170px] lg:h-[368px] lg:w-[188px]" />
                ))
              : products.map((product) => (
                  <CompactProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
          </ScrollRail>
          {!isLoading && !products.length ? (
            <StorefrontEmptyState className="mt-5" message="No approved products are available for this rail yet." />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MobileSectionHeader({ title, href, accent = true }: { title: string; href: string; accent?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
      <h2 className="flex min-w-0 items-center gap-2 text-2xl font-black tracking-normal text-[#111827]">
        {accent ? <Zap className="h-6 w-6 shrink-0 fill-[#ED3500] text-[#ED3500]" aria-hidden="true" /> : null}
        <span className="truncate">{title}</span>
      </h2>
      <HomepageItemLink href={href} className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-[#ED3500]">
        View all <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </HomepageItemLink>
    </div>
  );
}

function SellerCta({
  section,
  config,
}: {
  section: HomepageSection | null;
  config: HomepageSection["config"] | null;
}) {
  const title = section?.title || "Become a Seller";
  const description =
    stringValue(config?.subtitle) ||
    stringValue(config?.description) ||
    "Start selling with a verified marketplace storefront.";
  const ctaLabel = stringValue(config?.ctaLabel) || "Start Selling Now";
  const ctaUrl = stringValue(config?.ctaUrl) || stringValue(config?.ctaHref) || "/seller/register";
  const items = normalizeHomepageItems(config?.items);

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10">
      <div className="relative overflow-hidden rounded-[18px] border border-[#FFE0D6] bg-[linear-gradient(102deg,#fff_0%,#fff4ef_100%)] p-6 shadow-sm lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_260px] lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-[#1F2933] sm:text-3xl">{title}</h2>
              <span className="rounded-full bg-[#ED3500] px-2.5 py-1 text-[11px] font-black text-white">
                It's Free
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-[#596276]">{description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(items.length ? items : defaultSellerCtaItems()).map((item, index) => {
              const Icon = [PackageCheck, UsersRound, ShieldCheck][index] ?? Sparkles;
              return (
                <div key={`${item.label}-${index}`} className="rounded-[14px] bg-white/88 p-4 shadow-sm">
                  <Icon className="h-5 w-5 text-[#ED3500]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black text-[#1F2933]">{item.label}</p>
                  {item.description ? (
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#7A8496]">{item.description}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-center">
            <div className="hidden h-28 w-32 rounded-t-[48px] border-[10px] border-[#FFBE9E] border-b-[#ED3500] bg-white shadow-[0_18px_44px_rgba(237,53,0,0.12)] lg:block" />
            <HomepageItemLink
              href={ctaUrl}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#ED3500] px-5 text-sm font-black text-white shadow-[0_18px_36px_rgba(237,53,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d52f00]"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </HomepageItemLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServiceBadges({ items }: { items: NormalizedHomepageItem[] }) {
  const icons = [Zap, ShieldCheck, Truck, UserRound, BadgeCheck, ShoppingBag];

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-4 sm:px-6 lg:px-10">
      <div className="grid gap-3 border-y border-[#F1D7CF] py-4 sm:grid-cols-2 lg:grid-cols-6">
        {items.slice(0, 6).map((item, index) => {
          const Icon = icons[index] ?? Sparkles;
          return (
            <div key={`${item.label}-${index}`} className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs font-black text-[#1F2933]">{item.label}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-[11px] font-semibold text-[#7A8496]">{item.description}</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CustomHomepageSections({ sections }: { sections: HomepageSection[] }) {
  if (!sections.length) {
    return null;
  }

  return (
    <>
      {sections.map((section) => (
        <CustomHomepageSection key={section.id} section={section} />
      ))}
    </>
  );
}

function CustomHomepageSection({ section }: { section: HomepageSection }) {
  const config = section.config ?? {};
  const items = normalizeHomepageItems(config.items);
  const eyebrow = stringValue(config.eyebrow) || humanize(section.sectionType);
  const description =
    stringValue(config.subtitle) ||
    stringValue(config.description);
  const ctaLabel = stringValue(config.ctaLabel);
  const ctaUrl = stringValue(config.ctaUrl) || stringValue(config.ctaHref);

  if (!items.length && !description && (!ctaLabel || !ctaUrl)) {
    return null;
  }

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
      <div className="overflow-hidden rounded-[18px] border border-[#FFE0D6] bg-white p-5 shadow-[0_12px_32px_rgba(22,59,92,0.05)] lg:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? (
              <span className="mb-2 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#ED3500]">
                <span className="h-1 w-5 rounded-full bg-[#ED3500]" aria-hidden="true" />
                {eyebrow}
              </span>
            ) : null}
            <h2 className="text-2xl font-black tracking-normal text-[#111827] sm:text-3xl">
              {section.title}
            </h2>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
                {description}
              </p>
            ) : null}
          </div>
          {ctaLabel && ctaUrl ? (
            <HomepageItemLink
              href={ctaUrl}
              className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-[#FFE0D6] bg-[#FFF7F3] px-4 text-sm font-black !text-[#ED3500] transition hover:-translate-y-0.5 hover:border-[#ED3500]/50 hover:!text-[#c92b00]"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </HomepageItemLink>
          ) : null}
        </div>

        {items.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => (
              <CustomHomepageItemCard
                key={`${section.id}-${item.label}-${index}`}
                item={item}
                accent={categoryAccent(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CustomHomepageItemCard({
  item,
  accent,
}: {
  item: NormalizedHomepageItem;
  accent: CategoryAccent;
}) {
  return (
    <HomepageItemLink
      href={item.linkUrl}
      className="group flex min-h-[156px] min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#E8EDF2] bg-[#FFFCFB] p-4 text-left shadow-[0_10px_24px_rgba(22,59,92,0.04)] transition hover:-translate-y-0.5 hover:border-[#FFD8CC] hover:shadow-[0_18px_38px_rgba(22,59,92,0.08)]"
    >
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[14px]",
            accent.imageBg,
          )}
        >
          {item.imageUrl ? (
            <StorefrontImage
              src={item.imageUrl}
              alt={item.label}
              sizes="56px"
              fallbackLabel={item.label}
              showFallbackLabel={false}
              allowExternalRemote
              className="object-contain p-2 transition duration-300 group-hover:scale-105"
            />
          ) : (
            <Sparkles className={cn("h-6 w-6", accent.text)} aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          {item.badge ? (
            <span className="mb-1 inline-flex max-w-full rounded-full bg-[#FFF0EC] px-2 py-0.5 text-[10px] font-black uppercase text-[#ED3500]">
              <span className="truncate">{item.badge}</span>
            </span>
          ) : null}
          <span className="line-clamp-2 text-base font-black leading-5 text-[#111827]">
            {item.label}
          </span>
        </span>
      </span>
      {item.description ? (
        <span className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[#667085]">
          {item.description}
        </span>
      ) : null}
      <span className={cn("mt-auto flex items-center gap-2 pt-4 text-xs font-black", accent.text)}>
        Explore <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </HomepageItemLink>
  );
}

function PromoPanel({
  product,
  tone,
  title,
  description,
}: {
  product: ProductSummary | undefined;
  tone: "orange" | "soft";
  title: string;
  description: string;
}) {
  const market = useMarket();
  const variant = product ? primaryVariant(product) : null;

  return (
    <div
      className={cn(
        "relative isolate min-h-[368px] overflow-hidden rounded-[16px] p-6 shadow-[0_14px_30px_rgba(237,53,0,0.12)]",
        tone === "orange"
          ? "bg-[radial-gradient(circle_at_78%_14%,rgba(255,255,255,0.22),transparent_22%),linear-gradient(145deg,#FF4318_0%,#ED3500_62%,#D72F00_100%)] text-white"
          : "border border-[#FFE0D6] bg-[#FFF4EF] text-[#1F2933]",
      )}
    >
      <span className="absolute right-7 top-7 grid grid-cols-3 gap-1 opacity-30">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className="h-1 w-1 rounded-full bg-white" />
        ))}
      </span>
      <span className="absolute bottom-5 right-20 h-11 w-11 rotate-45 border border-white/24" />
      <div className="relative z-10">
        <h2 className={cn("text-xl font-black leading-none", tone === "orange" ? "text-white" : "text-[#ED3500]")}>
          {title}
        </h2>
        <p className={cn("mt-3 max-w-[20ch] text-sm font-bold leading-6", tone === "orange" ? "text-white/88" : "text-[#596276]")}>
          {description || (product ? product.name : "Hot products from approved sellers")}
        </p>
        <HomepageItemLink
          href={product ? `/products/${product.slug}` : "/search"}
          className={cn(
            "relative z-40 mt-8 inline-flex h-10 min-w-[142px] items-center justify-center gap-2 rounded-full px-5 text-xs font-black shadow-[0_10px_24px_rgba(16,24,40,0.10)] transition hover:-translate-y-0.5",
            tone === "orange" ? "bg-white !text-[#C4320A]" : "bg-[#ED3500] !text-white",
          )}
        >
          <span className="relative z-10">Explore Now</span>
          <ArrowRight className="relative z-10 h-3.5 w-3.5" aria-hidden="true" />
        </HomepageItemLink>
      </div>
      {product ? (
        <span className="pointer-events-none absolute -bottom-1 right-2 z-0 h-36 w-36 opacity-95">
          <StorefrontImage
            src={primaryImage(product)}
            alt={product.name}
            sizes="180px"
            fallbackLabel={product.category.name}
            allowExternalRemote
            className="object-contain"
          />
        </span>
      ) : null}
      {variant ? (
        <span className="sr-only">From {market.format(variant.pricePaise)}</span>
      ) : null}
    </div>
  );
}

function CompactProductCard({
  product,
}: {
  product: ProductSummary;
}) {
  const market = useMarket();
  const wishlist = useStorefrontWishlist();
  const variant = primaryVariant(product);
  const activeDeal = getActiveDeal(product, variant);
  const dealOriginalPrice = getDealOriginalPrice(variant);
  const mrp = dealOriginalPrice ?? (variant?.mrpPaise && variant.mrpPaise > variant.pricePaise ? variant.mrpPaise : null);
  const discount = mrp && variant ? Math.round(((mrp - variant.pricePaise) / mrp) * 100) : null;
  const stockStatus = getStorefrontStockStatus(variant?.stockQuantity);
  const campaignBadge = activeDeal ? `${activeDeal.discountBps / 100}% DEAL` : product.campaignBadge?.trim();
  const isWishlisted = wishlist.hasWishlistProduct(product.id);
  const isWishlistPending = wishlist.isPendingProductId === product.id;

  async function handleWishlistClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await wishlist.toggleWishlist(product.id);
    } catch {
      // Compact homepage cards keep wishlist feedback visual only.
    }
  }

  return (
    <article
      className={cn(
        "group flex h-[268px] w-[154px] snap-start shrink-0 flex-col overflow-hidden rounded-[16px] border bg-white shadow-[0_10px_24px_rgba(22,59,92,0.05)] transition hover:border-[#ED3500] hover:shadow-[0_18px_38px_rgba(22,59,92,0.09)] sm:h-[292px] sm:w-[170px] lg:h-[368px] lg:w-[188px]",
        stockStatus.tone === "danger" ? "border-[#FFD1C4]" : "border-[#E8EDF2]",
      )}
    >
      <div className="relative h-[124px] shrink-0 overflow-hidden bg-[#FFF8F5] sm:h-[142px] lg:h-[168px]">
        <Link href={`/products/${product.slug}` as Route} className="absolute inset-0 block">
          {campaignBadge ? (
            <span className="absolute left-3 top-3 z-10 hidden max-w-[120px] truncate rounded-full bg-[#ED3500] px-2.5 py-1 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(237,53,0,0.20)] lg:block">
              {campaignBadge}
            </span>
          ) : null}
          <StorefrontImage
            src={primaryImage(product)}
            alt={product.name}
            sizes="(max-width: 640px) 154px, (max-width: 1024px) 170px, 188px"
            fallbackLabel={product.category.name}
            allowExternalRemote
            className="object-contain p-4 transition duration-500 group-hover:scale-105 lg:p-5"
          />
        </Link>
        <button
          type="button"
          onClick={(event) => void handleWishlistClick(event)}
          disabled={isWishlistPending}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className={cn(
            "absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-[#ED3500] shadow-[0_8px_18px_rgba(22,59,92,0.10)] transition lg:right-3 lg:top-3",
            isWishlisted && "bg-[#FFF0EC]",
            isWishlistPending && "cursor-wait opacity-70",
          )}
        >
          <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} aria-hidden="true" strokeWidth={2} />
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-3 pb-4 pt-3 text-left lg:px-4 lg:pb-6">
        <Link href={`/products/${product.slug}` as Route} className="line-clamp-2 min-h-9 text-sm font-black leading-[18px] text-[#1F2933] lg:min-h-10 lg:leading-5">
          {product.name}
        </Link>
        <p className="mt-1 line-clamp-1 text-[11px] font-bold text-[#98A2B3]">{product.seller.storeName}</p>
        <div className="mt-2 flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-black text-[#1F2933] lg:text-base">
            {variant ? market.format(variant.pricePaise) : "Price pending"}
          </span>
          {mrp ? <span className="hidden truncate text-xs font-semibold text-[#98A2B3] line-through lg:inline">{market.format(mrp)}</span> : null}
        </div>
        {discount ? (
          <span className="mt-1 w-fit rounded bg-[#FFF0EC] px-2 py-0.5 text-[10px] font-black text-[#ED3500]">
            {activeDeal ? `${discount}% DEAL` : `${discount}% OFF`}
          </span>
        ) : null}
        <span
          className={cn(
            "mt-auto hidden w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black sm:inline-flex",
            storefrontStockBadgeClass(stockStatus.tone),
          )}
        >
          <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {stockStatus.label}
        </span>
      </div>
    </article>
  );
}

function SectionTitle({
  title,
  description,
  href,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  href?: string;
  action?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className={cn("font-black tracking-normal text-[#111827]", compact ? "text-xl" : "text-2xl")}>{title}</h2>
        {description ? <p className="mt-1 text-sm font-semibold text-[#7A8496]">{description}</p> : null}
      </div>
      {href && action ? (
        <HomepageItemLink href={href} className="inline-flex w-fit items-center gap-2 text-xs font-black text-[#ED3500] transition hover:text-[#c92b00]">
          {action} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </HomepageItemLink>
      ) : null}
    </div>
  );
}

function ScrollRail({
  children,
  className,
  ariaLabel,
  controls = true,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel: string;
  controls?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        aria-label={ariaLabel}
        className="indihub-scroll-rail -mx-1 flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-6 bg-[linear-gradient(90deg,#FFFCFB,rgba(255,252,251,0))] sm:block" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-[linear-gradient(270deg,#FFFCFB,rgba(255,252,251,0))] sm:block" />
      {controls ? <div className="mt-2 hidden justify-end gap-2 sm:flex">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500]">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500]">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div> : null}
    </div>
  );
}

function HomepageItemLink({
  href,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  className: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  if (!href || href === "#") {
    return <span className={className} aria-label={ariaLabel}>{children}</span>;
  }

  if (href.startsWith("/")) {
    return (
      <Link href={href as Route} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} target="_blank" rel="noreferrer" aria-label={ariaLabel}>
      {children}
    </a>
  );
}

type NormalizedHomepageItem = {
  label: string;
  description: string;
  imageUrl: string | null;
  linkUrl: string;
  badge: string;
};

function normalizeHomepageItems(items: HomepageSectionItem[] | undefined): NormalizedHomepageItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const label = stringValue(item.label) || stringValue(item.title) || stringValue(item.name);
      if (!label) {
        return null;
      }

      return {
        label,
        description: stringValue(item.description) || stringValue(item.subtitle),
        imageUrl: stringValue(item.imageUrl) || stringValue(item.image) || null,
        linkUrl: stringValue(item.linkUrl) || stringValue(item.href) || stringValue(item.url) || "#",
        badge: stringValue(item.badge),
      };
    })
    .filter((item): item is NormalizedHomepageItem => Boolean(item));
}

function findSection(sections: HomepageSection[] | undefined, type: string) {
  return sections?.find((section) => section.sectionType === type) ?? null;
}

const INLINE_HOMEPAGE_SECTION_TYPES = new Set([
  "featured_categories",
  "featured_products",
  "deal_strip",
  "seller_cta",
  "service_badges",
  "trust_highlights",
]);

function standaloneHomepageSections(sections: HomepageSection[] | undefined) {
  return sections?.filter((section) => !INLINE_HOMEPAGE_SECTION_TYPES.has(section.sectionType)) ?? [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getActiveDeal(product: ProductSummary, variant: ReturnType<typeof primaryVariant>) {
  return variant?.activeDeal ?? product.activeDeal ?? null;
}

function getDealOriginalPrice(variant: ReturnType<typeof primaryVariant>) {
  if (!variant?.activeDeal || !variant.originalPricePaise || variant.originalPricePaise <= variant.pricePaise) {
    return null;
  }

  return variant.originalPricePaise;
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatCompactCount(value: number) {
  if (value >= 1000000) {
    return `${Math.floor(value / 100000) / 10}M+`;
  }
  if (value >= 1000) {
    return `${Math.floor(value / 100) / 10}K+`;
  }
  return value.toLocaleString("en-IN");
}

function statsSentence(stats: StorefrontHomePayload["stats"] | undefined) {
  if (!stats || (!stats.liveProducts && !stats.approvedStores)) {
    return "";
  }

  return `Browse ${stats.liveProducts.toLocaleString("en-IN")} live products from ${stats.approvedStores.toLocaleString("en-IN")} approved stores.`;
}

function splitMarketplaceTitle(title: string) {
  const marketplaceIndex = title.toLowerCase().indexOf("marketplace");
  if (marketplaceIndex === -1) {
    return title;
  }

  return (
    <>
      {title.slice(0, marketplaceIndex)}
      <span className="text-[#ED3500]">{title.slice(marketplaceIndex)}</span>
    </>
  );
}

function heroProductPosition(index: number) {
  const positions = [
    "left-[18%] top-[7%] rotate-[-9deg]",
    "right-[10%] top-[13%] rotate-[8deg]",
    "left-[7%] bottom-[18%] rotate-[-7deg]",
    "right-[1%] bottom-[25%] rotate-[10deg]",
  ];

  return positions[index] ?? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";
}

type StorefrontProductRailDefinition = {
  description: string;
  href: string;
  id: string;
  products: ProductSummary[];
  promoTone: "orange" | "soft";
  title: string;
};

function buildStorefrontProductRails(home: StorefrontHomePayload | undefined): StorefrontProductRailDefinition[] {
  if (!home) {
    return [
      {
        id: "todays-deals",
        title: "Today's Deals",
        description: "Live offers and limited-time marketplace prices.",
        href: "/deals",
        products: [],
        promoTone: "orange",
      },
      {
        id: "best-sellers",
        title: "Best Sellers",
        description: "Top featured picks from verified sellers.",
        href: "/search?sort=rating",
        products: [],
        promoTone: "soft",
      },
      {
        id: "new-arrivals",
        title: "New Arrivals",
        description: "Freshly approved products added to the marketplace.",
        href: "/search?sort=newest",
        products: [],
        promoTone: "soft",
      },
      {
        id: "nearby-products",
        title: "Nearby Products",
        description: "Products from stores matched to your selected location.",
        href: "/stores",
        products: [],
        promoTone: "soft",
      },
    ];
  }

  const allProducts = uniqueProducts([
    ...home.productRails.deals,
    ...home.productRails.featured,
    ...home.productRails.latest,
  ]);
  const todayDeals = uniqueProducts(home.productRails.deals).slice(0, 10);
  const bestSellers = distinctRailProducts(
    uniqueProducts(home.productRails.featured),
    todayDeals,
  ).slice(0, 10);
  const newArrivals = distinctRailProducts(
    uniqueProducts(home.productRails.latest),
    [...todayDeals, ...bestSellers],
  ).slice(0, 10);
  const nearbyProducts = distinctRailProducts(
    productsFromNearbyStores(allProducts, home.storesNearYou),
    [...todayDeals, ...bestSellers, ...newArrivals],
  ).slice(0, 10);

  return [
    {
      id: "todays-deals",
      title: "Today's Deals",
      description: "Live offers and limited-time marketplace prices.",
      href: "/deals",
      products: todayDeals,
      promoTone: "orange",
    },
    {
      id: "best-sellers",
      title: "Best Sellers",
      description: "Top featured picks from verified sellers.",
      href: "/search?sort=rating",
      products: bestSellers.length ? bestSellers : uniqueProducts(home.productRails.featured).slice(0, 10),
      promoTone: "soft",
    },
    {
      id: "new-arrivals",
      title: "New Arrivals",
      description: "Freshly approved products added to the marketplace.",
      href: "/search?sort=newest",
      products: newArrivals.length ? newArrivals : uniqueProducts(home.productRails.latest).slice(0, 10),
      promoTone: "soft",
    },
    {
      id: "nearby-products",
      title: "Nearby Products",
      description: "Products from stores matched to your selected location.",
      href: "/stores",
      products: nearbyProducts.length ? nearbyProducts : productsFromNearbyStores(allProducts, home.storesNearYou).slice(0, 10),
      promoTone: "soft",
    },
  ];
}

function distinctRailProducts(products: ProductSummary[], usedProducts: ProductSummary[]) {
  const used = new Set(usedProducts.map((product) => product.id));
  return products.filter((product) => !used.has(product.id));
}

function productsFromNearbyStores(products: ProductSummary[], stores: StoreProfile[]) {
  const nearbySellerIds = new Set(stores.map((store) => store.id));
  if (!nearbySellerIds.size) {
    return [];
  }

  return uniqueProducts(
    products.filter((product) => nearbySellerIds.has(product.sellerId) || nearbySellerIds.has(product.seller?.id)),
  );
}

function uniqueProducts(products: ProductSummary[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

function defaultSellerCtaItems(): NormalizedHomepageItem[] {
  return [
    {
      label: "Easy Registration",
      description: "Create your seller account and submit store details.",
      imageUrl: null,
      linkUrl: "/seller/register",
      badge: "",
    },
    {
      label: "Reach Customers",
      description: "Publish approved products to live marketplace rails.",
      imageUrl: null,
      linkUrl: "/seller/register",
      badge: "",
    },
    {
      label: "Secure & Trusted",
      description: "Operate with approval, orders, payments, and support flows.",
      imageUrl: null,
      linkUrl: "/seller/register",
      badge: "",
    },
  ];
}
