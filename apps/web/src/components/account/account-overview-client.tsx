"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { AccountMetric, EmptyState, ErrorPanel, PagePanel, SkeletonBlock, StatusPill, formatDateTime } from "./account-ui";
import { AccountShell } from "./account-shell";
import { getCustomerProfile, listCustomerOrders } from "@/lib/account-api";
import { formatMoney, formatOrderTotal } from "@/lib/storefront-api";

export function AccountOverviewClient() {
  const customerAuth = useCustomerAuth();

  const profileQuery = useQuery({
    queryKey: ["account-profile", customerAuth.authKey],
    queryFn: () => getCustomerProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });
  const ordersQuery = useQuery({
    queryKey: ["account-orders", customerAuth.authKey, "overview"],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, { limit: 3 }),
    enabled: customerAuth.enabled,
    retry: false
  });

  const profile = profileQuery.data;
  const orders = ordersQuery.data?.items ?? [];
  const defaultAddress = profile?.addresses.find((address) => address.isDefault) ?? profile?.addresses[0];
  const orderTotal = orders.reduce((total, order) => total + order.totalPaise, 0);

  return (
    <AccountShell
      title="Account overview"
      description="Manage customer profile, delivery addresses, wishlist, order history, and support requests from one place."
    >
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      {profileQuery.isLoading ? <SkeletonBlock /> : null}
      {profileQuery.error ? <ErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}

      {profile ? (
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <AccountMetric label="Orders" value={profile._count?.orders ?? 0} note="Customer order history" />
            <AccountMetric label="Addresses" value={profile.addresses.length} note="Saved delivery locations" />
            <AccountMetric label="Recent value" value={formatMoney(orderTotal)} note="Last visible orders" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <PagePanel>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <SectionHeading title="Recent orders" description="Latest customer orders with payment and delivery status." />
                <Button asChild variant="outline">
                  <Link href="/account/orders">View all orders</Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-3">
                {ordersQuery.isLoading ? <SkeletonBlock className="h-40" /> : null}
                {!ordersQuery.isLoading && orders.length === 0 ? (
                  <EmptyState
                    title="No orders yet"
                    message="Orders placed from checkout will appear here with payment and delivery progress."
                    action={
                      <Button asChild>
                        <Link href="/search">Browse products</Link>
                      </Button>
                    }
                  />
                ) : null}
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/account/orders/${order.orderNumber}`}
                    className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="text-base font-black text-[#1F2933]">{order.orderNumber}</p>
                      <p className="mt-1 text-xs font-semibold text-[#667085]">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <StatusPill status={order.orderStatus} />
                      <StatusPill status={order.deliveryStatus} />
                      <span className="text-sm font-black text-[#163B5C]">{formatOrderTotal(order)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </PagePanel>

            <div className="grid gap-5">
              <PagePanel>
                <SectionHeading title="Profile" description="Customer identity attached to the active account." />
                <div className="mt-5 grid gap-3 text-sm">
                  <InfoLine label="Name" value={profile.user.fullName ?? profile.displayName ?? "Not set"} />
                  <InfoLine label="Email" value={profile.user.email} />
                  <InfoLine label="Phone" value={profile.user.phone ?? "Not set"} />
                </div>
                <Button asChild className="mt-5 w-full" variant="outline">
                  <Link href="/account/profile">Edit profile</Link>
                </Button>
              </PagePanel>

              <PagePanel>
                <SectionHeading title="Default address" description="Used as the preferred delivery location." />
                {defaultAddress ? (
                  <div className="mt-5 text-sm font-semibold leading-6 text-[#667085]">
                    <p className="font-black text-[#1F2933]">{defaultAddress.label ?? "Delivery address"}</p>
                    <p>{defaultAddress.fullName}</p>
                    <p>{defaultAddress.line1}</p>
                    {defaultAddress.line2 ? <p>{defaultAddress.line2}</p> : null}
                    {defaultAddress.area ? <p>{defaultAddress.area}</p> : null}
                    <p>
                      {defaultAddress.city}, {defaultAddress.state} {defaultAddress.pincode}
                    </p>
                    <p>{defaultAddress.country ?? defaultAddress.countryCode ?? "India"}</p>
                  </div>
                ) : (
                  <p className="mt-5 text-sm font-semibold text-[#667085]">No delivery address saved yet.</p>
                )}
                <Button asChild className="mt-5 w-full" variant="outline">
                  <Link href="/account/addresses">Manage addresses</Link>
                </Button>
              </PagePanel>
            </div>
          </div>
        </div>
      ) : null}
    </AccountShell>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3 last:border-b-0 last:pb-0">
      <span className="font-bold text-[#667085]">{label}</span>
      <span className="text-right font-black text-[#1F2933]">{value}</span>
    </div>
  );
}
