import Link from "next/link";
import type { Route } from "next";
import { Suspense, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BadgePercent,
  Grip,
  Headphones,
  Heart,
  MapPin,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  UsersRound,
  Zap,
} from "lucide-react";
import { cn } from "@indihub/ui/cn";
import {
  primaryImage,
  primaryVariant,
  variantBaseMrp,
  variantBaseOriginalPrice,
  variantBasePrice,
  type CategorySummary,
  type HomepageBanner,
  type HomepageSection,
  type HomepageSectionItem,
  type ProductSummary,
  type StoreProfile,
  type StorefrontHomePayload,
} from "@/lib/storefront-api";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { StorefrontLocationPicker } from "./storefront-location-picker";
import { getStorefrontStockStatus, storefrontStockBadgeClass } from "./storefront-stock-status";
import {
  HomeAuthNotice,
  HomeDealCountdown,
  HomeHeroCarousel,
  HomeLocationRefreshBridge,
  HomePrice,
  HomeRetryButton,
  HomeScrollableRail,
  HomeSearchForm,
  HomeWishlistButton,
  PersonalizedHomeClient,
} from "./storefront-home-client";
import {
  browsingLocationHeadline,
  browsingLocationLabel,
  type StorefrontBrowsingLocation,
} from "./storefront-location-utils";

export type StorefrontHomeDataPromise = Promise<StorefrontHomePayload | null>;

export function StorefrontHome({
  homePromise,
  serverLocation,
  serverLocationFingerprint,
}: {
  homePromise: StorefrontHomeDataPromise;
  serverLocation: StorefrontBrowsingLocation | null;
  serverLocationFingerprint: string;
}) {
  return (
    <StorefrontFrame>
      <HomeLocationRefreshBridge serverFingerprint={serverLocationFingerprint} />
      <div className="bg-[#FFFCFB] pb-8">
        <Suspense fallback={<HeroFallback />}>
          <HomeHeroSection homePromise={homePromise} serverLocation={serverLocation} />
        </Suspense>
        <Suspense fallback={<SectionFallback heightClassName="h-[300px]" />}>
          <HomeCategorySection homePromise={homePromise} />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <HomeProductRailSection homePromise={homePromise} railId="todays-deals" />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <HomeRecommendedSection homePromise={homePromise} />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <HomeProductRailSection homePromise={homePromise} railId="best-sellers" />
        </Suspense>
        <PersonalizedHomeClient />
        <Suspense fallback={<SectionFallback />}>
          <HomeProductRailSection homePromise={homePromise} railId="new-arrivals" />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <HomeProductRailSection homePromise={homePromise} railId="nearby-products" />
        </Suspense>
        <Suspense fallback={<SectionFallback heightClassName="h-[420px]" />}>
          <HomeStoresSection homePromise={homePromise} serverLocation={serverLocation} />
        </Suspense>
        <Suspense fallback={<SectionFallback heightClassName="h-[260px]" />}>
          <HomeTailSections homePromise={homePromise} />
        </Suspense>
        <HomeAuthNotice />
      </div>
    </StorefrontFrame>
  );
}

async function HomeHeroSection({
  homePromise,
  serverLocation,
}: {
  homePromise: StorefrontHomeDataPromise;
  serverLocation: StorefrontBrowsingLocation | null;
}) {
  const home = await homePromise;
  if (!home) {
    return <HomeLoadError />;
  }

  const categories = home.categories.slice(0, 8);
  const heroProducts = (
    home.productRails.featured.length
      ? home.productRails.featured
      : home.productRails.latest
  ).slice(0, 4);
  const banners = home.banners.length
    ? home.banners
    : home.fallbackHeroEnabled === false
      ? []
      : [fallbackBanner(home)];

  return (
    <>
      <MobileHomeTools categories={categories} />
      <div className="mx-auto max-w-[1440px] px-4 pt-3 sm:px-6 md:px-8 lg:px-10 xl:px-12">
        <HomeHeroCarousel>
          {banners.map((banner, index) => (
            <HeroSlide
              key={banner.id}
              banner={banner}
              products={heroProducts}
              locationLabel={browsingLocationLabel(serverLocation)}
              priority={index === 0}
            />
          ))}
        </HomeHeroCarousel>
      </div>
    </>
  );
}

