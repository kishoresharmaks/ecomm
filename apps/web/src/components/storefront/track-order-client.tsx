"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, ClipboardList, MapPin, PackageCheck, RefreshCw, Search, Truck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { customerDeliveryModeLabel } from "@/lib/delivery-labels";
import { formatMoney, formatOrderTotal, trackOrder, type PublicTrackedOrder } from "@/lib/storefront-api";
import { StorefrontFrame } from "./storefront-frame";
import {
  StorefrontEmptyState,
  StorefrontFormPanel,
  StorefrontInfoItem,
  StorefrontNotice,
  StorefrontPageHeader,
  StorefrontPanel,
  StorefrontPanelHeader,
  storefrontFieldLabelClassName,
  storefrontInputClassName,
} from "./storefront-ui";

export function TrackOrderClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const trackingMutation = useMutation({
    mutationFn: () => {
      const cleanedOrderNumber = orderNumber.trim();
      const cleanedContact = contact.trim();

      if (cleanedOrderNumber.length < 6) {
        throw new Error("Enter a valid order number.");
      }
      if (cleanedContact.length < 5) {
        throw new Error("Enter the phone number or email used for the order.");
      }

      return trackOrder({ orderNumber: cleanedOrderNumber, contact: cleanedContact });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Unable to track order."),
    onSuccess: () => setFormError(null)
  });
  const order = trackingMutation.data;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    trackingMutation.mutate();
  }

  return (
    <StorefrontFrame>
      <StorefrontPageHeader
        badge="Order tracking"
        title="Track your order"
        description="Check order, payment, and delivery status with the order number and customer contact used during checkout."
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[420px_minmax(0,1fr)] lg:px-6">
        <StorefrontFormPanel onSubmit={submit} className="h-fit">
          <StorefrontPanelHeader icon={ClipboardList} title="Tracking lookup" description="Contact must match the order customer email or delivery phone." />
          <div className="mt-5 grid gap-4">
            <label className="space-y-2">
              <span className={storefrontFieldLabelClassName}>Order number</span>
              <input
                value={orderNumber}
                onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
                placeholder="1HI20260523123456"
                className={storefrontInputClassName}
              />
            </label>
            <label className="space-y-2">
              <span className={storefrontFieldLabelClassName}>Phone or email</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="9876543210 or customer@example.com"
                className={storefrontInputClassName}
              />
            </label>
          </div>

          {formError ? (
            <StorefrontNotice tone="danger" className="mt-5">{formError}</StorefrontNotice>
          ) : null}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={trackingMutation.isPending}>
            {trackingMutation.isPending ? <RefreshCw size={17} /> : <Search size={17} />}
            {trackingMutation.isPending ? "Checking" : "Track order"}
          </Button>

          <div className="mt-5 border-t border-[#E5E7EB] pt-5">
            <Button asChild variant="outline" className="w-full">
              <Link href="/account/orders">Open account orders</Link>
            </Button>
          </div>
        </StorefrontFormPanel>

        {order ? <TrackedOrderPanel order={order} /> : <EmptyTrackingPanel />}
      </section>
    </StorefrontFrame>
  );
}

