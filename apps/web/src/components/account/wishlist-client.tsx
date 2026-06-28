"use client";

import Link from "next/link";
import type { Route } from "next";
import { Check, MoreVertical, PackageCheck, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { AccountShell } from "./account-shell";
import { EmptyState, ErrorPanel, PagePanel, SkeletonBlock } from "./account-ui";
import { getWishlist, removeWishlistItem, type WishlistProduct, type WishlistSummary } from "@/lib/account-api";
import { addCartItem, isPurchasableVariant, type ProductVariant } from "@/lib/storefront-api";

type WishlistItem = WishlistSummary["items"][number];

export function WishlistClient() {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const confirmation = useConfirmationDialog();

  const wishlistQuery = useQuery({
    queryKey: ["account-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });

  const items = wishlistQuery.data?.items ?? [];
  const purchasableItems = useMemo(() => items.filter((item) => primaryWishlistVariant(item.product)), [items]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.product.id) && primaryWishlistVariant(item.product)),
    [items, selectedIds],
  );
  const summary = useMemo(() => wishlistSummary(items, selectedItems), [items, selectedItems]);
  const allPurchasableSelected = purchasableItems.length > 0 && purchasableItems.every((item) => selectedIds.has(item.product.id));

  useEffect(() => {
    if (!items.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds((current) => {
      const availableIds = new Set(items.map((item) => item.product.id));
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      if (next.size === current.size) {
        return current;
      }
      return next;
    });
  }, [items]);

  const removeMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      for (const productId of productIds) {
        await removeWishlistItem(customerAuth.authHeaders, productId);
      }
    },
    onSuccess: (_, productIds) => {
      setNotice(productIds.length === 1 ? "Product removed from wishlist." : `${productIds.length} products removed from wishlist.`);
      setSelectedIds((current) => {
        const next = new Set(current);
        productIds.forEach((id) => next.delete(id));
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["account-wishlist", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["account-profile", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to remove selected products.")
  });

  const cartMutation = useMutation({
    mutationFn: async (products: WishlistProduct[]) => {
      if (!customerAuth.enabled) {
        throw new Error("Sign in before using cart actions.");
      }

      for (const product of products) {
        const variant = primaryWishlistVariant(product);
        if (!variant) {
          continue;
        }
        await addCartItem(customerAuth.authHeaders, variant.id, 1);
      }
    },
    onSuccess: (_, products) => {
      setNotice(products.length === 1 ? "Product added to cart." : `${products.length} selected products added to cart.`);
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to add selected products to cart.")
  });

  function toggleProduct(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (allPurchasableSelected) {
        return new Set();
      }
      const next = new Set(current);
      purchasableItems.forEach((item) => next.add(item.product.id));
      return next;
    });
  }

  function addSelectedToCart() {
    if (!selectedItems.length) {
      setNotice("Select available products before adding to cart.");
      return;
    }
    cartMutation.mutate(selectedItems.map((item) => item.product));
  }

  function removeSelected() {
    if (!selectedItems.length) {
      setNotice("Select products before removing.");
      return;
    }
    confirmation.requestConfirmation({
      title: "Remove selected products?",
      description: `${selectedItems.length} selected product${selectedItems.length === 1 ? "" : "s"} will be removed from your wishlist.`,
      confirmLabel: "Remove selected",
      onConfirm: () => removeMutation.mutate(selectedItems.map((item) => item.product.id))
    });
  }

  return (
    <AccountShell title="Wishlist" description="Saved products for quick review, cart actions, and later ordering.">
      {confirmation.confirmationDialog}
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <PagePanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            title={`Saved products (${items.length})`}
            description="All your saved items in one place. Select and move to cart or remove."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={!purchasableItems.length}
              className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-black text-[#1F2933] transition hover:bg-[#FFF3EE] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={cn("grid h-5 w-5 place-items-center rounded border", allPurchasableSelected ? "border-[#ED3500] bg-[#ED3500] text-white" : "border-[#D0D5DD] bg-white")}>
                {allPurchasableSelected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </span>
              Select all ({purchasableItems.length})
            </button>
            <Button type="button" variant="outline" disabled={!selectedItems.length || removeMutation.isPending} onClick={removeSelected}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove selected
            </Button>
            <Button type="button" disabled={!selectedItems.length || cartMutation.isPending} onClick={addSelectedToCart}>
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Add selected to cart
            </Button>
          </div>
        </div>

        {notice ? (
          <div className="mt-5">
            <StatusBadge tone={removeMutation.isError || cartMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
          </div>
        ) : null}

        <div className="mt-5">
          {wishlistQuery.isLoading ? <SkeletonBlock className="h-72" /> : null}
          {wishlistQuery.error ? <ErrorPanel error={wishlistQuery.error} onRetry={() => void wishlistQuery.refetch()} /> : null}
          {!wishlistQuery.isLoading && items.length === 0 ? (
            <EmptyState
              title="Wishlist is empty"
              message="Save customer favorites so they can return to products without searching again."
              action={
                <Button asChild>
                  <Link href="/search">Browse products</Link>
                </Button>
              }
            />
          ) : null}

          {items.length ? (
            <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
              <div className="hidden grid-cols-[44px_minmax(280px,1fr)_160px_150px_150px_44px] border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#667085] lg:grid">
                <span />
                <span>Product details</span>
                <span>Price</span>
                <span>Added on</span>
                <span>Availability</span>
                <span />
              </div>

              {items.map((item) => {
                const product = item.product;
                const variant = primaryWishlistVariant(product);
                const isSelected = selectedIds.has(product.id);
                return (
                  <WishlistRow
                    item={item}
                    key={item.id}
                    marketFormat={(amount) => market.format(amount)}
                    selected={isSelected}
                    variant={variant}
                    onToggle={() => variant ? toggleProduct(product.id) : undefined}
                    onAddToCart={() => cartMutation.mutate([product])}
                    onRemove={() =>
                      confirmation.requestConfirmation({
                        title: "Remove wishlist product?",
                        description: `"${product.name}" will be removed from saved products.`,
                        confirmLabel: "Remove product",
                        onConfirm: () => removeMutation.mutate([product.id])
                      })
                    }
                    disabled={cartMutation.isPending || removeMutation.isPending}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </PagePanel>

      {items.length ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_1.2fr]">
          <SummaryCard title="Wishlist Summary">
            <SummaryLine label="Total items" value={summary.totalItems} />
            <SummaryLine label="In stock" value={summary.inStock} />
            <SummaryLine label="Low stock" value={summary.lowStock} />
            <SummaryLine label="Total value" value={market.format(summary.totalValue)} strong />
          </SummaryCard>

          <SummaryCard>
            <div className="flex items-center gap-2 text-sm font-black text-[#064C35]">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              You save
            </div>
            <p className="mt-3 text-3xl font-black text-[#16A34A]">{market.format(summary.savings)}</p>
            <p className="mt-3 text-sm font-semibold text-[#667085]">
              Total MRP: <span className="line-through">{market.format(summary.mrpTotal)}</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-[#667085]">Total discount: {summary.discountPercent}%</p>
          </SummaryCard>

          <SummaryCard title={`Selected Items (${selectedItems.length})`}>
            <SummaryLine label="Total price" value={market.format(summary.selectedValue)} strong />
            <Button type="button" className="mt-4 w-full" disabled={!selectedItems.length || cartMutation.isPending} onClick={addSelectedToCart}>
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Add selected to cart
            </Button>
            <Button type="button" className="mt-3 w-full" variant="outline" disabled={!selectedItems.length || removeMutation.isPending} onClick={removeSelected}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove selected
            </Button>
          </SummaryCard>
        </section>
      ) : null}
    </AccountShell>
  );
}

function WishlistRow({
  item,
  marketFormat,
  selected,
  variant,
  onToggle,
  onAddToCart,
  onRemove,
  disabled,
}: {
  item: WishlistItem;
  marketFormat: (amountPaise: number) => string;
  selected: boolean;
  variant: ProductVariant | null;
  onToggle: () => void | undefined;
  onAddToCart: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const product = item.product;
  const image = product.images.find((entry) => entry.isPrimary)?.url ?? product.images[0]?.url ?? null;
  const originalPrice = originalVariantPrice(variant);
  const discountPercent = discountBps(variant);
  const lowStock = Boolean(variant && variant.stockQuantity > 0 && variant.stockQuantity <= 3);

  return (
    <article className="grid gap-4 border-b border-[#E5E7EB] px-4 py-4 last:border-b-0 lg:grid-cols-[44px_minmax(280px,1fr)_160px_150px_150px_44px] lg:items-center">
      <button
        type="button"
        onClick={onToggle}
        disabled={!variant || disabled}
        className={cn("grid h-6 w-6 place-items-center rounded border transition", selected ? "border-[#ED3500] bg-[#ED3500] text-white" : "border-[#D0D5DD] bg-white", (!variant || disabled) && "cursor-not-allowed opacity-45")}
        aria-label={selected ? `Unselect ${product.name}` : `Select ${product.name}`}
      >
        {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      </button>

      <div className="flex min-w-0 gap-3">
        <Link href={`/products/${product.slug}` as Route} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-[#EAF1F7]">
          <StorefrontImage src={image} alt={product.name} sizes="80px" fallbackLabel="Product" />
        </Link>
        <div className="min-w-0">
          <Link href={`/products/${product.slug}` as Route} className="line-clamp-2 text-base font-black text-[#1F2933] hover:text-[#ED3500]">
            {product.name}
          </Link>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            {variant?.variantName ?? variant?.sku ?? "Variant unavailable"}
          </p>
          <p className="mt-1 text-xs font-semibold text-[#667085]">Added to wishlist from {product.seller.storeName}</p>
        </div>
      </div>

      <div>
        <p className="text-base font-black text-[#1F2933]">{variant ? marketFormat(variant.pricePaise) : "Price pending"}</p>
        {originalPrice && variant ? <p className="text-sm font-bold text-[#98A2B3] line-through">{marketFormat(originalPrice)}</p> : null}
        {discountPercent > 0 ? <span className="mt-2 inline-flex rounded-full bg-[#DCFCE7] px-2 py-1 text-xs font-black text-[#16803A]">{discountPercent}% OFF</span> : null}
      </div>

      <p className="text-sm font-bold text-[#667085]">{formatWishlistDate(item.createdAt)}</p>

      <div>
        {variant && variant.stockQuantity > 0 ? (
          <>
            <p className={cn("text-sm font-black", lowStock ? "text-[#ED3500]" : "text-[#16803A]")}>{lowStock ? "Low Stock" : "In Stock"}</p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">{lowStock ? `Only ${variant.stockQuantity} left` : "Ships Soon"}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-black text-[#B42318]">Unavailable</p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">Cannot add to cart</p>
          </>
        )}
      </div>

      <div className="flex gap-2 lg:justify-end">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-md text-[#667085] transition hover:bg-[#FFF3EE] hover:text-[#ED3500]" onClick={onAddToCart} disabled={!variant || disabled} aria-label={`Add ${product.name} to cart`}>
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-md text-[#667085] transition hover:bg-[#FFF3EE] hover:text-[#ED3500]" onClick={onRemove} disabled={disabled} aria-label={`Remove ${product.name}`}>
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function SummaryCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      {title ? <h2 className="mb-4 text-base font-black text-[#1F2933]">{title}</h2> : null}
      {children}
    </section>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-4 text-sm">
      <span className="font-semibold text-[#667085]">{label}</span>
      <span className={strong ? "font-black text-[#163B5C]" : "font-black text-[#1F2933]"}>{value}</span>
    </div>
  );
}

function primaryWishlistVariant(product: WishlistProduct) {
  return product.variants.find(isPurchasableVariant) ?? null;
}

function originalVariantPrice(variant: ProductVariant | null) {
  if (!variant) {
    return null;
  }

  const original = variant.originalPricePaise ?? variant.mrpPaise ?? null;
  return original && original > variant.pricePaise ? original : null;
}

function discountBps(variant: ProductVariant | null) {
  const original = originalVariantPrice(variant);
  if (!variant || !original) {
    return 0;
  }

  return Math.round(((original - variant.pricePaise) / original) * 100);
}

function wishlistSummary(items: WishlistItem[], selectedItems: WishlistItem[]) {
  const totals = items.reduce(
    (result, item) => {
      const variant = primaryWishlistVariant(item.product);
      if (!variant) {
        return result;
      }

      const original = originalVariantPrice(variant) ?? variant.pricePaise;
      result.totalValue += variant.pricePaise;
      result.mrpTotal += original;
      result.savings += Math.max(0, original - variant.pricePaise);
      if (variant.stockQuantity > 3) {
        result.inStock += 1;
      } else if (variant.stockQuantity > 0) {
        result.lowStock += 1;
      }
      return result;
    },
    { totalValue: 0, mrpTotal: 0, savings: 0, inStock: 0, lowStock: 0 },
  );

  const selectedValue = selectedItems.reduce((total, item) => {
    const variant = primaryWishlistVariant(item.product);
    return total + (variant?.pricePaise ?? 0);
  }, 0);
  const discountPercent = totals.mrpTotal > 0 ? Math.round((totals.savings / totals.mrpTotal) * 10000) / 100 : 0;

  return {
    ...totals,
    discountPercent,
    selectedValue,
    totalItems: items.length,
  };
}

function formatWishlistDate(value?: string) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
