"use client";

import Link from "next/link";
import { ArrowRight, Clock3, IndianRupee } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { getDeliveryWallet, listDeliveryOrders, type DeliveryOrder } from "@/lib/delivery-api";
import {
  DeliveryEmptyState,
  DeliveryError,
  DeliveryIconTile,
  DeliveryMetric,
  DeliveryPanel,
  DeliveryStatusPill,
  DeliveryTruckIcon,
  formatDateTime,
  formatPaise,
  humanize,
  useDeliveryAuth
} from "./delivery-ui";

export function DeliveryDashboardClient() {
  const auth = useDeliveryAuth();
  const ordersQuery = useQuery({
    queryKey: ["delivery-orders", auth.authKey, "dashboard"],
    queryFn: () => listDeliveryOrders(auth.authHeaders, { limit: 50 }),
    enabled: auth.enabled,
    retry: false
  });
  const walletQuery = useQuery({
    queryKey: ["delivery-wallet", auth.authKey, "dashboard"],
    queryFn: () => getDeliveryWallet(auth.authHeaders, { limit: 5 }),
    enabled: auth.enabled,
    retry: false
  });

  if (!auth.enabled) {
    return null;
  }

  const orders = ordersQuery.data?.items ?? [];
  const activeOrders = orders.filter((order) => !["DELIVERED", "CANCELLED"].includes(order.deliveryStatus));
  const deliveredOrders = orders.filter((order) => order.deliveryStatus === "DELIVERED");
  const codPending = orders.filter(isCodPending);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DeliveryMetric label="Assigned" value={ordersQuery.data?.total ?? orders.length} note="Orders assigned by admin" />
        <DeliveryMetric label="Active" value={activeOrders.length} note="Pending, packed, or in transit" />
        <DeliveryMetric label="Delivered" value={deliveredOrders.length} note="Completed delivery updates" />
        <DeliveryMetric label="COD pending" value={codPending.length} note="Admin marks COD paid after verification" />
        <DeliveryMetric
          label="Wallet balance"
          value={formatPaise(walletQuery.data?.summary.availableBalancePaise ?? 0)}
          note={`${formatPaise(walletQuery.data?.summary.totalEarnedPaise ?? 0)} local earnings`}
        />
      </div>

      <DeliveryPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionHeading title="Today focus" description="Newest assigned delivery tasks with customer address and COD visibility." />
          <Button asChild variant="outline">
            <Link href="/delivery/orders">
              View all orders <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          {ordersQuery.isLoading ? <div className="h-48 animate-pulse rounded-md bg-[#F8FAFC]" /> : null}
          {ordersQuery.error ? <DeliveryError error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} /> : null}
          {!ordersQuery.isLoading && orders.length === 0 ? (
            <DeliveryEmptyState title="No assigned deliveries" message="Orders appear here after admin assigns this delivery partner from the order detail screen." />
          ) : null}
          {orders.slice(0, 8).map((order) => (
            <DeliveryOrderRow key={order.id} order={order} />
          ))}
        </div>
      </DeliveryPanel>
    </div>
  );
}

function DeliveryOrderRow({ order }: { order: DeliveryOrder }) {
  return (
    <div className="grid gap-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <DeliveryIconTile>
          <DeliveryTruckIcon />
        </DeliveryIconTile>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-black text-[#1F2933]">{order.orderNumber}</p>
            <DeliveryStatusPill status={order.deliveryStatus} />
            <StatusBadge tone={order.deliveryDetail?.assignmentStatus === "ACCEPTED" ? "success" : "warning"}>
              {humanize(order.deliveryDetail?.assignmentStatus ?? "ASSIGNED")}
            </StatusBadge>
            <StatusBadge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>{humanize(order.paymentStatus)}</StatusBadge>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            {formatDateTime(order.createdAt)} / {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? "" : "s"}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[#667085]">{addressLine(order)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <span className="inline-flex items-center gap-1 text-sm font-black text-[#123A5A]">
          <IndianRupee className="h-4 w-4" aria-hidden="true" />
          {formatPaise(order.buyerTotalMinor ?? order.totalPaise, order.buyerCurrency ?? order.currency)}
        </span>
        {isCodPending(order) ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EC] px-2.5 py-1 text-xs font-black text-[#ED3500]">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            COD pending
          </span>
        ) : null}
        <Button asChild size="sm">
          <Link href={`/delivery/orders/${order.orderNumber}`}>
            {order.deliveryDetail?.assignmentStatus === "ASSIGNED" ? "Accept" : "Open"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function isCodPending(order: DeliveryOrder) {
  return (
    order.paymentStatus === "PENDING" &&
    (order.payments ?? []).some((payment) => payment.provider === "COD" || payment.method === "COD")
  );
}

function addressLine(order: DeliveryOrder) {
  const address = order.shippingAddressSnapshot;
  return [address?.line1, address?.area, address?.city, address?.state, address?.pincode].filter(Boolean).join(", ") || "Address unavailable";
}