function TrackedOrderPanel({ order }: { order: PublicTrackedOrder }) {
  const shippingLocation = [
    order.shippingLocation?.city,
    order.shippingLocation?.state,
    order.shippingLocation?.pincode,
    order.shippingLocation?.country
  ].filter(Boolean).join(", ");

  return (
    <StorefrontPanel>
      <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <StatusBadge tone={order.orderStatus === "CANCELLED" ? "warning" : "success"}>{statusLabel(order.orderStatus)}</StatusBadge>
          <h2 className="mt-3 text-2xl font-black text-[#163B5C]">{order.orderNumber}</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="rounded-md bg-[#FFFCFB] px-4 py-3 text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-[#667085]">Total</p>
          <p className="mt-1 text-xl font-black text-[#1F2933]">{formatOrderTotal(order)}</p>
          {order.buyerCurrency && order.buyerCurrency !== order.currency ? (
            <p className="mt-1 text-xs font-bold text-[#667085]">Base {formatMoney(order.totalPaise, order.currency)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatusTile icon={<PackageCheck size={18} />} label="Order" value={statusLabel(order.orderStatus)} tone="blue" />
        <StatusTile icon={<Truck size={18} />} label="Delivery" value={friendlyDeliveryLabel(order.deliveryStatus)} tone="orange" />
        <StatusTile icon={<ClipboardList size={18} />} label="Payment" value={statusLabel(order.paymentStatus)} tone="green" />
      </div>

      <section className="mt-7">
        <SectionHeading title="Delivery detail" description={shippingLocation || "Shipping location is attached to the order."} />
        <div className="mt-4 grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085] md:grid-cols-2">
          <Info label="Mode" value={customerDeliveryModeLabel(order.deliveryDetail?.deliveryMode)} />
          <Info label="Status" value={friendlyDeliveryLabel(order.deliveryDetail?.status ?? order.deliveryStatus)} />
          <Info label="Partner" value={order.deliveryDetail?.partnerName ?? "Not assigned"} />
          <Info label="Partner phone" value={order.deliveryDetail?.partnerPhone ?? "Not assigned"} />
          <Info label="Tracking" value={order.deliveryDetail?.trackingReference ?? "Not assigned"} />
          <Info
            label="Estimate"
            value={order.deliveryDetail?.estimatedDeliveryDate ? formatDateTime(order.deliveryDetail.estimatedDeliveryDate) : "Not assigned"}
          />
          <Info label="Location" value={shippingLocation || "Not available"} />
          <Info label="Note" value={order.deliveryDetail?.deliveryNote ?? "No delivery note yet"} />
        </div>
      </section>

      <section className="mt-7">
        <SectionHeading title="Delivery progress" description="Clear delivery milestones for this order." />
        <DeliveryProgress currentStatus={order.deliveryDetail?.status ?? order.deliveryStatus} />
      </section>

      <section className="mt-7">
        <SectionHeading title="Items" description={`${order.items.length} item${order.items.length === 1 ? "" : "s"} in this order.`} />
        <div className="mt-4 overflow-hidden rounded-md border border-[#E5E7EB]">
          {order.items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 border-b border-[#E5E7EB] bg-white p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-[#1F2933]">{item.productNameSnapshot}</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  {item.variantSnapshot?.variantName ?? item.variantSnapshot?.sku ?? "Default"} x {item.quantity}
                </p>
                {item.seller ? <p className="mt-1 text-xs font-bold text-[#667085]">Sold by {item.seller.storeName}</p> : null}
              </div>
              <p className="font-black text-[#163B5C]">{formatMoney(item.lineTotalPaise, item.currency)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeading title="Order charges" description="Checkout charges locked for this order." />
        <div className="mt-4 grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085] md:grid-cols-2">
          <Info label="Subtotal" value={formatMoney(order.subtotalPaise, order.currency)} />
          <Info label="Shipping" value={formatMoney(order.shippingPaise, order.currency)} />
          <Info label="Platform fee" value={formatMoney(order.platformFeePaise, order.currency)} />
          <Info label="Total" value={formatOrderTotal(order)} />
        </div>
      </section>

      {buildTrackingTimeline(order).length ? (
        <section className="mt-7">
          <SectionHeading title="Tracking timeline" description="Latest delivery and order events from admin, seller, and delivery updates." />
          <div className="mt-4 grid gap-3">
            {buildTrackingTimeline(order).map((event) => (
              <div key={event.id} className="rounded-md border border-[#E5E7EB] bg-white p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{event.kind}</StatusBadge>
                    <p className="text-sm font-black text-[#1F2933]">{friendlyTimelineLabel(event.newStatus)}</p>
                  </div>
                  <p className="text-xs font-bold text-[#667085]">{formatDateTime(event.createdAt)}</p>
                </div>
                {event.note ? <p className="mt-2 text-sm font-semibold text-[#667085]">{event.note}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </StorefrontPanel>
  );
}

function DeliveryProgress({ currentStatus }: { currentStatus?: string | null }) {
  const steps = ["PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"];
  const currentIndex = steps.indexOf(currentStatus ?? "");
  const isCancelled = currentStatus === "CANCELLED";

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-5">
      {steps.map((step, index) => {
        const complete = !isCancelled && currentIndex >= index;
        return (
          <div
            key={step}
            className={`rounded-md border p-4 ${complete ? "border-[#B9E6D3] bg-[#E9F7F1]" : "border-[#E5E7EB] bg-white"}`}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-full ${complete ? "bg-[#0F8A5F] text-white" : "bg-[#F1F5F9] text-[#667085]"}`}>
              <CheckCircle2 size={16} />
            </span>
            <p className="mt-3 text-sm font-black text-[#1F2933]">{friendlyDeliveryLabel(step)}</p>
          </div>
        );
      })}
      {isCancelled ? (
        <div className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-4 md:col-span-5">
          <p className="text-sm font-black text-[#8A1F1F]">This order delivery was cancelled.</p>
        </div>
      ) : null}
    </div>
  );
}

function EmptyTrackingPanel() {
  return (
    <StorefrontEmptyState
      icon={MapPin}
      title="Order status appears here"
      description="Enter your order number and matching customer contact to see payment, delivery, item, and timeline details."
      className="grid min-h-[420px] place-items-center bg-white"
      centered
    />
  );
}

function StatusTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "blue" | "orange" | "green" }) {
  const toneClass = {
    blue: "bg-[#EAF1F7] text-[#163B5C]",
    orange: "bg-[#FFF0EC] text-[#9F2600]",
    green: "bg-[#E9F7F1] text-[#064C35]"
  }[tone];

  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-4">
      <div className={`grid h-9 w-9 place-items-center rounded-md ${toneClass}`}>{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <StorefrontInfoItem label={label} value={value} />;
}

function buildTrackingTimeline(order: PublicTrackedOrder) {
  return [
    ...(order.deliveryDetail?.events ?? []).map((event) => ({
      id: `delivery-${event.id}`,
      kind: "Delivery",
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null
    })),
    ...(order.statusEvents ?? []).map((event) => ({
      id: `status-${event.id}`,
      kind: statusLabel(event.statusType),
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null
    }))
  ].sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime());
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
      return statusLabel(status);
  }
}

function friendlyTimelineLabel(status?: string | null) {
  return friendlyDeliveryLabel(status);
}

function statusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not assigned";
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
