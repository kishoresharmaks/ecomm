"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PackageCheck, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { AccountShell } from "./account-shell";
import { EmptyState, ErrorPanel, PagePanel, SkeletonBlock, StatusPill, formatDateTime } from "./account-ui";
import { listCustomerOrders } from "@/lib/account-api";
import { formatOrderTotal } from "@/lib/storefront-api";

export function OrdersClient() {
  const customerAuth = useCustomerAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["account-orders", customerAuth.authKey, submittedSearch],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, { search: submittedSearch, limit: 20 }),
    enabled: customerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  const orders = ordersQuery.data?.items ?? [];

  return (
    <AccountShell title="Orders" description="Customer order history, payment state, delivery state, and order detail access.">
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <PagePanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading title="Order history" description="Search by order number and open details for item, delivery, and cancellation controls." />
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

        <div className="mt-5 grid gap-3">
          {ordersQuery.isLoading ? <SkeletonBlock className="h-72" /> : null}
          {ordersQuery.error ? <ErrorPanel error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} /> : null}
          {!ordersQuery.isLoading && orders.length === 0 ? (
            <EmptyState
              title="No orders found"
              message="Completed checkout orders will appear here with status, payment, delivery, and item summaries."
              action={
                <Button asChild>
                  <Link href="/search">Continue shopping</Link>
                </Button>
              }
            />
          ) : null}

          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.orderNumber}`}
              className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <PackageCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-lg font-black text-[#1F2933]">{order.orderNumber}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {formatDateTime(order.createdAt)} - {order.items.length} item{order.items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <StatusPill status={order.orderStatus} />
                <StatusPill status={order.paymentStatus} />
                <StatusPill status={order.deliveryStatus} />
                <span className="text-base font-black text-[#163B5C]">{formatOrderTotal(order)}</span>
              </div>
            </Link>
          ))}
        </div>
      </PagePanel>
    </AccountShell>
  );
}