function MobileHomeTools({ categories }: { categories: CategorySummary[] }) {
  return (
    <section className="mx-auto max-w-[760px] px-3 pb-1 pt-3 sm:px-4 lg:hidden">
      <div className="relative overflow-visible rounded-[16px] border border-[#FFE0D6] bg-white p-3 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
        <StorefrontLocationPicker mobile compact className="min-w-0" />
        <HomeSearchForm compact className="mt-3" inputClassName="rounded-lg bg-[#FFF9F6]" />
        <CustomerQuickActions mobile />
        <div
          className="indihub-scroll-rail mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Browse categories"
        >
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}` as Route}
              aria-label={`Shop ${category.name}`}
              title={category.name}
              className="storefront-mobile-category-card group flex shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-[16px] border border-[#FFE0D6] bg-[#FFF9F6] p-2 text-center shadow-[0_4px_12px_rgba(17,24,39,0.05)] transition active:scale-[0.97] motion-reduce:transform-none"
            >
              <span className="storefront-mobile-category-image relative shrink-0 overflow-hidden rounded-[14px] border border-[#FFF0EA] bg-white">
                <StorefrontImage
                  src={category.imageUrl?.trim() || null}
                  alt={category.name}
                  sizes="54px"
                  fallbackLabel={category.name}
                  showFallbackLabel={false}
                  allowExternalRemote
                  className="object-contain p-1.5 transition group-hover:scale-105"
                />
              </span>
              <span className="line-clamp-2 min-h-6 w-full text-[10px] font-black leading-3 text-[#111827]">
                {category.name}
              </span>
            </Link>
          ))}
          <Link
            href="/categories"
            aria-label="View all categories"
            title="All categories"
            className="storefront-mobile-category-card flex shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-[16px] border border-[#FFC8B8] bg-[#FFF2ED] p-2 text-[#ED3500] shadow-[0_4px_12px_rgba(237,53,0,0.08)] transition active:scale-[0.97] motion-reduce:transform-none"
          >
            <span className="storefront-mobile-category-image grid shrink-0 place-items-center rounded-[14px] bg-white">
              <ShoppingBag className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-h-6 text-[10px] font-black leading-3">All categories</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HeroSlide({
  banner,
  products,
  locationLabel,
  priority,
}: {
  banner: HomepageBanner;
  products: ProductSummary[];
  locationLabel: string;
  priority: boolean;
}) {
  const imageUrl = banner.imageUrl || banner.mobileImageUrl || null;
  const fallbackProduct = products.find((product) => primaryImage(product)) ?? products[0] ?? null;
  const title = banner.title?.trim() || "1HandIndia Marketplace";
  const subtitle =
    banner.subtitle?.trim() ||
    "Shop verified local stores, live deals, and everyday essentials from trusted sellers.";

  return (
    <div className="relative grid min-h-[310px] overflow-hidden rounded-[22px] border border-[#FFE4DC] bg-[linear-gradient(104deg,#fff_0%,#fff_48%,#fff1ec_100%)] px-5 py-7 shadow-[0_18px_50px_rgba(237,53,0,0.07)] sm:grid-cols-[minmax(0,1fr)_180px] sm:px-8 md:min-h-[390px] md:px-10 lg:min-h-[500px] lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1fr)] lg:px-14 lg:py-12">
      <div className="relative z-10 flex max-w-2xl flex-col justify-center">
        <div className="flex flex-wrap items-center gap-2">
          {banner.eyebrow?.trim() ? (
            <span className="rounded-full bg-[#FFF0EC] px-3 py-1.5 text-[11px] font-black uppercase text-[#ED3500]">
              {banner.eyebrow}
            </span>
          ) : null}
          <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#596276] shadow-sm lg:inline-flex">
            <MapPin className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
            {locationLabel === "All stores" ? "Set your location" : locationLabel}
          </span>
        </div>
        <h1 className="mt-4 text-[30px] font-black leading-[1.06] tracking-normal text-[#111827] sm:text-[42px] lg:text-[60px]">
          {splitMarketplaceTitle(title)}
        </h1>
        <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-[#596276] sm:text-lg sm:leading-8">
          {subtitle}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <HomepageLink
            href={banner.linkUrl?.trim() || "/categories"}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#ED3500] px-5 text-sm font-black text-white shadow-[0_16px_30px_rgba(237,53,0,0.24)]"
          >
            {banner.ctaLabel?.trim() || "Shop Now"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </HomepageLink>
          {banner.secondaryCtaLabel?.trim() && banner.secondaryLinkUrl?.trim() ? (
            <HomepageLink
              href={banner.secondaryLinkUrl}
              className="inline-flex h-12 items-center rounded-full border border-[#FFE0D6] bg-white px-5 text-sm font-black text-[#111827]"
            >
              {banner.secondaryCtaLabel}
            </HomepageLink>
          ) : null}
          <HomeSearchForm className="hidden min-w-[300px] flex-1 md:block" />
        </div>
      </div>

      <div className="relative ml-auto hidden h-full min-h-[280px] w-full items-center justify-center sm:flex">
        <div className="relative aspect-[4/3] w-full max-w-[520px] overflow-hidden rounded-[18px] border border-white bg-white/80 shadow-[0_24px_70px_rgba(22,59,92,0.14)]">
          <StorefrontImage
            src={imageUrl || (fallbackProduct ? primaryImage(fallbackProduct) : null)}
            alt={banner.imageAlt || title}
            sizes="(max-width: 1024px) 180px, 520px"
            fallbackLabel={fallbackProduct?.category.name ?? title}
            showFallbackLabel={false}
            priority={priority}
            allowExternalRemote
            className={imageUrl ? "object-cover" : "object-contain p-5"}
          />
        </div>
      </div>
    </div>
  );
}

async function HomeCategorySection({ homePromise }: { homePromise: StorefrontHomeDataPromise }) {
  const home = await homePromise;
  if (!home) {
    return null;
  }

  const section = findSection(home.homepageSections, "featured_categories");
  const title = section?.title?.trim() || "Shop by Category";
  const description =
    stringValue(section?.config?.subtitle) ||
    stringValue(section?.config?.description) ||
    "Explore popular departments across the marketplace.";

  return (
    <section className="bg-[linear-gradient(180deg,#FFFCFB_0%,#FFF8F4_100%)] py-7 sm:py-8 lg:py-11">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
        <div className="sm:hidden">
          <h2 className="text-[26px] font-black leading-8 text-[#111827]">{title}</h2>
          <p className="mt-1.5 max-w-[320px] text-sm font-semibold leading-5 text-[#7A8496]">{description}</p>
          <Link
            href="/categories"
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#FFD8CC] bg-white px-3.5 py-2 text-xs font-black text-[#ED3500] shadow-[0_4px_12px_rgba(17,24,39,0.06)]"
          >
            View all categories
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="hidden sm:block">
          <SectionHeading title={title} description={description} href="/categories" linkLabel="View all categories" />
        </div>
        {home.categories.length ? (
          <HomeScrollableRail ariaLabel="Shop by category" className="mt-5 sm:mt-6">
            {home.categories.slice(0, 10).map((category, index) => (
              <CategoryCard key={category.id} category={category} index={index} />
            ))}
          </HomeScrollableRail>
        ) : (
          <EmptyPanel message="No active categories are available yet." />
        )}
      </div>
    </section>
  );
}

function CategoryCard({ category, index }: { category: CategorySummary; index: number }) {
  const productCount = category._count?.products ?? 0;
  const accentClasses = [
    "bg-[#FFF0F4] text-[#D92D68]",
    "bg-[#F4EDFF] text-[#7C3AED]",
    "bg-[#EEF9EE] text-[#2FAE3D]",
    "bg-[#EEF6FF] text-[#2F80ED]",
  ];
  const accent = accentClasses[index % accentClasses.length] ?? accentClasses[0];

  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      aria-label={`Shop ${category.name}`}
      className="storefront-category-card group flex shrink-0 snap-start flex-col items-start rounded-[16px] border border-[#E8EDF2] bg-white p-3 shadow-[0_8px_24px_rgba(17,24,39,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-[#FFD8CC] hover:shadow-[0_14px_34px_rgba(17,24,39,0.10)] motion-reduce:transform-none sm:p-5"
    >
      <span className={cn("storefront-category-image relative grid place-items-center overflow-hidden rounded-full", accent)}>
        <StorefrontImage
          src={category.imageUrl?.trim() || null}
          alt={category.name}
          sizes="(max-width: 639px) 44px, 96px"
          fallbackLabel={category.name}
          showFallbackLabel={false}
          allowExternalRemote
          className="object-contain p-1.5 transition group-hover:scale-105 sm:p-4"
        />
      </span>
      <span className="mt-2.5 line-clamp-2 min-h-8 w-full text-left text-[12px] font-black leading-4 text-[#111827] sm:mt-5 sm:min-h-0 sm:text-xl">
        {category.name}
      </span>
      <span className="mt-auto flex w-full items-center justify-between gap-2 sm:hidden">
        <span className="truncate text-[10px] font-semibold text-[#7A8496]">Explore category</span>
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", accent)}>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className="mt-2 hidden text-sm font-semibold text-[#7A8496] sm:block">
        {productCount ? `${productCount.toLocaleString("en-IN")} products` : "Curated marketplace picks"}
      </span>
      <span className="mt-auto hidden items-center gap-2 text-sm font-black text-[#ED3500] sm:inline-flex">
        Explore <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

type HomeRailId = "todays-deals" | "best-sellers" | "new-arrivals" | "nearby-products";

async function HomeProductRailSection({
  homePromise,
  railId,
}: {
  homePromise: StorefrontHomeDataPromise;
  railId: HomeRailId;
}) {
  const home = await homePromise;
  if (!home) {
    return null;
  }
  const rail = buildProductRails(home).find((item) => item.id === railId);
  if (!rail || (!rail.products.length && !rail.showWhenEmpty)) {
    return null;
  }

  return <ProductRail rail={rail} />;
}

async function HomeRecommendedSection({ homePromise }: { homePromise: StorefrontHomeDataPromise }) {
  const home = await homePromise;
  if (!home) {
    return null;
  }
  const products = uniqueProducts([
    ...home.productRails.featured,
    ...home.productRails.deals,
    ...home.productRails.latest,
  ]).slice(0, 6);
  if (!products.length) {
    return null;
  }

  return (
    <ProductRail
      rail={{
        id: "recommended",
        title: "Recommended for you",
        description: "Fresh picks from verified sellers across the marketplace.",
        href: "/search",
        products,
        surface: "white",
        promoTitle: "Marketplace picks",
        promoBadge: "Recommended",
        promoDescription: "Fresh picks from verified sellers across the marketplace.",
        promoCtaLabel: "Explore Picks",
      }}
    />
  );
}

type HomeProductRail = {
  id: string;
  title: string;
  description: string;
  href: string;
  products: ProductSummary[];
  surface: "white" | "soft";
  promoTitle: string;
  promoBadge: string;
  promoDescription: string;
  promoCtaLabel: string;
  timerEndsAt?: string;
  showWhenEmpty?: boolean;
};

function ProductRail({ rail }: { rail: HomeProductRail }) {
  const product = rail.products[0];

  return (
    <section className={cn("py-8 lg:py-10", rail.surface === "soft" ? "bg-[#FFF8F4]" : "bg-white")}>
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
        <SectionHeading
          title={rail.title}
          description={rail.description}
          href={rail.href}
          linkLabel={`View all ${rail.title.toLowerCase()}`}
          extra={rail.timerEndsAt ? <HomeDealCountdown endsAt={rail.timerEndsAt} /> : undefined}
        />
        <div className="mt-5 min-w-0 sm:mt-6">
          <HomeScrollableRail ariaLabel={rail.title}>
            <PromoCard product={product} rail={rail} />
            {rail.products.map((item) => (
              <ProductCard key={`${rail.id}-${item.id}`} product={item} />
            ))}
          </HomeScrollableRail>
        </div>
      </div>
    </section>
  );
}

function PromoCard({ product, rail }: { product: ProductSummary | undefined; rail: HomeProductRail }) {
  const variant = product ? primaryVariant(product) : null;
  const basePrice = variant ? variantBasePrice(variant) : null;
  const baseMrp = variant ? variantBaseMrp(variant) : null;
  const originalPrice = variant ? variantBaseOriginalPrice(variant) : null;
  const mrp = originalPrice ?? (baseMrp && basePrice && baseMrp > basePrice ? baseMrp : null);

  return (
    <article className="relative flex h-[330px] w-[216px] shrink-0 snap-start flex-col overflow-hidden rounded-[16px] border border-[#D82F00] bg-[linear-gradient(145deg,#FF5A36_0%,#ED3500_48%,#D92F00_100%)] p-4 text-white shadow-[0_16px_38px_rgba(237,53,0,0.18)] sm:w-[236px] sm:p-5 lg:w-[260px]">
      <div className="flex items-start justify-between gap-3">
        <span className="w-fit rounded-full border border-white/20 bg-[#C92F0C]/55 px-2.5 py-1 text-[10px] font-black uppercase text-white">
          {rail.promoBadge}
        </span>
        <Grip className="h-5 w-5 text-white/35" aria-hidden="true" />
      </div>
      <div className="mt-3 min-h-[88px]">
        <h3 className="line-clamp-2 max-w-[190px] text-xl font-black leading-[1.08] text-white sm:text-[22px]">
          {rail.promoTitle}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-4 text-white/90 sm:text-xs">
          {rail.promoDescription}
        </p>
      </div>
      {product ? (
        <div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 rounded-[14px] border border-white/10 bg-white/15 p-2 shadow-inner">
          <span className="relative h-16 overflow-hidden rounded-[10px] border-[3px] border-white/65 bg-white">
            <StorefrontImage
              src={primaryImage(product)}
              alt={product.name}
              sizes="64px"
              fallbackLabel={product.category.name}
              showFallbackLabel={false}
              allowExternalRemote
              className="object-contain p-1"
            />
          </span>
          <span className="flex min-w-0 flex-col justify-center">
            <span className="line-clamp-2 text-xs font-black leading-4 text-white">{product.name}</span>
            <span className="mt-1.5 flex min-w-0 items-baseline gap-1.5 overflow-hidden">
              <HomePrice amountPaise={basePrice} className="block min-w-0 truncate text-sm font-black text-white" />
              {mrp ? (
                <HomePrice amountPaise={mrp} className="block max-w-12 shrink-0 truncate text-[10px] font-bold text-white/70 line-through" />
              ) : null}
            </span>
          </span>
        </div>
      ) : null}
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <HomepageLink
          href={product ? `/products/${product.slug}` : rail.href}
          className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-[11px] font-black !text-[#C4320A] shadow-[0_10px_24px_rgba(117,28,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#FFF7F3]"
        >
          <span className="truncate text-[#C4320A]">{rail.promoCtaLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </HomepageLink>
        <span className="mb-1 mr-1 h-8 w-8 shrink-0 rotate-45 border-2 border-white/25" aria-hidden="true" />
      </div>
    </article>
  );
}

function ProductCard({ product }: { product: ProductSummary }) {
  const variant = primaryVariant(product);
  const basePrice = variantBasePrice(variant);
  const baseMrp = variantBaseMrp(variant);
  const originalPrice = variantBaseOriginalPrice(variant);
  const mrp = originalPrice ?? (baseMrp && basePrice && baseMrp > basePrice ? baseMrp : null);
  const discount = mrp && basePrice ? Math.round(((mrp - basePrice) / mrp) * 100) : null;
  const stock = getStorefrontStockStatus(variant?.stockQuantity);
  const deal = variant?.activeDeal ?? product.activeDeal;
  const badge = deal ? `${deal.discountBps / 100}% DEAL` : product.campaignBadge?.trim();

  return (
    <article className="group flex h-[330px] w-[174px] shrink-0 snap-start flex-col overflow-hidden rounded-[16px] border border-[#E3E8EF] bg-white shadow-[0_8px_24px_rgba(17,24,39,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-[#FFB9A5] hover:shadow-[0_16px_36px_rgba(17,24,39,0.12)] motion-reduce:transform-none sm:w-[188px]">
      <div className="relative h-[160px] shrink-0 bg-[#FFF8F5] p-3">
        <Link href={`/products/${product.slug}` as Route} className="absolute inset-0">
          {badge ? (
            <span className="absolute left-3 top-3 z-10 max-w-[118px] truncate rounded-full bg-[#ED3500] px-2 py-1 text-[9px] font-black text-white">
              {badge}
            </span>
          ) : null}
          <span className="absolute inset-3 overflow-hidden rounded-[13px] border border-[#FFF0EA] bg-white">
            <StorefrontImage
              src={primaryImage(product)}
              alt={product.name}
              sizes="164px"
              fallbackLabel={product.category.name}
              allowExternalRemote
              className="object-contain p-2 transition group-hover:scale-105"
            />
          </span>
        </Link>
        <HomeWishlistButton productId={product.id} productName={product.name} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-3 pb-4 pt-3">
        <Link
          href={`/products/${product.slug}` as Route}
          className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-[#111827]"
        >
          {product.name}
        </Link>
        <p className="mt-1 truncate text-xs font-semibold text-[#98A2B3]">{product.seller.storeName}</p>
        <div className="mt-2 flex min-w-0 items-baseline gap-2 overflow-hidden">
          <HomePrice amountPaise={variant ? basePrice : null} className="block min-w-0 truncate font-black text-[#111827]" />
          {mrp ? <HomePrice amountPaise={mrp} className="block max-w-16 shrink-0 truncate text-xs font-semibold text-[#98A2B3] line-through" /> : null}
        </div>
        {discount ? <span className="mt-1 text-[10px] font-black text-[#ED3500]">{discount}% OFF</span> : null}
        <span className={cn("mt-auto inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black", storefrontStockBadgeClass(stock.tone))}>
          <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {stock.label}
        </span>
      </div>
    </article>
  );
}

async function HomeStoresSection({
  homePromise,
  serverLocation,
}: {
  homePromise: StorefrontHomeDataPromise;
  serverLocation: StorefrontBrowsingLocation | null;
}) {
  const home = await homePromise;
  if (!home) {
    return null;
  }
  const locationLabel = homeStoreRankingSubtitle(
    home.storeRankingMode,
    serverLocation ? browsingLocationHeadline(serverLocation) : undefined,
  );

  return (
    <section className="bg-[#FFF8F4] py-9 lg:py-12">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
        <SectionHeading title="Top Stores" description={locationLabel} href="/stores" linkLabel="View all stores" />
        {home.storesNearYou.length ? (
          <div className="mt-5 grid gap-4 sm:mt-6 sm:grid-cols-2">
            {home.storesNearYou.slice(0, 4).map((store, index) => (
              <StoreCard key={store.id} store={store} index={index} />
            ))}
          </div>
        ) : (
          <EmptyPanel message="Explore the wider marketplace while new local sellers are approved." />
        )}
      </div>
    </section>
  );
}

function StoreCard({ store, index }: { store: StoreProfile; index: number }) {
  const address = store.addresses?.[0];
  const rating = store.reviewSummary?.averageRating ?? 4.6 + (index % 3) / 10;

  return (
    <Link
      href={`/stores/${store.slug}` as Route}
      className="group grid min-h-[146px] min-w-0 grid-cols-[64px_minmax(0,1fr)_36px] items-center gap-3 overflow-hidden rounded-[18px] border border-[#E7EAF0] bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-[#FFC5B4] hover:shadow-[0_16px_36px_rgba(17,24,39,0.11)] motion-reduce:transform-none sm:min-h-[158px] sm:grid-cols-[72px_minmax(0,1fr)_40px] sm:gap-4 sm:p-5"
    >
      <span className="relative h-16 w-16 overflow-hidden rounded-full border border-[#FFE0D6] bg-[#FFF4EF] shadow-inner sm:h-[72px] sm:w-[72px]">
        <StorefrontImage
          src={store.profile?.logoUrl ?? store.profile?.bannerUrl ?? null}
          alt={`${store.storeName} logo`}
          sizes="64px"
          fallbackLabel={store.storeName}
          allowExternalRemote
          className="object-cover"
        />
      </span>
      <span className="min-w-0">
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#CDEEDB] bg-[#ECFDF3] px-2 py-1 text-[10px] font-black text-[#16803A]">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate">Verified Seller</span>
        </span>
        <span className="mt-2 block truncate text-base font-black leading-5 text-[#111827] sm:text-lg">{store.storeName}</span>
        <span className="mt-1.5 block truncate text-xs font-semibold text-[#667085] sm:text-sm">
          {(store._count?.products ?? 0).toLocaleString("en-IN")} live products · {rating.toFixed(1)} rating
        </span>
        <span className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#667085] sm:text-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#ED3500] sm:h-4 sm:w-4" aria-hidden="true" />
          <span className="truncate">
            {address ? [address.area, address.city, address.state].filter(Boolean).join(", ") : "Marketplace store"}
          </span>
        </span>
      </span>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FFF2ED] text-[#ED3500] transition group-hover:bg-[#ED3500] group-hover:text-white sm:h-10 sm:w-10">
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

async function HomeTailSections({ homePromise }: { homePromise: StorefrontHomeDataPromise }) {
  const home = await homePromise;
  if (!home) {
    return null;
  }
  const serviceItems = normalizeHomepageItems(home.serviceBadges?.config?.items);
  const customSections = standaloneHomepageSections(home.homepageSections);

  return (
    <>
      <SellerCta section={home.sellerCta ?? null} />
      <CustomerQuickActions />
      <CustomHomepageSections sections={customSections} />
      <StatsStrip home={home} />
      {serviceItems.length ? <ServiceBadges items={serviceItems} /> : null}
    </>
  );
}

function SellerCta({ section }: { section: HomepageSection | null }) {
  const config = section?.config ?? null;
  const items = normalizeHomepageItems(config?.items);

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-7 sm:px-6 lg:px-10">
      <div className="grid gap-6 rounded-lg border border-[#FFE0D6] bg-[#FFF7F3] p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] lg:items-center">
        <div>
          <h2 className="text-2xl font-black text-[#111827]">{section?.title || "Become a Seller"}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#596276]">
            {stringValue(config?.subtitle) ||
              stringValue(config?.description) ||
              "Open your verified 1HandIndia Seller Hub storefront and grow across the marketplace."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(items.length ? items : defaultSellerItems()).slice(0, 3).map((item, index) => {
            const Icon = [PackageCheck, UsersRound, ShieldCheck][index] ?? Sparkles;
            return (
              <div key={`${item.label}-${index}`} className="rounded-lg border border-white bg-white p-4 shadow-sm">
                <Icon className="h-5 w-5 text-[#ED3500]" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-[#111827]">{item.label}</p>
                {item.description ? <p className="mt-1 text-xs font-semibold leading-5 text-[#7A8496]">{item.description}</p> : null}
              </div>
            );
          })}
        </div>
        <HomepageLink
          href={stringValue(config?.ctaUrl) || stringValue(config?.ctaHref) || "/seller/register"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ED3500] px-6 text-sm font-black text-white"
        >
          {stringValue(config?.ctaLabel) || "Start Selling"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </HomepageLink>
      </div>
    </section>
  );
}

const quickActions = [
  { label: "Track order", href: "/track-order", icon: Truck, description: "Check delivery updates" },
  { label: "Reorder", href: "/account/orders", icon: RotateCcw, description: "Buy from past orders" },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart, description: "Open saved products" },
  { label: "Support", href: "/contact", icon: Headphones, description: "Get marketplace help" },
  { label: "Offers", href: "/deals", icon: BadgePercent, description: "Browse live deals" },
  { label: "Nearby stores", href: "/stores", icon: Store, description: "Discover local shops" },
] as const;

function CustomerQuickActions({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <nav
        className="indihub-scroll-rail mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden"
        aria-label="Customer quick actions"
      >
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href as Route}
            className="flex h-[74px] w-[74px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[14px] border border-[#FFE0D6] bg-[#FFF9F6] px-2 text-center text-[11px] font-black leading-3 text-[#111827] shadow-[0_4px_12px_rgba(17,24,39,0.04)] transition active:scale-[0.97] motion-reduce:transform-none"
          >
            <action.icon className="h-5 w-5 text-[#ED3500]" aria-hidden="true" />
            {action.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <section className="mx-auto hidden max-w-[1360px] px-4 py-6 sm:px-6 lg:block lg:px-10">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href as Route} className="rounded-lg border border-[#FFE0D6] bg-white p-4 shadow-sm">
            <action.icon className="h-5 w-5 text-[#ED3500]" aria-hidden="true" />
            <p className="mt-3 text-sm font-black text-[#111827]">{action.label}</p>
            <p className="mt-1 text-xs font-semibold text-[#7A8496]">{action.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CustomHomepageSections({ sections }: { sections: HomepageSection[] }) {
  return sections.map((section) => {
    const config = section.config ?? {};
    const items = normalizeHomepageItems(config.items);
    const description = stringValue(config.subtitle) || stringValue(config.description);
    if (!items.length && !description) {
      return null;
    }

    return (
      <section key={section.id} className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10">
        <div className="rounded-lg border border-[#FFE0D6] bg-white p-5 shadow-sm">
          <SectionHeading
            title={section.title || humanize(section.sectionType)}
            description={description}
            href={stringValue(config.ctaUrl) || stringValue(config.ctaHref)}
            linkLabel={stringValue(config.ctaLabel)}
          />
          {items.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.slice(0, 8).map((item, index) => (
                <HomepageLink
                  key={`${section.id}-${item.label}-${index}`}
                  href={item.linkUrl}
                  className="flex min-h-[138px] flex-col rounded-lg border border-[#E8EDF2] bg-[#FFFCFB] p-4"
                >
                  <span className="relative h-14 w-14 overflow-hidden rounded-lg bg-[#FFF0EC]">
                    <StorefrontImage
                      src={item.imageUrl}
                      alt={item.label}
                      sizes="56px"
                      fallbackLabel={item.label}
                      showFallbackLabel={false}
                      allowExternalRemote
                      className="object-contain p-2"
                    />
                  </span>
                  <span className="mt-3 font-black text-[#111827]">{item.label}</span>
                  {item.description ? <span className="mt-1 line-clamp-2 text-xs font-semibold text-[#667085]">{item.description}</span> : null}
                </HomepageLink>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  });
}

function StatsStrip({ home }: { home: StorefrontHomePayload }) {
  const items = [
    { label: "Stores", value: home.stats.approvedStores, icon: Store },
    { label: "Verified Sellers", value: home.stats.verifiedSellerPercent, suffix: "%", icon: ShieldCheck },
    { label: "Categories", value: home.stats.activeCategories, icon: ShoppingBag },
  ];

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-5 sm:px-6 lg:px-10">
      <div className="grid grid-cols-3 rounded-lg border border-[#F1D7CF] bg-white p-3 shadow-sm">
        {items.map((item) => (
          <div key={item.label} className="flex min-h-[72px] items-center justify-center gap-2 border-r border-[#FFF0EC] px-2 last:border-0">
            <item.icon className="hidden h-5 w-5 text-[#ED3500] sm:block" aria-hidden="true" />
            <span>
              <span className="block text-lg font-black text-[#ED3500]">
                {formatCompactCount(item.value)}{item.suffix ?? ""}
              </span>
              <span className="text-[10px] font-semibold text-[#596276] sm:text-xs">{item.label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServiceBadges({ items }: { items: NormalizedHomepageItem[] }) {
  const icons = [Zap, ShieldCheck, Truck, Store, BadgeCheck, ShoppingBag];
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-4 sm:px-6 lg:px-10">
      <div className="grid gap-3 border-y border-[#F1D7CF] py-4 sm:grid-cols-2 lg:grid-cols-6">
        {items.slice(0, 6).map((item, index) => {
          const Icon = icons[index] ?? Sparkles;
          return (
            <div key={`${item.label}-${index}`} className="flex items-center gap-3">
              <Icon className="h-5 w-5 shrink-0 text-[#ED3500]" aria-hidden="true" />
              <span>
                <span className="block text-xs font-black text-[#111827]">{item.label}</span>
                {item.description ? <span className="text-[11px] font-semibold text-[#7A8496]">{item.description}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  description,
  href,
  linkLabel,
  extra,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 text-[22px] font-black leading-7 tracking-normal text-[#111827] sm:text-3xl sm:leading-9">{title}</h2>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {extra}
          {href && linkLabel ? (
            <HomepageLink href={href} className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-1 text-xs font-black text-[#ED3500] sm:text-sm">
              <span className="sm:hidden">View all</span>
              <span className="hidden sm:inline">{linkLabel}</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            </HomepageLink>
          ) : null}
        </div>
      </div>
      {description ? (
        <p className="line-clamp-2 max-w-3xl text-xs font-semibold leading-5 text-[#7A8496] sm:text-sm sm:leading-6">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function HeroFallback() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-10">
      <div className="min-h-[390px] animate-pulse rounded-[22px] bg-[#FFF4EF]" />
    </section>
  );
}

function SectionFallback({ heightClassName = "h-[360px]" }: { heightClassName?: string }) {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-10">
      <div className={cn("animate-pulse rounded-lg bg-[#FFF4EF]", heightClassName)} />
    </section>
  );
}

function HomeLoadError() {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-10 text-center sm:px-6 lg:px-10">
      <div className="rounded-lg border border-[#FFE0D6] bg-white p-8">
        <h1 className="text-2xl font-black text-[#111827]">We're polishing a few things — please check back in a moment.</h1>
        <p className="mt-2 text-sm font-semibold text-[#667085]">Please retry while we reconnect to the catalogue.</p>
        <HomeRetryButton />
      </div>
    </section>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="mt-5 rounded-lg border border-[#FFE0D6] bg-white p-6 text-center text-sm font-semibold text-[#667085]">{message}</div>;
}

function HomepageLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (!href || href === "#") {
    return <span className={className}>{children}</span>;
  }
  if (href.startsWith("/")) {
    return <Link href={href as Route} className={className}>{children}</Link>;
  }
  return <a href={href} className={className} target="_blank" rel="noreferrer">{children}</a>;
}

type NormalizedHomepageItem = {
  label: string;
  description: string;
  imageUrl: string | null;
  linkUrl: string;
};

function normalizeHomepageItems(items: HomepageSectionItem[] | undefined): NormalizedHomepageItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const label = stringValue(item.label) || stringValue(item.title) || stringValue(item.name);
    if (!label) {
      return [];
    }
    return [{
      label,
      description: stringValue(item.description) || stringValue(item.subtitle),
      imageUrl: stringValue(item.imageUrl) || stringValue(item.image) || null,
      linkUrl: stringValue(item.linkUrl) || stringValue(item.href) || stringValue(item.url) || "#",
    }];
  });
}

const inlineSectionTypes = new Set([
  "featured_categories",
  "featured_products",
  "deal_strip",
  "seller_cta",
  "service_badges",
  "trust_highlights",
  "featured_stores",
]);

function standaloneHomepageSections(sections: HomepageSection[]) {
  return sections.filter((section) => !inlineSectionTypes.has(section.sectionType));
}

function findSection(sections: HomepageSection[], type: string) {
  return sections.find((section) => section.sectionType === type) ?? null;
}

function buildProductRails(home: StorefrontHomePayload): HomeProductRail[] {
  const allProducts = uniqueProducts([
    ...home.productRails.deals,
    ...home.productRails.featured,
    ...home.productRails.latest,
  ]);
  const deals = uniqueProducts(home.productRails.deals).slice(0, 6);
  const best = distinctProducts(home.productRails.featured, deals).slice(0, 6);
  const latest = distinctProducts(home.productRails.latest, [...deals, ...best]).slice(0, 6);
  const nearbySellerIds = new Set(home.storesNearYou.map((store) => store.id));
  const nearby = distinctProducts(
    allProducts.filter((product) => nearbySellerIds.has(product.sellerId) || nearbySellerIds.has(product.seller.id)),
    [...deals, ...best, ...latest],
  ).slice(0, 6);
  const dealSection = findSection(home.homepageSections, "deal_strip");
  const dealConfig = dealSection?.config ?? null;
  const timerEndsAt = stringValue(dealConfig?.timerEndsAt) || stringValue(dealConfig?.endsAt);

  return [
    {
      id: "todays-deals",
      title: dealSection?.title?.trim() || "Today's Deals",
      description: stringValue(dealConfig?.subtitle) || stringValue(dealConfig?.description) || "Live offers and limited-time marketplace prices.",
      href: stringValue(dealConfig?.ctaUrl) || stringValue(dealConfig?.ctaHref) || "/deals",
      products: deals,
      surface: "white",
      promoTitle: "Deal of the day",
      promoBadge: "Limited offer",
      promoDescription: "Live offers and limited-time marketplace prices.",
      promoCtaLabel: "Shop Deals",
      showWhenEmpty: Boolean(dealSection),
      ...(timerEndsAt ? { timerEndsAt } : {}),
    },
    {
      id: "best-sellers",
      title: "Best Sellers",
      description: "Popular products from verified marketplace sellers.",
      href: "/search?sort=rating",
      products: best.length ? best : uniqueProducts(home.productRails.featured).slice(0, 6),
      surface: "soft",
      promoTitle: "Best seller spotlight",
      promoBadge: "Buyer favourite",
      promoDescription: "Popular picks backed by buyer demand.",
      promoCtaLabel: "Shop Best Sellers",
    },
    {
      id: "new-arrivals",
      title: "New Arrivals",
      description: "Freshly approved products added to the marketplace.",
      href: "/search?sort=newest",
      products: latest.length ? latest : uniqueProducts(home.productRails.latest).slice(0, 6),
      surface: "white",
      promoTitle: "New arrival focus",
      promoBadge: "New drop",
      promoDescription: "Freshly listed products from verified sellers.",
      promoCtaLabel: "See New Picks",
    },
    {
      id: "nearby-products",
      title: "Nearby Products",
      description: "Products from stores matched to your selected location.",
      href: "/stores",
      products: nearby,
      surface: "soft",
      promoTitle: "Local store picks",
      promoBadge: "Nearby",
      promoDescription: "Products from stores matched to your selected location.",
      promoCtaLabel: "Explore Nearby",
    },
  ];
}

function distinctProducts(products: ProductSummary[], used: ProductSummary[]) {
  const usedIds = new Set(used.map((product) => product.id));
  return uniqueProducts(products).filter((product) => !usedIds.has(product.id));
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

function fallbackBanner(home: StorefrontHomePayload): HomepageBanner {
  return {
    id: "fallback-homepage-hero",
    title: "1HandIndia Marketplace",
    subtitle: statsSentence(home),
    status: "PUBLISHED",
    sortOrder: 0,
    ctaLabel: "Shop Now",
    linkUrl: "/categories",
  };
}

function statsSentence(home: StorefrontHomePayload) {
  return home.stats.liveProducts || home.stats.approvedStores
    ? `Browse ${home.stats.liveProducts.toLocaleString("en-IN")} live products from ${home.stats.approvedStores.toLocaleString("en-IN")} approved stores.`
    : "Shop verified local stores, live deals, and everyday essentials from trusted sellers.";
}

function homeStoreRankingSubtitle(
  mode: StorefrontHomePayload["storeRankingMode"],
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

function splitMarketplaceTitle(title: string) {
  const index = title.toLowerCase().indexOf("marketplace");
  if (index === -1) {
    return title;
  }
  return (
    <>
      {title.slice(0, index)}
      <span className="text-[#ED3500]">{title.slice(index)}</span>
    </>
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCompactCount(value: number) {
  if (value >= 1_000_000) {
    return `${Math.floor(value / 100_000) / 10}M+`;
  }
  if (value >= 1_000) {
    return `${Math.floor(value / 100) / 10}K+`;
  }
  return value.toLocaleString("en-IN");
}

function defaultSellerItems(): NormalizedHomepageItem[] {
  return [
    { label: "Easy registration", description: "Open your Seller Hub account.", imageUrl: null, linkUrl: "/seller/register" },
    { label: "Operational tools", description: "Manage products, orders, and finance.", imageUrl: null, linkUrl: "/seller" },
    { label: "Marketplace trust", description: "Build visibility as a verified seller.", imageUrl: null, linkUrl: "/seller/register" },
  ];
}
