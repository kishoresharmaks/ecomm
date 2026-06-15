"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useMarket } from "@/components/market/market-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { cartTotals, formatMoney, getCart, getCheckoutSummary, primaryImage, removeCartItem, updateCartItem } from "@/lib/storefront-api";
import {
  couponApplyErrorMessage,
  couponFeedbackClassName,
  normalizeCouponCodeInput,
  validateCouponCodeInput,
  type CouponFeedback,
} from "./coupon-feedback";
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
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [pendingCouponCode, setPendingCouponCode] = useState<string | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<CouponFeedback | null>(null);
  const confirmation = useConfirmationDialog();
  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });
  const checkoutSummaryQuery = useQuery({
    queryKey: ["checkout-summary", customerAuth.authKey, market.countryCode, appliedCouponCode],
    queryFn: () =>
      getCheckoutSummary(customerAuth.authHeaders, {
        buyerCountryCode: market.countryCode,
        ...(appliedCouponCode ? { couponCode: appliedCouponCode } : {}),
      }),
    enabled: customerAuth.enabled,
    retry: false
  });
  const totals = cartTotals(cartQuery.data);
  const checkoutTotals = {
    itemCount: checkoutSummaryQuery.data?.itemCount ?? totals.itemCount,
    subtotalPaise: checkoutSummaryQuery.data?.subtotalPaise ?? totals.subtotalPaise,
    buyerSubtotalMinor: checkoutSummaryQuery.data?.buyerSubtotalMinor ?? market.convert(totals.subtotalPaise),
    shippingPaise: checkoutSummaryQuery.data?.shippingPaise ?? 0,
    buyerShippingMinor: checkoutSummaryQuery.data?.buyerShippingMinor ?? 0,
    platformFeePaise: checkoutSummaryQuery.data?.platformFeePaise ?? 0,
    buyerPlatformFeeMinor: checkoutSummaryQuery.data?.buyerPlatformFeeMinor ?? 0,
    couponDiscountPaise: checkoutSummaryQuery.data?.couponDiscountPaise ?? 0,
    buyerCouponDiscountMinor: checkoutSummaryQuery.data?.buyerCouponDiscountMinor ?? 0,
    coupon: checkoutSummaryQuery.data?.coupon ?? null,
    totalPaise: checkoutSummaryQuery.data?.totalPaise ?? totals.subtotalPaise,
    buyerTotalMinor: checkoutSummaryQuery.data?.buyerTotalMinor ?? market.convert(totals.subtotalPaise),
    buyerCurrency: checkoutSummaryQuery.data?.buyerCurrency ?? market.market.currency,
    buyerLocale: market.market.locale,
  };
  const couponIsApplying = Boolean(pendingCouponCode && checkoutSummaryQuery.isFetching);
  const couponApplied = Boolean(appliedCouponCode && checkoutTotals.coupon && !pendingCouponCode);

  useEffect(() => {
    if (!pendingCouponCode || checkoutSummaryQuery.isFetching) {
      return;
    }

    if (checkoutSummaryQuery.isSuccess) {
      const appliedCoupon = checkoutSummaryQuery.data?.coupon;
      const appliedCode = appliedCoupon?.code;
      if (appliedCoupon && appliedCode && normalizeCouponCodeInput(appliedCode) === pendingCouponCode) {
        setCouponFeedback({
          tone: "success",
          message: `${appliedCode} applied. ${appliedCoupon.title}`,
        });
      } else {
        setAppliedCouponCode(null);
        setCouponFeedback({
          tone: "danger",
          message: "This coupon is not valid for the items in your cart.",
        });
      }
      setPendingCouponCode(null);
      return;
    }

    if (checkoutSummaryQuery.isError) {
      setAppliedCouponCode(null);
      setPendingCouponCode(null);
      setCouponFeedback({
        tone: "danger",
        message: couponApplyErrorMessage(checkoutSummaryQuery.error),
      });
    }
  }, [
    checkoutSummaryQuery.data?.coupon,
    checkoutSummaryQuery.error,
    checkoutSummaryQuery.isError,
    checkoutSummaryQuery.isFetching,
    checkoutSummaryQuery.isSuccess,
    pendingCouponCode,
  ]);

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(customerAuth.authHeaders, itemId, quantity),
    onSuccess: () => {
      setNotice("Cart updated.");
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["checkout-summary", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to update cart.")
  });

  function applyCoupon() {
    const code = normalizeCouponCodeInput(couponInput);
    const validation = validateCouponCodeInput(code);

    if (validation) {
      setCouponFeedback(validation);
      setAppliedCouponCode(null);
      setPendingCouponCode(null);
      return;
    }

    setCouponFeedback(null);
    setPendingCouponCode(code);
    setAppliedCouponCode(code);
    setCouponInput(code);
  }

  function removeCoupon() {
    setAppliedCouponCode(null);
    setPendingCouponCode(null);
    setCouponInput("");
    setCouponFeedback(null);
  }
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
                const originalUnitPrice =
                  item.originalUnitPricePaise && item.originalUnitPricePaise > item.unitPricePaise
                    ? item.originalUnitPricePaise
                    : item.productVariant.originalPricePaise && item.productVariant.originalPricePaise > item.unitPricePaise
                      ? item.productVariant.originalPricePaise
                      : null;
                const activeDeal = item.activeDeal ?? item.productVariant.activeDeal ?? null;

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
                      {originalUnitPrice ? (
                        <p className="mt-1 text-xs font-bold text-[#98A2B3] line-through">{market.format(originalUnitPrice)}</p>
                      ) : null}
                      {activeDeal ? (
                        <p className="mt-1 text-xs font-black text-[#ED3500]">{activeDeal.discountBps / 100}% deal applied</p>
                      ) : null}
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
          <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3">
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">
              Coupon
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={couponInput}
                onChange={(event) => {
                  setCouponInput(event.target.value.toUpperCase());
                  if (!couponIsApplying && couponFeedback?.tone !== "success") {
                    setCouponFeedback(null);
                  }
                }}
                placeholder="Enter code"
                disabled={couponIsApplying || couponApplied}
                className="min-w-0 flex-1 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#ED3500]"
              />
              {couponApplied ? (
                <Button type="button" variant="outline" size="sm" onClick={removeCoupon} aria-label="Remove coupon">
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={applyCoupon} disabled={couponIsApplying}>
                  {couponIsApplying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Applying
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
              )}
            </div>
            {couponFeedback ? (
              <p
                className={`mt-2 text-xs font-bold ${couponFeedbackClassName(couponFeedback.tone)}`}
                role={couponFeedback.tone === "danger" ? "alert" : "status"}
                aria-live="polite"
              >
                {couponFeedback.message}
              </p>
            ) : null}
          </div>
          <div className="mt-5 space-y-3 border-b border-[#E5E7EB] pb-5 text-sm font-semibold text-[#667085]">
            <StorefrontSummaryRow label="Items" value={checkoutTotals.itemCount} />
            <StorefrontSummaryRow label="Subtotal" value={formatMoney(checkoutTotals.buyerSubtotalMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)} />
            {checkoutTotals.couponDiscountPaise > 0 ? (
              <StorefrontSummaryRow
                label={`Coupon ${checkoutTotals.coupon?.code ?? ""}`.trim()}
                value={`-${formatMoney(checkoutTotals.buyerCouponDiscountMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)}`}
              />
            ) : null}
            <StorefrontSummaryRow label="Shipping" value={formatMoney(checkoutTotals.buyerShippingMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)} />
            <StorefrontSummaryRow label="Platform fee" value={formatMoney(checkoutTotals.buyerPlatformFeeMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)} />
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-bold text-[#667085]">Estimated total</span>
            <span className="text-2xl font-black text-[#163B5C]">{formatMoney(checkoutTotals.buyerTotalMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)}</span>
          </div>
          {checkoutTotals.buyerCurrency !== "INR" ? (
            <p className="mt-2 text-xs font-semibold text-[#667085]">
              Base estimate: {formatMoney(checkoutTotals.totalPaise)}. Checkout locks the final buyer-currency rate.
            </p>
          ) : null}
          {checkoutSummaryQuery.isError && !couponFeedback ? <StorefrontErrorPanel className="mt-6" error={checkoutSummaryQuery.error} onRetry={() => void checkoutSummaryQuery.refetch()} /> : null}
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
