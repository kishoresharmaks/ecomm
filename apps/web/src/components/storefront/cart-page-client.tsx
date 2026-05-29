"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { cartTotals, getCart, getCheckoutSummary, primaryImage, removeCartItem, updateCartItem } from "@/lib/storefront-api";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { StorefrontProductAttributeChips } from "./storefront-product-attributes";
import {
  StorefrontEmptyState,
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontPageHeader,
  StorefrontPanel,
  StorefrontQuantityStepper,
  StorefrontSkeleton,
  StorefrontSummaryRow,
} from "./storefront-ui";

export function CartPageClient() {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();
  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });
  const checkoutSummaryQuery = useQuery({
    queryKey: ["checkout-summary", customerAuth.authKey, market.countryCode],
    queryFn: () => getCheckoutSummary(customerAuth.authHeaders, market.countryCode),
    enabled: customerAuth.enabled,
    retry: false
  });
  const totals = cartTotals(cartQuery.data);
  const checkoutTotals = {
    itemCount: checkoutSummaryQuery.data?.itemCount ?? totals.itemCount,
    subtotalPaise: checkoutSummaryQuery.data?.subtotalPaise ?? totals.subtotalPaise,
    shippingPaise: checkoutSummaryQuery.data?.shippingPaise ?? 0,
    platformFeePaise: checkoutSummaryQuery.data?.platformFeePaise ?? 0,
    totalPaise: checkoutSummaryQuery.data?.totalPaise ?? totals.subtotalPaise
  };

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(customerAuth.authHeaders, itemId, quantity),
    onSuccess: () => {
      setNotice("Cart updated.");
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["checkout-summary", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to update cart.")
  });
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeCartItem(customerAuth.authHeaders, itemId),
    onSuccess: () => {
      setNotice("Item removed.");
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["checkout-summary", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to remove item.")
  });

  return (
    <StorefrontFrame>
      {confirmation.confirmationDialog}
      <StorefrontPageHeader
        title="Cart"
        description="Review quantities and continue to checkout using the customer account context."
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[1fr_360px] lg:px-6">
        <div>
          <CustomerAuthNotice />

          {notice ? (
            <StorefrontNotice className="mb-5">{notice}</StorefrontNotice>
          ) : null}

          {cartQuery.isLoading ? (
            <StorefrontSkeleton className="h-80 bg-white" />
          ) : cartQuery.data?.items.length ? (
            <div className="overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white shadow-sm">
              {cartQuery.data.items.map((item) => {
                const product = item.productVariant.product;
                const imageUrl = primaryImage(product);
                const quantityBusy = updateMutation.isPending || removeMutation.isPending;

                return (
                  <div key={item.id} className="grid gap-4 border-b border-[#E5E7EB] p-4 last:border-b-0 md:grid-cols-[120px_1fr_auto]">
                    <Link href={`/products/${product.slug}` as Route} className="relative aspect-square overflow-hidden rounded-2xl bg-[#EAF1F7]">
                      <StorefrontImage src={imageUrl} alt={product.name} sizes="120px" fallbackLabel={product.category.name} />
                    </Link>
                    <div>
                      <Link href={`/products/${product.slug}` as Route} className="text-lg font-black text-[#1F2933] hover:text-[#163B5C]">
                        {product.name}
                      </Link>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">{product.seller.storeName}</p>
                      <StorefrontProductAttributeChips product={product} />
                      <p className="mt-3 text-base font-black text-[#163B5C]">
                        {market.format(item.unitPricePaise)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 md:flex-col md:items-end md:justify-between">
                      <StorefrontQuantityStepper
                        value={item.quantity}
                        disabled={quantityBusy}
                        decreaseDisabled={item.quantity <= 1}
                        increaseDisabled={item.quantity >= item.productVariant.stockQuantity}
                        decreaseLabel={`Decrease ${product.name}`}
                        increaseLabel={`Increase ${product.name}`}
                        onDecrease={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                        onIncrease={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                      />
                      <button
                        type="button"
                        disabled={quantityBusy}
                        onClick={() =>
                          confirmation.requestConfirmation({
                            title: "Remove item from cart?",
                            description: `"${product.name}" will be removed from this customer's cart. The product stays available in the storefront.`,
                            confirmLabel: "Remove item",
                            onConfirm: () => removeMutation.mutate(item.id)
                          })
                        }
                        className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold text-[#D64545] hover:bg-[#FDECEC] disabled:opacity-50"
                      >
                        <Trash2 size={15} /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : customerAuth.enabled ? (
            <StorefrontEmptyState
              title="Your cart is empty"
              description="Add approved products from the storefront before checkout."
              action={
                <Button asChild>
                  <Link href="/search">Browse products</Link>
                </Button>
              }
            />
          ) : null}

          {cartQuery.isError ? <StorefrontErrorPanel className="mt-6" error={cartQuery.error} onRetry={() => void cartQuery.refetch()} /> : null}
        </div>

        <StorefrontPanel as="aside" className="h-fit">
          <h2 className="text-lg font-black text-[#1F2933]">Order summary</h2>
          <div className="mt-5 space-y-3 border-b border-[#E5E7EB] pb-5 text-sm font-semibold text-[#667085]">
            <StorefrontSummaryRow label="Items" value={checkoutTotals.itemCount} />
            <StorefrontSummaryRow label="Subtotal" value={market.format(checkoutTotals.subtotalPaise)} />
            <StorefrontSummaryRow label="Shipping" value={market.format(checkoutTotals.shippingPaise)} />
            <StorefrontSummaryRow label="Platform fee" value={market.format(checkoutTotals.platformFeePaise)} />
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-bold text-[#667085]">Estimated total</span>
            <span className="text-2xl font-black text-[#163B5C]">{market.format(checkoutTotals.totalPaise)}</span>
          </div>
          {checkoutSummaryQuery.isError ? <StorefrontErrorPanel className="mt-6" error={checkoutSummaryQuery.error} onRetry={() => void checkoutSummaryQuery.refetch()} /> : null}
          {cartQuery.data?.items.length ? (
            <Button asChild size="lg" className="mt-5 w-full">
              <Link href="/checkout">
                Checkout <ArrowRight size={17} />
              </Link>
            </Button>
          ) : (
            <Button type="button" size="lg" className="mt-5 w-full" disabled>
              Checkout <ArrowRight size={17} />
            </Button>
          )}
        </StorefrontPanel>
      </section>
    </StorefrontFrame>
  );
}
