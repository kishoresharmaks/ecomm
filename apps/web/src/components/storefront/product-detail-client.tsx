"use client";

import Link from "next/link";
import type { Route } from "next";
import { type ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FilePlus2,
  Headphones,
  Heart,
  Home,
  PackageCheck,
  RefreshCcw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import {
  addCartItem,
  formatMoney,
  getProduct,
  isPurchasableVariant,
  listProductReviews,
  primaryImage,
  primaryVariant,
  type PaginatedProductReviews,
  type ProductSummary,
  type ProductVariant,
} from "@/lib/storefront-api";
import { rememberRecentProduct } from "@/lib/recent-products";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { displayStorefrontAttributeValue } from "./storefront-product-attributes";
import { getStorefrontStockStatus } from "./storefront-stock-status";
import {
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontQuantityStepper,
  StorefrontSkeleton,
} from "./storefront-ui";
import { useStorefrontWishlist } from "./use-storefront-wishlist";

export function ProductDetailClient({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const wishlist = useStorefrontWishlist();

  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug),
  });
  const product = productQuery.data;
  const fallbackVariant = product ? primaryVariant(product) : null;
  const purchasableVariants = product?.variants.filter(isPurchasableVariant) ?? [];
  const selectedVariant = purchasableVariants.find((variant) => variant.id === selectedVariantId) ?? fallbackVariant;
  const galleryImages = product ? [...product.images].sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0)) : [];
  const hasGalleryThumbnails = galleryImages.length > 1;
  const selectedImage = galleryImages.find((image) => image.id === selectedImageId) ?? galleryImages.find((image) => image.isPrimary) ?? galleryImages[0] ?? null;
  const imageUrl = selectedImage?.url ?? (product ? primaryImage(product) : null);
  const hasStock = Boolean(selectedVariant && selectedVariant.stockQuantity > 0);
  const stockStatus = getStorefrontStockStatus(selectedVariant?.stockQuantity);
  const isWishlisted = product ? wishlist.hasWishlistProduct(product.id) : false;
  const isWishlistPending = product ? wishlist.isPendingProductId === product.id : false;
  const listingMode = product?.listingMode ?? "CART";
  const isEnquiryOnly = listingMode === "ENQUIRY_ONLY";
  const canAddToCart = listingMode !== "ENQUIRY_ONLY";
  const purchaseModeBadge = publicPurchaseModeLabel(listingMode);
  const specificationRows = product ? productSpecificationRows(product, selectedVariant) : [];
  const serviceHighlights = productServiceHighlights();
  const activeDeal = selectedVariant?.activeDeal ?? product?.activeDeal ?? null;
  const reviewsQuery = useQuery({
    queryKey: ["product-reviews", product?.id],
    queryFn: () => {
      if (!product) {
        throw new Error("Product is still loading.");
      }
      return listProductReviews(product.id, { limit: 5 });
    },
    enabled: Boolean(product?.id),
  });
  const reviewSummary = reviewsQuery.data?.summary ?? product?.reviewSummary ?? null;
  const reviewCount = reviewSummary?.reviewCount ?? 0;
  const averageRating = reviewSummary?.averageRating ?? null;
  const originalDealPrice =
    selectedVariant?.originalPricePaise && selectedVariant.originalPricePaise > selectedVariant.pricePaise
      ? selectedVariant.originalPricePaise
      : null;
  const discountPercent =
    activeDeal
      ? activeDeal.discountBps / 100
      : selectedVariant?.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise
      ? Math.round(((selectedVariant.mrpPaise - selectedVariant.pricePaise) / selectedVariant.mrpPaise) * 100)
      : null;

  useEffect(() => {
    if (product) {
      rememberRecentProduct(product);
    }
  }, [product]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!product) {
        throw new Error("Product is still loading.");
      }
      if (!customerAuth.enabled) {
        throw new Error("Sign in before using cart actions.");
      }
      if (product.listingMode === "ENQUIRY_ONLY") {
        throw new Error("This listing is enquiry-only. Contact the seller instead of adding it to cart.");
      }
      if (!selectedVariant) {
        throw new Error("Select an active product variant.");
      }

      return addCartItem(customerAuth.authHeaders, selectedVariant.id, quantity);
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

  async function handleShare() {
    if (!product) {
      setNotice("Product is still loading.");
      return;
    }

    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url: shareUrl });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setNotice("Product link copied.");
    } catch {
      setNotice("Unable to share this product right now.");
    }
  }

  return (
    <StorefrontFrame>
      {productQuery.isLoading ? (
        <section className="mx-auto grid max-w-[1440px] gap-4 px-4 py-6 md:grid-cols-[minmax(0,1fr)_420px] md:px-6 lg:grid-cols-[minmax(0,1fr)_560px] lg:px-10">
          <StorefrontSkeleton className="min-h-[460px] bg-white" />
          <StorefrontSkeleton className="h-96 bg-white" />
        </section>
      ) : product ? (
        <>
          <section className="mx-auto max-w-[1440px] px-4 pb-3 pt-5 md:px-6 lg:px-10">
            <div className="hidden items-center gap-2 text-sm font-semibold text-[#667085] md:flex">
              <Link href="/" className="inline-flex items-center gap-1.5 transition hover:text-[#ED3500]">
                <Home className="h-4 w-4" aria-hidden="true" /> Home
              </Link>
              <span>/</span>
              <Link href={`/categories/${product.category.slug}` as Route} className="transition hover:text-[#ED3500]">
                {product.category.name}
              </Link>
              <span>/</span>
              <span className="font-black text-[#1F2933]">{product.name}</span>
            </div>
            <Button asChild variant="ghost" size="sm" className="md:hidden">
              <Link href={(product?.category ? `/categories/${product.category.slug}` : "/search") as Route}>
                <ArrowLeft size={16} /> Back to products
              </Link>
            </Button>
          </section>

          <section className="mx-auto grid max-w-[1440px] gap-4 px-4 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(380px,520px)] md:px-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(520px,1.06fr)] lg:px-10">
            <div
              className={cn(
                "grid self-start overflow-hidden rounded-[24px] border border-[#FFE0D6] bg-white p-4 shadow-[0_24px_70px_rgba(22,59,92,0.08)] lg:rounded-[28px]",
                hasGalleryThumbnails && "md:grid-cols-[72px_minmax(0,1fr)] md:gap-4",
              )}
            >
              {hasGalleryThumbnails ? (
                <div className="order-2 mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:order-1 md:mt-0 md:max-h-[480px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pb-0 [&::-webkit-scrollbar]:hidden">
                  {galleryImages.slice(0, 6).map((image) => {
                    const selected = image.id === selectedImage?.id;

                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedImageId(image.id)}
                        className={cn(
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border bg-white shadow-sm transition md:h-[72px] md:w-[72px]",
                          selected ? "border-[#ED3500] ring-2 ring-[#ED3500]/10" : "border-[#E8EDF2] hover:border-[#ED3500]",
                        )}
                        aria-label={`Show ${image.altText ?? product.name}`}
                      >
                        <StorefrontImage
                          src={image.url}
                          alt={image.altText ?? product.name}
                          sizes="72px"
                          allowExternalRemote
                          className="object-contain p-1.5"
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="relative order-1 h-[min(112vw,520px)] min-h-[340px] overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_50%_48%,rgba(237,53,0,0.10),transparent_32%),linear-gradient(135deg,#fff_0%,#FFF4EF_100%)] md:order-2 md:h-[520px] md:min-h-0 lg:h-[clamp(430px,calc(100svh-300px),560px)]">
                {discountPercent ? (
                  <span className="absolute right-5 top-5 z-10 rounded-full bg-[#ED3500] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(237,53,0,0.24)]">
                    {activeDeal ? "Deal" : `${discountPercent}% OFF`}
                  </span>
                ) : null}
                <div className="absolute inset-5 z-0 flex items-center justify-center md:inset-7 lg:inset-9">
                  <div className="relative h-full w-full max-w-[540px]">
                    <StorefrontImage
                      src={imageUrl}
                      alt={selectedImage?.altText ?? product.images[0]?.altText ?? product.name}
                      priority
                      sizes="(max-width: 768px) 100vw, 44vw"
                      fallbackLabel={product.category.name}
                      allowExternalRemote
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#FFE0D6] bg-white p-5 shadow-[0_24px_70px_rgba(22,59,92,0.08)] md:p-6 lg:rounded-[28px]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap gap-2">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-black", isEnquiryOnly ? "bg-[#FFF7E6] text-[#B54708]" : stockStatus.tone === "danger" ? "bg-[#FFE8E1] text-[#C4320A]" : "bg-[#EAFBF2] text-[#0F8A5F]")}>
                    {isEnquiryOnly ? "Enquiry required" : stockStatus.label}
                  </span>
                  <span className="rounded-full bg-[#EAF4FF] px-3 py-1 text-xs font-black text-[#175CD3]">{product.category.name}</span>
                  {purchaseModeBadge ? (
                    <span className="rounded-full bg-[#EAFBF2] px-3 py-1 text-xs font-black text-[#0F8A5F]">{purchaseModeBadge}</span>
                  ) : null}
                  {activeDeal ? <span className="rounded-full bg-[#FFF0EC] px-3 py-1 text-xs font-black text-[#ED3500]">Deal</span> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleShare()} className="hidden rounded-full md:inline-flex">
                    <Share2 size={15} /> Share
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={!product || isWishlistPending}
                    onClick={() => void handleWishlistToggle()}
                    className={cn("h-12 w-12 rounded-full p-0", isWishlisted && "border-[#ED3500] bg-[#FFF0EC] text-[#ED3500]")}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <Heart size={18} className={cn(isWishlisted && "fill-current")} />
                  </Button>
                </div>
              </div>

              <h1 className="mt-5 text-3xl font-black leading-tight tracking-normal text-[#1F2933] md:text-4xl">{product.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#667085]">
                <span>by</span>
                <Link href={`/stores/${product.seller.slug}` as Route} className="font-black uppercase tracking-wide text-[#667085] transition hover:text-[#ED3500]">
                  {product.seller.storeName}
                </Link>
                <BadgeCheck className="h-4 w-4 shrink-0 fill-[#ED3500] text-white" aria-hidden="true" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold text-[#667085]">
                <span className="inline-flex items-center gap-1.5 text-[#ED3500]">
                  <Star className="h-4 w-4 fill-[#ED3500]" aria-hidden="true" />
                  <span className="font-black">
                    {reviewCount ? `${averageRating?.toFixed(1)} (${reviewCount} reviews)` : "No reviews yet"}
                  </span>
                </span>
                <span className="h-4 w-px bg-[#E5E7EB]" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#98A2B3]" aria-hidden="true" />
                  Approved product
                </span>
              </div>

              <div className="mt-6">
                <p className="text-sm font-bold text-[#667085]">Selected price</p>
                <div className="mt-1 flex flex-wrap items-end gap-3">
                  <span className="text-4xl font-black leading-none tracking-normal text-[#ED3500]">
                    {selectedVariant ? market.format(selectedVariant.pricePaise) : "Price pending"}
                  </span>
                  {originalDealPrice ? (
                    <span className="text-xl font-black text-[#98A2B3] line-through">
                      {market.format(originalDealPrice)}
                    </span>
                  ) : selectedVariant?.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise ? (
                    <span className="text-xl font-black text-[#98A2B3] line-through">
                      {market.format(selectedVariant.mrpPaise)}
                    </span>
                  ) : null}
                  {discountPercent ? (
                    <span className="mb-1 rounded-full bg-[#FFF0EC] px-3 py-1 text-xs font-black text-[#ED3500]">
                      {activeDeal ? `${discountPercent}% deal` : `${discountPercent}% OFF`}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-[#667085]">Inclusive of all taxes</p>
                {selectedVariant && market.market.currency !== selectedVariant.currency ? (
                  <p className="mt-2 text-xs font-bold text-[#667085]">{formatMoney(selectedVariant.pricePaise, selectedVariant.currency)} base seller price</p>
                ) : null}
              </div>

              {product.variants.length ? (
                <div className="mt-6">
                  <p className="text-sm font-black text-[#1F2933]">Variant</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.variants.map((variant) => {
                      const available = isPurchasableVariant(variant);
                      const variantStockStatus = getStorefrontStockStatus(variant.stockQuantity);
                      const label = variant.status !== "ACTIVE" ? "Unavailable" : variantStockStatus.label;

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={!available}
                          onClick={() => setSelectedVariantId(variant.id)}
                          className={cn(
                            "min-w-[92px] rounded-[14px] border px-3 py-2 text-left text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55",
                            selectedVariant?.id === variant.id
                              ? "border-[#ED3500] bg-white text-[#ED3500] shadow-[0_8px_18px_rgba(237,53,0,0.08)]"
                              : "border-[#D8E2EA] bg-white text-[#1F2933] hover:border-[#ED3500]",
                          )}
                        >
                          <span className="block">{variant.variantName ?? variant.sku}</span>
                          <span className="block text-xs font-semibold text-[#667085]">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {canAddToCart ? (
                  <>
                    <StorefrontQuantityStepper
                      className="h-11"
                      value={quantity}
                      onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
                      onIncrease={() => setQuantity((current) => Math.min(selectedVariant?.stockQuantity ?? 99, current + 1))}
                      decreaseDisabled={quantity <= 1}
                      increaseDisabled={!selectedVariant || quantity >= selectedVariant.stockQuantity}
                      disabled={!selectedVariant || !hasStock || addMutation.isPending}
                    />
                    <Button
                      type="button"
                      size="lg"
                      disabled={!selectedVariant || !hasStock || addMutation.isPending}
                      onClick={() => addMutation.mutate()}
                      className={cn(
                        "min-w-[190px] rounded-full bg-[#ED3500] shadow-[0_14px_28px_rgba(237,53,0,0.20)]",
                        (!selectedVariant || !hasStock) && "bg-[#FFF0EC] text-[#C4320A] hover:bg-[#FFF0EC] [&_svg]:text-[#C4320A]",
                      )}
                    >
                      <ShoppingCart size={18} /> {!selectedVariant ? "Unavailable" : !hasStock ? "Out of stock" : addMutation.isPending ? "Adding" : "Add to cart"}
                    </Button>
                    <Button asChild variant="outline" size="lg" className="min-w-[160px] rounded-full border-[#ED3500] text-[#ED3500] hover:bg-[#FFF0EC]">
                      <Link href="/cart">View cart</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild size="lg" className="rounded-full bg-[#ED3500]">
                      <Link href={`/b2b/enquiries/new?productId=${encodeURIComponent(product.id)}` as Route}>
                        <FilePlus2 size={18} /> Send enquiry
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="rounded-full">
                      <Link href={`/stores/${product.seller.slug}` as Route}>
                        <Store size={18} /> Contact seller
                      </Link>
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={!product || isWishlistPending}
                  onClick={() => void handleWishlistToggle()}
                  className={cn(
                    "rounded-full",
                    isWishlisted && "border-[#ED3500] bg-[#FFF0EC] text-[#9F2600] hover:bg-[#FFE5DB]",
                  )}
                >
                  <Heart size={18} className={cn(isWishlisted && "fill-current")} />
                  {isWishlistPending
                    ? wishlist.pendingAction === "remove"
                      ? "Removing"
                      : "Saving"
                    : isWishlisted
                      ? "Saved"
                      : "Wishlist"}
                </Button>
              </div>

              {notice ? <StorefrontNotice className="mt-5">{notice}</StorefrontNotice> : null}

              {!customerAuth.enabled ? (
                <div className="mt-6">
                  <CustomerAuthNotice />
                </div>
              ) : null}

              <div className="mt-6 grid grid-cols-2 gap-0 border-t border-[#E5E7EB] pt-5">
                <ProductTrustItem icon={<Store className="h-5 w-5" />} label="Sold by" value={product.seller.storeName} />
                <ProductTrustItem icon={<ShieldCheck className="h-5 w-5" />} label="Verified seller" value="Checked by 1HandIndia" />
               </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1440px] px-4 pb-4 md:px-6 lg:px-10">
            <div className="grid gap-3 rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_14px_36px_rgba(22,59,92,0.05)] md:grid-cols-3 lg:grid-cols-5">
              {serviceHighlights.map((item) => (
                <div key={item.title} className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[#E8EDF2] bg-white text-[#163B5C]">
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#1F2933]">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[#667085]">{item.description}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {(product.description || specificationRows.length) ? (
            <section className="mx-auto max-w-[1440px] px-4 pb-4 md:px-6 lg:px-10">
              <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <p className="text-base font-black text-[#1F2933]">Product details</p>
                {product.description ? (
                  <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-[#667085]">
                    {product.description}
                  </p>
                ) : specificationRows.length ? (
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
                    Helpful details shared by the seller so you can compare this item before buying.
                  </p>
                ) : null}
                {specificationRows.length ? (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {specificationRows.map((row) => (
                      <div key={`${row.scope}-${row.label}`} className="rounded-2xl bg-[#F8FAFC] px-4 py-3">
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{row.label}</dt>
                        <dd className="mt-1 text-sm font-black text-[#1F2933]">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="mx-auto max-w-[1440px] px-4 pb-4 md:px-6 lg:px-10">
            <ProductReviewsSection reviews={reviewsQuery.data} isLoading={reviewsQuery.isLoading} />
          </section>

          <section className="mx-auto max-w-[1440px] px-4 pb-14 md:px-6 lg:px-10">
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <SectionHeading
                  title="Buying support"
                  description={
                    isEnquiryOnly
                      ? "Send an enquiry and the seller will follow up with availability and next steps."
                      : listingMode === "CART_AND_ENQUIRY"
                        ? "Order online, or request a quote if you need bulk quantity or business pricing support."
                        : "Order online with secure checkout, order updates, and customer support."
                  }
                />
                <div className="grid gap-3 text-sm font-semibold text-[#667085] md:grid-cols-3 lg:flex lg:items-center">
                  <SupportPoint icon={<PackageCheck className="h-5 w-5" />} text="Track your order status from your account." />
                  <SupportPoint icon={<Heart className="h-5 w-5" />} text="Listed by a seller checked by 1HandIndia." />
                  {product && listingMode !== "CART" ? (
                    <Button asChild variant="outline" className="rounded-full border-[#ED3500] text-[#ED3500]">
                      <Link href={`/b2b/enquiries/new?productId=${encodeURIComponent(product.id)}` as Route}>
                        <FilePlus2 size={16} /> {isEnquiryOnly ? "Send enquiry" : "Request quote"}
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="rounded-full border-[#ED3500] text-[#ED3500]">
                      <Link href="/contact">
                        Contact Support <ArrowRight size={16} />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {productQuery.isError ? (
        <section className="mx-auto max-w-[1440px] px-4 pb-14 md:px-6 lg:px-10">
          <StorefrontErrorPanel error={productQuery.error} onRetry={() => void productQuery.refetch()} />
        </section>
      ) : null}
    </StorefrontFrame>
  );
}

function ProductReviewsSection({
  reviews,
  isLoading,
}: {
  reviews: PaginatedProductReviews | undefined;
  isLoading: boolean;
}) {
  const summary = reviews?.summary;
  const reviewCount = summary?.reviewCount ?? 0;
  const averageRating = summary?.averageRating ?? null;
  const items = reviews?.items ?? [];

  return (
    <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          title="Customer reviews"
          description={
            reviewCount
              ? `${averageRating?.toFixed(1)} average from ${reviewCount} customer ${reviewCount === 1 ? "review" : "reviews"}.`
              : "Customer reviews from verified purchases will appear here."
          }
        />
        <div className="flex items-center gap-2 rounded-full border border-[#FFE0D6] bg-[#FFF8F5] px-4 py-2 text-sm font-black text-[#ED3500]">
          <Star className={cn("h-4 w-4", reviewCount && "fill-[#ED3500]")} aria-hidden="true" />
          {reviewCount ? averageRating?.toFixed(1) : "New"}
        </div>
      </div>

      {summary ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = summary.distribution[rating as 1 | 2 | 3 | 4 | 5] ?? 0;
            const percent = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
            return (
              <div key={rating} className="rounded-2xl bg-[#F8FAFC] px-3 py-2">
                <div className="flex items-center justify-between text-xs font-black text-[#1F2933]">
                  <span>{rating} star</span>
                  <span>{count}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div className="h-full rounded-full bg-[#ED3500]" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <StorefrontSkeleton className="h-28 bg-[#F8FAFC]" />
        ) : items.length ? (
          items.map((review) => (
            <article key={review.id} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-1 text-[#ED3500]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={cn("h-4 w-4", index < review.rating && "fill-[#ED3500]")}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  {review.title ? <p className="mt-2 text-sm font-black text-[#1F2933]">{review.title}</p> : null}
                  {review.comment ? (
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{review.comment}</p>
                  ) : null}
                </div>
                <div className="text-left text-xs font-bold text-[#667085] sm:text-right">
                  <p>{review.customer.displayName}</p>
                  {review.isVerifiedPurchase ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-[#0F8A5F]">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Verified purchase
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl bg-[#F8FAFC] px-4 py-6 text-sm font-semibold text-[#667085]">
            No customer reviews yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ProductTrustItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-r border-[#E5E7EB] px-3 py-2 last:border-r-0 md:justify-center">
      <span className="shrink-0 text-[#163B5C]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold leading-none text-[#667085]">{label}</span>
        <span className="mt-1 block truncate text-sm font-black leading-tight text-[#1F2933]">{value}</span>
      </span>
    </div>
  );
}

function SupportPoint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[#E8EDF2] bg-white text-[#163B5C]">
        {icon}
      </span>
      <span className="max-w-[220px] leading-5">{text}</span>
    </span>
  );
}

type SpecificationRow = { scope: "PRODUCT" | "VARIANT"; label: string; value: string };

const publicProductDetailFields = [
  { key: "brand", label: "Brand" },
  { key: "condition", label: "Condition" },
  { key: "unitOfMeasure", label: "Sold as" },
  { key: "returnEligibility", label: "Return policy" },
  { key: "warranty", label: "Warranty" },
  { key: "countryOfOrigin", label: "Country of origin" },
] as const;

const publicProductDetailFieldKeys = new Set<string>(publicProductDetailFields.map((field) => field.key));

const hiddenPublicProductDetailKeys = new Set<string>([
  "gstRatePercent",
  "hsnCode",
  "packageWeightGrams",
  "packageLengthCm",
  "packageWidthCm",
  "packageBreadthCm",
  "packageHeightCm",
  "gtin",
  "searchTags",
  "seoTitle",
  "seoDescription",
  "manufacturerAddress",
  "packerName",
  "importerName",
]);

function productServiceHighlights() {
  return [
    {
      title: "Buyer Protection",
      description: "Safe payments and secure shopping",
      icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Easy Returns",
      description: "Based on seller's return policy",
      icon: <RefreshCcw className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Genuine Products",
      description: "Approved marketplace products",
      icon: <BadgeCheck className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "Secure Payments",
      description: "Multiple payment options",
      icon: <CreditCard className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "24/7 Support",
      description: "We're here to help",
      icon: <Headphones className="h-5 w-5" aria-hidden="true" />,
    },
  ];
}

function productSpecificationRows(product: ProductSummary, selectedVariant: ProductVariant | null | undefined): SpecificationRow[] {
  const fields = product.category.productTemplate?.fields ?? [];
  const productDetailRows: SpecificationRow[] = publicProductDetailFields.flatMap((field) => {
    const value = displayAttributeValue(product.attributes?.[field.key]);

    return value
      ? [
          {
            scope: "PRODUCT" as const,
            label: field.label,
            value,
          },
        ]
      : [];
  });

  const templateRows: SpecificationRow[] = fields
    .filter((field) => field.scope === "PRODUCT" || Boolean(selectedVariant))
    .filter((field) => !hiddenPublicProductDetailKeys.has(field.fieldKey))
    .filter((field) => field.scope !== "PRODUCT" || !publicProductDetailFieldKeys.has(field.fieldKey))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.label.localeCompare(second.label))
    .flatMap((field) => {
      const source = field.scope === "VARIANT" ? selectedVariant?.attributes : product.attributes;
      const value = displayAttributeValue(source?.[field.fieldKey]);

      return value
        ? [
            {
              scope: field.scope,
              label: field.label,
              value,
            },
          ]
        : [];
    });

  return [...productDetailRows, ...templateRows];
}

function displayAttributeValue(value: unknown) {
  return displayStorefrontAttributeValue(value);
}

function publicPurchaseModeLabel(value: string) {
  if (value === "ENQUIRY_ONLY") {
    return "Enquiry only";
  }

  if (value === "CART_AND_ENQUIRY") {
    return "Quote available";
  }

  return null;
}
