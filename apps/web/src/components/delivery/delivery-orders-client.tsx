"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Search, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { listDeliveryOrders, type DeliveryOrder } from "@/lib/delivery-api";
import {
  DeliveryEmptyState,
  DeliveryError,
  DeliveryIconTile,
  DeliveryPanel,
  DeliveryStatusPill,
  formatDateTime,
  formatPaise,
  humanize,
  useDeliveryAuth
} from "./delivery-ui";

const deliveryStatuses = ["", "PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];
const paymentStatuses = ["", "PENDING", "PAID", "FAILED", "REFUNDED", "NOT_REQUIRED"];

export function DeliveryOrdersClient() {
  const auth = useDeliveryAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["delivery-orders", auth.authKey, submittedSearch, deliveryStatus, paymentStatus],
    queryFn: () =>
      listDeliveryOrders(auth.authHeaders, {
        search: submittedSearch,
        deliveryStatus,
        paymentStatus,
        limit: 40
      }),
    enabled: auth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  if (!auth.enabled) {
    return null;
  }

  const orders = ordersQuery.data?.items ?? [];

  return (
    <DeliveryPanel>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <SectionHeading title="Assigned order queue" description="Search assigned delivery orders and update progress from the order detail screen." />
        <form onSubmit={submit} className="flex w-full gap-2 xl:max-w-md">
          <label className="relative flex-1">
            <span className="sr-only">Search order number</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <DeliverySelect label="Delivery status" value={deliveryStatus} onChange={setDeliveryStatus} values={deliveryStatuses} fallback="All delivery statuses" />
        <DeliverySelect label="Payment status" value={paymentStatus} onChange={setPaymentStatus} values={paymentStatuses} fallback="All payment statuses" />
      </div>

      <div className="mt-5 grid gap-3">
        {ordersQuery.isLoading ? <div className="h-56 animate-pulse rounded-md bg-[#F8FAFC]" /> : null}
        {ordersQuery.error ? <DeliveryError error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} /> : null}
        {!ordersQuery.isLoading && orders.length === 0 ? (
          <DeliveryEmptyState title="No matching orders" message="Try clearing filters, or ask admin to assign this delivery partner to an order." />
        ) : null}
        {orders.map((order) => (
          <DeliveryOrderCard key={order.id} order={order} />
        ))}
      </div>
    </DeliveryPanel>
  );
}

function DeliveryOrderCard({ order }: { order: DeliveryOrder }) {
  const codPayment = order.payments?.find((payment) => payment.provider === "COD" || payment.method === "COD") ?? null;
  const codCollectionStatus = order.deliveryDetail?.codCollectionStatus ?? "NOT_COLLECTED";

  return (
    <div className="grid gap-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <DeliveryIconTile>
          <Truck className="h-5 w-5" aria-hidden="true" />
        </DeliveryIconTile>
        <div className="min-w-0">
          <p className="text-lg font-black text-[#1F2933]">{order.orderNumber}</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            {formatDateTime(order.createdAt)} / {order.customer?.fullName || order.customer?.email || "Customer"}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{order.items?.map((item) => `${item.productNameSnapshot} x ${item.quantity}`).join(", ")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <DeliveryStatusPill status={order.deliveryStatus} />
          <StatusBadge tone={order.deliveryDetail?.assignmentStatus === "ACCEPTED" ? "success" : "warning"}>
            {humanize(order.deliveryDetail?.assignmentStatus ?? "ASSIGNED")}
          </StatusBadge>
          <StatusBadge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>{humanize(order.paymentStatus)}</StatusBadge>
          {codPayment ? <StatusBadge tone={codCollectionTone(codCollectionStatus)}>COD {humanize(codCollectionStatus)}</StatusBadge> : null}
          <StatusBadge tone="info">{humanize(order.orderStatus)}</StatusBadge>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <span className="font-black text-[#123A5A]">{formatPaise(order.buyerTotalMinor ?? order.totalPaise, order.buyerCurrency ?? order.currency)}</span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/delivery/orders/${order.orderNumber}`}>
              {order.deliveryDetail?.assignmentStatus === "ASSIGNED" ? "Accept assignment" : "Update delivery"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function codCollectionTone(status?: string | null) {
  if (status === "VERIFIED") {
    return "success";
  }
  if (status === "REJECTED") {
    return "danger";
  }
  if (status === "COLLECTED") {
    return "warning";
  }
  return "neutral";
}

function DeliverySelect({
  label,
  value,
  values,
  fallback,
  onChange
}: {
  label: string;
  value: string;
  values: string[];
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
      >
        {values.map((option) => (
          <option key={option || "all"} value={option}>
            {option ? humanize(option) : fallback}
          </option>
        ))}
      </select>
    </label>
  );
}
