"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useStorefrontLocation } from "@/components/storefront/storefront-location-context";
import {
  addCartItem,
  listHomepageBanners,
  listHomepageSections,
  listCategories,
  listProducts,
  listStores,
  primaryVariant,
  type HomepageBanner,
  type HomepageSection,
  type HomepageSectionItem,
  type ProductSummary
} from "@/lib/storefront-api";
import { resolveImageSource } from "@/lib/image-url";
import {
  browsingLocationHeadline,
  browsingLocationLabel,
  browsingLocationQuery,
} from "./storefront-location-utils";
import { ProductCard } from "./product-card";
import { StorefrontImage } from "./storefront-image";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontCategoryCard } from "./storefront-category-card";
import { StorefrontStoreCard } from "./storefront-store-card";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontSkeleton,
} from "./storefront-ui";

const heroImage =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=80";

const trustStats = [
  { label: "Verified sellers", value: "Approved marketplace partners", icon: ShieldCheck },
  { label: "Local stores", value: "Browse nearby storefronts first", icon: MapPin },
  { label: "B2B quotes", value: "Bulk enquiry paths included", icon: BriefcaseBusiness },
  { label: "Secure payments", value: "Razorpay, COD and finance checks", icon: ShoppingBag }
];

export function StorefrontHomeClient() {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const storefrontLocation = useStorefrontLocation();
  const [notice, setNotice] = useState<string | null>(null);
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories
  });
  const productsQuery = useQuery({
    queryKey: ["products", "home"],
    queryFn: () => listProducts({ limit: 8 })
  });
  const bannersQuery = useQuery({
    queryKey: ["homepage-banners"],
    queryFn: listHomepageBanners
  });
  const homepageSectionsQuery = useQuery({
    queryKey: ["homepage-sections"],
    queryFn: listHomepageSections
  });
  const localStoresQuery = useQuery({
    queryKey: [
      "stores",
      "home",
      storefrontLocation.activeLocation?.countryCode ?? "",
      storefrontLocation.activeLocation?.stateCode ?? "",
      storefrontLocation.activeLocation?.cityCode ?? "",
      storefrontLocation.activeLocation?.localAreaCode ?? "",
      storefrontLocation.activeLocation?.pincode ?? ""
    ],
    queryFn: () => listStores(browsingLocationQuery(storefrontLocation.activeLocation, 4)),
    retry: false
  });
  const addMutation = useMutation({
    mutationFn: (product: ProductSummary) => {
      const variant = primaryVariant(product);
      if (!customerAuth.enabled) {
        throw new Error("Sign in before using cart actions.");
      }
      if (!variant) {
        throw new Error("This product does not have an active variant.");
      }

      return addCartItem(customerAuth.authHeaders, variant.id, 1);
    },
    onSuccess: (_cart, product) => {
      setNotice(`${product.name} added to cart.`);
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Unable to add product to cart.");
    }
  });

  return (
    <StorefrontFrame>
      <HomepageHero
        banners={bannersQuery.data ?? []}
        isLoading={bannersQuery.isLoading}
        error={bannersQuery.error}
        onRetry={() => void bannersQuery.refetch()}
        browsingLocationLabel={browsingLocationLabel(storefrontLocation.activeLocation)}
        browsingLocationHeadline={browsingLocationHeadline(storefrontLocation.activeLocation)}
        locationSource={storefrontLocation.source}
      />

      <section className="mx-auto max-w-7xl px-5 py-4 lg:px-6">
        <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-[#E8EDF2] bg-white/95 p-2.5 shadow-[0_18px_50px_rgba(22,59,92,0.06)] sm:gap-3 md:grid-cols-4">
          {trustStats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex min-h-[68px] items-center gap-2 rounded-[18px] border border-[#EEF2F6] bg-[#FCFDFE] px-3 py-3 sm:min-h-[74px] sm:gap-3 sm:px-4 sm:py-3.5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#FFF0EC] text-[#ED3500] sm:h-10 sm:w-10">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black leading-4 text-[#1F2933] sm:text-sm sm:leading-5">{label}</span>
                <span className="mt-0.5 block text-xs font-semibold leading-4 text-[#667085]">{value}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <HomepageLocalStores
        stores={localStoresQuery.data ?? []}
        isLoading={localStoresQuery.isLoading}
        error={localStoresQuery.error}
        onRetry={() => void localStoresQuery.refetch()}
        browsingLocation={storefrontLocation.activeLocation}
        locationSource={storefrontLocation.source}
      />

      <HomepageCmsSections
        sections={homepageSectionsQuery.data ?? []}
        isLoading={homepageSectionsQuery.isLoading}
        error={homepageSectionsQuery.error}
        onRetry={() => void homepageSectionsQuery.refetch()}
      />

      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-6">
        <div className="rounded-[32px] border border-[#E8EDF2] bg-white px-5 py-8 shadow-[0_24px_60px_rgba(22,59,92,0.08)] lg:px-6">
          <SectionHeading
            eyebrow="Shop by category"
            title="Start with the launch catalogue"
            description="Move from broad discovery to a live category aisle in one step."
          />
          <div className="mt-5 grid grid-cols-3 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-5">
            {categoriesQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <StorefrontSkeleton key={index} className="h-28 sm:h-36" />
              ))
            ) : categoriesQuery.data?.length ? (
              categoriesQuery.data.map((category) => (
                <StorefrontCategoryCard key={category.id} category={category} />
              ))
            ) : (
              <StorefrontEmptyState className="col-span-3 lg:col-span-full" message="No active categories found yet." />
            )}
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#E8EDF2] bg-white px-5 py-10 shadow-[0_26px_70px_rgba(22,59,92,0.08)] lg:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              eyebrow="Live products"
              title="Fresh from approved sellers"
              description="Only approved, live catalogue items surface here, with seller context kept close."
            />
            <Button asChild variant="outline">
              <Link href="/search">
                View all <ArrowRight size={16} />
              </Link>
            </Button>
          </div>

          {notice ? (
            <StorefrontNotice className="mt-5">{notice}</StorefrontNotice>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {productsQuery.isLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <StorefrontSkeleton key={index} className="h-64 sm:h-80" />
              ))
            ) : productsQuery.data?.items.length ? (
              productsQuery.data.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={(item) => addMutation.mutate(item)}
                  isAdding={addMutation.isPending}
                />
              ))
            ) : (
              <StorefrontEmptyState
                className="col-span-2 md:col-span-3 lg:col-span-full"
                message="No approved products are live yet. Approve seller products from the admin panel to populate this section."
              />
            )}
          </div>

          {!customerAuth.enabled ? (
            <div className="mt-8">
              <CustomerAuthNotice />
            </div>
          ) : null}

          {productsQuery.isError ? <StorefrontErrorPanel className="mt-6" error={productsQuery.error} onRetry={() => void productsQuery.refetch()} /> : null}
        </div>
      </section>
    </StorefrontFrame>
  );
}

