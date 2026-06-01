"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  LocateFixed,
  MapPin,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { useStorefrontLocation } from "@/components/storefront/storefront-location-context";
import {
  addCartItem,
  getStorefrontHome,
  primaryImage,
  primaryVariant,
  type CategorySummary,
  type HomepageBanner,
  type HomepageSection,
  type HomepageSectionItem,
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
import { getStorefrontStockStatus, storefrontStockBadgeClass } from "./storefront-stock-status";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontSkeleton,
} from "./storefront-ui";
import { useStorefrontWishlist } from "./use-storefront-wishlist";

export function StorefrontHomeClient() {
  const customerAuth = useCustomerAuth();
  const storefrontLocation = useStorefrontLocation();
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
    retry: false,
  });

  const home = homeQuery.data;
  const featuredProducts = home?.productRails.featured.length
    ? home.productRails.featured
    : home?.productRails.latest ?? [];
  const trendingProducts = uniqueProducts([
    ...(home?.productRails.featured ?? []),
    ...(home?.productRails.latest ?? []),
  ]).slice(0, 8);
  const dealProducts = home?.productRails.deals ?? [];
  const topCategories = home?.categories ?? [];
  const liveCategorySection = findSection(home?.homepageSections, "featured_categories");
  const featuredProductSection = findSection(home?.homepageSections, "featured_products");
  const serviceItems = normalizeHomepageItems(home?.serviceBadges?.config?.items);
  const sellerCtaConfig = home?.sellerCta?.config ?? null;

  return (
    <StorefrontFrame>
      <main className="bg-[#FFFCFB] pb-8">
        <HomepageHero
          home={home}
          isLoading={homeQuery.isLoading}
          products={featuredProducts}
          browsingLocation={storefrontLocation.activeLocation}
          locationSource={storefrontLocation.source}
        />

        {homeQuery.isError ? (
          <section className="mx-auto max-w-[1440px] px-4 pt-5 sm:px-6 lg:px-10">
            <StorefrontErrorPanel error={homeQuery.error} onRetry={() => void homeQuery.refetch()} />
          </section>
        ) : null}

        <StatsStrip home={home} isLoading={homeQuery.isLoading} />

        <div className="flex flex-col">
          <div className="hidden lg:order-1 lg:block">
            <CategoryShowcase
              categories={topCategories}
              isLoading={homeQuery.isLoading}
              title={liveCategorySection?.title || "Shop by Category"}
              description={
                stringValue(liveCategorySection?.config?.subtitle) ||
                stringValue(liveCategorySection?.config?.description) ||
                "Explore top categories"
              }
            />
          </div>

          <div className="order-1 lg:order-4">
            {dealProducts.length || homeQuery.isLoading ? (
              <DealRail
                products={dealProducts}
                isLoading={homeQuery.isLoading}
                section={findSection(home?.homepageSections, "deal_strip")}
              />
            ) : null}
          </div>

          <div className="order-2 lg:order-3">
            <ProductRailSection
              title={featuredProductSection?.title || "Trending Now"}
              description={
                stringValue(featuredProductSection?.config?.subtitle) ||
                stringValue(featuredProductSection?.config?.description) ||
                "Live products loved by marketplace shoppers"
              }
              products={trendingProducts}
              isLoading={homeQuery.isLoading}
              promoProduct={trendingProducts[0]}
              promoTone="orange"
            />
          </div>

          <div className="order-3 lg:order-2">
            <StoresNearYou
              stores={home?.storesNearYou ?? []}
              isLoading={homeQuery.isLoading}
              locationLabel={
                storefrontLocation.source === "global"
                  ? "Top rated stores"
                  : `Top rated stores in and around ${browsingLocationHeadline(storefrontLocation.activeLocation)}`
              }
            />
          </div>

          <div className="hidden lg:order-5 lg:block">
            <LiveCategories
              categories={topCategories}
              isLoading={homeQuery.isLoading}
              section={liveCategorySection}
            />
          </div>
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
  const banner = home?.banners[0] ?? null;
  const title = banner?.title?.trim() || "Discover Local Marketplace";
  const subtitle =
    banner?.subtitle?.trim() ||
    statsSentence(home?.stats) ||
    "Browse live products from approved sellers and local stores.";
  const eyebrow = banner?.eyebrow?.trim() || "Shop local, save smart";
  const ctaLabel = banner?.ctaLabel?.trim() || "Shop Now";
  const ctaHref = banner?.linkUrl?.trim() || "/categories";
  const locationText =
    locationSource === "global"
      ? "Set your location"
      : browsingLocationLabel(browsingLocation);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push((trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search") as Route);
  }

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-2 sm:px-6 lg:px-10 lg:pt-4">
      <div className="relative isolate min-h-[270px] overflow-hidden rounded-[22px] border border-[#FFE4DC] bg-[linear-gradient(104deg,#fff_0%,#fff_42%,#fff1ec_100%)] shadow-[0_18px_50px_rgba(237,53,0,0.07)] sm:rounded-[18px] lg:min-h-[540px] lg:shadow-[0_24px_80px_rgba(237,53,0,0.08)]">
        <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_18%_62%,rgba(237,53,0,0.14)_0,transparent_16%),radial-gradient(circle_at_78%_24%,rgba(237,53,0,0.10)_0,transparent_18%)]" />
        <div className="absolute right-[12%] top-8 hidden h-16 w-24 bg-[radial-gradient(#ED3500_1.2px,transparent_1.2px)] [background-size:10px_10px] opacity-25 lg:block" />

        <div className="relative grid min-h-[270px] grid-cols-[minmax(0,1fr)_minmax(118px,0.86fr)] gap-2 px-5 py-6 sm:px-8 lg:min-h-[540px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6 lg:px-16 lg:py-14">
          <div className="flex max-w-[620px] flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#FFF0EC] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#ED3500] lg:text-[11px] lg:tracking-[0.14em]">
                {isLoading ? "Loading marketplace" : eyebrow}
              </span>
              <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#163B5C] shadow-sm lg:inline-flex">
                <LocateFixed className="h-3.5 w-3.5 text-[#ED3500]" aria-hidden="true" />
                {locationText}
              </span>
            </div>

            <h1 className="mt-4 max-w-[11ch] text-[32px] font-black leading-[1.03] tracking-normal text-[#111827] sm:text-5xl lg:mt-5 lg:text-7xl">
              {splitMarketplaceTitle(title)}
            </h1>
            <p className="mt-3 max-w-[20ch] text-sm font-semibold leading-6 text-[#596276] sm:text-base sm:leading-7 lg:mt-5 lg:max-w-md">
              {subtitle}
            </p>

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
  const visualProducts = products.slice(0, 3);

  if (visualProducts.length) {
    return (
      <div className="relative flex min-w-0 items-center justify-center lg:hidden">
        <span className="absolute left-1/2 top-1/2 h-24 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ED3500]/10 blur-lg" />
        {visualProducts.map((product, index) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}` as Route}
            className={cn(
              "absolute block h-[104px] w-[86px] overflow-hidden rounded-[18px] border border-white/80 bg-white shadow-[0_16px_34px_rgba(22,59,92,0.12)]",
              index === 0 && "left-0 top-8 rotate-[-8deg]",
              index === 1 && "right-4 top-2 rotate-[8deg]",
              index === 2 && "bottom-4 right-0 rotate-[10deg]",
            )}
          >
            <StorefrontImage
              src={primaryImage(product)}
              alt={product.name}
              sizes="96px"
              fallbackLabel={product.category.name}
              allowExternalRemote
              className="object-contain p-2"
            />
          </Link>
        ))}
      </div>
    );
  }

  if (banner?.imageUrl) {
    return (
      <div className="relative min-w-0 lg:hidden">
        <StorefrontImage
          src={banner.imageUrl}
          alt={banner.imageAlt || banner.title}
          sizes="160px"
          fallbackLabel={banner.title}
          allowExternalRemote
          className="object-contain p-3"
        />
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
  const visualProducts = products.slice(0, 4);
  const hasProductCards = visualProducts.length > 0;

  return (
    <div className="relative hidden min-h-[420px] items-center justify-center lg:flex">
      <div className="absolute bottom-11 left-1/2 h-16 w-[420px] -translate-x-1/2 rounded-[50%] bg-white shadow-[0_22px_70px_rgba(22,59,92,0.16)]" />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ED3500]" />
      <div className="absolute left-[16%] top-[26%] h-16 w-16 rounded-full bg-[#ED3500]/18 blur-sm" />

      {hasProductCards ? (
        visualProducts.map((product, index) => (
          <HeroProductCard
            key={product.id}
            product={product}
            className={heroProductPosition(index)}
          />
        ))
      ) : banner?.imageUrl ? (
        <div className="relative z-10 h-[340px] w-[440px] rotate-[-3deg] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(22,59,92,0.16)]">
          <StorefrontImage
            src={banner.imageUrl}
            alt={banner.imageAlt || banner.title}
            sizes="440px"
            fallbackLabel={banner.title}
            allowExternalRemote
          />
        </div>
      ) : isLoading ? (
        <StorefrontSkeleton className="relative z-10 h-[320px] w-[420px] bg-white/70" />
      ) : null}
    </div>
  );
}

function HeroProductCard({ product, className }: { product: ProductSummary; className: string }) {
  const market = useMarket();
  const variant = primaryVariant(product);

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
      <div className="grid auto-cols-[minmax(78px,1fr)] grid-flow-col gap-0 overflow-x-auto rounded-[18px] border border-[#F1D7CF] bg-white p-3 shadow-[0_14px_42px_rgba(22,59,92,0.06)] [scrollbar-width:none] sm:grid-cols-2 lg:flex lg:min-h-[112px] lg:flex-wrap lg:items-center lg:justify-center lg:gap-y-3 lg:overflow-visible lg:px-5 lg:py-4 lg:shadow-[0_20px_60px_rgba(22,59,92,0.07)] [&::-webkit-scrollbar]:hidden">
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
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10">
      <SectionTitle title={title} description={description} href="/categories" action="View all categories" />
      <ScrollRail className="mt-4" ariaLabel="Shop by category" controls={false}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <StorefrontSkeleton key={index} className="h-[205px] w-[154px] shrink-0 rounded-[18px] bg-white" />
            ))
          : categories.slice(0, 8).map((category) => (
              <CategoryTile key={category.id} category={category} />
            ))}
      </ScrollRail>
      {!isLoading && !categories.length ? (
        <StorefrontEmptyState className="mt-5" message="No active categories are available yet." />
      ) : null}
    </section>
  );
}

function CategoryTile({ category }: { category: CategorySummary }) {
  const productCount = category._count?.products ?? 0;

  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className="group relative h-[205px] w-[154px] shrink-0 overflow-hidden rounded-[18px] border border-[#FFE6DE] bg-[#FFF1EC] p-2 shadow-[0_10px_24px_rgba(237,53,0,0.06)] outline outline-1 outline-transparent transition hover:border-[#ED3500] hover:outline-[#ED3500] hover:shadow-[0_18px_36px_rgba(237,53,0,0.10)] focus-visible:outline-[#ED3500]"
    >
      <span className="relative block h-[124px] overflow-hidden rounded-[15px] bg-[#FFF1EC]">
        <StorefrontImage
          src={category.imageUrl ?? null}
          alt={category.name}
          sizes="150px"
          fallbackLabel={category.name}
          allowExternalRemote
          className="object-contain p-2 transition duration-500 group-hover:scale-105"
        />
      </span>
      <span className="absolute inset-x-2 bottom-2 rounded-[14px] bg-white px-2.5 py-3 text-center shadow-[0_10px_22px_rgba(22,59,92,0.08)]">
        <span className="block truncate text-sm font-black leading-5 text-[#1F2933]">
          {category.name}
        </span>
        <span className="mt-0.5 block text-xs font-bold text-[#98A2B3]">
          {productCount.toLocaleString("en-IN")}{productCount > 0 ? "+" : ""} {productCount === 1 ? "product" : "products"}
        </span>
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
  products,
  isLoading,
  promoProduct,
  promoTone,
}: {
  title: string;
  description: string;
  products: ProductSummary[];
  isLoading: boolean;
  promoProduct: ProductSummary | undefined;
  promoTone: "orange" | "soft";
}) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
      <MobileSectionHeader title={title} href="/search" />
      <div className="grid items-stretch gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <PromoPanel product={promoProduct} tone={promoTone} title={title} description={description} />
        </div>
        <div className="min-w-0">
          <ScrollRail ariaLabel={title} controls={false}>
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <StorefrontSkeleton key={index} className="h-[176px] w-[112px] shrink-0 rounded-[16px] bg-white lg:h-[368px] lg:w-[188px]" />
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

function DealRail({
  products,
  isLoading,
  section,
}: {
  products: ProductSummary[];
  isLoading: boolean;
  section?: HomepageSection | null;
}) {
  const endsAt = stringValue(section?.config?.timerEndsAt) || stringValue(section?.config?.endsAt);
  const timer = useCountdownParts(endsAt);
  const title = section?.title || "Flash Sale";
  const description =
    stringValue(section?.config?.subtitle) ||
    stringValue(section?.config?.description) ||
    "Limited time offer, grab now!";
  const headline = description || title;

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
      <div className="relative overflow-visible bg-transparent lg:rounded-[28px] lg:border lg:border-[#FFF0EC] lg:bg-white lg:p-8 lg:shadow-[0_24px_70px_rgba(22,59,92,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500] lg:h-10 lg:w-10">
              <Zap className="h-5 w-5 fill-[#ED3500]" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-black tracking-normal text-[#111827] lg:hidden">{title}</span>
                <span className="hidden text-xs font-black uppercase tracking-wide text-[#ED3500] lg:block">{title}</span>
                <span className="mt-1 hidden text-xl font-black tracking-normal text-[#111827] sm:text-2xl lg:block lg:text-3xl">
                  {headline}
                </span>
              </span>
            </span>
            <HomepageItemLink href="/deals" className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-[#ED3500] lg:hidden">
              View all <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </HomepageItemLink>
          </div>

          {timer ? <DealCountdown timer={timer} /> : null}
        </div>

        <DealHeroScroller ariaLabel={title}>
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <StorefrontSkeleton key={index} className="h-[472px] w-[260px] shrink-0 rounded-[22px] bg-[#FFF8F5] sm:w-[272px] lg:w-[276px] xl:w-[292px]" />
              ))
            : products.map((product) => (
                <DealHeroProductCard
                  key={product.id}
                  product={product}
                />
              ))}
        </DealHeroScroller>
      </div>
    </section>
  );
}

function DealCountdown({ timer }: { timer: Array<{ label: string; value: string }> }) {
  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-[16px] bg-[#FFF0EC] px-4 py-2 text-[#ED3500] shadow-[0_12px_28px_rgba(237,53,0,0.08)] sm:px-5 lg:gap-3 lg:rounded-[22px] lg:py-3">
      <Clock3 className="hidden h-6 w-6 shrink-0 lg:block" aria-hidden="true" />
      {timer.map((part, index) => (
        <span key={part.label} className="flex items-start gap-2">
          <span className="text-center">
            <span className="block text-2xl font-black leading-none tracking-normal sm:text-3xl">{part.value}</span>
            <span className="mt-1 block text-[10px] font-semibold text-[#7A8496]">{shortCountdownLabel(part.label)}</span>
          </span>
          {index < timer.length - 1 ? (
            <span className="pt-0.5 text-2xl font-black leading-none text-[#ED3500] sm:text-3xl">:</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function DealHeroScroller({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);

  function scrollDeals(direction: -1 | 1) {
    railRef.current?.scrollBy({
      left: direction * Math.max((railRef.current?.clientWidth ?? 720) - 72, 304),
      behavior: "smooth",
    });
  }

  return (
    <div className="relative mt-4 lg:mt-7">
      <button
        type="button"
        aria-label="Previous deals"
        onClick={() => scrollDeals(-1)}
        className="absolute -left-5 top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500] shadow-[0_16px_38px_rgba(22,59,92,0.12)] transition hover:-translate-x-0.5 hover:border-[#ED3500] lg:grid xl:-left-7"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden="true" />
      </button>
      <div
        ref={railRef}
        aria-label={ariaLabel}
        className="flex snap-x gap-3 overflow-x-auto pb-3 pt-1 [scrollbar-width:none] lg:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Next deals"
        onClick={() => scrollDeals(1)}
        className="absolute -right-5 top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#ED3500] shadow-[0_16px_38px_rgba(22,59,92,0.12)] transition hover:translate-x-0.5 hover:border-[#ED3500] lg:grid xl:-right-7"
      >
        <ChevronRight className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );
}

function DealHeroProductCard({ product }: { product: ProductSummary }) {
  const market = useMarket();
  const customerAuth = useCustomerAuth();
  const wishlist = useStorefrontWishlist();
  const queryClient = useQueryClient();
  const [cardMessage, setCardMessage] = useState("");
  const variant = primaryVariant(product);
  const mrp = variant?.mrpPaise && variant.mrpPaise > variant.pricePaise ? variant.mrpPaise : null;
  const discount = mrp && variant ? Math.round(((mrp - variant.pricePaise) / mrp) * 100) : null;
  const stockStatus = getStorefrontStockStatus(variant?.stockQuantity);
  const dealBadge = dealBadgeLabel(product.campaignBadge, discount);
  const href = product.campaignLinkUrl?.trim() || `/products/${product.slug}`;
  const categoryLabel = product.category.name;
  const canAddToCart = Boolean(customerAuth.enabled && variant && stockStatus.isAvailable && variant.status === "ACTIVE");
  const isWishlisted = wishlist.hasWishlistProduct(product.id);
  const isWishlistPending = wishlist.isPendingProductId === product.id;
  const addMutation = useMutation({
    mutationFn: () => {
      if (!customerAuth.enabled) {
        throw new Error("Sign in before using cart actions.");
      }
      if (!variant) {
        throw new Error("This product is not available for cart.");
      }

      return addCartItem(customerAuth.authHeaders, variant.id, 1);
    },
    onSuccess: () => {
      setCardMessage("Added to cart.");
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
    },
    onError: (error) => {
      setCardMessage(error instanceof Error ? error.message : "Unable to add product.");
    },
  });

  async function handleWishlistClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCardMessage("");

    try {
      const action = await wishlist.toggleWishlist(product.id);
      setCardMessage(action === "add" ? "Saved to wishlist." : "Removed from wishlist.");
    } catch (error) {
      setCardMessage(error instanceof Error ? error.message : "Unable to update wishlist.");
    }
  }

  return (
    <article className="flex h-[308px] w-[174px] shrink-0 snap-start flex-col overflow-hidden rounded-[16px] border border-[#E8EDF2] bg-white shadow-[0_12px_28px_rgba(22,59,92,0.05)] transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-[0_20px_44px_rgba(22,59,92,0.10)] sm:h-[472px] sm:w-[272px] sm:rounded-[22px] sm:border-[#FFE0D6] lg:w-[276px] xl:w-[292px]">
      <div className="relative h-[150px] shrink-0 overflow-hidden bg-white sm:h-[184px] sm:bg-[radial-gradient(circle_at_50%_44%,rgba(237,53,0,0.10),transparent_42%),linear-gradient(135deg,#fff_0%,#FFF0EC_100%)]">
        <HomepageItemLink href={href} className="absolute inset-0 block" aria-label={`View ${product.name}`}>
          <StorefrontImage
            src={primaryImage(product)}
            alt={product.name}
            sizes="292px"
            fallbackLabel={product.category.name}
            allowExternalRemote
            className="object-contain p-4 transition duration-500 hover:scale-105 sm:p-5"
          />
        </HomepageItemLink>
        <button
          type="button"
          onClick={(event) => void handleWishlistClick(event)}
          disabled={isWishlistPending}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className={cn(
            "absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white text-[#ED3500] shadow-[0_12px_24px_rgba(22,59,92,0.12)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED3500] sm:h-10 sm:w-10",
            isWishlisted && "bg-[#FFF0EC] text-[#ED3500]",
            isWishlistPending && "cursor-wait opacity-70",
          )}
        >
          <Heart className={cn("h-4 w-4 sm:h-5 sm:w-5", isWishlisted && "fill-current")} aria-hidden="true" strokeWidth={2} />
        </button>
        {dealBadge ? (
          <span className="absolute left-3 top-3 max-w-[calc(100%-4.5rem)] truncate rounded-[8px] bg-[#ED3500] px-2.5 py-1.5 text-[10px] font-black text-white shadow-[0_12px_24px_rgba(237,53,0,0.24)] sm:bottom-3 sm:top-auto sm:rounded-full sm:px-3 sm:text-xs">
            {dealBadge}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <span className="hidden w-fit max-w-full truncate rounded-full bg-[#FFF8F5] px-2.5 py-1 text-[10px] font-black uppercase text-[#ED3500] sm:inline-flex">
          {categoryLabel}
        </span>
        <HomepageItemLink href={href} className="block sm:mt-3">
          <span className="line-clamp-2 min-h-10 text-sm font-black leading-5 tracking-normal text-[#1F2933] sm:min-h-11 sm:text-[17px] sm:leading-[22px]">
            {product.name}
          </span>
        </HomepageItemLink>
        <span className="mt-2 hidden min-w-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-normal text-[#7A8496] sm:flex">
          <Store className="h-3.5 w-3.5 shrink-0 text-[#667085]" aria-hidden="true" />
          <span className="truncate">{product.seller.storeName}</span>
          <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-[#ED3500] text-white" aria-hidden="true" />
        </span>
        <span className="mt-2 flex min-w-0 items-baseline gap-2 sm:mt-3">
          <span className="text-2xl font-black leading-none tracking-normal text-[#1F2933] sm:text-2xl sm:text-[#ED3500]">
            {variant ? market.format(variant.pricePaise) : "Price pending"}
          </span>
          {mrp ? <span className="truncate text-xs font-black text-[#7A8496] line-through sm:text-sm">{market.format(mrp)}</span> : null}
        </span>
        <span
          className={cn(
            "mt-3 inline-flex w-fit max-w-full items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-xs font-black sm:rounded-full sm:px-3",
            storefrontStockBadgeClass(stockStatus.tone),
          )}
        >
          <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{stockStatus.label}</span>
        </span>
        <div className="mt-auto hidden grid-cols-[1fr_auto] gap-2 pt-4 sm:grid">
          {customerAuth.enabled ? (
            <button
              type="button"
              disabled={!canAddToCart || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ED3500] px-4 text-sm font-black text-white shadow-[0_14px_24px_rgba(237,53,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d52f00]",
                (!canAddToCart || addMutation.isPending) && "cursor-not-allowed bg-[#F2B5A5] shadow-none hover:translate-y-0 hover:bg-[#F2B5A5]",
              )}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              {!variant ? "Unavailable" : !stockStatus.isAvailable ? "Sold out" : addMutation.isPending ? "Adding" : "Add to Cart"}
            </button>
          ) : (
            <HomepageItemLink
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ED3500] px-4 text-sm font-black text-white shadow-[0_14px_24px_rgba(237,53,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d52f00]"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Sign in
            </HomepageItemLink>
          )}
          <HomepageItemLink
            href={href}
            aria-label={`View ${product.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E8EDF2] bg-white text-[#7A8496] shadow-[0_10px_20px_rgba(22,59,92,0.06)] transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:text-[#ED3500]"
          >
            <Eye className="h-5 w-5" aria-hidden="true" />
          </HomepageItemLink>
        </div>
        {cardMessage ? <p className="mt-2 hidden min-h-4 truncate text-xs font-bold text-[#667085] sm:block">{cardMessage}</p> : <span className="mt-2 hidden min-h-4 sm:block" aria-hidden="true" />}
      </div>
    </article>
  );
}

function LiveCategories({
  categories,
  isLoading,
  section,
}: {
  categories: CategorySummary[];
  isLoading: boolean;
  section?: HomepageSection | null;
}) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10">
      <SectionTitle
        title={section?.title || "Live Categories from the Catalogue"}
        description={
          stringValue(section?.config?.subtitle) ||
          stringValue(section?.config?.description) ||
          "Real category aisles published from the admin catalogue"
        }
        href="/categories"
        action="View all categories"
      />
      <ScrollRail className="mt-5" ariaLabel="Live categories">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <StorefrontSkeleton key={index} className="h-[156px] w-[265px] shrink-0 bg-white" />
            ))
          : categories.slice(0, 8).map((category, index) => (
              <LiveCategoryCard key={category.id} category={category} highlight={index === 0} />
            ))}
      </ScrollRail>
    </section>
  );
}

