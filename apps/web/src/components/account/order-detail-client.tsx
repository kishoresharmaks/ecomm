"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  Package,
  ReceiptText,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { marketplaceProductCardFields } from "@indihub/shared-types";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { AccountShell } from "./account-shell";
import {
  ErrorPanel,
  PagePanel,
  SkeletonBlock,
  StatusPill,
  TextAreaField,
  formatDateTime,
  statusLabel,
} from "./account-ui";
import { cancelCustomerOrder, getAccountOrder } from "@/lib/account-api";
import { customerDeliveryModeLabel } from "@/lib/delivery-labels";
import {
  canCustomerSelfCancelOrder,
  customerCancellationUnavailableReason,
  hasOrderLeftSeller,
} from "@/lib/order-cancellation";
import {
  formatMoney,
  formatOrderTotal,
  primaryImage,
  type ProductSummary,
} from "@/lib/storefront-api";

type AccountOrderDetail = Awaited<ReturnType<typeof getAccountOrder>>;

export function OrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();

  const orderQuery = useQuery({
    queryKey: ["account-order", customerAuth.authKey, orderNumber],
    queryFn: () => getAccountOrder(customerAuth.authHeaders, orderNumber),
    enabled: customerAuth.enabled,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (note?: string) => cancelCustomerOrder(customerAuth.authHeaders, orderNumber, note),
    onSuccess: () => {
      setNotice("Order cancelled.");
      void queryClient.invalidateQueries({
        queryKey: ["account-order", customerAuth.authKey, orderNumber],
      });
      void queryClient.invalidateQueries({ queryKey: ["account-orders", customerAuth.authKey] });
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Order cancellation failed."),
  });

  function cancelOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = String(form.get("note") ?? "").trim();
    setNotice(null);
    confirmation.requestConfirmation({
      title: "Cancel this order?",
      description: `Order ${orderNumber} will move to cancelled status. Seller fulfilment, delivery, and report totals will use this updated lifecycle state.`,
      confirmLabel: "Cancel order",
      onConfirm: () => cancelMutation.mutate(note || undefined),
    });
  }

  const order = orderQuery.data;
  const address = order?.shippingAddressSnapshot;
  const canCancel = order ? canCustomerSelfCancelOrder(order) : false;
  const cancellationUnavailableReason = order ? customerCancellationUnavailableReason(order) : null;
  const shouldShowSupportLink = order ? hasOrderLeftSeller(order) : false;
  const timeline = order ? buildTrackingTimeline(order) : [];
  const deliveryStatus = order?.deliveryDetail?.status ?? order?.deliveryStatus ?? null;
  const itemCount = order?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const packageCount = order?.shipments?.length ?? 0;
  const visiblePackageCount = packageCount || 1;

  return (
    <AccountShell
      title="Order detail"
      description={`Order ${orderNumber} with item, payment, delivery, and support information in one place.`}
    >
      {confirmation.confirmationDialog}
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <div className="mb-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/account/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to orders
          </Link>
        </Button>
      </div>

      {orderQuery.isLoading ? <SkeletonBlock /> : null}
      {orderQuery.error ? (
        <ErrorPanel error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />
      ) : null}

      {order ? (
        <div className="grid gap-4">
          <section className="overflow-hidden rounded-xl border border-[#C5D8E8] bg-[#163B5C] shadow-sm">
            <div className="grid gap-5 p-5 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-6">
              <div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-white hover:bg-white/10"
                >
                  <Link href="/account/orders">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to orders
                  </Link>
                </Button>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#FFD7C8]">
                  Placed on {formatDateTime(order.createdAt)}
                </p>
                <h2 className="mt-2 break-words text-2xl font-black tracking-normal md:text-4xl">
                  {order.orderNumber}
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill status={order.orderStatus} />
                  <StatusPill status={order.paymentStatus} />
                  <StatusPill status={order.deliveryStatus} />
                </div>
              </div>
              <div className="rounded-lg bg-white p-4 text-left text-[#163B5C] shadow-sm lg:min-w-64 lg:text-right">
                <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Order total
                </p>
                <p className="mt-1 text-3xl font-black">{formatOrderTotal(order)}</p>
                {order.buyerCurrency && order.buyerCurrency !== order.currency ? (
                  <p className="mt-1 text-xs font-bold text-[#667085]">
                    Base total {formatMoney(order.totalPaise, order.currency)} at{" "}
                    {order.fxProvider ?? "FX"} rate {order.fxRate ?? "locked"}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid border-t border-white/15 bg-[#0F2D47]/80 sm:grid-cols-2 xl:grid-cols-4">
              <OrderHeroMetric
                icon={Package}
                label="Items"
                value={`${itemCount} item${itemCount === 1 ? "" : "s"}`}
              />
              <OrderHeroMetric
                icon={Truck}
                label="Delivery"
                value={friendlyDeliveryLabel(deliveryStatus)}
              />
              <OrderHeroMetric
                icon={ReceiptText}
                label="Packages"
                value={`${visiblePackageCount} package${visiblePackageCount === 1 ? "" : "s"}`}
              />
              <OrderHeroMetric
                icon={Clock3}
                label="Last update"
                value={timeline[0] ? formatDateTime(timeline[0].createdAt) : "Awaiting update"}
              />
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid min-w-0 gap-4">
              <PagePanel className="p-0">
                <div className="border-b border-[#E5E7EB] p-5">
                  <SectionHeading
                    title="Delivery progress"
                    description="Current movement of this order from placement to delivery."
                  />
                </div>
                <DeliveryProgress currentStatus={deliveryStatus} />
              </PagePanel>

              <PagePanel>
                <SectionHeading
                  title="Items"
                  description="Products and seller details recorded when the order was placed."
                />
                <div className="mt-5 overflow-hidden rounded-lg border border-[#E5E7EB]">
                  {order.items.map((item) => {
                    const imageUrl = item.product ? primaryImage(item.product) : null;

                    return (
                      <div
                        key={item.id}
                        className="grid gap-4 border-b border-[#E5E7EB] bg-white p-4 last:border-b-0 md:grid-cols-[96px_1fr_auto]"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-md bg-[#EAF1F7]">
                          <StorefrontImage
                            src={imageUrl}
                            alt={item.productNameSnapshot}
                            sizes="96px"
                            fallbackLabel="Item"
                          />
                        </div>
                        <div>
                          <p className="font-black text-[#1F2933]">{item.productNameSnapshot}</p>
                          <p className="mt-1 text-sm font-semibold text-[#667085]">
                            {item.variantSnapshot?.variantName ??
                              item.variantSnapshot?.sku ??
                              "Default"}{" "}
                            x {item.quantity}
                          </p>
                          {item.seller?.storeName ? (
                            <p className="mt-1 text-sm font-semibold text-[#667085]">
                              Seller: {item.seller.storeName}
                            </p>
                          ) : null}
                          {item.product ? (
                            <OrderItemProductEssentials product={item.product} />
                          ) : null}
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-sm font-semibold text-[#667085]">
                            {formatMoney(item.unitPricePaise, item.currency)} each
                          </p>
                          <p className="mt-1 text-lg font-black text-[#163B5C]">
                            {formatMoney(item.lineTotalPaise, item.currency)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PagePanel>

              <PagePanel>
                <SectionHeading
                  title="Timeline"
                  description="Order and delivery events from seller, delivery, and admin updates."
                />
                <div className="mt-5 grid gap-3">
                  {timeline.slice(0, 8).map((event, index) => (
                    <div key={event.id} className="grid grid-cols-[28px_1fr] gap-3">
                      <span
                        className={`mt-1 grid h-7 w-7 place-items-center rounded-full border text-xs font-black ${
                          index === 0
                            ? "border-[#163B5C] bg-[#163B5C] text-white"
                            : "border-[#D8E2EA] bg-[#F8FAFC] text-[#667085]"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone="info">{event.kind}</StatusBadge>
                          <p className="font-black text-[#1F2933]">
                            {friendlyTimelineLabel(event.newStatus)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#667085]">
                          {formatDateTime(event.createdAt)}
                        </p>
                        {event.note ? (
                          <p className="mt-2 text-sm leading-6 text-[#667085]">{event.note}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 ? (
                    <p className="text-sm font-semibold text-[#667085]">
                      No timeline events found.
                    </p>
                  ) : null}
                </div>
              </PagePanel>
            </div>

            <div className="grid gap-4 xl:sticky xl:top-24">
              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading
                    title="Delivery address"
                    description="Snapshot saved at checkout."
                  />
                </div>
                <div className="mt-4 text-sm font-semibold leading-6 text-[#667085]">
                  <p className="font-black text-[#1F2933]">
                    {address?.fullName ?? "Not available"}
                  </p>
                  {address?.phone ? <p>{address.phone}</p> : null}
                  {address?.line1 ? <p>{address.line1}</p> : null}
                  {address?.line2 ? <p>{address.line2}</p> : null}
                  {address?.area ? <p>{address.area}</p> : null}
                  <p>
                    {[address?.city, address?.state, address?.pincode].filter(Boolean).join(", ") ||
                      "Address not available"}
                  </p>
                  {address?.country || address?.countryCode ? (
                    <p>{address.country ?? address.countryCode}</p>
                  ) : null}
                </div>
              </PagePanel>

              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                    <Truck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading
                    title="Delivery"
                    description="Delivery updates and tracking details."
                  />
                </div>
                <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085]">
                  <Info
                    label="Mode"
                    value={customerDeliveryModeLabel(order.deliveryDetail?.deliveryMode)}
                  />
                  <Info
                    label="Partner"
                    value={order.deliveryDetail?.partnerName ?? "Not assigned"}
                  />
                  <Info
                    label="Phone"
                    value={order.deliveryDetail?.partnerPhone ?? "Not assigned"}
                  />
                  <Info
                    label="Tracking"
                    value={order.deliveryDetail?.trackingReference ?? "Not assigned"}
                  />
                  <Info
                    label="Estimate"
                    value={
                      order.deliveryDetail?.estimatedDeliveryDate
                        ? formatDateTime(order.deliveryDetail.estimatedDeliveryDate)
                        : "Not assigned"
                    }
                  />
                  <Info
                    label="Status"
                    value={friendlyDeliveryLabel(
                      order.deliveryDetail?.status ?? order.deliveryStatus,
                    )}
                  />
                  <Info
                    label="Assignment"
                    value={friendlyAssignmentLabel(order.deliveryDetail?.assignmentStatus)}
                  />
                  <Info
                    label="Note"
                    value={order.deliveryDetail?.deliveryNote ?? "No delivery note yet"}
                  />
                </div>
              </PagePanel>

              {order.shipments?.length ? (
                <PagePanel>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-[#F8FAFC] text-[#163B5C]">
                      <Package className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <SectionHeading
                      title="Seller packages"
                      description="Each seller ships their own package."
                    />
                  </div>
                  <div className="mt-4 grid gap-3">
                    {order.shipments.map((shipment) => (
                      <div
                        key={shipment.id}
                        className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-black text-[#1F2933]">{shipment.shipmentNumber}</p>
                            <p className="mt-1 font-semibold text-[#667085]">
                              {shipment.seller?.storeName ?? "Seller package"}
                            </p>
                          </div>
                          <StatusPill status={shipment.status} />
                        </div>
                        <div className="mt-3 grid gap-2 font-semibold text-[#667085] sm:grid-cols-2">
                          <Info
                            label="Mode"
                            value={customerDeliveryModeLabel(shipment.deliveryMode)}
                          />
                          <Info
                            label="Assignment"
                            value={friendlyAssignmentLabel(shipment.assignmentStatus)}
                          />
                          <Info
                            label="Subtotal"
                            value={formatMoney(shipment.subtotalPaise, order.currency)}
                          />
                          <Info
                            label="Shipping share"
                            value={formatMoney(shipment.shippingPaise, order.currency)}
                          />
                          <Info
                            label="Tracking"
                            value={shipment.trackingReference ?? "Not assigned"}
                          />
                          <Info
                            label="Estimate"
                            value={
                              shipment.estimatedDeliveryDate
                                ? formatDateTime(shipment.estimatedDeliveryDate)
                                : "Not assigned"
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </PagePanel>
              ) : null}

              <PagePanel>
                <SectionHeading
                  title="Order charges"
                  description="Checkout fee snapshot saved with this order."
                />
                <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085]">
                  <Info label="Subtotal" value={formatMoney(order.subtotalPaise, order.currency)} />
                  <Info label="Shipping" value={formatMoney(order.shippingPaise, order.currency)} />
                  <Info
                    label="Platform fee"
                    value={formatMoney(order.platformFeePaise, order.currency)}
                  />
                  <Info label="Total" value={formatOrderTotal(order)} />
                </div>
              </PagePanel>

              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#E9F7F1] text-[#0F8A5F]">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading title="Payment" description="Latest payment attempt status." />
                </div>
                <div className="mt-4 grid gap-3">
                  {(order.payments ?? []).slice(0, 2).map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-[#1F2933]">
                          {statusLabel(payment.provider)}
                        </span>
                        <StatusPill status={payment.status} />
                      </div>
                      <p className="mt-1 font-semibold text-[#667085]">
                        {formatMoney(payment.amountPaise, payment.currency)}
                      </p>
                    </div>
                  ))}
                  {(order.payments ?? []).length === 0 ? (
                    <p className="text-sm font-semibold text-[#667085]">
                      No payment attempt found.
                    </p>
                  ) : null}
                </div>
              </PagePanel>

              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FDECEC] text-[#D64545]">
                    <Ban className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading title="Cancellation" description="Available before dispatch." />
                </div>

                {notice ? (
                  <div className="mt-4">
                    <StatusBadge tone={cancelMutation.isError ? "danger" : "success"}>
                      {notice}
                    </StatusBadge>
                  </div>
                ) : null}

                {canCancel ? (
                  <form onSubmit={cancelOrder} className="mt-5 grid gap-4">
                    <TextAreaField
                      label="Cancellation note"
                      name="note"
                      placeholder="Reason for cancellation"
                      rows={3}
                    />
                    <Button type="submit" variant="outline" disabled={cancelMutation.isPending}>
                      {cancelMutation.isPending ? "Cancelling..." : "Cancel order"}
                    </Button>
                  </form>
                ) : (
                  <div className="mt-5 grid gap-3">
                    <p className="text-sm font-semibold leading-6 text-[#667085]">
                      {cancellationUnavailableReason}
                    </p>
                    {shouldShowSupportLink ? (
                      <Button asChild variant="outline">
                        <Link href="/account/support">Contact support</Link>
                      </Button>
                    ) : null}
                  </div>
                )}
              </PagePanel>
            </div>
          </div>
        </div>
      ) : null}
    </AccountShell>
  );
}

function OrderHeroMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-white/10 px-5 py-4 text-white last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/10 text-[#FFD7C8]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black uppercase tracking-wide text-white/60">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-sm font-black">{value}</span>
      </span>
    </div>
  );
}

function DeliveryProgress({ currentStatus }: { currentStatus?: string | null }) {
  const steps = ["PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"];
  const currentIndex = steps.indexOf(currentStatus ?? "");
  const isCancelled = currentStatus === "CANCELLED";

  return (
    <div className="p-5">
      <div className="grid overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] sm:grid-cols-5">
        {steps.map((step, index) => {
          const complete = !isCancelled && currentIndex >= index;
          return (
            <div
              key={step}
              className={`flex items-center gap-3 border-b border-[#E5E7EB] p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
                complete ? "bg-[#E9F7F1]" : "bg-white"
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  complete ? "bg-[#0F8A5F] text-white" : "bg-[#F8FAFC] text-[#98A2B3]"
                }`}
              >
                <CheckCircle2 size={16} />
              </span>
              <span className="min-w-0 text-sm font-black text-[#1F2933]">
                {friendlyDeliveryLabel(step)}
              </span>
            </div>
          );
        })}
      </div>
      {isCancelled ? (
        <div className="mt-3 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-black text-[#8A1F1F]">
          This order delivery was cancelled.
        </div>
      ) : null}
    </div>
  );
}

function OrderItemProductEssentials({ product }: { product: ProductSummary }) {
  const chips = marketplaceProductCardFields
    .map((field) => {
      const value = displayOrderAttributeValue(product.attributes?.[field.key]);
      return value ? `${field.label}: ${value}` : null;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);

  if (!chips.length) {
    return null;
  }

  return <p className="mt-2 text-xs font-semibold text-[#98A2B3]">{chips.join(" | ")}</p>;
}

function displayOrderAttributeValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  return "";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <span className="text-right font-black text-[#1F2933]">{value}</span>
    </div>
  );
}

function buildTrackingTimeline(order: AccountOrderDetail) {
  return [
    ...(order.deliveryDetail?.events ?? []).map((event) => ({
      id: `delivery-${event.id}`,
      kind: "Delivery",
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null,
    })),
    ...(order.statusEvents ?? []).map((event) => ({
      id: `status-${event.id}`,
      kind: statusLabel(event.statusType),
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null,
    })),
  ].sort(
    (left, right) =>
      new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime(),
  );
}

function friendlyDeliveryLabel(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Assigned to partner";
    case "PACKED":
      return "Packed for pickup";
    case "DISPATCHED":
      return "Picked up";
    case "IN_TRANSIT":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Delivery cancelled";
    default:
      return statusLabel(status ?? "PENDING");
  }
}

function friendlyAssignmentLabel(status?: string | null) {
  switch (status) {
    case "ASSIGNED":
      return "Assigned to delivery partner";
    case "ACCEPTED":
      return "Accepted by delivery partner";
    case "REJECTED":
      return "Waiting for reassignment";
    case "CANCELLED":
      return "Assignment cancelled";
    default:
      return "Not assigned yet";
  }
}

function friendlyTimelineLabel(status?: string | null) {
  return friendlyDeliveryLabel(status);
}
