"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, PackageCheck, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { listSellerOrders } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSelect,
  SellerSkeleton,
  SellerStatusPill,
  formatDateTime,
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "./seller-ui";

const orderStatuses = ["", "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const deliveryStatuses = ["", "NOT_ASSIGNED", "PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];

export function SellerOrdersClient() {
  const sellerAuth = useSellerAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["seller-orders", sellerAuth.authKey, submittedSearch, orderStatus, deliveryStatus],
    queryFn: () =>
      listSellerOrders(sellerAuth.authHeaders, {
        search: submittedSearch,
        orderStatus,
        deliveryStatus,
        limit: 30
      }),
    enabled: sellerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (ordersQuery.error && isSellerOnboardingRequiredError(ordersQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before reviewing seller orders." />;
  }

  const orders = ordersQuery.data?.items ?? [];

  return (
    <SellerPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading title="Order queue" description="Orders containing this store's products with payment, delivery, and fulfilment state." />
        <form onSubmit={submit} className="flex w-full gap-2 lg:max-w-md">
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
        <SellerSelect label="Order status" name="orderStatus" value={orderStatus} onChange={setOrderStatus}>
          {orderStatuses.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? option.replace(/_/g, " ") : "All order statuses"}
            </option>
          ))}
        </SellerSelect>
        <SellerSelect label="Delivery status" name="deliveryStatus" value={deliveryStatus} onChange={setDeliveryStatus}>
          {deliveryStatuses.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? option.replace(/_/g, " ") : "All delivery statuses"}
            </option>
          ))}
        </SellerSelect>
      </div>

      <div className="mt-5 grid gap-3">
        {ordersQuery.isLoading ? <SellerSkeleton /> : null}
        {ordersQuery.error ? <SellerErrorPanel error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} /> : null}
        {!ordersQuery.isLoading && orders.length === 0 ? (
          <SellerEmptyState title="No orders found" message="Orders appear here after checkout includes this store's approved products." />
        ) : null}

        {orders.map((order) => {
          const sellerSplit = order.sellerSplits?.[0];
          const sellerSubtotal = sellerSplit?.sellerSubtotalPaise ?? 0;

          return (
            <div
              key={order.id}
              className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <PackageCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-lg font-black text-[#1F2933]">{order.orderNumber}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {formatDateTime(order.createdAt)} - {order.items.length} item{order.items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <StatusPair label="Order" status={order.orderStatus} />
                  <StatusPair label="Seller" status={sellerSplit?.sellerStatus} />
                  <StatusPair label="Delivery" status={order.deliveryStatus} />
                  <StatusPair label="Payment" status={order.paymentStatus} />
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <span className="font-black text-[#163B5C]">{formatMoney(sellerSubtotal || order.totalPaise, order.currency)}</span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/seller/orders/${order.orderNumber}`}>
                      Review / update
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SellerPanel>
  );
}

function StatusPair({ label, status }: { label: string; status?: string | null | undefined }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase tracking-wide text-[#667085] ring-1 ring-[#E5E7EB]">
      {label}
      <SellerStatusPill status={status} />
    </span>
  );
}