function LiveCategoryCard({ category, highlight }: { category: CategorySummary; highlight?: boolean }) {
  const count = category._count?.products ?? 0;

  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className={cn(
        "group grid h-[156px] w-[265px] shrink-0 grid-cols-[1fr_112px] overflow-hidden rounded-[16px] border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(22,59,92,0.08)]",
        highlight
          ? "border-[#ED3500] bg-[#ED3500] text-white"
          : "border-[#E8EDF2] bg-white text-[#1F2933]",
      )}
    >
      <span className="flex min-w-0 flex-col justify-between">
        <span>
          <span className="line-clamp-1 text-sm font-black">{category.name}</span>
          <span className={cn("mt-1 block text-xs font-semibold", highlight ? "text-white/80" : "text-[#7A8496]")}>
            {count.toLocaleString("en-IN")} live {count === 1 ? "deal" : "deals"}
          </span>
        </span>
        <span className={cn("inline-flex items-center gap-2 text-xs font-black", highlight ? "text-white" : "text-[#ED3500]")}>
          View deals <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className="relative overflow-hidden rounded-[14px] bg-[#FFF4EF]">
        <StorefrontImage
          src={category.imageUrl ?? null}
          alt={category.name}
          sizes="112px"
          fallbackLabel={category.name}
          allowExternalRemote
          className="transition duration-500 group-hover:scale-105"
        />
      </span>
    </Link>
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
        <p className={cn("text-xl font-black leading-none", tone === "orange" ? "text-white" : "text-[#ED3500]")}>
          {title}
        </p>
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
  const mrp = variant?.mrpPaise && variant.mrpPaise > variant.pricePaise ? variant.mrpPaise : null;
  const discount = mrp && variant ? Math.round(((mrp - variant.pricePaise) / mrp) * 100) : null;
  const stockStatus = getStorefrontStockStatus(variant?.stockQuantity);
  const campaignBadge = product.campaignBadge?.trim();
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
        "group flex h-[176px] w-[112px] shrink-0 flex-col overflow-visible rounded-[16px] border border-transparent bg-transparent shadow-none transition lg:h-[368px] lg:w-[188px] lg:overflow-hidden lg:border lg:bg-white lg:shadow-[0_10px_24px_rgba(22,59,92,0.05)] lg:hover:border-[#ED3500] lg:hover:shadow-[0_18px_38px_rgba(22,59,92,0.09)]",
        stockStatus.tone === "danger" ? "lg:border-[#FFD1C4]" : "lg:border-[#E8EDF2]",
      )}
    >
      <div className="relative h-[100px] shrink-0 overflow-hidden rounded-full border border-[#E8EDF2] bg-white shadow-[0_10px_24px_rgba(22,59,92,0.06)] lg:h-[168px] lg:rounded-none lg:border-0 lg:bg-[#FFF8F5] lg:shadow-none">
        <Link href={`/products/${product.slug}` as Route} className="absolute inset-0 block">
          {campaignBadge ? (
            <span className="absolute left-3 top-3 z-10 hidden max-w-[120px] truncate rounded-full bg-[#ED3500] px-2.5 py-1 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(237,53,0,0.20)] lg:block">
              {campaignBadge}
            </span>
          ) : null}
          <StorefrontImage
            src={primaryImage(product)}
            alt={product.name}
            sizes="188px"
            fallbackLabel={product.category.name}
            allowExternalRemote
            className="object-contain p-3 transition duration-500 group-hover:scale-105 lg:p-5"
          />
        </Link>
        <button
          type="button"
          onClick={(event) => void handleWishlistClick(event)}
          disabled={isWishlistPending}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className={cn(
            "absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-[#ED3500] shadow-[0_8px_18px_rgba(22,59,92,0.10)] transition lg:right-3 lg:top-3",
            isWishlisted && "bg-[#FFF0EC]",
            isWishlistPending && "cursor-wait opacity-70",
          )}
        >
          <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} aria-hidden="true" strokeWidth={2} />
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-1 pb-0 pt-2 text-center lg:px-4 lg:pb-6 lg:pt-3 lg:text-left">
        <Link href={`/products/${product.slug}` as Route} className="line-clamp-2 min-h-9 text-sm font-black leading-[18px] text-[#1F2933] lg:min-h-10 lg:leading-5">
          {product.name}
        </Link>
        <p className="mt-1 hidden line-clamp-1 text-[11px] font-bold text-[#98A2B3] lg:block">{product.seller.storeName}</p>
        <div className="mt-2 flex min-w-0 items-baseline gap-2">
          <span className="mx-auto text-sm font-black text-[#1F2933] lg:mx-0 lg:text-base">
            {variant ? market.format(variant.pricePaise) : "Price pending"}
          </span>
          {mrp ? <span className="hidden truncate text-xs font-semibold text-[#98A2B3] line-through lg:inline">{market.format(mrp)}</span> : null}
        </div>
        {discount ? (
          <span className="mt-1 hidden w-fit rounded bg-[#FFF0EC] px-2 py-0.5 text-[10px] font-black text-[#ED3500] lg:inline-flex">
            {discount}% OFF
          </span>
        ) : null}
        <span
          className={cn(
            "mt-auto hidden w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black lg:inline-flex",
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
    <div className={cn("relative", className)}>
      <div
        aria-label={ariaLabel}
        className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function shortCountdownLabel(label: string) {
  if (label === "Hours") {
    return "Hrs";
  }

  if (label === "Mins") {
    return "Mins";
  }

  if (label === "Secs") {
    return "Secs";
  }

  return label;
}

function dealBadgeLabel(value: unknown, discount: number | null) {
  const badge = stringValue(value);

  if (badge) {
    const numericBadge = badge.match(/^(\d+(?:\.\d+)?)%?$/);
    return numericBadge ? `${numericBadge[1]}% OFF` : badge;
  }

  return discount ? `${discount}% OFF` : "";
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

function useCountdownParts(value: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!value) {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [value]);

  return useMemo(() => buildStaticCountdown(value, now), [now, value]);
}

function buildStaticCountdown(value: string, now = Date.now()) {
  if (!value) {
    return null;
  }
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  const delta = Math.max(0, target.getTime() - now);
  const hours = Math.floor(delta / 3_600_000);
  const minutes = Math.floor((delta % 3_600_000) / 60_000);
  const seconds = Math.floor((delta % 60_000) / 1000);

  return [
    { label: "Hours", value: String(hours).padStart(2, "0") },
    { label: "Mins", value: String(minutes).padStart(2, "0") },
    { label: "Secs", value: String(seconds).padStart(2, "0") },
  ];
}