const fallbackHeroBanner: HomepageBanner = {
  id: "default-homepage-hero",
  title: "Shop trusted local sellers near you",
  subtitle: "Discover approved stores, live products, and B2B buying paths in one marketplace.",
  imageUrl: heroImage,
  linkUrl: "/categories",
  eyebrow: "1HandIndia marketplace",
  ctaLabel: "Explore products",
  secondaryCtaLabel: "Browse stores",
  secondaryLinkUrl: "/stores",
  textPosition: "LEFT",
  status: "PUBLISHED",
  sortOrder: 0
};

const heroAutoplayMs = 6000;

function HomepageHero({
  banners,
  isLoading,
  error,
  onRetry,
  browsingLocationLabel,
  browsingLocationHeadline,
  locationSource
}: {
  banners: HomepageBanner[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  browsingLocationLabel: string;
  browsingLocationHeadline: string;
  locationSource: "manual" | "saved-address" | "global";
}) {
  const router = useRouter();
  const liveBanners = banners.length ? banners : [fallbackHeroBanner];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [failedHeroImages, setFailedHeroImages] = useState<Record<string, true>>({});
  const pointerStartX = useRef<number | null>(null);
  const safeActiveIndex = Math.min(activeIndex, liveBanners.length - 1);
  const activeBanner = liveBanners[safeActiveIndex] ?? fallbackHeroBanner;
  const hasManagedBanners = banners.length > 0;
  const heroLink = activeBanner.linkUrl || "/categories";
  const secondaryLink = activeBanner.secondaryLinkUrl || "";
  const primaryCtaLabel = activeBanner.ctaLabel?.trim() || "Explore now";
  const secondaryCtaLabel = activeBanner.secondaryCtaLabel?.trim();
  const heroImageSrc = activeBanner.imageUrl ?? heroImage;
  const mobileHeroImageSrc = activeBanner.mobileImageUrl || heroImageSrc;
  const desktopHeroMedia = resolveHeroMedia(heroImageSrc, failedHeroImages);
  const mobileHeroMedia = resolveHeroMedia(mobileHeroImageSrc, failedHeroImages);
  const textPosition = normalizeHeroTextPosition(activeBanner.textPosition);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, liveBanners.length - 1));
  }, [liveBanners.length]);

  useEffect(() => {
    if (isPaused || liveBanners.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % liveBanners.length);
    }, heroAutoplayMs);

    return () => window.clearInterval(timer);
  }, [isPaused, liveBanners.length]);

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + liveBanners.length) % liveBanners.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % liveBanners.length);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    router.push((query ? `/search?q=${encodeURIComponent(query)}` : "/search") as Route);
  };

  const handlePointerUp = (clientX: number) => {
    if (pointerStartX.current === null || liveBanners.length <= 1) {
      pointerStartX.current = null;
      return;
    }

    const delta = clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(delta) < 50) {
      return;
    }

    if (delta > 0) {
      showPrevious();
    } else {
      showNext();
    }
  };

  const markHeroImageFailed = (imageKey: string) => {
    setFailedHeroImages((current) => (current[imageKey] ? current : { ...current, [imageKey]: true }));
  };

  return (
    <section
      className="relative isolate mx-auto mt-5 w-[calc(100%-1.5rem)] max-w-7xl overflow-hidden rounded-[26px] border border-white/80 bg-[#102C44] text-white shadow-[0_26px_70px_rgba(22,59,92,0.16)] ring-1 ring-[#E8EDF2] sm:w-[calc(100%-3rem)] sm:rounded-[30px] lg:w-[calc(100%-4rem)]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onPointerDown={(event) => {
        pointerStartX.current = event.clientX;
      }}
      onPointerUp={(event) => handlePointerUp(event.clientX)}
      onPointerCancel={() => {
        pointerStartX.current = null;
      }}
    >
      <span className="absolute inset-0 hidden md:block">
        {desktopHeroMedia.src ? (
          <img
            key={`desktop-${activeBanner.id}-${desktopHeroMedia.key}`}
            src={desktopHeroMedia.src}
            alt={activeBanner.imageAlt || activeBanner.title}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full scale-[1.015] object-cover transition duration-[1200ms] ease-out"
            onError={() => markHeroImageFailed(desktopHeroMedia.key)}
          />
        ) : (
          <HeroFallbackVisual />
        )}
      </span>
      <span className="absolute inset-0 md:hidden">
        {mobileHeroMedia.src ? (
          <img
            key={`mobile-${activeBanner.id}-${mobileHeroMedia.key}`}
            src={mobileHeroMedia.src}
            alt={activeBanner.imageAlt || activeBanner.title}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full scale-[1.02] object-cover transition duration-[1200ms] ease-out"
            onError={() => markHeroImageFailed(mobileHeroMedia.key)}
          />
        ) : (
          <HeroFallbackVisual />
        )}
      </span>
      <div className={cn("absolute inset-0", heroOverlayClass(textPosition))} />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(0deg,rgba(8,24,39,0.82),rgba(8,24,39,0))]" />

      <div className={cn("relative mx-auto flex min-h-[430px] max-w-7xl flex-col px-5 py-6 sm:min-h-[500px] sm:px-7 sm:py-8 lg:min-h-[540px] lg:px-10", heroTextLayoutClass(textPosition))}>
        <div className={cn("my-auto w-full max-w-[650px] py-6", heroTextAlignmentClass(textPosition))}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/22 bg-white/14 px-3.5 py-2 text-xs font-black text-white backdrop-blur">
              {isLoading
                ? "Loading banner"
                : activeBanner.eyebrow || (hasManagedBanners ? "Featured now" : "Verified marketplace")}
            </span>
            <span
              title={browsingLocationLabel}
              className="rounded-full border border-white/18 bg-white/10 px-3.5 py-2 text-xs font-black text-white/84 backdrop-blur"
            >
              {locationSource === "global"
                ? "Set location"
                : `Browsing near ${browsingLocationHeadline}`}
            </span>
          </div>

          <h1 className={cn("mt-5 max-w-[11ch] text-4xl font-black leading-[1.02] sm:text-5xl lg:text-6xl", textPosition === "CENTER" ? "mx-auto" : textPosition === "RIGHT" ? "ml-auto" : "")}>
            {activeBanner.title}
          </h1>
          {activeBanner.subtitle ? (
            <p className={cn("mt-4 max-w-xl text-base font-semibold leading-7 text-white/88 sm:text-lg", textPosition === "CENTER" ? "mx-auto" : textPosition === "RIGHT" ? "ml-auto" : "")}>
              {activeBanner.subtitle}
            </p>
          ) : null}

          <div className={cn("mt-7 flex flex-wrap gap-3", textPosition === "CENTER" ? "justify-center" : textPosition === "RIGHT" ? "justify-end" : "justify-start")}>
            <HomepageItemLink
              href={heroLink}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#ED3500] px-5 text-sm font-black text-white shadow-[0_16px_38px_rgba(237,53,0,0.32)] transition hover:-translate-y-0.5 hover:bg-[#D82F00]"
            >
              {primaryCtaLabel} <ArrowRight size={18} />
            </HomepageItemLink>
            {secondaryCtaLabel ? (
              <HomepageItemLink
                href={secondaryLink || "#"}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/35 bg-white/12 px-5 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                {secondaryCtaLabel}
              </HomepageItemLink>
            ) : null}
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className={cn(
              "mt-8 flex h-14 w-full max-w-xl overflow-hidden rounded-full border border-white/28 bg-white/95 p-1.5 shadow-[0_22px_60px_rgba(0,0,0,0.2)] backdrop-blur",
              textPosition === "CENTER" ? "mx-auto" : textPosition === "RIGHT" ? "ml-auto" : "",
            )}
          >
            <label className="sr-only" htmlFor="homepage-hero-search">
              Search marketplace products
            </label>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
              <Search size={18} />
            </span>
            <input
              id="homepage-hero-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products, stores, or categories"
              className="min-w-0 flex-1 bg-transparent px-2 text-sm font-bold text-[#1F2933] outline-none placeholder:text-[#667085]"
            />
            <button
              type="submit"
              className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#163B5C] text-sm font-black text-white transition hover:bg-[#0C2238] sm:w-auto sm:px-5"
            >
              <Search size={17} className="sm:hidden" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {error ? (
            <div className="mt-5 flex w-fit flex-wrap items-center gap-3 rounded-md border border-white/25 bg-white/15 px-4 py-3 text-sm font-bold text-white">
              <span>Homepage banner feed unavailable.</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-black underline decoration-white/60 underline-offset-4"
                onClick={onRetry}
              >
                Retry <RefreshCw size={14} />
              </button>
            </div>
          ) : null}
        </div>

        {liveBanners.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={showPrevious}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-white/12 text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/22"
                aria-label="Show previous banner"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={showNext}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-white/12 text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/22"
                aria-label="Show next banner"
              >
                <ChevronRight size={20} />
              </button>
              <span className="ml-2 text-xs font-black text-white/72">
                {safeActiveIndex + 1} / {liveBanners.length}
              </span>
            </div>
            <div className="flex min-w-36 flex-1 items-center justify-end gap-2">
              {liveBanners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "h-2 rounded-full transition",
                    index === safeActiveIndex
                      ? "w-12 bg-white"
                      : "w-2 bg-white/40 hover:bg-white/65",
                  )}
                  aria-label={`Show banner ${index + 1}: ${banner.title}`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {liveBanners.length > 1 ? (
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/18">
            <div
              key={activeBanner.id}
              className="h-full origin-left bg-[#ED3500]"
              style={{
                animation: isPaused
                  ? "none"
                  : `homepageHeroProgress ${heroAutoplayMs}ms linear forwards`,
              }}
            />
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        @keyframes homepageHeroProgress {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
      `}</style>
    </section>
  );
}

function resolveHeroMedia(source: string | null | undefined, failedSources: Record<string, true>) {
  const primaryKey = source?.trim();

  if (primaryKey && !failedSources[primaryKey]) {
    return {
      key: primaryKey,
      src: resolveImageSource(primaryKey),
    };
  }

  if (!failedSources[heroImage]) {
    return {
      key: heroImage,
      src: heroImage,
    };
  }

  return {
    key: "hero-fallback",
    src: null,
  };
}

function HeroFallbackVisual() {
  return (
    <div className="h-full w-full bg-[#102C44]">
      <div className="h-full w-full bg-[linear-gradient(115deg,#163B5C_0%,#31566F_46%,#FFF0EC_100%)] opacity-95" />
    </div>
  );
}

function normalizeHeroTextPosition(value: HomepageBanner["textPosition"]) {
  return value === "CENTER" || value === "RIGHT" ? value : "LEFT";
}

function heroTextLayoutClass(position: "LEFT" | "CENTER" | "RIGHT") {
  if (position === "CENTER") {
    return "items-center";
  }

  if (position === "RIGHT") {
    return "items-end";
  }

  return "items-start";
}

function heroTextAlignmentClass(position: "LEFT" | "CENTER" | "RIGHT") {
  if (position === "CENTER") {
    return "text-center";
  }

  if (position === "RIGHT") {
    return "text-right";
  }

  return "text-left";
}

function heroOverlayClass(position: "LEFT" | "CENTER" | "RIGHT") {
  if (position === "CENTER") {
    return "bg-[linear-gradient(180deg,rgba(12,34,56,0.52),rgba(12,34,56,0.84))]";
  }

  if (position === "RIGHT") {
    return "bg-[linear-gradient(270deg,rgba(12,34,56,0.92),rgba(12,34,56,0.58),rgba(12,34,56,0.18))]";
  }

  return "bg-[linear-gradient(90deg,rgba(12,34,56,0.92),rgba(12,34,56,0.58),rgba(12,34,56,0.18))]";
}

function HomepageLocalStores({
  stores,
  isLoading,
  error,
  onRetry,
  browsingLocation,
  locationSource,
}: {
  stores: Awaited<ReturnType<typeof listStores>>;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  browsingLocation: ReturnType<typeof useStorefrontLocation>["activeLocation"];
  locationSource: ReturnType<typeof useStorefrontLocation>["source"];
}) {
  const hasDistrictLocation =
    locationSource !== "global" && Boolean(browsingLocation?.cityCode || browsingLocation?.cityName);
  const localDistrictStores = hasDistrictLocation
    ? stores.filter((store) => store.locationMatchLevel === "LOCAL_AREA" || store.locationMatchLevel === "CITY")
    : stores;
  const districtName = browsingLocationHeadline(browsingLocation);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-6">
      <div className="rounded-[32px] border border-[#E8EDF2] bg-white px-5 py-8 shadow-[0_24px_60px_rgba(22,59,92,0.08)] lg:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow="Local stores"
            title={
              browsingLocation
                ? `Stores near ${browsingLocationHeadline(browsingLocation)}`
                : "Approved stores across the marketplace"
            }
            description={
              locationSource === "global"
                ? "Choose a browsing location from the header to bring your city and nearby stores to the front."
                : `Local discovery is currently using ${browsingLocationLabel(browsingLocation)}.`
            }
          />
          <Button asChild variant="outline">
            <Link href="/stores">
              Explore stores <ArrowRight size={16} />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <StorefrontSkeleton key={index} className="h-56 sm:h-72" />
            ))
          ) : localDistrictStores.length ? (
            localDistrictStores.slice(0, 4).map((store) => (
              <StorefrontStoreCard key={store.id} store={store} variant="compact" />
            ))
          ) : hasDistrictLocation ? (
            <LocalStoresEmptyState locationName={districtName} hasBroaderStores={stores.length > 0} />
          ) : (
            <StorefrontEmptyState className="col-span-2 md:col-span-3 xl:col-span-full" message="No approved stores are available for this view yet." />
          )}
        </div>

        {error ? <StorefrontErrorPanel className="mt-6" error={error} onRetry={onRetry} /> : null}
      </div>
    </section>
  );
}

function LocalStoresEmptyState({
  locationName,
  hasBroaderStores,
}: {
  locationName: string;
  hasBroaderStores: boolean;
}) {
  return (
    <div className="rounded-[26px] border border-dashed border-[#D8E2EA] bg-[#FCFDFE] p-6 sm:col-span-2 lg:col-span-full">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF0EC] text-[#ED3500]">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-lg font-black text-[#1F2933]">
              No local stores available in {locationName}
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
              {hasBroaderStores
                ? "There are no local stores available in this district on our platform yet. You can still browse approved stores from other locations."
                : "There are no local stores available in this district on our platform yet. New approved stores will appear here after seller onboarding."}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/stores">
            Browse all stores <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function HomepageCmsSections({
  sections,
  isLoading,
  error,
  onRetry
}: {
  sections: HomepageSection[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <StorefrontSkeleton key={index} className="h-36 bg-white sm:h-44" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      {sections.map((section) => (
        <HomepageCmsSection key={section.id} section={section} />
      ))}
      {error ? (
        <section className="mx-auto max-w-7xl px-5 lg:px-6">
          <StorefrontErrorPanel className="mt-6" error={error} onRetry={onRetry} />
        </section>
      ) : null}
    </>
  );
}

function HomepageCmsSection({ section }: { section: HomepageSection }) {
  const config = section.config ?? {};
  const items = normalizeHomepageItems(config.items);
  const ctaLabel = stringValue(config.ctaLabel);
  const ctaUrl = stringValue(config.ctaUrl) || stringValue(config.ctaHref);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-6">
      <div className="rounded-[32px] border border-[#E8EDF2] bg-white px-5 py-8 shadow-[0_24px_60px_rgba(22,59,92,0.08)] lg:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow={stringValue(config.eyebrow) || humanize(section.sectionType)}
            title={section.title}
            description={stringValue(config.subtitle) || stringValue(config.description)}
          />
          {ctaLabel && ctaUrl ? (
            <HomepageItemLink href={ctaUrl} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#D8E2EA] bg-[#FCFDFE] px-4 text-sm font-black text-[#163B5C] transition hover:border-[#ED3500] hover:text-[#ED3500] sm:w-auto">
              {ctaLabel} <ArrowRight size={16} />
            </HomepageItemLink>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.length ? (
            items.map((item, index) => (
              <HomepageCmsItemCard key={`${item.linkUrl}-${item.label}-${index}`} item={item} sectionType={section.sectionType} />
            ))
          ) : (
            <StorefrontEmptyState className="col-span-2 md:col-span-3 xl:col-span-full" message="This homepage section is published but has no selected items yet." />
          )}
        </div>
      </div>
    </section>
  );
}

function HomepageCmsItemCard({ item, sectionType }: { item: NormalizedHomepageItem; sectionType: string }) {
  const hasImage = Boolean(item.imageUrl);
  const VisualIcon = homepageSectionIcon(sectionType);

  return (
    <HomepageItemLink
      href={item.linkUrl}
      className="group block h-full overflow-hidden rounded-[26px] border border-[#EEF2F6] bg-[#FCFDFE] p-4 transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-[0_24px_48px_rgba(22,59,92,0.08)] sm:p-5"
    >
      {hasImage ? (
        <span className="relative block aspect-[16/10] overflow-hidden rounded-[20px] bg-[#EAF1F7]">
          <StorefrontImage
            src={item.imageUrl}
            alt={item.label}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
            fallbackLabel={item.label}
            allowExternalRemote
            className="transition duration-500 group-hover:scale-105"
          />
        </span>
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF0EC] text-[#ED3500]">
          <VisualIcon size={20} />
        </span>
      )}

      <span className="mt-4 flex min-h-[108px] flex-col justify-between gap-3">
        <span className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <span className="min-w-0">
            <span className="block text-base font-black leading-6 text-[#1F2933] sm:text-lg">
              {item.label}
            </span>
            {item.description ? (
              <span className="mt-1 block text-sm font-semibold leading-6 text-[#667085]">
                {item.description}
              </span>
            ) : null}
          </span>
          {item.badge ? (
            <StatusBadge tone="info" className="w-fit max-w-full">
              {item.badge}
            </StatusBadge>
          ) : null}
        </span>

        <span className="inline-flex items-center gap-2 text-sm font-black text-[#163B5C] transition group-hover:text-[#ED3500]">
          Explore <ArrowRight size={15} />
        </span>
      </span>
    </HomepageItemLink>
  );
}

function homepageSectionIcon(sectionType: string) {
  switch (sectionType) {
    case "featured_categories":
      return PackageSearch;
    case "featured_products":
    case "deal_strip":
      return ShoppingBag;
    case "featured_stores":
      return Store;
    default:
      return Building2;
  }
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
        badge: stringValue(item.badge)
      };
    })
    .filter((item): item is NormalizedHomepageItem => Boolean(item));
}

function HomepageItemLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (!href || href === "#") {
    return <span className={className}>{children}</span>;
  }

  if (href.startsWith("/")) {
    return (
      <Link href={href as Route} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
