"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, FilePlus2, Heart, ShieldCheck, ShoppingCart, Store } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { marketplaceProductSpecificationFields } from "@indihub/shared-types";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { addCartItem, formatMoney, getProduct, isPurchasableVariant, primaryImage, primaryVariant, type ProductSummary, type ProductVariant } from "@/lib/storefront-api";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { displayStorefrontAttributeValue } from "./storefront-product-attributes";
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
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const wishlist = useStorefrontWishlist();

  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug)
  });
  const product = productQuery.data;
  const fallbackVariant = product ? primaryVariant(product) : null;
  const purchasableVariants = product?.variants.filter(isPurchasableVariant) ?? [];
  const selectedVariant = purchasableVariants.find((variant) => variant.id === selectedVariantId) ?? fallbackVariant;
  const imageUrl = product ? primaryImage(product) : null;
  const hasStock = Boolean(selectedVariant && selectedVariant.stockQuantity > 0);
  const stockTone = !selectedVariant ? "danger" : selectedVariant.stockQuantity <= 3 ? "warning" : "success";
  const stockLabel = !selectedVariant ? "Unavailable" : selectedVariant.stockQuantity <= 3 ? "Limited stock" : "Ready to order";
  const isWishlisted = product ? wishlist.hasWishlistProduct(product.id) : false;
  const isWishlistPending = product ? wishlist.isPendingProductId === product.id : false;
  const listingMode = product?.listingMode ?? "CART";
  const isEnquiryOnly = listingMode === "ENQUIRY_ONLY";
  const canAddToCart = listingMode !== "ENQUIRY_ONLY";
  const specificationRows = product ? productSpecificationRows(product, selectedVariant) : [];
  const highlights = product ? productHighlights(product) : [];

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
    }
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

  return (
    <StorefrontFrame>
      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={(product?.category ? `/categories/${product.category.slug}` : "/search") as Route}>
            <ArrowLeft size={16} /> Back to products
          </Link>
        </Button>
      </section>

      {productQuery.isLoading ? (
        <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-14 lg:grid-cols-[1fr_520px] lg:px-6">
          <StorefrontSkeleton className="aspect-[4/3] bg-white" />
          <StorefrontSkeleton className="h-96 bg-white" />
        </section>
      ) : product ? (
        <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-14 lg:grid-cols-[minmax(0,1fr)_520px] lg:px-6">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-[#EAF1F7] shadow-[0_24px_60px_rgba(22,59,92,0.08)]">
              <StorefrontImage
                src={imageUrl}
                alt={product.images[0]?.altText ?? product.name}
                priority
                sizes="(max-width: 1024px) 100vw, 55vw"
                fallbackLabel={product.category.name}
              />
            </div>

            {product.images.length > 1 ? (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {product.images.slice(0, 4).map((image) => (
                  <div key={image.id} className="relative aspect-square overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
                    <StorefrontImage
                      src={image.url}
                      alt={image.altText ?? product.name}
                      sizes="160px"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_24px_70px_rgba(22,59,92,0.08)]">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={isEnquiryOnly ? "warning" : stockTone}>{isEnquiryOnly ? "Enquiry required" : stockLabel}</StatusBadge>
              <StatusBadge tone="info">{product.category.name}</StatusBadge>
              <StatusBadge tone={listingMode === "CART_AND_ENQUIRY" ? "info" : isEnquiryOnly ? "warning" : "success"}>
                {listingModeLabel(listingMode)}
              </StatusBadge>
            </div>

            <h1 className="mt-5 text-3xl font-black leading-tight text-[#163B5C] md:text-4xl">{product.name}</h1>
            <p className="mt-4 text-sm leading-7 text-[#667085]">{product.description}</p>

            {highlights.length ? (
              <div className="mt-5 rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                <p className="text-sm font-black text-[#1F2933]">Highlights</p>
                <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-[#667085]">
                  {highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0F8A5F]" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-6 rounded-[24px] bg-[#FFFCFB] p-5">
              <p className="text-sm font-bold text-[#667085]">Selected price</p>
              <p className="mt-1 text-3xl font-black text-[#1F2933]">
                {selectedVariant ? market.format(selectedVariant.pricePaise) : "Price pending"}
              </p>
              {selectedVariant?.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise ? (
                <p className="mt-1 text-sm font-semibold text-[#98A2B3] line-through">
                  {market.format(selectedVariant.mrpPaise)}
                </p>
              ) : null}
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
                    const label =
                      variant.status !== "ACTIVE" ? "Unavailable" : variant.stockQuantity > 0 ? `${variant.stockQuantity} in stock` : "Out of stock";

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={!available}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55",
                          selectedVariant?.id === variant.id
                            ? "border-[#ED3500] bg-[#FFF0EC] text-[#9F2600]"
                            : "border-[#D8E2EA] bg-white text-[#1F2933] hover:border-[#ED3500]"
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

            {specificationRows.length ? (
              <div className="mt-6 rounded-[24px] border border-[#E5E7EB] bg-white p-5">
                <p className="text-sm font-black text-[#1F2933]">Specifications</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {specificationRows.map((row) => (
                    <div key={`${row.scope}-${row.label}`} className="rounded-2xl bg-[#F8FAFC] px-4 py-3">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{row.label}</dt>
                      <dd className="mt-1 text-sm font-black text-[#1F2933]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
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
                  />
                  <Button
                    type="button"
                    size="lg"
                    disabled={!selectedVariant || !hasStock || addMutation.isPending}
                    onClick={() => addMutation.mutate()}
                    className="rounded-full"
                  >
                    <ShoppingCart size={18} /> {addMutation.isPending ? "Adding" : "Add to cart"}
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full">
                    <Link href="/cart">View cart</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="rounded-full">
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

            {notice ? (
              <StorefrontNotice className="mt-5">{notice}</StorefrontNotice>
            ) : null}

            {!customerAuth.enabled ? (
              <div className="mt-6">
                <CustomerAuthNotice />
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 border-t border-[#E5E7EB] pt-5 text-sm font-semibold text-[#667085]">
              <div className="flex items-center gap-2">
                <Store size={16} className="text-[#163B5C]" />
                Sold by{" "}
                <Link href={`/stores/${product.seller.slug}` as Route} className="font-black text-[#1F2933] hover:text-[#163B5C]">
                  {product.seller.storeName}
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#0F8A5F]" />
                Seller approval and product moderation verified by 1HandIndia.
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#0F8A5F]" />
                Manual order and delivery status updates supported.
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {productQuery.isError ? (
        <section className="mx-auto max-w-7xl px-5 pb-14 lg:px-6">
          <StorefrontErrorPanel error={productQuery.error} onRetry={() => void productQuery.refetch()} />
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-5 pb-14 lg:px-6">
        <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <SectionHeading
              title="Buying support"
              description={
                isEnquiryOnly
                  ? "This listing is handled through enquiry and seller follow-up instead of direct cart checkout."
                  : listingMode === "CART_AND_ENQUIRY"
                    ? "Customers can order normally, and business buyers can also request a quotation."
                    : "Customers can place normal orders for this product."
              }
            />
            {product && listingMode !== "CART" ? (
              <Button asChild variant="outline">
                <Link href={`/b2b/enquiries/new?productId=${encodeURIComponent(product.id)}` as Route}>
                  <FilePlus2 size={16} /> {isEnquiryOnly ? "Send enquiry" : "Request bulk quote"}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </StorefrontFrame>
  );
}

type SpecificationRow = { scope: "PRODUCT" | "VARIANT"; label: string; value: string };

function productSpecificationRows(product: ProductSummary, selectedVariant: ProductVariant | null | undefined): SpecificationRow[] {
  const fields = product.category.productTemplate?.fields ?? [];
  const marketplaceRows: SpecificationRow[] = marketplaceProductSpecificationFields
    .flatMap((field) => {
      const value = displayMarketplaceAttributeValue(field.key, productMarketplaceValue(product, field.key));

      return value
        ? [{
            scope: "PRODUCT" as const,
            label: field.label,
            value
          }]
        : [];
    });
  const marketplaceFieldKeys = new Set<string>(marketplaceProductSpecificationFields.map((field) => field.key));

  const templateRows: SpecificationRow[] = fields
    .filter((field) => field.scope === "PRODUCT" || Boolean(selectedVariant))
    .filter((field) => field.scope !== "PRODUCT" || !marketplaceFieldKeys.has(field.fieldKey))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.label.localeCompare(second.label))
    .flatMap((field) => {
      const source = field.scope === "VARIANT" ? selectedVariant?.attributes : product.attributes;
      const value = displayAttributeValue(source?.[field.fieldKey]);

      return value
        ? [{
            scope: field.scope,
            label: field.label,
            value
          }]
        : [];
    });

  return [...marketplaceRows, ...templateRows];
}

function productMarketplaceValue(product: ProductSummary, key: string) {
  if (key === "hsnCode") {
    return product.attributes?.hsnCode ?? product.hsnCode;
  }

  if (key === "gstRatePercent") {
    return product.attributes?.gstRatePercent ?? product.gstRatePercent;
  }

  return product.attributes?.[key];
}

function productHighlights(product: ProductSummary) {
  const value = product.attributes?.highlights;
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];

  return values.map((item) => String(item).trim()).filter(Boolean).slice(0, 6);
}

function displayMarketplaceAttributeValue(key: string, value: unknown) {
  const displayValue = displayStorefrontAttributeValue(value);
  if (!displayValue) {
    return "";
  }

  if (key === "gstRatePercent") {
    return `${displayValue}%`;
  }

  if (key === "packageWeightGrams") {
    return `${displayValue} g`;
  }

  if (key === "packageLengthCm" || key === "packageWidthCm" || key === "packageHeightCm") {
    return `${displayValue} cm`;
  }

  return displayValue;
}

function displayAttributeValue(value: unknown) {
  return displayStorefrontAttributeValue(value);
}

function listingModeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
