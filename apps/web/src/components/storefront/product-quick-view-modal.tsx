"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Heart,
  ShieldCheck,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import {
  addCartItem,
  formatMoney,
  primaryImage,
  primaryVariant,
  type ProductSummary,
} from "@/lib/storefront-api";
import { StorefrontImage } from "./storefront-image";
import { getStorefrontStockStatus } from "./storefront-stock-status";
import { StorefrontNotice, StorefrontQuantityStepper } from "./storefront-ui";
import { useStorefrontWishlist } from "./use-storefront-wishlist";

type ProductQuickViewModalProps = {
  product: ProductSummary | null;
  open: boolean;
  onClose: () => void;
};

export function ProductQuickViewModal({ product, open, onClose }: ProductQuickViewModalProps) {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const wishlist = useStorefrontWishlist();
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuantity(1);
      setImageIndex(0);
      setNotice(null);
    }
  }, [open, product?.id]);

  const variant = product ? primaryVariant(product) : null;
  const listingMode = product?.listingMode ?? "CART";
  const isEnquiryOnly = listingMode === "ENQUIRY_ONLY";
  const hasStock = Boolean(variant && variant.stockQuantity > 0);
  const stockStatus = getStorefrontStockStatus(variant?.stockQuantity);
  const imageUrl = product?.images[imageIndex]?.url ?? (product ? primaryImage(product) : null);
  const mrp = variant?.mrpPaise && variant.mrpPaise > variant.pricePaise ? variant.mrpPaise : null;
  const isWishlisted = product ? wishlist.hasWishlistProduct(product.id) : false;
  const isWishlistPending = product ? wishlist.isPendingProductId === product.id : false;
  const detailHref = product ? (`/products/${product.slug}` as Route) : ("/search" as Route);

  const addMutation = useMutation({
    mutationFn: () => {
      if (!product) {
        throw new Error("Product is still loading.");
      }
      if (!customerAuth.enabled) {
        throw new Error("Sign in before using cart actions.");
      }
      if (isEnquiryOnly) {
        throw new Error("This listing is enquiry-only. Contact the seller instead of adding it to cart.");
      }
      if (!variant) {
        throw new Error("This product does not have an active variant.");
      }

      return addCartItem(customerAuth.authHeaders, variant.id, quantity);
    },
    onSuccess: () => {
      setNotice("Product added to cart.");
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Unable to add product to cart.");
    },
  });

  async function handleWishlistToggle() {
    if (!product) {
      setNotice("Product is still loading.");
      return;
    }

    try {
      const action = await wishlist.toggleWishlist(product.id);
      setNotice(action === "add" ? "Product saved to wishlist." : "Product removed from wishlist.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update wishlist.");
    }
  }

  function shiftImage(direction: -1 | 1) {
    if (!product?.images.length) {
      return;
    }

    setImageIndex((current) => (current + direction + product.images.length) % product.images.length);
  }

  if (!product) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[110]">
      <DialogBackdrop transition className="fixed inset-0 bg-[#101828]/55 transition duration-200 data-closed:opacity-0" />
      <div className="fixed inset-0 w-screen overflow-y-auto px-3 py-4 sm:px-5 sm:py-8">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="relative w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-[0_28px_90px_rgba(16,24,40,0.32)] transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#1F2933] shadow-sm backdrop-blur transition hover:border-[#ED3500] hover:text-[#ED3500] sm:right-5 sm:top-5"
              aria-label="Close quick view"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="grid max-h-[88svh] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_520px]">
              <div className="relative min-h-[320px] bg-white p-4 sm:min-h-[520px] sm:p-6">
                <div className="relative h-full min-h-[288px] overflow-hidden rounded-lg bg-[#F8FAFC] sm:min-h-[480px]">
                  <StorefrontImage
                    src={imageUrl}
                    alt={product.images[imageIndex]?.altText ?? product.name}
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="object-contain"
                    fallbackLabel={product.category.name}
                  />
                </div>

                {product.images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => shiftImage(-1)}
                      className="absolute left-6 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#163B5C] shadow-lg transition hover:text-[#ED3500]"
                      aria-label="Previous product image"
                    >
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftImage(1)}
                      className="absolute right-6 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#163B5C] shadow-lg transition hover:text-[#ED3500]"
                      aria-label="Next product image"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>

              <div className="flex flex-col p-5 sm:p-8">
                <Link
                  href={`/stores/${product.seller.slug}` as Route}
                  className="text-sm font-black text-[#667085] transition hover:text-[#163B5C]"
                >
                  {product.seller.storeName}
                </Link>
                <DialogTitle className="mt-2 pr-9 text-2xl font-black leading-tight text-[#0B1824] sm:text-4xl">
                  {product.name}
                </DialogTitle>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={isEnquiryOnly ? "warning" : stockStatus.tone}>
                    {isEnquiryOnly ? "Enquiry required" : stockStatus.label}
                  </StatusBadge>
                  <StatusBadge tone="info">{product.category.name}</StatusBadge>
                  {product.isFeatured ? <StatusBadge tone="warning">Featured</StatusBadge> : null}
                </div>

                <Description className="mt-5 line-clamp-4 text-sm font-semibold leading-7 text-[#667085]">
                  {product.description}
                </Description>

                <div className="mt-6">
                  <p className="text-3xl font-black text-[#0B1824]">
                    {variant ? market.format(variant.pricePaise) : "Price pending"}
                  </p>
                  {mrp ? (
                    <p className="mt-1 text-sm font-semibold text-[#98A2B3] line-through">{market.format(mrp)}</p>
                  ) : null}
                  {variant && market.market.currency !== variant.currency ? (
                    <p className="mt-2 text-xs font-bold text-[#667085]">
                      {formatMoney(variant.pricePaise, variant.currency)} base seller price
                    </p>
                  ) : null}
                </div>

                {variant ? (
                  <div className="mt-5 rounded-lg border border-[#E8EDF2] bg-[#FCFDFE] px-4 py-3 text-sm font-semibold text-[#667085]">
                    SKU <span className="font-black text-[#1F2933]">{variant.sku}</span>
                    {variant.variantName ? <span> / {variant.variantName}</span> : null}
                  </div>
                ) : null}

                {notice ? <StorefrontNotice className="mt-5">{notice}</StorefrontNotice> : null}

                <div className="mt-6">
                  {isEnquiryOnly ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button asChild size="lg" className="rounded-md">
                        <Link href={`/b2b/enquiries/new?productId=${encodeURIComponent(product.id)}` as Route}>
                          <FilePlus2 className="h-5 w-5" aria-hidden="true" /> Send enquiry
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="lg" className="rounded-md">
                        <Link href={`/stores/${product.seller.slug}` as Route}>
                          <Store className="h-5 w-5" aria-hidden="true" /> Contact seller
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-[154px_minmax(0,1fr)]">
                      <StorefrontQuantityStepper
                        value={quantity}
                        onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
                        onIncrease={() => setQuantity((current) => Math.min(variant?.stockQuantity ?? 99, current + 1))}
                        decreaseDisabled={quantity <= 1}
                        increaseDisabled={!variant || quantity >= variant.stockQuantity}
                        disabled={!variant || addMutation.isPending}
                        className="h-12 rounded-md"
                      />
                      <Button
                        type="button"
                        size="lg"
                        disabled={!variant || !hasStock || addMutation.isPending}
                        onClick={() => addMutation.mutate()}
                        className={cn(
                          "h-12 rounded-md bg-[#163B5C] hover:bg-[#0f2d46]",
                          (!variant || !hasStock) && "bg-[#FFF0EC] text-[#C4320A] hover:bg-[#FFF0EC] [&_svg]:text-[#C4320A]",
                        )}
                      >
                        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                        {!variant ? "Unavailable" : !hasStock ? "Sold out" : addMutation.isPending ? "Adding" : "Add to cart"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isWishlistPending}
                    onClick={() => void handleWishlistToggle()}
                    className={cn(
                      "rounded-full",
                      isWishlisted && "border-[#ED3500] bg-[#FFF0EC] text-[#9F2600] hover:bg-[#FFE5DB]",
                    )}
                  >
                    <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} aria-hidden="true" />
                    {isWishlisted ? "Saved" : "Add wishlist"}
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="rounded-full text-[#163B5C]">
                    <Link href={detailHref}>
                      Full details <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>

                <div className="mt-auto grid gap-3 border-t border-[#E5E7EB] pt-5 text-sm font-semibold text-[#667085] sm:grid-cols-2">
                  <span className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-[#163B5C]" aria-hidden="true" />
                    Verified seller page
                  </span>
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#0F8A5F]" aria-hidden="true" />
                    Moderated listing
                  </span>
                </div>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
