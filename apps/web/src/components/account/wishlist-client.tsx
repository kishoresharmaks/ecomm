"use client";

import Link from "next/link";
import type { Route } from "next";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { AccountShell } from "./account-shell";
import { EmptyState, ErrorPanel, PagePanel, SkeletonBlock } from "./account-ui";
import { getWishlist, removeWishlistItem, type WishlistProduct } from "@/lib/account-api";
import { addCartItem, formatMoney, isPurchasableVariant } from "@/lib/storefront-api";

export function WishlistClient() {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();

  const wishlistQuery = useQuery({
    queryKey: ["account-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeWishlistItem(customerAuth.authHeaders, productId),
    onSuccess: () => {
      setNotice("Product removed from wishlist.");
      void queryClient.invalidateQueries({ queryKey: ["account-wishlist", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["account-profile", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to remove product.")
  });

  const cartMutation = useMutation({
    mutationFn: (product: WishlistProduct) => {
      const variant = primaryWishlistVariant(product);
      if (!customerAuth.enabled) {
        throw new Error("Sign in before using cart actions.");
      }
      if (!variant) {
        throw new Error("This product has no active variant.");
      }

      return addCartItem(customerAuth.authHeaders, variant.id, 1);
    },
    onSuccess: () => {
      setNotice("Product added to cart.");
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to add product to cart.")
  });

  const items = wishlistQuery.data?.items ?? [];

  return (
    <AccountShell title="Wishlist" description="Saved products for quick review, cart actions, and later ordering.">
      {confirmation.confirmationDialog}
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <PagePanel>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <SectionHeading title="Saved products" description="Wishlist items are tied to the customer account and active approved products." />
          <Button asChild variant="outline">
            <Link href="/search">Find products</Link>
          </Button>
        </div>

        {notice ? (
          <div className="mt-5">
            <StatusBadge tone={removeMutation.isError || cartMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          {wishlistQuery.isLoading ? <SkeletonBlock className="h-60" /> : null}
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

          {items.map((item) => {
            const product = item.product;
            const variant = primaryWishlistVariant(product);
            const image = product.images.find((entry) => entry.isPrimary)?.url ?? product.images[0]?.url ?? null;

            return (
              <article key={item.id} className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 md:grid-cols-[140px_1fr_auto]">
                <Link href={`/products/${product.slug}` as Route} className="relative aspect-[4/3] overflow-hidden rounded-md bg-[#EAF1F7]">
                  <StorefrontImage src={image} alt={product.name} sizes="180px" fallbackLabel="Product" />
                </Link>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">
                      <Heart className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Saved
                    </StatusBadge>
                    <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">{product.seller.storeName}</span>
                  </div>
                  <Link href={`/products/${product.slug}` as Route} className="mt-2 block text-lg font-black text-[#1F2933] hover:text-[#163B5C]">
                    {product.name}
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#667085]">{product.description}</p>
                  <p className="mt-3 text-xl font-black text-[#163B5C]">
                    {variant ? market.format(variant.pricePaise) : "Price pending"}
                  </p>
                  {variant && market.market.currency !== variant.currency ? (
                    <p className="mt-1 text-xs font-bold text-[#667085]">{formatMoney(variant.pricePaise, variant.currency)} base seller price</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!variant || cartMutation.isPending}
                    onClick={() => cartMutation.mutate(product)}
                  >
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                    Add to cart
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      confirmation.requestConfirmation({
                        title: "Remove wishlist product?",
                        description: `"${product.name}" will be removed from saved products. The item remains available in product search if it is still active.`,
                        confirmLabel: "Remove product",
                        onConfirm: () => removeMutation.mutate(product.id)
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </PagePanel>
    </AccountShell>
  );
}

function primaryWishlistVariant(product: WishlistProduct) {
  return product.variants.find(isPurchasableVariant) ?? null;
}
