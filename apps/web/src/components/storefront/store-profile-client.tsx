"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Heart,
  MapPin,
  PackageCheck,
  RefreshCw,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import {
  addCartItem,
  formatMoney,
  getStoreProfile,
  listProducts,
  primaryImage,
  primaryVariant,
  type ProductSummary,
} from "@/lib/storefront-api";
import { listPublicServices, type ServiceListing } from "@/lib/service-marketplace-api";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { getStorefrontStockStatus, storefrontStockBadgeClass } from "./storefront-stock-status";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontSkeleton,
} from "./storefront-ui";
import { locationMatchLabel, sellerLocationLabel } from "./storefront-location-utils";
import { useStorefrontWishlist } from "./use-storefront-wishlist";

const brandLogoSrc = "/brand/1handindia_logo.png";
const vendorHeroVisualSrc = "/brand/vendor-page-logo.png";

export function StoreProfileClient({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const wishlist = useStorefrontWishlist();
  const [notice, setNotice] = useState<string | null>(null);

  const storeQuery = useQuery({
    queryKey: ["store-profile", slug],
    queryFn: () => getStoreProfile(slug),
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ["products", "store", storeQuery.data?.id],
    queryFn: () => listProducts({ sellerId: storeQuery.data?.id ?? "", limit: 24 }),
    enabled: Boolean(storeQuery.data?.id),
  });
  const servicesQuery = useQuery({
    queryKey: ["public-services", "store", storeQuery.data?.id],
    queryFn: () => listPublicServices({ sellerId: storeQuery.data?.id ?? "", limit: 12 }),
    enabled: Boolean(storeQuery.data?.id),
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
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to add product to cart."),
  });

  const store = storeQuery.data;
  const address = store?.addresses[0];
  const bannerUrl = store?.profile?.bannerUrl ?? null;
  const logoUrl = store?.profile?.logoUrl ?? null;
  const productCount = store?._count?.products ?? productsQuery.data?.items.length ?? 0;
  const memberSince = formatMonthYear(store?.createdAt ?? store?.profile?.createdAt);
  const storeReviewCount = store?.reviewSummary?.reviewCount ?? 0;
  const storeAverageRating = store?.reviewSummary?.averageRating ?? null;

  async function handleShareStore() {
    if (!store) {
      setNotice("Store is still loading.");
      return;
    }

    const shareUrl = `${window.location.origin}/stores/${store.slug}`;
    const location = sellerLocationLabel(address);
    const description = store.profile?.description?.trim();
    const shareText = [
      description,
      `${store.storeName} on 1HandIndia.`,
      productCount ? `${productCount.toLocaleString("en-IN")} live products.` : null,
      location !== "Location not shared" ? location : null,
    ]
      .filter(Boolean)
      .join(" ");
    const clipboardText = `${store.storeName}\n${shareText}\n${shareUrl}`;

    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: store.storeName,
            text: shareText,
            url: shareUrl,
          });
          return;
        } catch (error) {
          if (isShareAbort(error)) {
            return;
          }
          console.error("Store native share failed", error);
        }
      }

      await copyStoreShareText(clipboardText);
      setNotice("Store link copied.");
    } catch (error) {
      console.error("Store share fallback failed", error);
      setNotice("Unable to share this store right now. Please try again.");
    }
  }

  async function toggleWishlist(product: ProductSummary) {
    try {
      const action = await wishlist.toggleWishlist(product.id);
      setNotice(action === "add" ? `${product.name} saved to wishlist.` : `${product.name} removed from wishlist.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update wishlist.");
    }
  }

  return (
    <StorefrontFrame>
      <main className="min-h-[calc(100svh-69px)] bg-[#FFFCFB]">
        <section className="mx-auto max-w-7xl px-5 py-6 lg:px-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/search">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to products
            </Link>
          </Button>
        </section>

        {storeQuery.isLoading ? (
          <section className="mx-auto max-w-7xl px-5 pb-10 lg:px-6">
            <StorefrontSkeleton className="h-[420px] bg-white" />
          </section>
        ) : null}

        {store ? (
          <>
            <section className="mx-auto max-w-7xl px-5 pb-8 lg:px-6">
              <div className="overflow-hidden rounded-[26px] border border-[#FFE0D6] bg-white shadow-[0_18px_54px_rgba(22,59,92,0.08)]">
                <div className="relative isolate min-h-[250px] overflow-hidden bg-[#FFF7F3] sm:min-h-[300px] md:min-h-[340px]">
                  {bannerUrl ? (
                    <span className="absolute inset-0 -z-20 opacity-20">
                      <StorefrontImage src={bannerUrl} alt={`${store.storeName} banner`} priority sizes="100vw" fallbackLabel={store.storeName} />
                    </span>
                  ) : null}
                  <span className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_74%_18%,rgba(237,53,0,0.16),transparent_30%),linear-gradient(135deg,#FFFFFF_0%,#FFF7F3_58%,#FFF0EC_100%)]" />
                  <span className="absolute inset-0 -z-10 opacity-45 [background-image:radial-gradient(rgba(237,53,0,0.18)_1px,transparent_1px)] [background-size:18px_18px]" />

                  <div className="grid min-h-[250px] grid-cols-[48px_minmax(0,1fr)_76px] items-center gap-2 p-4 pb-12 text-[#0B1824] sm:min-h-[300px] sm:grid-cols-[88px_minmax(0,1fr)_176px] sm:gap-5 sm:p-7 sm:pb-16 md:min-h-[340px] md:grid-cols-[112px_minmax(0,1fr)_320px] md:gap-8 md:p-12 md:pb-20">
                    <span className="relative grid h-12 w-12 shrink-0 place-items-center self-center overflow-hidden rounded-full border-[3px] border-white bg-white text-base font-black text-[#163B5C] shadow-[0_14px_34px_rgba(22,59,92,0.14)] sm:h-[5.5rem] sm:w-[5.5rem] sm:border-4 sm:text-2xl md:h-28 md:w-28 md:border-[6px] md:text-3xl">
                      <StorefrontImage
                        src={logoUrl}
                        alt={`${store.storeName} logo`}
                        sizes="112px"
                        fallbackLabel={store.storeName.slice(0, 2).toUpperCase()}
                      />
                      <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-[#ED3500] text-white shadow-lg sm:h-7 sm:w-7 md:bottom-1 md:right-1 md:h-8 md:w-8">
                        <BadgeCheck className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" aria-hidden="true" />
                      </span>
                    </span>

                    <div className="min-w-0 self-center">
                      <span className="inline-flex rounded-full border border-[#FFD8CA] bg-white/80 px-2.5 py-0.5 text-[10px] font-black text-[#ED3500] sm:px-3 sm:py-1 sm:text-xs">
                        Marketplace
                      </span>
                      <h1 className="mt-2 whitespace-normal text-[16px] font-black leading-5 tracking-normal text-[#0B1824] sm:mt-4 sm:text-3xl sm:leading-tight md:text-5xl">
                        {store.storeName}
                      </h1>
                      {/* <p className="mt-2 line-clamp-2 max-w-2xl text-[11px] font-semibold leading-4 text-[#475467] sm:mt-3 sm:line-clamp-3 sm:text-sm sm:leading-6 md:text-base md:leading-7">
                        {store.profile?.description ??
                          "Approved 1HandIndia seller profile with products, store details, and customer-facing catalog."}
                      </p> */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleShareStore()}
                          className="rounded-full border-[#FFD1C4] bg-white/85 text-[#163B5C] shadow-sm hover:border-[#ED3500] hover:bg-white hover:text-[#ED3500]"
                        >
                          <Share2 className="h-4 w-4" aria-hidden="true" />
                          Share store
                        </Button>
                      </div>
                    </div>

                    <HeroLogoStand />
                  </div>
                </div>

                <div className="relative z-10 -mt-8 px-5 pb-5 md:px-8">
                  <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_18px_44px_rgba(22,59,92,0.10)]">
                    <StoreStatCard icon={ShoppingBag} label="Live products" value={productCount.toLocaleString("en-IN")} />
                    <StoreStatCard
                      icon={Star}
                      label={storeReviewCount ? `${storeReviewCount.toLocaleString("en-IN")} reviews` : "Reviews yet"}
                      value={storeReviewCount ? `${storeAverageRating?.toFixed(1)}/5` : "No"}
                      tone={storeReviewCount ? "success" : "neutral"}
                    />
                    <StoreStatCard icon={CalendarDays} label="Member since" value={memberSince ?? "New"} />
                  </div>
                </div>
              </div>
            </section>

            <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <SectionHeading title="Store products" description="Approved active products from this seller." />
                <Button type="button" variant="outline" onClick={() => void productsQuery.refetch()} disabled={productsQuery.isFetching}>
                  <RefreshCw className={cn("h-4 w-4", productsQuery.isFetching && "animate-spin")} aria-hidden="true" />
                  Refresh
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-[#667085]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EDF2] bg-white px-3 py-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#ED3500]" aria-hidden="true" />
                  {sellerLocationLabel(address)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EDF2] bg-white px-3 py-1.5">
                  <Store className="h-3.5 w-3.5 text-[#ED3500]" aria-hidden="true" />
                  {locationMatchLabel(store.locationMatchLevel)}
                </span>
              </div>

              {notice ? <StorefrontNotice className="mt-5">{notice}</StorefrontNotice> : null}

              <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-2">
                {productsQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <StorefrontSkeleton key={index} className="h-80 bg-white xl:h-56" />
                  ))
                ) : productsQuery.data?.items.length ? (
                  productsQuery.data.items.map((product) => (
                    <StoreProductTile
                      key={product.id}
                      product={product}
                      onAddToCart={(item) => addMutation.mutate(item)}
                      isAdding={addMutation.isPending}
                      isWishlisted={wishlist.hasWishlistProduct(product.id)}
                      isWishlistEnabled={wishlist.isEnabled}
                      isWishlistPending={wishlist.isPendingProductId === product.id}
                      onToggleWishlist={(item) => void toggleWishlist(item)}
                    />
                  ))
                ) : (
                  <StorefrontEmptyState className="col-span-2" message="No approved products are live for this store yet." />
                )}
              </div>

              {productsQuery.isError ? (
                <StorefrontErrorPanel className="mt-6" error={productsQuery.error} onRetry={() => void productsQuery.refetch()} />
              ) : null}

              {!customerAuth.enabled ? (
                <div className="mt-6 max-w-2xl">
                  <CustomerAuthNotice />
                </div>
              ) : null}
            </section>

            <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <SectionHeading title="Store services" description="Approved service listings from this provider." />
                <Button type="button" variant="outline" onClick={() => void servicesQuery.refetch()} disabled={servicesQuery.isFetching}>
                  <RefreshCw className={cn("h-4 w-4", servicesQuery.isFetching && "animate-spin")} aria-hidden="true" />
                  Refresh
                </Button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {servicesQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <StorefrontSkeleton key={index} className="h-64 bg-white" />)
                ) : servicesQuery.data?.items.length ? (
                  servicesQuery.data.items.map((service) => <StoreServiceTile key={service.id} service={service} />)
                ) : (
                  <StorefrontEmptyState className="sm:col-span-2 lg:col-span-3" message="No approved services are live for this store yet." />
                )}
              </div>
              {servicesQuery.isError ? (
                <StorefrontErrorPanel className="mt-6" error={servicesQuery.error} onRetry={() => void servicesQuery.refetch()} />
              ) : null}
            </section>
          </>
        ) : null}

        {storeQuery.isError ? (
          <section className="mx-auto max-w-7xl px-5 pb-12 lg:px-6">
            <StorefrontErrorPanel error={storeQuery.error} onRetry={() => void storeQuery.refetch()} />
          </section>
        ) : null}
      </main>
    </StorefrontFrame>
  );
}

function StoreServiceTile({ service }: { service: ServiceListing }) {
  const imageUrl = service.images?.find((image) => image.isPrimary)?.url ?? service.images?.[0]?.url ?? service.seller.profile?.logoUrl ?? null;
  const rating = Number(service.serviceRating ?? service.seller.serviceRating ?? 0);
  const reviewCount = service.serviceReviewCount ?? service.seller.serviceReviewCount ?? 0;

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-[0_22px_48px_rgba(22,59,92,0.10)]">
      <Link href={`/services/${service.slug}` as Route} className="relative block aspect-[4/3] overflow-hidden bg-[#FFF5F1]">
        <StorefrontImage
          src={imageUrl}
          alt={service.title}
          sizes="(max-width: 640px) 100vw, 33vw"
          fallbackLabel={service.title}
          className="transition duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EC] px-2.5 py-1 text-[10px] font-black uppercase text-[#ED3500]">
            <Wrench className="h-3.5 w-3.5" />
            {service.pricingModel.replace(/_/g, " ")}
          </span>
          {reviewCount ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-black text-[#667085]">
              <Star className="h-3.5 w-3.5 fill-[#ED3500] text-[#ED3500]" />
              {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
        <Link href={`/services/${service.slug}` as Route} className="mt-3 block">
          <h2 className="line-clamp-2 text-lg font-black leading-6 text-[#1F2933] group-hover:text-[#163B5C]">{service.title}</h2>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#667085]">{service.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[#163B5C]">
            {service.pricingModel === "QUOTE_FIRST"
              ? "Request quote"
              : formatMoney(service.basePricePaise ?? service.inspectionFeePaise ?? service.packages?.[0]?.pricePaise ?? 0, service.currency)}
          </p>
          <Button asChild size="sm">
            <Link href={`/services/${service.slug}` as Route}>Book</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function HeroLogoStand() {
  return (
    <div className="relative h-40 w-full self-stretch overflow-hidden sm:h-56 md:h-72">
      <img
        src={vendorHeroVisualSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        loading="eager"
        aria-hidden="true"
      />
    </div>
  );
}

function StoreStatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div className="flex min-h-[110px] min-w-0 flex-col items-center justify-center gap-3 px-3 py-5 text-center sm:min-h-[124px] sm:px-5">
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl border bg-[#F8FAFC]",
          tone === "success"
            ? "border-[#BFEAD9] text-[#0F8A5F]"
            : "border-[#E8EDF2] text-[#163B5C]",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>

      <span className="min-w-0 space-y-1">
        <span className={cn("block text-sm font-black leading-5 text-[#1F2933] sm:text-base", tone === "success" && "text-[#0F8A5F]")}>
          {value}
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#667085] sm:text-[11px] sm:tracking-[0.12em]">{label}</span>
      </span>
    </div>
  );
}

function StoreProductTile({
  product,
  onAddToCart,
  isAdding,
  isWishlisted,
  isWishlistEnabled,
  isWishlistPending,
  onToggleWishlist,
}: {
  product: ProductSummary;
  onAddToCart: (product: ProductSummary) => void;
  isAdding: boolean;
  isWishlisted: boolean;
  isWishlistEnabled: boolean;
  isWishlistPending: boolean;
  onToggleWishlist: (product: ProductSummary) => void;
}) {
  const market = useMarket();
  const imageUrl = primaryImage(product);
  const displayImageUrl = imageUrl || brandLogoSrc;
  const variant = primaryVariant(product);
  const hasStock = Boolean(variant && variant.stockQuantity > 0);
  const stockStatus = getStorefrontStockStatus(variant?.stockQuantity);
  const activeDeal = variant?.activeDeal ?? product.activeDeal ?? null;
  const dealOriginalPrice =
    activeDeal && variant?.originalPricePaise && variant.originalPricePaise > variant.pricePaise
      ? variant.originalPricePaise
      : null;
  const mrp = dealOriginalPrice ?? (variant?.mrpPaise && variant.mrpPaise > variant.pricePaise ? variant.mrpPaise : null);
  const href = `/products/${product.slug}` as Route;
  const reviewCount = product.reviewSummary?.reviewCount ?? 0;
  const averageRating = product.reviewSummary?.averageRating ?? null;

  function handleWishlistClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onToggleWishlist(product);
  }

  return (
    <article className="group grid min-h-full overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-[0_22px_48px_rgba(22,59,92,0.10)] xl:grid-cols-[220px_1fr]">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-[#FFF5F1] xl:aspect-auto xl:min-h-full">
        {activeDeal ? (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-[#ED3500] px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-[0_10px_20px_rgba(237,53,0,0.24)]">
            Deal
          </span>
        ) : null}
        <StorefrontImage
          src={displayImageUrl}
          alt={product.images[0]?.altText ?? product.name}
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 50vw, 260px"
          className="object-contain p-5 transition duration-500 group-hover:scale-105"
          fallbackLabel={product.category.name}
          allowExternalRemote
        />
      </Link>

      <div className="relative flex min-w-0 flex-col p-4 sm:p-5">
        {isWishlistEnabled ? (
          <button
            type="button"
            onClick={handleWishlistClick}
            disabled={isWishlistPending}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            className={cn(
              "absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-[#E8EDF2] bg-white text-[#163B5C] shadow-sm transition hover:bg-[#FFF0EC] hover:text-[#ED3500] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED3500] sm:right-4 sm:top-4 sm:h-10 sm:w-10",
              isWishlisted && "bg-[#FFF0EC] text-[#ED3500]",
              isWishlistPending && "cursor-wait opacity-70",
            )}
          >
            <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} aria-hidden="true" />
          </button>
        ) : null}

        <Link
          href={`/stores/${product.seller.slug}` as Route}
          className="flex max-w-[calc(100%-3rem)] items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#667085] hover:text-[#163B5C] sm:max-w-[calc(100%-3.5rem)] sm:gap-2 sm:text-xs"
        >
          <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{product.seller.storeName}</span>
        </Link>

        <Link href={href} className="mt-3 block max-w-[calc(100%-3rem)] sm:mt-4 sm:max-w-[calc(100%-3.5rem)]">
          <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-[#1F2933] group-hover:text-[#163B5C] sm:min-h-14 sm:text-xl sm:leading-7">
            {product.name}
          </h2>
        </Link>

        <div className="mt-2 flex min-h-5 items-center gap-1.5 text-[11px] font-black text-[#667085]">
          <Star className={cn("h-3.5 w-3.5", reviewCount ? "fill-[#ED3500] text-[#ED3500]" : "text-[#98A2B3]")} aria-hidden="true" />
          {reviewCount ? <span>{averageRating?.toFixed(1)} ({reviewCount})</span> : <span>No reviews yet</span>}
        </div>

        <span className={cn("mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black sm:gap-1.5 sm:px-3 sm:text-xs", storefrontStockBadgeClass(stockStatus.tone))}>
          <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {stockStatus.label}
        </span>

        <div className="mt-auto flex flex-col items-start gap-3 pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pt-6">
          <div>
            <p className="text-xl font-black text-[#071B35] sm:text-2xl">
              {variant ? market.format(variant.pricePaise) : "Price pending"}
            </p>
            {mrp ? <p className="text-sm font-semibold text-[#98A2B3] line-through">{market.format(mrp)}</p> : null}
            {activeDeal ? (
              <p className="mt-1 w-fit rounded bg-[#FFF0EC] px-2 py-0.5 text-[10px] font-black text-[#ED3500]">
                {activeDeal.discountBps / 100}% deal applied
              </p>
            ) : null}
            {variant && market.market.currency !== variant.currency ? (
              <p className="mt-1 text-xs font-bold text-[#667085]">{formatMoney(variant.pricePaise, variant.currency)} base</p>
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            disabled={!variant || !hasStock || isAdding}
            onClick={() => onAddToCart(product)}
            aria-label={hasStock ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
            className={cn(
              "h-10 rounded-full px-4 sm:h-11 sm:px-5",
              !hasStock && "border border-[#FFD1C4] bg-[#FFF0EC] text-[#C4320A] hover:bg-[#FFF0EC] [&_svg]:text-[#C4320A]",
            )}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {!variant ? "Unavailable" : !hasStock ? "Out of stock" : isAdding ? "Adding" : "Add"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function formatMonthYear(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(date);
}

function isShareAbort(error: unknown) {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError");
}

async function copyStoreShareText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Clipboard copy command returned false.");
    }
  } finally {
    document.body.removeChild(textArea);
  }
}
