"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  HeartHandshake,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  formatOrderBaseAmount,
  formatOrderBuyerAmount,
  formatMoney,
  formatOrderTotal,
  getCustomerOrder,
  primaryImage,
  type OrderSummary,
} from "@/lib/storefront-api";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { StorefrontProductAttributeChips } from "./storefront-product-attributes";
import {
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontPanel,
  StorefrontSkeleton,
  StorefrontSummaryRow,
} from "./storefront-ui";

type PaymentSummary = {
  method?: string | null;
  provider?: string | null;
  status?: string | null;
};

export function OrderSuccessClient({ orderNumber }: { orderNumber: string }) {
  const customerAuth = useCustomerAuth();
  const orderQuery = useQuery({
    queryKey: ["order", orderNumber, customerAuth.authKey],
    queryFn: () => getCustomerOrder(customerAuth.authHeaders, orderNumber),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const order = orderQuery.data;
  const payment = order ? paymentSummary(order) : null;
  const savingsPaise = order ? orderSavingsPaise(order) : 0;

  return (
    <StorefrontFrame>
      <section className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <StorefrontPanel className="overflow-hidden border-[#BFEAD9] bg-white p-0 shadow-[0_24px_70px_rgba(22,59,92,0.08)]">
          <div className="relative overflow-hidden border-b border-[#D7F4E7] bg-[linear-gradient(135deg,#F0FFF8_0%,#FFFCFB_55%,#FFF0EC_100%)] px-5 py-6 md:px-8 md:py-8">
            <SuccessBurst />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#0F8A5F] text-white shadow-[0_14px_28px_rgba(15,138,95,0.24)] md:h-20 md:w-20">
                  <span className="absolute inset-0 rounded-full bg-[#0F8A5F] opacity-20 animate-ping" aria-hidden="true" />
                  <CheckCircle2 className="relative h-9 w-9 md:h-11 md:w-11" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <StatusBadge tone="success">Order confirmed</StatusBadge>
                  <h1 className="mt-3 text-3xl font-black leading-tight tracking-normal text-[#163B5C] md:text-5xl">
                    Your order has been placed successfully
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
                    Thank you for shopping with 1HandIndia. We have saved your order and will keep the status updated from your account.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-[#163B5C]">
                    <span className="rounded-full border border-[#BFEAD9] bg-white px-3 py-1.5">Order ID: {orderNumber}</span>
                    {order?.createdAt ? (
                      <span className="rounded-full border border-[#BFEAD9] bg-white px-3 py-1.5">Placed: {formatDateTime(order.createdAt)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              {order ? (
                <div className="rounded-2xl border border-white/80 bg-white/90 px-5 py-4 shadow-sm md:min-w-[220px] md:text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Order total</p>
                  <p className="mt-1 text-3xl font-black text-[#ED3500]">{formatOrderTotal(order)}</p>
                  {order.buyerCurrency && order.buyerCurrency !== order.currency ? (
                    <p className="mt-1 text-xs font-bold text-[#667085]">Base {formatMoney(order.totalPaise, order.currency)}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-5 md:p-8">
            <CustomerAuthNotice />

            {orderQuery.isLoading ? <StorefrontSkeleton className="mt-6 h-72 bg-[#F8FAFC]" /> : null}

            {order && payment ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <main className="grid gap-6">
                  <section className="grid gap-3 md:grid-cols-3">
                    <StatusTile icon={<PackageCheck className="h-5 w-5" />} label="Order status" value={statusLabel(order.orderStatus)} tone="blue" />
                    <StatusTile icon={<CreditCard className="h-5 w-5" />} label="Payment" value={payment.label} tone={payment.tone} loading={payment.loading} />
                    <StatusTile icon={<Truck className="h-5 w-5" />} label="Delivery" value={deliveryStatusLabel(order.deliveryStatus)} tone="orange" />
                  </section>

                  <PaymentNotice payment={payment} />

                  <section>
                    <SectionHeading
                      title="Items ordered"
                      description={`${order.items.length} product${order.items.length === 1 ? "" : "s"} will be handled by the seller and delivery workflow.`}
                    />
                    <div className="mt-4 grid gap-3">
                      {order.items.map((item) => (
                        <OrderItemCard key={item.id} item={item} order={order} />
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 md:p-5">
                    <SectionHeading title="Customer reassurance" description="What happens after placing this order." />
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <TrustPoint icon={<ShieldCheck className="h-5 w-5" />} title="Secure order" text="Your order is saved with secure checkout details." />
                      <TrustPoint icon={<PackageCheck className="h-5 w-5" />} title="Order updates" text="Track seller and delivery progress from your account." />
                      <TrustPoint icon={<HeartHandshake className="h-5 w-5" />} title="Support ready" text="Our team can help if a seller or payment update is needed." />
                    </div>
                  </section>
                </main>

                <aside className="grid h-fit gap-4">
                  <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#FFF0EC] text-[#ED3500]">
                        <ReceiptText className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-lg font-black text-[#1F2933]">Price details</h2>
                        <p className="text-xs font-semibold text-[#667085]">Charges locked when the order was placed.</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085]">
                      <ChargeRow label="Subtotal" value={formatOrderBuyerAmount(order, order.buyerSubtotalMinor, order.subtotalPaise)} />
                      {savingsPaise > 0 ? <ChargeRow label="Savings" value={`-${formatMoney(savingsPaise, order.currency)}`} positive /> : null}
                      {(order.couponDiscountPaise ?? 0) > 0 ? (
                        <ChargeRow
                          label={`Coupon ${order.couponCode ?? ""}`.trim()}
                          value={`-${formatOrderBuyerAmount(order, order.buyerCouponDiscountMinor, order.couponDiscountPaise ?? 0)}`}
                          positive
                        />
                      ) : null}
                      <ChargeRow label="Shipping" value={order.shippingPaise > 0 ? formatOrderBuyerAmount(order, order.buyerShippingMinor, order.shippingPaise) : "FREE"} />
                      <ChargeRow label="Platform fee" value={formatOrderBuyerAmount(order, order.buyerPlatformFeeMinor, order.platformFeePaise)} />
                      <ChargeRow label="GST" value="Included" />
                      <ChargeRow label="Total" value={formatOrderTotal(order)} strong />
                    </div>
                    {formatOrderBaseAmount(order, order.totalPaise) ? (
                      <p className="mt-3 text-xs font-semibold text-[#667085]">
                        Base total: {formatOrderBaseAmount(order, order.totalPaise)}
                      </p>
                    ) : null}
                  </section>

                  <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:p-5">
                    <h2 className="text-lg font-black text-[#1F2933]">Next steps</h2>
                    <div className="mt-4 grid gap-3">
                      <Button
                        asChild
                        size="lg"
                        className="w-full rounded-full bg-[#ED3500] !text-white hover:bg-[#C72D00] hover:!text-white [&_svg]:!text-white"
                      >
                        <Link href={`/account/orders/${order.orderNumber}` as Route}>
                          <Truck className="h-5 w-5" aria-hidden="true" />
                          Track order
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="secondary"
                        size="lg"
                        className="w-full rounded-full bg-[#163B5C] !text-white hover:bg-[#0F2D46] hover:!text-white"
                      >
                        <Link href="/account/orders">View orders</Link>
                      </Button>
                      <Button asChild variant="outline" size="lg" className="w-full rounded-full">
                        <Link href="/search">Continue shopping</Link>
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#BFEAD9] bg-[#F0FFF8] p-4 text-sm font-semibold leading-6 text-[#0B5F43] md:p-5">
                    <div className="flex items-start gap-3">
                      <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <p>
                        Delivery status starts at {deliveryStatusLabel(order.deliveryStatus)}. Estimated delivery appears when the seller or delivery team updates it.
                      </p>
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}

            {orderQuery.isError ? <StorefrontErrorPanel className="mt-6" error={orderQuery.error} onRetry={() => void orderQuery.refetch()} /> : null}
          </div>
        </StorefrontPanel>
      </section>
    </StorefrontFrame>
  );
}

function SuccessBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="absolute right-[12%] top-7 h-2 w-10 rotate-12 rounded-full bg-[#ED3500]/20" />
      <span className="absolute right-[22%] top-16 h-2 w-2 rounded-full bg-[#0F8A5F]/35" />
      <span className="absolute left-[6%] bottom-8 h-2 w-12 -rotate-12 rounded-full bg-[#0F8A5F]/15" />
      <span className="absolute left-[34%] top-8 h-2 w-2 rounded-full bg-[#ED3500]/25" />
    </div>
  );
}

function StatusTile({
  icon,
  label,
  value,
  tone,
  loading = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "blue" | "green" | "orange" | "warning";
  loading?: boolean;
}) {
  const toneClass = {
    blue: "bg-[#EAF1F7] text-[#163B5C]",
    green: "bg-[#E9F7F1] text-[#064C35]",
    orange: "bg-[#FFF0EC] text-[#9F2600]",
    warning: "bg-[#FFF7E6] text-[#B54708]",
  }[tone];

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <span className={cn("grid h-11 w-11 place-items-center rounded-xl", toneClass)}>
        {loading ? <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" /> : icon}
      </span>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function PaymentNotice({ payment }: { payment: ReturnType<typeof paymentSummary> }) {
  if (payment.kind === "PAID" || payment.kind === "COD") {
    return (
      <StorefrontNotice tone="success">
        {payment.description}
      </StorefrontNotice>
    );
  }

  if (payment.kind === "FAILED") {
    return (
      <StorefrontNotice tone="danger">
        Payment failed. The order is saved, but fulfilment will wait until payment is completed or support updates the payment status.
      </StorefrontNotice>
    );
  }

  return (
    <StorefrontNotice tone="warning">
      <span className="inline-flex items-center gap-2">
        {payment.loading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {payment.description}
      </span>
    </StorefrontNotice>
  );
}

function OrderItemCard({ item, order }: { item: OrderSummary["items"][number]; order: OrderSummary }) {
  const imageUrl = item.product ? primaryImage(item.product) : null;
  const variantLabel = item.variantSnapshot?.variantName ?? item.variantSnapshot?.sku ?? "Default";
  const deliveryEstimate = itemDeliveryEstimate(item, order);
  const itemSavings = itemSavingsPaise(item);

  return (
    <article className="grid gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:grid-cols-[96px_minmax(0,1fr)_auto]">
      <Link href={item.product ? (`/products/${item.product.slug}` as Route) : "/search"} className="relative aspect-square overflow-hidden rounded-2xl bg-[#F3F6F9]">
        <StorefrontImage src={imageUrl} alt={item.productNameSnapshot} sizes="96px" fallbackLabel={item.productNameSnapshot} />
      </Link>
      <div className="min-w-0">
        <p className="text-base font-black leading-6 text-[#1F2933]">{item.productNameSnapshot}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-full bg-[#EAF1F7] px-3 py-1 text-[#163B5C]">Qty {item.quantity}</span>
          <span className="rounded-full bg-[#FFF0EC] px-3 py-1 text-[#9F2600]">{variantLabel}</span>
          {item.seller ? <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[#667085]">Sold by {item.seller.storeName}</span> : null}
        </div>
        {item.product ? <StorefrontProductAttributeChips product={item.product} variant="inline" className="mt-2" /> : null}
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#667085]">
          <Truck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
          {deliveryEstimate}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-lg font-black text-[#163B5C]">{formatMoney(item.lineTotalPaise, item.currency)}</p>
        {item.originalUnitPricePaise && item.originalUnitPricePaise > item.unitPricePaise ? (
          <p className="mt-1 text-xs font-bold text-[#98A2B3] line-through">
            {formatMoney(item.originalUnitPricePaise * item.quantity, item.currency)}
          </p>
        ) : null}
        {itemSavings > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E9F7F1] px-2.5 py-1 text-xs font-black text-[#0F8A5F]">
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            Saved {formatMoney(itemSavings, item.currency)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function TrustPoint({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E9F7F1] text-[#0F8A5F]">{icon}</span>
      <p className="mt-3 text-sm font-black text-[#1F2933]">{title}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{text}</p>
    </div>
  );
}

function ChargeRow({
  label,
  value,
  strong = false,
  positive = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
}) {
  return (
    <StorefrontSummaryRow
      className={cn("border-b border-[#E5E7EB] pb-2 last:border-b-0 last:pb-0", positive && "text-[#0F8A5F]")}
      label={label}
      value={value}
      strong={strong}
    />
  );
}

function paymentSummary(order: OrderSummary) {
  const payment = primaryPayment(order);
  const method = (payment?.method ?? payment?.provider ?? "").toUpperCase();

  if (order.paymentStatus === "PAID") {
    return {
      kind: "PAID" as const,
      label: "Paid",
      description: "Payment is complete. Your order is ready for seller processing.",
      tone: "green" as const,
      loading: false,
    };
  }

  if (method === "COD") {
    return {
      kind: "COD" as const,
      label: "Cash on Delivery",
      description: "Payment method: Cash on Delivery. Pay only when the order is delivered.",
      tone: "green" as const,
      loading: false,
    };
  }

  if (order.paymentStatus === "FAILED") {
    return {
      kind: "FAILED" as const,
      label: "Payment failed",
      description: "Payment failed.",
      tone: "warning" as const,
      loading: false,
    };
  }

  if (method === "RAZORPAY") {
    return {
      kind: "PENDING" as const,
      label: "Awaiting Payment Confirmation",
      description: "Verifying your Razorpay payment. Please keep this order number until confirmation is complete.",
      tone: "warning" as const,
      loading: true,
    };
  }

  if (method === "BANK_TRANSFER") {
    return {
      kind: "PENDING" as const,
      label: "Bank transfer review",
      description: "We received the order and will update payment status after bank transfer verification.",
      tone: "warning" as const,
      loading: false,
    };
  }

  if (method === "MANUAL") {
    return {
      kind: "PENDING" as const,
      label: "Payment review pending",
      description: "Your order is placed and payment will be reviewed by the finance team.",
      tone: "warning" as const,
      loading: false,
    };
  }

  return {
    kind: "PENDING" as const,
    label: statusLabel(order.paymentStatus),
    description: "Payment status is being checked. Your order number is saved for tracking.",
    tone: "warning" as const,
    loading: order.paymentStatus === "PENDING",
  };
}

function primaryPayment(order: OrderSummary): PaymentSummary | null {
  const payments = (order as OrderSummary & { payments?: PaymentSummary[] }).payments ?? [];
  return payments[0] ?? null;
}

function orderSavingsPaise(order: OrderSummary) {
  return order.items.reduce((total, item) => total + itemSavingsPaise(item), 0);
}

function itemSavingsPaise(item: OrderSummary["items"][number]) {
  if (item.dealDiscountPaise && item.dealDiscountPaise > 0) {
    return item.dealDiscountPaise;
  }

  if (item.originalUnitPricePaise && item.originalUnitPricePaise > item.unitPricePaise) {
    return Math.max(0, item.originalUnitPricePaise * item.quantity - item.lineTotalPaise);
  }

  return 0;
}

function itemDeliveryEstimate(item: OrderSummary["items"][number], order: OrderSummary) {
  const shipmentEstimate = order.shipments?.find((shipment) => shipment.sellerId === item.sellerId)?.estimatedDeliveryDate;
  const estimate = shipmentEstimate ?? order.deliveryDetail?.estimatedDeliveryDate;

  return estimate ? `Estimated delivery ${formatDateTime(estimate)}` : "Delivery estimate will update soon";
}

function statusLabel(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deliveryStatusLabel(value?: string | null) {
  if (value === "PENDING") {
    return "Pending";
  }
  return statusLabel(value);
}

function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
