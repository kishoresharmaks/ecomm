"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, type MouseEvent } from "react";
import { Eye, FilePlus2, Heart, PackageCheck, ShoppingCart, Star, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, cn } from "@indihub/ui";
import { useMarket } from "@/components/market/market-context";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { formatMoney, getCart, primaryImage, primaryVariant, type ProductSummary } from "@/lib/storefront-api";
import { ProductQuickViewModal } from "./product-quick-view-modal";
import { StorefrontImage } from "./storefront-image";
import { getStorefrontStockStatus, storefrontStockBadgeClass } from "./storefront-stock-status";
import { useStorefrontWishlist } from "./use-storefront-wishlist";

type ProductCardProps = {
  product: ProductSummary;
  onAddToCart?: (product: ProductSummary) => void;
  isAdding?: boolean;
};

export function ProductCard({ product, onAddToCart, isAdding = false }: ProductCardProps) {
  const market = useMarket();
  const customerAuth = useCustomerAuth();
  const wishlist = useStorefrontWishlist();
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const imageUrl = primaryImage(product);
  const variant = primaryVariant(product);
  const href = `/products/${product.slug}` as Route;
  const hasStock = Boolean(variant && variant.stockQuantity > 0);
  const stockStatus = getStorefrontStockStatus(variant?.stockQuantity);
  const deal = variant?.activeDeal ?? product.activeDeal ?? null;
  const originalDealPrice =
    variant?.originalPricePaise && variant.originalPricePaise > variant.pricePaise
      ? variant.originalPricePaise
      : null;
  const mrp =
    originalDealPrice ??
    (variant?.mrpPaise && variant.mrpPaise > variant.pricePaise ? variant.mrpPaise : null);
  const isWishlisted = wishlist.hasWishlistProduct(product.id);
  const isWishlistPending = wishlist.isPendingProductId === product.id;
  const listingMode = product.listingMode ?? "CART";
  const isEnquiryOnly = listingMode === "ENQUIRY_ONLY";
  const campaignBadge = product.campaignBadge?.trim() || (deal ? "Deal" : "");
  const reviewCount = product.reviewSummary?.reviewCount ?? 0;
  const averageRating = product.reviewSummary?.averageRating ?? null;
  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });
  const isInCart = Boolean(
    variant &&
      cartQuery.data?.items.some(
        (item) => item.productVariant.id === variant.id || item.productVariant.product.id === product.id,
      ),
  );

  async function handleWishlistClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await wishlist.toggleWishlist(product.id);
    } catch {
      // Detail pages already carry explicit notices. Cards keep this interaction quiet.
    }
  }

  function handleQuickViewClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setQuickViewOpen(true);
  }

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#E8EDF2] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-[0_24px_48px_rgba(22,59,92,0.08)] sm:rounded-[28px]">
      <div className="relative">
        <Link href={href} className="block">
          <div className="relative aspect-square overflow-hidden bg-[#FFF8F5] sm:aspect-[4/3]">
            {campaignBadge ? (
              <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-4rem)] truncate rounded-full bg-[#ED3500] px-2.5 py-1 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(237,53,0,0.20)] sm:left-3 sm:top-3">
                {campaignBadge}
              </span>
            ) : null}
            <StorefrontImage
              src={imageUrl}
              alt={product.images[0]?.altText ?? product.name}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 280px"
              className="object-contain p-4 transition duration-500 group-hover:scale-105"
              fallbackLabel={product.category.name}
            />
          </div>
        </Link>

        <div className="absolute right-2 top-2 z-10 flex flex-col rounded-full border border-white/70 bg-white/95 text-[#163B5C] shadow-[0_10px_28px_rgba(22,59,92,0.14)] backdrop-blur sm:right-3 sm:top-3">
          <button
            type="button"
            onClick={handleQuickViewClick}
            aria-label={`Quick view ${product.name}`}
            className="group/action relative grid h-8 w-8 place-items-center rounded-t-full bg-[#163B5C] text-white transition hover:bg-[#0f2d46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED3500] sm:h-10 sm:w-10"
          >
            <Eye size={17} />
            <span className="pointer-events-none absolute right-full z-20 mr-2 hidden whitespace-nowrap rounded bg-[#0B1824] px-2 py-1 text-[11px] font-black text-white shadow-lg group-hover/action:block group-focus-visible/action:block">
              Quick View
            </span>
          </button>
          {wishlist.isEnabled ? (
            <button
              type="button"
              onClick={(event) => void handleWishlistClick(event)}
              disabled={isWishlistPending}
              aria-label={
                isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`
              }
              className={cn(
                "grid h-8 w-8 place-items-center rounded-b-full border-t border-[#E8EDF2] transition hover:bg-[#FFF0EC] hover:text-[#ED3500] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED3500] sm:h-10 sm:w-10",
                isWishlisted && "bg-[#FFF0EC] text-[#ED3500]",
                isWishlistPending && "cursor-wait opacity-70",
              )}
            >
              <Heart size={17} className={cn(isWishlisted && "fill-current")} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <Link
          href={`/stores/${product.seller.slug}` as Route}
          className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-[#667085] hover:text-[#163B5C] sm:gap-2 sm:text-[11px]"
        >
          <Store size={13} className="shrink-0" />
          <span className="truncate">{product.seller.storeName}</span>
        </Link>
        <Link href={href} className="mt-1.5 block sm:mt-2">
          <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-[#1F2933] group-hover:text-[#163B5C] sm:min-h-12 sm:text-base sm:leading-6">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2 flex min-h-5 items-center gap-1.5 text-[11px] font-black text-[#667085]">
          <Star className={cn("h-3.5 w-3.5", reviewCount ? "fill-[#ED3500] text-[#ED3500]" : "text-[#98A2B3]")} aria-hidden="true" />
          {reviewCount ? (
            <span>{averageRating?.toFixed(1)} ({reviewCount})</span>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>

        <span
          className={cn(
            "mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black",
            storefrontStockBadgeClass(stockStatus.tone),
          )}
        >
          <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {stockStatus.label}
        </span>

        <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:pt-5">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#163B5C] sm:text-xl">
            {variant ? market.format(variant.pricePaise) : "Price pending"}
          </p>
            {mrp ? <p className="text-xs font-semibold text-[#98A2B3] line-through">{market.format(mrp)}</p> : null}
            {deal ? (
              <p className="mt-1 text-[11px] font-black text-[#ED3500]">
                {deal.discountBps / 100}% deal price
              </p>
            ) : null}
            {variant && market.market.currency !== variant.currency ? (
              <p className="mt-1 text-[11px] font-bold text-[#667085]">{formatMoney(variant.pricePaise, variant.currency)} base</p>
            ) : null}
          </div>
          {isEnquiryOnly ? (
            <Button asChild size="sm" variant="outline" className="h-9 w-fit rounded-full px-3">
              <Link href={href} aria-label={`Enquire about ${product.name}`}>
                <FilePlus2 size={15} />
                <span>Enquire</span>
              </Link>
            </Button>
          ) : isInCart ? (
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="h-9 w-fit rounded-full bg-[#163B5C] px-3 !text-white hover:bg-[#0f2d46] hover:!text-white [&_svg]:!text-white"
            >
              <Link href="/cart" aria-label={`View cart with ${product.name}`}>
                <ShoppingCart size={15} />
                <span>Cart</span>
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!variant || !hasStock || isAdding}
              onClick={() => onAddToCart?.(product)}
              aria-label={hasStock ? `Add ${product.name} to cart` : `${product.name} is not available for cart`}
              className={cn(
                "h-9 w-fit rounded-full px-3",
                !hasStock && "border border-[#FFD1C4] bg-[#FFF0EC] text-[#C4320A] hover:bg-[#FFF0EC] [&_svg]:text-[#C4320A]",
              )}
            >
              <ShoppingCart size={15} />
              <span>{!variant ? "Unavailable" : !hasStock ? "Out of stock" : isAdding ? "Adding" : "Add"}</span>
            </Button>
          )}
        </div>
      </div>
      <ProductQuickViewModal product={product} open={quickViewOpen} onClose={() => setQuickViewOpen(false)} />
    </article>
  );
}
