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
import { useTranslations } from "next-intl";
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
      customerAuth.authKey,
      storefrontLocation.activeLocation?.countryCode ?? "",
      storefrontLocation.activeLocation?.stateCode ?? "",
      storefrontLocation.activeLocation?.cityCode ?? "",
      storefrontLocation.activeLocation?.localAreaCode ?? "",
      storefrontLocation.activeLocation?.pincode ?? "",
      storefrontLocation.activeLocation?.latitude ?? "",
      storefrontLocation.activeLocation?.longitude ?? "",
      storefrontLocation.activeLocation?.accuracyMeters ?? "",
    ],
    queryFn: () =>
      getStorefrontHome(
        browsingLocationQuery(storefrontLocation.activeLocation, 6),
        customerAuth.enabled ? customerAuth.authHeaders : undefined,
      ),
    initialData: useInitialHome ? initialHome : undefined,
    retry: false,
  });

  const home = homeQuery.data;
  const heroProducts = home?.productRails.featured.length
    ? home.productRails.featured
    : home?.productRails.latest ?? [];
  const productRailSections = useMemo(() => buildStorefrontProductRails(home), [home]);
  const todaysDealsRail = productRailSections.find((rail) => rail.id === "todays-deals");
  const bestSellersRail = productRailSections.find((rail) => rail.id === "best-sellers");
  const newArrivalsRail = productRailSections.find((rail) => rail.id === "new-arrivals");
  const nearbyProductsRail = productRailSections.find((rail) => rail.id === "nearby-products");
  const topCategories = home?.categories ?? [];
  const liveCategorySection = findSection(home?.homepageSections, "featured_categories");
  const categorySectionTitle = liveCategorySection?.title || "Shop by Category";
  const categorySectionDescription =
    stringValue(liveCategorySection?.config?.subtitle) ||
    stringValue(liveCategorySection?.config?.description) ||
    "Explore our top categories and find what you need";
  const storesLocationLabel =
    homeStoreRankingSubtitle(
      home?.storeRankingMode,
      storefrontLocation.source === "global"
        ? undefined
        : browsingLocationHeadline(storefrontLocation.activeLocation),
    );
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

        {homeQuery.isError ? (
          <section className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-10">
            <StorefrontErrorPanel error={homeQuery.error} onRetry={() => void homeQuery.refetch()} />
          </section>
        ) : null}

        <div className="flex flex-col">
          <CategoryShowcase
            categories={topCategories}
            isLoading={homeQuery.isLoading}
            title={categorySectionTitle}
            description={categorySectionDescription}
          />

          <HomeProductRail rail={todaysDealsRail} isLoading={homeQuery.isLoading} />

          <PersonalizedHomeSections
            home={home}
            isLoading={homeQuery.isLoading}
            surface="recommended"
            slots={["recommended"]}
          />

          <HomeProductRail rail={bestSellersRail} isLoading={homeQuery.isLoading} />

          <PersonalizedHomeSections
            home={home}
            isLoading={homeQuery.isLoading}
            surface="retention"
            slots={["buyAgain", "cartReminder", "continueShopping", "recentlyViewed"]}
          />

          <HomeProductRail rail={newArrivalsRail} isLoading={homeQuery.isLoading} />

          <HomeProductRail rail={nearbyProductsRail} isLoading={homeQuery.isLoading} />

          <div>
            <StoresNearYou
              stores={home?.storesNearYou ?? []}
              isLoading={homeQuery.isLoading}
              locationLabel={storesLocationLabel}
            />
          </div>

          <SellerCta section={home?.sellerCta ?? null} config={sellerCtaConfig} />

          <CustomerQuickActions variant="desktop" />

          <CustomHomepageSections sections={customSections} />
        </div>

        <StatsStrip home={home} isLoading={homeQuery.isLoading} />

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
  const title = banner?.title?.trim() || "1HandIndia Marketplace";
  const subtitle =
    banner?.subtitle?.trim() ||
    statsSentence(home?.stats) ||
    "Shop verified local stores, live deals, and everyday essentials from trusted sellers across 1HandIndia.";
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

  if (!banner && isLoading) {
    return (
      <section className="mx-auto max-w-[1440px] px-4 pt-2 sm:px-6 sm:pt-3 md:px-8 md:pt-4 lg:px-10 lg:pt-5 xl:px-12 2xl:max-w-[1600px] 2xl:px-16">
        <StorefrontSkeleton className="min-h-[280px] rounded-[22px] bg-white/70 sm:min-h-[320px] md:min-h-[380px] lg:min-h-[480px] xl:min-h-[520px] 2xl:min-h-[560px]" />
      </section>
    );
  }

  return (
    <section
      className="mx-auto max-w-[1440px] px-4 pt-2 sm:px-6 sm:pt-3 md:px-8 md:pt-4 lg:px-10 lg:pt-5 xl:px-12 2xl:max-w-[1600px] 2xl:px-16"
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
      <div className="relative isolate min-h-[280px] overflow-hidden rounded-[22px] border border-[#FFE4DC] bg-[linear-gradient(104deg,#fff_0%,#fff_42%,#fff1ec_100%)] shadow-[0_18px_50px_rgba(237,53,0,0.07)] sm:rounded-[18px] sm:min-h-[320px] md:min-h-[380px] md:rounded-[20px] lg:min-h-[480px] lg:shadow-[0_24px_80px_rgba(237,53,0,0.08)] xl:min-h-[520px] xl:rounded-[22px] 2xl:min-h-[560px]">
        <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_18%_62%,rgba(237,53,0,0.14)_0,transparent_16%),radial-gradient(circle_at_78%_24%,rgba(237,53,0,0.10)_0,transparent_18%)]" />
        <div className="absolute right-[12%] top-8 hidden h-16 w-24 bg-[radial-gradient(#ED3500_1.2px,transparent_1.2px)] [background-size:10px_10px] opacity-25 lg:block xl:right-[15%] xl:top-10 xl:h-20 xl:w-32" />

        <div className="relative grid min-h-[280px] grid-cols-1 gap-3 px-5 py-6 sm:grid-cols-[minmax(0,1fr)_140px] sm:gap-4 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,1fr)_180px] md:gap-5 md:px-10 md:py-10 lg:min-h-[480px] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-6 lg:px-14 lg:py-12 xl:min-h-[520px] xl:gap-7 xl:px-16 xl:py-14 2xl:min-h-[560px] 2xl:gap-8 2xl:px-18 2xl:py-16">
          <div className="flex max-w-full flex-col justify-center sm:max-w-[550px] md:max-w-[600px] lg:max-w-[650px] xl:max-w-[700px] 2xl:max-w-[750px]">
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow ? (
                <span className="rounded-full bg-[#FFF0EC] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#ED3500] sm:text-[11px] sm:tracking-[0.13em] md:text-[12px] md:tracking-[0.14em] lg:text-[13px] lg:tracking-[0.15em]">
                  {eyebrow}
                </span>
              ) : null}
              <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#163B5C] shadow-sm sm:text-[12px] md:text-[13px] lg:inline-flex lg:text-[14px]">
                <LocateFixed className="h-3.5 w-3.5 text-[#ED3500] sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4" aria-hidden="true" />
                {locationText}
              </span>
            </div>

            <h1 className="mt-4 max-w-full text-[26px] font-black leading-[1.08] tracking-normal text-[#111827] sm:mt-5 sm:text-[36px] sm:leading-[1.05] md:text-[44px] md:leading-[1.04] lg:mt-6 lg:text-[56px] lg:leading-[1.03] xl:text-[64px] 2xl:text-[72px]">
              {splitMarketplaceTitle(title)}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-full text-sm font-semibold leading-6 text-[#596276] sm:mt-4 sm:text-base sm:leading-7 md:text-lg md:leading-8 lg:mt-5 lg:max-w-lg lg:text-xl lg:leading-9 xl:text-xl xl:leading-9 xl:max-w-xl 2xl:text-2xl 2xl:leading-10 2xl:max-w-2xl">
                {subtitle}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6 sm:gap-4 md:mt-7 lg:mt-8 xl:mt-9 xl:gap-5">
              <HomepageItemLink
                href={ctaHref}
                className="inline-flex h-11 items-center gap-2.5 rounded-full bg-[#ED3500] px-4 text-xs font-black text-white shadow-[0_18px_36px_rgba(237,53,0,0.28)] transition hover:-translate-y-0.5 hover:bg-[#d52f00] sm:h-12 sm:gap-3 sm:px-5 sm:text-sm md:h-13 md:px-6 lg:h-14 lg:gap-3.5 lg:px-7 lg:text-base xl:h-15 xl:px-8 2xl:h-16 2xl:text-lg"
              >
                {ctaLabel}
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#ED3500] sm:h-8 sm:w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 xl:h-11 xl:w-11 2xl:h-12 2xl:w-12">
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-5 xl:w-5 2xl:h-5 2xl:w-5" aria-hidden="true" />
                </span>
              </HomepageItemLink>
              {secondaryCtaLabel && secondaryCtaHref ? (
                <HomepageItemLink
                  href={secondaryCtaHref}
                  className="inline-flex h-11 items-center rounded-full border border-[#FFE0D6] bg-white px-4 text-xs font-black text-[#163B5C] shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500]/40 hover:text-[#ED3500] sm:h-12 sm:px-5 sm:text-sm md:h-13 md:px-6 lg:h-14 lg:px-7 lg:text-base xl:h-15 xl:px-8 2xl:h-16 2xl:text-lg"
                >
                  {secondaryCtaLabel}
                </HomepageItemLink>
              ) : null}
              <form onSubmit={submitSearch} className="hidden h-12 min-w-[240px] flex-1 overflow-hidden rounded-full border border-[#FFE0D6] bg-white shadow-sm md:flex md:min-w-[280px] lg:flex lg:min-w-[320px] xl:min-w-[360px] 2xl:min-w-[400px]">
                <label htmlFor="home-search" className="sr-only">
                  Search products, stores, or brands
                </label>
                <span className="grid w-11 place-items-center text-[#ED3500] md:w-12 lg:w-13">
                  <Search className="h-4 w-4 md:h-4.5 md:w-4.5 lg:h-5 lg:w-5" aria-hidden="true" />
                </span>
                <input
                  id="home-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search marketplace"
                  className="min-w-0 flex-1 bg-transparent pr-3 text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3] sm:pr-4 sm:text-base md:pr-5 md:text-lg lg:pr-6 lg:text-base xl:pr-7 xl:text-lg"
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
              className="absolute bottom-4 left-4 z-20 grid h-8 w-8 place-items-center rounded-full border border-[#FFE0D6] bg-white/94 text-[#ED3500] shadow-[0_12px_24px_rgba(22,59,92,0.10)] transition hover:-translate-x-0.5 hover:border-[#ED3500] sm:bottom-5 sm:left-5 sm:h-9 sm:w-9 md:bottom-6 md:left-6 lg:bottom-auto lg:left-5 lg:top-1/2 lg:h-10 lg:w-10 lg:-translate-y-1/2 xl:left-6 xl:h-11 xl:w-11 2xl:left-7 2xl:h-12 2xl:w-12"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 lg:h-5 lg:w-5 xl:h-5.5 xl:w-5.5 2xl:h-6 2xl:w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveBanner(1)}
              aria-label="Next homepage banner"
              className="absolute bottom-4 right-4 z-20 grid h-8 w-8 place-items-center rounded-full border border-[#FFE0D6] bg-white/94 text-[#ED3500] shadow-[0_12px_24px_rgba(22,59,92,0.10)] transition hover:translate-x-0.5 hover:border-[#ED3500] sm:bottom-5 sm:right-5 sm:h-9 sm:w-9 md:bottom-6 md:right-6 lg:bottom-auto lg:right-5 lg:top-1/2 lg:h-10 lg:w-10 lg:-translate-y-1/2 xl:right-6 xl:h-11 xl:w-11 2xl:right-7 2xl:h-12 2xl:w-12"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 lg:h-5 lg:w-5 xl:h-5.5 xl:w-5.5 2xl:h-6 2xl:w-6" aria-hidden="true" />
            </button>
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/92 px-2 py-1.5 shadow-[0_10px_22px_rgba(22,59,92,0.10)] sm:bottom-5 sm:px-2.5 sm:py-2 sm:gap-2 md:bottom-6 md:px-3 md:py-2.5 lg:bottom-7 lg:gap-2.5 xl:bottom-8 xl:px-3.5 xl:py-3 xl:gap-3 2xl:bottom-9 2xl:px-4 2xl:py-3.5">
              {banners.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectBanner(index)}
                  className={cn(
                    "h-2 rounded-full transition sm:h-2.5 md:h-2.5 lg:h-2.5 xl:h-3 xl:gap-3 2xl:h-3.5",
                    index === normalizedBannerIndex
                      ? "w-5 bg-[#ED3500] sm:w-6 md:w-6 lg:w-6 xl:w-7 2xl:w-8"
                      : "w-2 bg-[#F2B8A7] hover:bg-[#ED3500]/70 sm:w-2.5 md:w-2.5 lg:w-2.5 xl:w-3 2xl:w-3.5",
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
          sizes="(max-width: 640px) 108px, (max-width: 768px) 140px, 180px"
          fallbackLabel={visualLabel}
          showFallbackLabel={false}
          allowExternalRemote
          className={cn(
            "transition duration-500",
            bannerImage ? "object-cover" : "object-contain p-2 sm:p-3"
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

  return isLoading ? <StorefrontSkeleton className="h-32 rounded-[18px] bg-white/70 sm:h-36 lg:hidden" /> : <span className="lg:hidden" />;
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
    <div className="relative hidden min-h-[380px] items-center justify-center lg:flex lg:min-h-[420px] xl:min-h-[480px] 2xl:min-h-[520px]">
      <div className="absolute bottom-11 left-1/2 h-16 w-[380px] -translate-x-1/2 rounded-[50%] bg-white shadow-[0_22px_70px_rgba(22,59,92,0.16)] lg:w-[420px] xl:w-[480px] xl:h-18 2xl:w-[520px] 2xl:h-20" />
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ED3500] lg:h-72 lg:w-72 xl:h-80 xl:w-80 2xl:h-96 2xl:w-96" />
      <div className="absolute left-[16%] top-[26%] h-14 w-14 rounded-full bg-[#ED3500]/18 blur-sm lg:h-16 lg:w-16 xl:h-18 xl:w-18 2xl:h-20 2xl:w-20" />

      {bannerImage ? (
        <div className="relative z-10 h-[300px] w-[380px] rotate-[-3deg] overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(22,59,92,0.16)] lg:h-[340px] lg:w-[440px] lg:rounded-[28px] xl:h-[380px] xl:w-[480px] xl:rounded-[30px] 2xl:h-[420px] 2xl:w-[520px] 2xl:rounded-[32px]">
          <StorefrontImage
            src={bannerImage}
            alt={bannerImageAlt}
            sizes="(max-width: 1024px) 380px, (max-width: 1280px) 440px, (max-width: 1536px) 480px, 520px"
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
        <StorefrontSkeleton className="relative z-10 h-[280px] w-[380px] bg-white/70 lg:h-[320px] lg:w-[420px] xl:h-[360px] xl:w-[480px] 2xl:h-[400px] 2xl:w-[520px]" />
      ) : null}
    </div>
  );
}

function HeroProductCard({ product, className }: { product: ProductSummary; className: string }) {
  const market = useMarket();
  const t = useTranslations("home");
  const variant = primaryVariant(product);
  const activeDeal = getActiveDeal(product, variant);

  return (
    <Link
      href={`/products/${product.slug}` as Route}
      className={cn(
        "absolute z-10 block w-36 overflow-hidden rounded-[16px] border border-white/80 bg-white p-2.5 shadow-[0_24px_70px_rgba(22,59,92,0.16)] transition hover:-translate-y-1 lg:w-40 lg:rounded-[18px] lg:p-3 xl:w-44 xl:rounded-[20px] xl:p-3.5 2xl:w-48 2xl:rounded-[22px] 2xl:p-4",
        className,
      )}
    >
      <div className="absolute right-2.5 top-2.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-white text-[#9AA4B2] shadow-sm lg:right-3 lg:top-3 lg:h-7 lg:w-7 xl:right-3.5 xl:top-3.5 xl:h-8 xl:w-8 2xl:right-4 2xl:top-4 2xl:h-9 2xl:w-9">
        <Heart className="h-3 w-3 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4 2xl:h-4.5 2xl:w-4.5" aria-hidden="true" />
      </div>
      <div className="relative aspect-square overflow-hidden rounded-[12px] bg-[#FFF4EF] lg:rounded-[14px] xl:rounded-[16px] 2xl:rounded-[18px]">
        {activeDeal ? (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-[#ED3500] px-1.5 py-0.5 text-[8px] font-black uppercase text-white shadow-sm lg:px-2 lg:py-1 lg:text-[9px] xl:px-2.5 xl:py-1 xl:text-[10px] 2xl:px-3 2xl:py-1.5 2xl:text-[11px]">
            Deal
          </span>
        ) : null}
        <StorefrontImage
          src={primaryImage(product)}
          alt={product.name}
          sizes="(max-width: 1024px) 144px, (max-width: 1280px) 160px, (max-width: 1536px) 176px, 192px"
          fallbackLabel={product.category.name}
          allowExternalRemote
        />
      </div>
      <p className="mt-2.5 line-clamp-1 text-[11px] font-black text-[#1F2933] lg:mt-3 lg:text-xs xl:mt-3.5 xl:text-[13px] 2xl:mt-4 2xl:text-sm">{product.name}</p>
      {variant ? (
        <p className="mt-1 text-[10px] font-black text-[#ED3500] lg:mt-1.5 lg:text-[11px] xl:text-[12px] 2xl:text-[13px]">
          {t("from_price", { price: market.format(variant.pricePaise) })}
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

type PersonalizedHomeSlot =
  | "cartReminder"
  | "continueShopping"
  | "recentlyViewed"
  | "recommended"
  | "buyAgain";

type PersonalizedHomeSurface = "default" | "recommended" | "retention";

const DEFAULT_PERSONALIZED_HOME_SLOTS: PersonalizedHomeSlot[] = [
  "cartReminder",
  "continueShopping",
  "recentlyViewed",
  "recommended",
  "buyAgain",
];

const PERSONALIZED_HOME_SURFACES: Record<PersonalizedHomeSurface, string> = {
  default: "bg-[#FFFCFB]",
  recommended: "bg-white",
  retention: "bg-[linear-gradient(180deg,#FFFCFB_0%,#FFF7F3_100%)]",
};

function PersonalizedHomeSections({
  home,
  isLoading,
  surface = "default",
  slots = DEFAULT_PERSONALIZED_HOME_SLOTS,
}: {
  home: StorefrontHomePayload | undefined;
  isLoading: boolean;
  surface?: PersonalizedHomeSurface;
  slots?: PersonalizedHomeSlot[];
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
  const showCartReminder = slots.includes("cartReminder");
  const showContinueShopping = slots.includes("continueShopping");
  const showRecentlyViewed = slots.includes("recentlyViewed");
  const showRecommended = slots.includes("recommended");
  const showBuyAgain = slots.includes("buyAgain");
  const cartReminderVisible = showCartReminder && (cartQuery.data?.items.length ?? 0) > 0;
  const continueShoppingVisible =
    showContinueShopping &&
    (personalizedRails.continueProducts.length > 0 || (cartQuery.isLoading && customerAuth.enabled));
  const recentlyViewedVisible =
    showRecentlyViewed && personalizedRails.recentlyViewedProducts.length > 0;
  const recommendedVisible =
    showRecommended && (personalizedRails.recommendedProducts.length > 0 || isLoading);
  const buyAgainVisible =
    showBuyAgain &&
    (personalizedRails.buyAgainProducts.length > 0 || (ordersQuery.isLoading && customerAuth.enabled));
  const hasAnySection =
    cartReminderVisible ||
    continueShoppingVisible ||
    recentlyViewedVisible ||
    recommendedVisible ||
    buyAgainVisible;

  if (!hasAnySection) {
    return null;
  }

  return (
    <section className={cn("py-6 sm:py-7 lg:py-9", PERSONALIZED_HOME_SURFACES[surface])} aria-label="Personalized shopping">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
        {showCartReminder ? <CartReminder cart={cartQuery.data} /> : null}
        <div className="grid gap-5">
          {showContinueShopping ? (
            <PersonalizedProductRail
              title="Continue shopping"
              description="Pick up items still in your cart."
              href="/cart"
              icon={ShoppingCart}
              products={personalizedRails.continueProducts.slice(0, 8)}
              isLoading={cartQuery.isLoading && customerAuth.enabled}
            />
          ) : null}
          {showRecentlyViewed ? (
            <PersonalizedProductRail
              title="Recently viewed"
              description="Products you checked on this device."
              href="/search"
              icon={Clock3}
              products={personalizedRails.recentlyViewedProducts}
              isLoading={false}
            />
          ) : null}
          {showRecommended ? (
            <PersonalizedProductRail
              title="Recommended for you"
              description="Fresh picks from current marketplace rails."
              href="/search"
              icon={Sparkles}
              products={personalizedRails.recommendedProducts}
              isLoading={isLoading}
            />
          ) : null}
          {showBuyAgain ? (
            <PersonalizedProductRail
              title="Buy again from previous orders"
              description="Open products from your recent orders."
              href="/account/orders"
              icon={RotateCcw}
              products={personalizedRails.buyAgainProducts}
              isLoading={ordersQuery.isLoading && customerAuth.enabled}
            />
          ) : null}
        </div>
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
          <p className="text-base font-black text-[#1F2933]">Cart reminder</p>
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
            <p className="truncate text-xl font-black text-[#111827]">{title}</p>
            <p className="mt-0.5 hidden text-sm font-semibold text-[#667085] sm:block">{description}</p>
          </div>
        </div>
        <HomepageItemLink href={href} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-[#ED3500]">
          {viewAllLabel(title)} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </HomepageItemLink>
      </div>
      <ScrollRail ariaLabel={title} controls={false}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <StorefrontSkeleton key={index} className="h-[292px] w-[154px] shrink-0 rounded-[20px] bg-white sm:h-[306px] sm:w-[176px]" />
            ))
          : products.map((product) => <PersonalizedProductCard key={`${title}-${product.id}-${product.slug}`} product={product} />)}
      </ScrollRail>
    </div>
  );
}

function PersonalizedProductCard({ product }: { product: PersonalizedProduct }) {
  const market = useMarket();
  const t = useTranslations("home");

  return (
    <Link
      href={`/products/${product.slug}` as Route}
      className="group flex h-[292px] w-[154px] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border border-[#E8EDF2] bg-white p-2.5 shadow-[0_10px_24px_rgba(22,59,92,0.05)] transition hover:border-[#ED3500] hover:shadow-[0_18px_38px_rgba(22,59,92,0.09)] sm:h-[306px] sm:w-[176px]"
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
      <span className="flex min-w-0 flex-1 flex-col px-1.5 pb-2 pt-3">
        <span className="line-clamp-2 min-h-10 text-[13px] font-black leading-5 text-[#1F2933] sm:text-sm">{product.name}</span>
        <span className="mt-1.5 line-clamp-1 min-h-4 text-[11px] font-bold text-[#7A8496]">{product.sellerName}</span>
        <span className="mt-auto flex min-h-6 min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-black text-[#ED3500]">
            {product.pricePaise !== null ? market.format(product.pricePaise) : t("view_price")}
          </span>
          {product.mrpPaise && product.pricePaise && product.mrpPaise > product.pricePaise ? (
            <span className="max-w-[58px] shrink-0 truncate text-[11px] font-bold text-[#98A2B3] line-through sm:max-w-[70px]">{market.format(product.mrpPaise)}</span>
          ) : null}
        </span>
        <span className="mt-2 block min-h-7 truncate border-t border-[#FFF0EC] pt-2 text-[11px] font-extrabold text-[#7A8496]">
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
  const t = useTranslations("home");
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const hoverScrollDirectionRef = useRef<"left" | "right" | null>(null);
  const hoverScrollSpeedRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const hasScrollableCategories = isLoading || categories.length > 4;

  function updateCategoryScrollState() {
    const rail = categoryRailRef.current;
    if (!rail) {
      return;
    }

    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4);
  }

  function scrollCategories(direction: "left" | "right") {
    const rail = categoryRailRef.current;
    if (!rail) {
      return;
    }

    rail.scrollBy({
      left: direction === "left" ? -rail.clientWidth * 0.85 : rail.clientWidth * 0.85,
      behavior: "smooth",
    });
  }

  function stopHoverScroll() {
    hoverScrollDirectionRef.current = null;
    hoverScrollSpeedRef.current = 0;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function startHoverScroll() {
    if (animationFrameRef.current !== null) {
      return;
    }

    const step = () => {
      const rail = categoryRailRef.current;
      const direction = hoverScrollDirectionRef.current;
      const speed = hoverScrollSpeedRef.current;
      if (!rail || !direction || speed <= 0) {
        animationFrameRef.current = null;
        return;
      }

      rail.scrollLeft += direction === "left" ? -speed : speed;
      updateCategoryScrollState();
      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
  }

  function handleCategoryPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !hasScrollableCategories) {
      return;
    }
    if (window.matchMedia("(max-width: 639px)").matches) {
      return;
    }

    const rail = categoryRailRef.current;
    if (!rail) {
      return;
    }

    const rect = rail.getBoundingClientRect();
    const edgeSize = Math.min(150, rect.width * 0.18);
    const distanceFromLeft = event.clientX - rect.left;
    const distanceFromRight = rect.right - event.clientX;

    if (distanceFromLeft < edgeSize && rail.scrollLeft > 0) {
      hoverScrollDirectionRef.current = "left";
      hoverScrollSpeedRef.current = Math.max(3, ((edgeSize - distanceFromLeft) / edgeSize) * 18);
      startHoverScroll();
      return;
    }

    if (distanceFromRight < edgeSize && rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4) {
      hoverScrollDirectionRef.current = "right";
      hoverScrollSpeedRef.current = Math.max(3, ((edgeSize - distanceFromRight) / edgeSize) * 18);
      startHoverScroll();
      return;
    }

    stopHoverScroll();
  }

  useEffect(() => {
    const rail = categoryRailRef.current;
    if (!rail) {
      return undefined;
    }

    updateCategoryScrollState();
    rail.addEventListener("scroll", updateCategoryScrollState, { passive: true });
    window.addEventListener("resize", updateCategoryScrollState);

    return () => {
      rail.removeEventListener("scroll", updateCategoryScrollState);
      window.removeEventListener("resize", updateCategoryScrollState);
      stopHoverScroll();
    };
  }, [categories.length, isLoading]);

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFCFB_0%,#FFF8F4_100%)] py-7 sm:py-8 lg:py-12">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
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
          <div className="flex items-center gap-2">
            {hasScrollableCategories ? (
              <div className="hidden items-center gap-2 sm:flex" aria-label="Category carousel controls">
                <button
                  type="button"
                  onClick={() => scrollCategories("left")}
                  disabled={!canScrollLeft}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500] shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500]/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  aria-label="Scroll categories left"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCategories("right")}
                  disabled={!canScrollRight}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500] shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500]/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  aria-label="Scroll categories right"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <HomepageItemLink
              href="/categories"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-[#FFE0D6] bg-white px-4 text-sm font-black !text-[#ED3500] shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500]/50 hover:bg-[#FFF7F3] hover:!text-[#c92b00]"
            >
              {t("view_all_categories")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </HomepageItemLink>
          </div>
        </div>
        <div
          className="relative mt-6 lg:mt-8"
          onPointerMove={handleCategoryPointerMove}
          onPointerLeave={stopHoverScroll}
        >
          <div
            ref={categoryRailRef}
            className="-mx-1 flex snap-x gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-4 pt-1 [scrollbar-width:none] sm:gap-5 sm:px-2 lg:-mx-2 [&::-webkit-scrollbar]:hidden"
            aria-label="Shop by category"
          >
            {isLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <StorefrontSkeleton
                    key={index}
                    className="h-[132px] min-w-[calc(50%-6px)] snap-start rounded-[16px] bg-white sm:h-[348px] sm:min-w-[280px] lg:min-w-[292px]"
                  />
                ))
              : categories.map((category, index) => (
                  <div key={category.id} className="min-w-[calc(50%-6px)] snap-start sm:min-w-[280px] lg:min-w-[292px]">
                    <MobileCategoryTile category={category} accent={categoryAccent(index)} />
                    <div className="hidden sm:block">
                      <CategoryTile category={category} accent={categoryAccent(index)} />
                    </div>
                  </div>
                ))}
          </div>
        </div>
        {!isLoading && !categories.length ? (
          <StorefrontEmptyState className="mt-5" message="No active categories are available yet." />
        ) : null}
      </div>
    </section>
  );
}

function MobileCategoryTile({ category, accent }: { category: CategorySummary; accent: CategoryAccent }) {
  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className="group flex min-h-[132px] min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#E8EDF2] bg-white p-3 text-left shadow-[0_10px_24px_rgba(22,59,92,0.05)] transition active:scale-[0.98] sm:hidden"
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
      className="group relative flex min-h-[348px] min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#E8EDF2] bg-white p-6 text-left shadow-[0_12px_28px_rgba(22,59,92,0.05)] outline outline-1 outline-transparent transition hover:border-[#FFD8CC] hover:shadow-[0_18px_42px_rgba(22,59,92,0.09)] focus-visible:outline-[#ED3500]"
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
  const t = useTranslations("home");
  const previewStores = stores.slice(0, 5);
  const filterChips = [
    { label: "Top Rated", href: "/stores?sort=rating" },
    { label: "Nearest", href: "/stores?sort=nearest" },
    { label: "Trending", href: "/stores?sort=trending" },
    { label: "Recently Joined", href: "/stores?sort=newest" },
    { label: "Most Products", href: "/stores?sort=products" },
    { label: "Verified Only", href: "/stores?verified=true" },
  ];

  return (
    <section className="bg-[linear-gradient(180deg,#FFFCFB_0%,#FFF8F4_100%)] px-4 py-7 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1360px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[30px] font-black leading-tight tracking-normal text-[#111827] lg:text-4xl">
              {t("top_stores")}
            </h2>
            <span className="mt-3 block h-1 w-10 rounded-full bg-[#ED3500]" aria-hidden="true" />
            <p className="mt-4 text-sm font-semibold leading-6 text-[#6B7280] sm:text-base">
              {locationLabel}
            </p>
          </div>
          <HomepageItemLink
            href="/stores"
            className="mt-1 inline-flex shrink-0 items-center gap-2 text-sm font-black !text-[#ED3500] transition hover:!text-[#c92b00]"
          >
            {t("view_all_stores")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </HomepageItemLink>
        </div>

        <div className="indihub-scroll-rail -mx-4 mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-1 sm:px-1 [&::-webkit-scrollbar]:hidden" aria-label="Store sorting filters">
          {filterChips.map((chip) => (
            <HomepageItemLink
              key={chip.label}
              href={chip.href}
              rel="nofollow"
              className="inline-flex h-9 shrink-0 snap-start items-center rounded-full border border-[#ECECEC] bg-white px-4 text-xs font-black !text-[#596276] shadow-[0_8px_20px_rgba(17,24,39,0.04)] transition hover:-translate-y-0.5 hover:border-[#ED3500]/40 hover:bg-[#FFF4EF] hover:!text-[#ED3500]"
            >
              {chip.label}
            </HomepageItemLink>
          ))}
        </div>

        <div className="mt-5 grid gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TopStoreCardSkeleton key={index} />
            ))
          ) : previewStores.length ? (
            previewStores.map((store, index) => (
              <TopStoreCard key={store.id} store={store} index={index} />
            ))
          ) : (
            <TopStoresEmptyState />
          )}
        </div>

        {!isLoading && stores.length > 5 ? (
          <div className="mt-5 flex justify-center">
            <HomepageItemLink
              href="/stores"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border border-[#FFE0D6] bg-white px-6 text-sm font-black !text-[#ED3500] shadow-[0_16px_34px_rgba(237,53,0,0.08)] transition hover:-translate-y-0.5 hover:border-[#ED3500]/40 hover:bg-[#FFF7F3]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#FFF0EC]">
                <Store className="h-4 w-4" aria-hidden="true" />
              </span>
              Browse full store directory
            </HomepageItemLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function homeStoreRankingSubtitle(
  mode: StorefrontHomePayload["storeRankingMode"] | undefined,
  locationName?: string,
) {
  if (mode === "LOCATION_MATCH" || mode === "GPS_NEAREST") {
    return locationName ? `Trusted sellers near ${locationName}.` : "Trusted sellers near you.";
  }
  if (mode === "CUSTOMER_RECENT_ORDERS") {
    return "Stores you recently shopped from.";
  }
  if (mode === "PLATFORM_TRENDING") {
    return "Popular stores customers are ordering from.";
  }
  return "Today's marketplace picks.";
}

function TopStoreCard({ store, index }: { store: StoreProfile; index: number }) {
  const productCount = store._count?.products ?? 0;
  const address = store.addresses?.[0];
  const rating = store.reviewSummary?.averageRating ?? 4.6 + (index % 3) / 10;
  const reviewCount = store.reviewSummary?.reviewCount ?? [128, 92, 156, 78, 64][index] ?? 48;
  const previewProducts = store.previewProducts?.slice(0, 3) ?? [];
  const fallbackPreviews = storeFallbackPreviews(store, index);
  const previews = previewProducts.length
    ? previewProducts.map((product) => ({
        id: product.id,
        imageUrl: primaryImage(product),
        label: product.category?.name ?? product.name,
        fallbackLabel: product.category?.name ?? product.name,
      }))
    : fallbackPreviews;

  return (
    <Link
      href={`/stores/${store.slug}` as Route}
      className="group grid min-h-[168px] grid-cols-[76px_minmax(0,1fr)_32px] gap-3 rounded-[20px] border border-[#ECECEC] bg-white p-3 shadow-[0_12px_34px_rgba(17,24,39,0.06)] transition duration-[250ms] hover:-translate-y-0.5 hover:scale-[1.005] hover:border-[#ED3500]/40 hover:shadow-[0_22px_54px_rgba(237,53,0,0.10)] sm:min-h-[168px] sm:grid-cols-[92px_minmax(0,1fr)_172px_44px] sm:gap-5 sm:p-5 lg:grid-cols-[112px_minmax(0,1fr)_230px_48px] lg:rounded-[24px] lg:p-7"
    >
      <span className="relative grid h-16 w-16 place-items-center self-start overflow-hidden rounded-full border border-[#ECECEC] bg-[#FFF4EF] shadow-[0_10px_24px_rgba(17,24,39,0.06)] sm:h-20 sm:w-20 lg:h-[88px] lg:w-[88px]">
        <StorefrontImage
          src={store.profile?.logoUrl ?? store.profile?.bannerUrl ?? null}
          alt={`${store.storeName} logo`}
          sizes="88px"
          fallbackLabel={store.storeName}
          allowExternalRemote
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </span>

      <span className="min-w-0">
        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#E9F8EF] px-2 py-1 text-[10px] font-black text-[#16A34A] shadow-[0_0_18px_rgba(22,163,74,0.08)]">
          <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Verified Seller</span>
        </span>
        <span className="mt-2 block truncate text-[17px] font-black leading-6 text-[#111827] sm:text-lg">
          {store.storeName}
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-[#6B7280]">
          <PackageCheck className="h-4 w-4 shrink-0 text-[#F59E0B]" aria-hidden="true" />
          <span className="truncate">
            {productCount.toLocaleString("en-IN")} live {productCount === 1 ? "product" : "products"}
          </span>
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-[#6B7280]">
          <MapPin className="h-4 w-4 shrink-0 text-[#ED3500]" aria-hidden="true" />
          <span className="truncate">
            {address
              ? [address.area, address.city, address.state ? shortIndianState(address.state) : null]
                  .filter(Boolean)
                  .join(", ")
              : "Marketplace store"}
          </span>
        </span>
        <span className="mt-3 flex items-center gap-1 text-sm font-bold text-[#596276] sm:hidden">
          <Sparkles className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
          {rating.toFixed(1)} ({reviewCount.toLocaleString("en-IN")})
        </span>
      </span>

      <span className="col-span-2 col-start-2 flex min-w-0 items-center justify-between gap-3 self-end sm:col-span-1 sm:col-start-auto sm:block sm:self-center">
        <span className="hidden items-center gap-1 text-sm font-bold text-[#596276] sm:flex">
          <Sparkles className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" aria-hidden="true" />
          {rating.toFixed(1)} ({reviewCount.toLocaleString("en-IN")})
        </span>
        <span className="flex min-w-0 gap-2 sm:mt-4 lg:gap-3">
          {previews.map((preview, previewIndex) => (
            <span
              key={`${preview.id}-${previewIndex}`}
              className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[#ECECEC] bg-[#FFF7F3] shadow-[0_8px_18px_rgba(17,24,39,0.06)] transition duration-[250ms] group-hover:scale-105 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
            >
              {preview.imageUrl ? (
                <StorefrontImage
                  src={preview.imageUrl}
                  alt={preview.label}
                  sizes="56px"
                  fallbackLabel={preview.fallbackLabel}
                  showFallbackLabel={false}
                  allowExternalRemote
                  className="object-contain p-1.5"
                />
              ) : (
                <span className="px-1 text-center text-[10px] font-black leading-3 text-[#ED3500]">
                  {preview.label}
                </span>
              )}
              <span className="sr-only">{preview.label}</span>
            </span>
          ))}
        </span>
      </span>

      <span className="col-start-3 row-start-1 grid h-8 w-8 place-items-center self-start justify-self-end rounded-full bg-[#F8FAFC] text-[#111827] shadow-[0_8px_18px_rgba(17,24,39,0.06)] transition duration-[250ms] group-hover:rotate-[-8deg] group-hover:bg-[#FFF0EC] group-hover:text-[#ED3500] sm:col-start-4 sm:h-10 sm:w-10 sm:self-center lg:h-11 lg:w-11">
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function TopStoreCardSkeleton() {
  return (
    <div className="grid min-h-[168px] grid-cols-[76px_minmax(0,1fr)_32px] gap-3 rounded-[20px] border border-[#ECECEC] bg-white p-3 shadow-[0_12px_34px_rgba(17,24,39,0.06)] sm:grid-cols-[92px_minmax(0,1fr)_172px_44px] sm:gap-5 sm:p-5 lg:grid-cols-[112px_minmax(0,1fr)_230px_48px] lg:p-7">
      <StorefrontSkeleton className="h-16 w-16 rounded-full bg-[#FFF0EC] sm:h-20 sm:w-20 lg:h-[88px] lg:w-[88px]" />
      <div className="min-w-0">
        <StorefrontSkeleton className="h-6 w-28 rounded-full bg-[#E9F8EF]" />
        <StorefrontSkeleton className="mt-3 h-5 w-44 rounded bg-[#F4F4F5]" />
        <StorefrontSkeleton className="mt-3 h-4 w-36 rounded bg-[#F4F4F5]" />
        <StorefrontSkeleton className="mt-2 h-4 w-48 rounded bg-[#F4F4F5]" />
      </div>
      <div className="col-span-2 col-start-2 flex items-center justify-between gap-3 self-end sm:col-span-1 sm:col-start-auto sm:block sm:self-center">
        <StorefrontSkeleton className="hidden h-4 w-24 rounded bg-[#F4F4F5] sm:block" />
        <div className="flex gap-2 sm:mt-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <StorefrontSkeleton key={index} className="h-11 w-11 rounded-[10px] bg-[#FFF4EF] sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
          ))}
        </div>
      </div>
      <StorefrontSkeleton className="col-start-3 row-start-1 h-8 w-8 rounded-full bg-[#F4F4F5] sm:col-start-4 sm:h-10 sm:w-10 lg:h-11 lg:w-11" />
    </div>
  );
}

function TopStoresEmptyState() {
  return (
    <div className="rounded-[24px] border border-[#FFE0D6] bg-white p-6 text-center shadow-[0_12px_34px_rgba(17,24,39,0.05)]">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-[#FFF0EC] text-[#ED3500]">
        <Store className="h-8 w-8" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-black text-[#111827]">No stores available nearby</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-[#6B7280]">
        Explore the wider 1HandIndia marketplace while new local sellers are being approved.
      </p>
      <HomepageItemLink
        href="/stores"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#ED3500] px-5 text-sm font-black !text-white shadow-[0_14px_28px_rgba(237,53,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#d52f00]"
      >
        Explore Marketplace
      </HomepageItemLink>
    </div>
  );
}

function storeFallbackPreviews(store: StoreProfile, index: number) {
  const defaultPreviewLabels = ["Fashion", "Electronics", "Groceries"];
  const sets = [
    defaultPreviewLabels,
    ["Automotive", "Beauty", "Tools"],
    ["Organic", "Groceries", "Home"],
    ["Fashion", "Kids", "Footwear"],
    ["Furniture", "Decor", "Plants"],
  ];
  const sellerType = store.sellerType ? humanize(store.sellerType) : null;
  const fallbackSet = sets[index % sets.length] ?? defaultPreviewLabels;
  const labels = fallbackSet.map((label, labelIndex) =>
    labelIndex === 0 && sellerType ? sellerType.split(" ")[0] : label,
  );

  return labels.map((label, labelIndex) => ({
    id: `${store.id}-fallback-${labelIndex}`,
    imageUrl: null,
    label,
    fallbackLabel: label,
  }));
}

function shortIndianState(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "tamil nadu") {
    return "TN";
  }
  if (normalized === "karnataka") {
    return "KA";
  }
  if (normalized === "kerala") {
    return "KL";
  }
  if (normalized === "maharashtra") {
    return "MH";
  }
  return value;
}

function HomeProductRail({
  rail,
  isLoading,
}: {
  rail: StorefrontProductRailDefinition | undefined;
  isLoading: boolean;
}) {
  if (!rail || (!rail.products.length && !isLoading && !rail.showWhenEmpty)) {
    return null;
  }

  return (
    <ProductRailSection
      title={rail.title}
      description={rail.description}
      href={rail.href}
      products={rail.products}
      isLoading={isLoading}
      promoProduct={rail.products[0]}
      promoTone={rail.promoTone}
      surface={rail.surface}
      {...(rail.timerEndsAt ? { timerEndsAt: rail.timerEndsAt } : {})}
    />
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
  surface,
  timerEndsAt,
}: {
  title: string;
  description: string;
  href: string;
  products: ProductSummary[];
  isLoading: boolean;
  promoProduct: ProductSummary | undefined;
  promoTone: "orange" | "soft";
  surface: ProductRailSurface;
  timerEndsAt?: string;
}) {
  const surfaceStyle = PRODUCT_RAIL_SURFACES[surface];
  const showTimer = surface === "deals" && Boolean(timerEndsAt);
  const t = useTranslations("home");

  return (
    <section className={cn("py-6 sm:py-7 lg:py-10", surfaceStyle.sectionClassName)}>
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex min-w-0 items-center gap-2 text-2xl font-black tracking-normal text-[#111827]">
              <Zap className="h-6 w-6 shrink-0 fill-[#ED3500] text-[#ED3500] lg:hidden" aria-hidden="true" />
              <span className="min-w-0 break-words">{title}</span>
            </h2>
            {description ? <p className="mt-1 text-sm font-semibold text-[#7A8496]">{description}</p> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
            {showTimer ? (
              <span className="hidden sm:inline-flex">
                <DealCountdown endsAt={timerEndsAt ?? ""} />
              </span>
            ) : null}
            <HomepageItemLink href={href} className="inline-flex w-fit items-center gap-2 text-sm font-black text-[#ED3500] transition hover:text-[#c92b00] lg:text-xs">
              {viewAllLabel(title, t("view_all"))} <ArrowRight className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden="true" />
            </HomepageItemLink>
          </div>
        </div>
        {showTimer ? (
          <div className="mt-3 sm:hidden">
            <DealCountdown endsAt={timerEndsAt ?? ""} />
          </div>
        ) : null}
        <div className={cn("mt-4 grid items-stretch gap-4 lg:mt-6", surfaceStyle.gridClassName)}>
          <div className="hidden lg:block">
            <PromoPanel
              product={promoProduct}
              tone={promoTone}
              badge={surfaceStyle.promoBadge}
              ctaLabel={surfaceStyle.promoCta}
              title={surfaceStyle.promoTitle}
              description={surfaceStyle.promoDescription ?? description}
              {...(showTimer && timerEndsAt ? { timerEndsAt } : {})}
            />
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
      </div>
    </section>
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
  const leadItem = items[0] ?? null;
  const eyebrow = stringValue(config.eyebrow) || humanize(section.sectionType);
  const title = homepageSectionDisplayTitle(section);
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
              {title}
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

        {leadItem ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
            <CustomHomepageLeadCard
              item={leadItem}
              title={title}
              description={description}
            />
            {items.length > 1 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.slice(1).map((item, index) => (
                  <CustomHomepageItemCard
                    key={`${section.id}-${item.label}-${index + 1}`}
                    item={item}
                    accent={categoryAccent(index + 1)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CustomHomepageLeadCard({
  item,
  title,
  description,
}: {
  item: NormalizedHomepageItem;
  title: string;
  description?: string;
}) {
  const body = item.description || description || "Handpicked marketplace picks for faster shopping.";
  const badge = item.badge || title;

  return (
    <HomepageItemLink
      href={item.linkUrl}
      className="group relative isolate min-h-[292px] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_78%_14%,rgba(255,255,255,0.22),transparent_22%),radial-gradient(circle_at_58%_48%,rgba(255,255,255,0.12),transparent_22%),linear-gradient(145deg,#FF4318_0%,#ED3500_62%,#D72F00_100%)] p-5 text-left text-white shadow-[0_18px_42px_rgba(237,53,0,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(237,53,0,0.18)] lg:min-h-[292px]"
    >
      <span className="absolute right-6 top-6 grid grid-cols-3 gap-1 opacity-30" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className="h-1 w-1 rounded-full bg-white" />
        ))}
      </span>
      <span className="absolute bottom-5 right-16 h-10 w-10 rotate-45 border border-white/24" aria-hidden="true" />
      <span className="relative z-10 block">
        <span className="mb-5 inline-flex max-w-full rounded-full bg-black/20 px-3 py-1 text-[10px] font-black uppercase text-white backdrop-blur">
          <span className="truncate">{badge}</span>
        </span>
        <span className="block max-w-[13rem] text-2xl font-black leading-tight text-white">
          {item.label || title}
        </span>
        <span className="mt-3 block max-w-[20ch] text-sm font-bold leading-6 text-white/88">
          {body}
        </span>
        <span className="relative z-20 mt-7 inline-flex h-10 min-w-[136px] items-center justify-center gap-2 rounded-full bg-white px-5 text-xs font-black !text-[#C4320A] shadow-[0_10px_24px_rgba(16,24,40,0.10)] transition group-hover:-translate-y-0.5">
          Explore Section
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className="pointer-events-none absolute bottom-5 right-5 z-0 grid h-32 w-32 place-items-center overflow-hidden rounded-[24px] bg-white/16 p-3 opacity-95">
        {item.imageUrl ? (
          <StorefrontImage
            src={item.imageUrl}
            alt={item.label}
            sizes="160px"
            fallbackLabel={item.label}
            showFallbackLabel={false}
            allowExternalRemote
            className="object-contain transition duration-500 group-hover:scale-105"
          />
        ) : (
          <ShoppingBag className="h-12 w-12 text-white" aria-hidden="true" />
        )}
      </span>
    </HomepageItemLink>
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

function DealCountdown({
  endsAt,
  tone = "dark",
}: {
  endsAt: string;
  tone?: "dark" | "light";
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (now === null) {
    // Render skeleton on server, countdown only after client mounts
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-black shadow-[0_12px_24px_rgba(22,59,92,0.08)] border-[#FFE0D6] bg-[#FFF7F3] text-[#B42318] w-24">
        <span className="animate-pulse">Loading...</span>
      </span>
    );
  }

  const countdown = dealCountdownLabel(endsAt, now);

  if (!countdown) {
    return null;
  }

  const isLight = tone === "light";

  return (
    <span
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-black shadow-[0_12px_24px_rgba(22,59,92,0.08)]",
        isLight
          ? "border-white/24 bg-white/14 text-white backdrop-blur"
          : "border-[#FFE0D6] bg-[#FFF7F3] text-[#B42318]",
      )}
    >
      <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className={cn("hidden sm:inline", isLight ? "text-white/84" : "text-[#7A271A]")}>
        {countdown.expired ? "Sale ended" : "Ends in"}
      </span>
      <span className="tabular-nums">{countdown.label}</span>
    </span>
  );
}

function dealCountdownLabel(value: string, now: number) {
  const target = Date.parse(value);

  if (!Number.isFinite(target)) {
    return null;
  }

  const remainingMs = target - now;

  if (remainingMs <= 0) {
    return { expired: true, label: "00:00:00" };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return {
      expired: false,
      label: `${days}d ${padCountdownPart(hours)}h ${padCountdownPart(minutes)}m`,
    };
  }

  return {
    expired: false,
    label: `${padCountdownPart(hours)}:${padCountdownPart(minutes)}:${padCountdownPart(seconds)}`,
  };
}

function padCountdownPart(value: number) {
  return String(value).padStart(2, "0");
}

function PromoPanel({
  badge,
  ctaLabel,
  product,
  tone,
  title,
  description,
  timerEndsAt,
}: {
  badge: string;
  ctaLabel: string;
  product: ProductSummary | undefined;
  tone: "orange" | "soft";
  title: string;
  description: string;
  timerEndsAt?: string;
}) {
  const market = useMarket();
  const variant = product ? primaryVariant(product) : null;
  const activeDeal = product && variant ? getActiveDeal(product, variant) : null;
  const originalPrice = variant ? getDealOriginalPrice(variant) ?? (variant.mrpPaise && variant.mrpPaise > variant.pricePaise ? variant.mrpPaise : null) : null;
  const discount = originalPrice && variant ? Math.round(((originalPrice - variant.pricePaise) / originalPrice) * 100) : null;

  return (
    <div
      className={cn(
        "relative isolate flex min-h-[368px] overflow-hidden rounded-[20px] p-5 shadow-[0_18px_42px_rgba(237,53,0,0.14)] sm:p-6",
        tone === "orange"
          ? "bg-[radial-gradient(circle_at_76%_18%,rgba(255,255,255,0.22),transparent_22%),radial-gradient(circle_at_60%_42%,rgba(255,255,255,0.12),transparent_20%),linear-gradient(145deg,#FF4318_0%,#ED3500_62%,#D72F00_100%)] text-white"
          : "border border-[#FFE0D6] bg-[#FFF4EF] text-[#1F2933]",
      )}
    >
      <span className="pointer-events-none absolute right-6 top-6 grid grid-cols-3 gap-1 opacity-30">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className="h-1 w-1 rounded-full bg-white" />
        ))}
      </span>
      <span className="pointer-events-none absolute bottom-6 right-10 h-11 w-11 rotate-45 border border-white/24" />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <span className={cn(
          "mb-5 inline-flex max-w-full self-start rounded-full px-3 py-1 text-[11px] font-black uppercase shadow-[0_10px_24px_rgba(16,24,40,0.10)]",
          tone === "orange" ? "bg-black/20 text-white backdrop-blur" : "bg-white text-[#ED3500]",
        )}>
          <span className="truncate">{badge}</span>
        </span>
        <p className={cn("max-w-[13ch] text-2xl font-black leading-[1.12] sm:text-3xl", tone === "orange" ? "text-white" : "text-[#ED3500]")}>
          {title}
        </p>
        <p className={cn("mt-3 max-w-[24ch] text-sm font-bold leading-6", tone === "orange" ? "text-white/88" : "text-[#596276]")}>
          {description || (product ? product.name : "Hot products from approved sellers")}
        </p>
        {timerEndsAt ? (
          <div className="mt-5">
            <DealCountdown endsAt={timerEndsAt} tone={tone === "orange" ? "light" : "dark"} />
          </div>
        ) : null}
        {product ? (
          <span
            className={cn(
              "mt-5 grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-[18px] p-3 sm:grid-cols-[104px_minmax(0,1fr)]",
              tone === "orange" ? "bg-white/16" : "bg-white/78",
            )}
          >
            <span className="relative block h-[92px] min-w-0 overflow-hidden rounded-[14px] bg-white/82 sm:h-[104px]">
              {discount ? (
                <span className="absolute right-1.5 top-1.5 z-10 grid h-11 w-11 place-items-center rounded-[12px] bg-[#8A1D0A] text-center text-[9px] font-black leading-3 text-white shadow-[0_12px_24px_rgba(16,24,40,0.14)]">
                  {discount}%<br />OFF
                </span>
              ) : activeDeal ? (
                <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-[#8A1D0A] px-2 py-1 text-[9px] font-black text-white">
                  DEAL
                </span>
              ) : null}
              <StorefrontImage
                src={primaryImage(product)}
                alt={product.name}
                sizes="112px"
                fallbackLabel={product.category.name}
                showFallbackLabel={false}
                allowExternalRemote
                className="object-contain p-2"
              />
            </span>
            <span className="min-w-0">
              <span className={cn("block line-clamp-3 text-sm font-black leading-5", tone === "orange" ? "text-white" : "text-[#1F2933]")}>
                {product.name}
              </span>
              {variant ? (
                <span className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={cn("text-base font-black", tone === "orange" ? "text-white" : "text-[#1F2933]")}>
                    {market.format(variant.pricePaise)}
                  </span>
                  {originalPrice ? (
                    <span className={cn("truncate text-xs font-bold line-through", tone === "orange" ? "text-white/64" : "text-[#98A2B3]")}>
                      {market.format(originalPrice)}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
          </span>
        ) : null}
        <HomepageItemLink
          href={product ? `/products/${product.slug}` : "/search"}
          className={cn(
            "relative z-40 mt-5 inline-flex min-h-10 w-fit max-w-full items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-black shadow-[0_10px_24px_rgba(16,24,40,0.10)] transition hover:-translate-y-0.5",
            tone === "orange" ? "bg-white !text-[#C4320A]" : "bg-[#ED3500] !text-white",
          )}
        >
          <span className="relative z-10 truncate">{ctaLabel}</span>
          <ArrowRight className="relative z-10 h-3.5 w-3.5" aria-hidden="true" />
        </HomepageItemLink>
        
      </div>
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
  const t = useTranslations("home");
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
      <div className="relative h-[124px] shrink-0 overflow-hidden bg-[linear-gradient(180deg,#FFF8F5_0%,#FFFFFF_100%)] p-2 sm:h-[142px] sm:p-3 lg:h-[168px]">
        <Link href={`/products/${product.slug}` as Route} className="absolute inset-0 block">
          {campaignBadge ? (
            <span className="absolute left-3 top-3 z-10 hidden max-w-[120px] truncate rounded-full bg-[#ED3500] px-2.5 py-1 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(237,53,0,0.20)] lg:block">
              {campaignBadge}
            </span>
          ) : null}
          <span className="absolute inset-2 grid place-items-center overflow-hidden rounded-[14px] bg-white/72 sm:inset-3 lg:inset-4">
            <StorefrontImage
              src={primaryImage(product)}
              alt={product.name}
              sizes="(max-width: 640px) 138px, (max-width: 1024px) 146px, 156px"
              fallbackLabel={product.category.name}
              allowExternalRemote
              className="object-contain transition duration-500 group-hover:scale-105"
            />
          </span>
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
            {variant ? market.format(variant.pricePaise) : t("price_pending")}
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
  rel,
}: {
  href: string;
  className: string;
  children: ReactNode;
  "aria-label"?: string;
  rel?: string;
}) {
  if (!href || href === "#") {
    return <span className={className} aria-label={ariaLabel}>{children}</span>;
  }

  if (href.startsWith("/")) {
    return (
      <Link href={href as Route} className={className} aria-label={ariaLabel} rel={rel}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} target="_blank" rel={rel ? `noreferrer ${rel}` : "noreferrer"} aria-label={ariaLabel}>
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

function homepageSectionDisplayTitle(section: HomepageSection) {
  const title = section.title.trim();
  if (section.sectionType === "featured_stores" && title.toLowerCase() === "top stores") {
    return "Featured Stores";
  }
  return title || humanize(section.sectionType);
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

function viewAllLabel(title: string, fallback = "View all") {
  const cleanTitle = title.trim();
  const prefix = fallback.trim() || "View all";
  return cleanTitle ? `${prefix} ${cleanTitle.toLowerCase()}` : prefix;
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

type ProductRailSurface = "deals" | "best" | "new" | "nearby";

type ProductRailSurfaceStyle = {
  gridClassName: string;
  promoBadge: string;
  promoCta: string;
  promoDescription?: string;
  promoTitle: string;
  sectionClassName: string;
};

const PRODUCT_RAIL_SURFACES: Record<ProductRailSurface, ProductRailSurfaceStyle> = {
  deals: {
    gridClassName: "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]", 
    promoBadge: "Today's pick",
    promoCta: "Explore Now",
    promoDescription: "A sharper lead pick for deal hunters.",
    promoTitle: "Deal of the day",
    sectionClassName: "bg-white",
  },
  best: {
    gridClassName: "lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]", 
    promoBadge: "Buyer favourite",
    promoCta: "Shop Best Sellers",
    promoDescription: "Popular products with stronger buyer signal.",
    promoTitle: "Best seller spotlight",
    sectionClassName: "bg-[linear-gradient(180deg,#FFF7F3_0%,#FFFCFB_100%)]",
  },
  new: {
    gridClassName: "lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]", 
    promoBadge: "New drop",
    promoCta: "See New Picks",
    promoDescription: "Freshly listed products from verified sellers.",
    promoTitle: "New arrival focus",
    sectionClassName: "bg-white",
  },
  nearby: {
    gridClassName: "lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]", 
    promoBadge: "Local pick",
    promoCta: "Shop Nearby",
    promoDescription: "Products matched to nearby store availability.",
    promoTitle: "Nearby store pick",
    sectionClassName: "bg-[linear-gradient(180deg,#FFFCFB_0%,#FFF8F4_100%)]",
  },
};

type StorefrontProductRailDefinition = {
  description: string;
  href: string;
  id: string;
  products: ProductSummary[];
  promoTone: "orange" | "soft";
  showWhenEmpty?: boolean;
  surface: ProductRailSurface;
  timerEndsAt?: string;
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
        surface: "deals",
      },
      {
        id: "best-sellers",
        title: "Best Sellers",
        description: "Top featured picks from verified sellers.",
        href: "/search?sort=rating",
        products: [],
        promoTone: "orange",
        surface: "best",
      },
      {
        id: "new-arrivals",
        title: "New Arrivals",
        description: "Freshly approved products added to the marketplace.",
        href: "/search?sort=newest",
        products: [],
        promoTone: "orange",
        surface: "new",
      },
      {
        id: "nearby-products",
        title: "Nearby Products",
        description: "Products from stores matched to your selected location.",
        href: "/stores",
        products: [],
        promoTone: "orange",
        surface: "nearby",
      },
    ];
  }

  const allProducts = uniqueProducts([
    ...home.productRails.deals,
    ...home.productRails.featured,
    ...home.productRails.latest,
  ]);
  const todayDeals = uniqueProducts(home.productRails.deals).slice(0, 10);
  const dealSection = findSection(home.homepageSections, "deal_strip");
  const dealConfig = dealSection?.config ?? null;
  const dealTitle = dealSection?.title?.trim() || "Today's Deals";
  const dealDescription =
    stringValue(dealConfig?.subtitle) ||
    stringValue(dealConfig?.description) ||
    "Live offers and limited-time marketplace prices.";
  const dealHref =
    stringValue(dealConfig?.ctaUrl) ||
    stringValue(dealConfig?.ctaHref) ||
    "/deals";
  const dealTimerEndsAt =
    stringValue(dealConfig?.timerEndsAt) ||
    stringValue(dealConfig?.endsAt) ||
    undefined;
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
      title: dealTitle,
      description: dealDescription,
      href: dealHref,
      products: todayDeals,
      promoTone: "orange",
      showWhenEmpty: Boolean(dealSection),
      surface: "deals",
      ...(dealTimerEndsAt ? { timerEndsAt: dealTimerEndsAt } : {}),
    },
    {
      id: "best-sellers",
      title: "Best Sellers",
      description: "Top featured picks from verified sellers.",
      href: "/search?sort=rating",
      products: bestSellers.length ? bestSellers : uniqueProducts(home.productRails.featured).slice(0, 10),
      promoTone: "orange",
      surface: "best",
    },
    {
      id: "new-arrivals",
      title: "New Arrivals",
      description: "Freshly approved products added to the marketplace.",
      href: "/search?sort=newest",
      products: newArrivals.length ? newArrivals : uniqueProducts(home.productRails.latest).slice(0, 10),
      promoTone: "orange",
      surface: "new",
    },
    {
      id: "nearby-products",
      title: "Nearby Products",
      description: "Products from stores matched to your selected location.",
      href: "/stores",
      products: nearbyProducts.length ? nearbyProducts : productsFromNearbyStores(allProducts, home.storesNearYou).slice(0, 10),
      promoTone: "orange",
      surface: "nearby",
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
