"use client";

import Link from "next/link";
import { CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { formatMoney, formatOrderTotal, getCustomerOrder } from "@/lib/storefront-api";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontProductAttributeChips } from "./storefront-product-attributes";
import {
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontPanel,
  StorefrontSkeleton,
  StorefrontSummaryRow,
} from "./storefront-ui";

export function OrderSuccessClient({ orderNumber }: { orderNumber: string }) {
  const customerAuth = useCustomerAuth();
  const orderQuery = useQuery({
    queryKey: ["order", orderNumber, customerAuth.authKey],
    queryFn: () => getCustomerOrder(customerAuth.authHeaders, orderNumber),
    enabled: customerAuth.enabled,
    retry: false
  });
  const order = orderQuery.data;

  return (
    <StorefrontFrame>
      <section className="mx-auto max-w-4xl px-5 py-12 lg:px-6">
        <StorefrontPanel className="border-[#BFEAD9]">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-md bg-[#E9F7F1] text-[#0F8A5F]">
              <CheckCircle2 size={28} />
            </span>
            <div>
              <StatusBadge tone="success">Order placed</StatusBadge>
              <h1 className="mt-3 text-3xl font-black text-[#163B5C] md:text-4xl">Thank you for shopping with 1HandIndia</h1>
              <p className="mt-2 text-sm font-semibold text-[#667085]">Order number: {orderNumber}</p>
            </div>
          </div>

          <div className="mt-6">
            <CustomerAuthNotice />
          </div>

          {orderQuery.isLoading ? <StorefrontSkeleton className="mt-6 h-56" /> : null}

          {order ? (
            <div className="mt-6 grid gap-5">
              <div className="grid gap-3 rounded-md bg-[#FFFCFB] p-4 text-sm font-semibold text-[#667085] md:grid-cols-3">
                <div>
                  <span className="block text-xs uppercase tracking-wide">Order status</span>
                  <span className="mt-1 block font-black text-[#1F2933]">{order.orderStatus}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide">Payment</span>
                  <span className="mt-1 block font-black text-[#1F2933]">{order.paymentStatus}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide">Total</span>
                  <span className="mt-1 block font-black text-[#163B5C]">{formatOrderTotal(order)}</span>
                  {order.buyerCurrency && order.buyerCurrency !== order.currency ? (
                    <span className="mt-1 block text-xs font-bold text-[#667085]">Base {formatMoney(order.totalPaise, order.currency)}</span>
                  ) : null}
                </div>
              </div>

              {order.paymentStatus === "PENDING" ? (
                <StorefrontNotice tone="warning">
                  Payment is pending. If you selected Razorpay, keep this order number and wait for gateway confirmation before fulfilment.
                </StorefrontNotice>
              ) : null}

              {order.paymentStatus === "FAILED" ? (
                <StorefrontNotice tone="danger">
                  Payment failed. The order is saved, but fulfilment should wait until payment is completed or an admin updates the payment status.
                </StorefrontNotice>
              ) : null}

              <section>
                <SectionHeading title="Items" description="Seller splits and delivery tracking are created in the backend for this order." />
                <div className="mt-4 overflow-hidden rounded-md border border-[#E5E7EB]">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 border-b border-[#E5E7EB] bg-white p-4 last:border-b-0">
                      <div>
                        <p className="font-black text-[#1F2933]">{item.productNameSnapshot}</p>
                        <p className="mt-1 text-sm font-semibold text-[#667085]">
                          {item.variantSnapshot?.variantName ?? item.variantSnapshot?.sku ?? "Default"} x {item.quantity}
                        </p>
                        {item.product ? <StorefrontProductAttributeChips product={item.product} variant="inline" /> : null}
                      </div>
                      <p className="font-black text-[#163B5C]">{formatMoney(item.lineTotalPaise, item.currency)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-[#E5E7EB] bg-white p-4">
                <SectionHeading title="Order charges" description="Checkout charges locked when the order was placed." />
                <div className="mt-4 grid gap-2 text-sm font-semibold text-[#667085]">
                  <ChargeRow label="Subtotal" value={formatMoney(order.subtotalPaise, order.currency)} />
                  <ChargeRow label="Shipping" value={formatMoney(order.shippingPaise, order.currency)} />
                  <ChargeRow label="Platform fee" value={formatMoney(order.platformFeePaise, order.currency)} />
                  <ChargeRow label="Total" value={formatOrderTotal(order)} strong />
                </div>
              </section>

              <div className="grid gap-3 rounded-md border border-[#E5E7EB] bg-white p-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <PackageCheck className="text-[#0F8A5F]" size={20} />
                  <span className="text-sm font-semibold text-[#667085]">Seller order notification is queued when provider settings allow it.</span>
                </div>
                <div className="flex items-center gap-3">
                  <Truck className="text-[#ED3500]" size={20} />
                  <span className="text-sm font-semibold text-[#667085]">Delivery status starts at {order.deliveryStatus}.</span>
                </div>
              </div>
            </div>
          ) : null}

          {orderQuery.isError ? <StorefrontErrorPanel className="mt-6" error={orderQuery.error} onRetry={() => void orderQuery.refetch()} /> : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/account/orders">View orders</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/track-order">Track order</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/search">Continue shopping</Link>
            </Button>
          </div>
        </StorefrontPanel>
      </section>
    </StorefrontFrame>
  );
}

function ChargeRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <StorefrontSummaryRow className="border-b border-[#E5E7EB] pb-2 last:border-b-0 last:pb-0" label={label} value={value} strong={strong} />
  );
}
