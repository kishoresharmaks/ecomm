"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, BarChart3, Boxes, Building2, CalendarDays, CreditCard, ExternalLink, PackageCheck, ShoppingBag, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { getSellerProfile, getSellerSalesReport } from "@/lib/seller-api";
import {
  SellerEmptyState,
  SellerErrorPanel,
  SellerMetric,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  SellerStartWelcome,
  SellerStatusPill,
  formatDateTime,
  isSellerApproved,
  isSellerOnboardingRequiredError,
  sellerHasCapability,
  statusLabel,
  useSellerAuth
} from "./seller-ui";

export function SellerDashboardClient() {
  const sellerAuth = useSellerAuth();

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });

  const hasSellerProfile = Boolean(profileQuery.data);
  const retailEnabled = sellerHasCapability(profileQuery.data, "RETAIL");
  const serviceEnabled = sellerHasCapability(profileQuery.data, "SERVICE");
  const reportQuery = useQuery({
    queryKey: ["seller-sales-report", sellerAuth.authKey, "dashboard"],
    queryFn: () => getSellerSalesReport(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled && hasSellerProfile && retailEnabled,
    retry: false
  });

  if (!sellerAuth.enabled) {
    return (
      <SellerStartWelcome message="Welcome. Choose how you want to join the 1HandIndia Seller Hub, then sign in or create an account to submit the onboarding form." />
    );
  }

  if (profileQuery.isLoading || (hasSellerProfile && retailEnabled && reportQuery.isLoading)) {
    return <SellerSkeleton />;
  }

  if (profileQuery.error) {
    if (isSellerOnboardingRequiredError(profileQuery.error)) {
      return <SellerOnboardingRequired message="Submit seller onboarding to unlock dashboard, catalogue, order, B2B, and sales tools." />;
    }

    return <SellerErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }

  const profile = profileQuery.data;
  const report = reportQuery.data;
  const sellerReady = isSellerApproved(profile);

  return (
    <div className="grid gap-5">
      <header className="mb-6 border-b border-[#D9E2EA] pb-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ED3500]">Seller Center</p>
            <h1 className="mt-2 max-w-5xl text-3xl font-black tracking-normal text-[#123A5A] md:text-4xl">Operations dashboard</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#5F6F82] md:text-base">Track store readiness, orders, catalogue health, B2B demand, and low-stock tasks.</p>
          </div>
        </div>
      </header>

      {retailEnabled && reportQuery.error ? <SellerErrorPanel error={reportQuery.error} onRetry={() => void reportQuery.refetch()} /> : null}
      {!sellerReady ? (
        <SellerPanel className="border-[#FFC7B8] bg-[#FFF0EC]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-base font-black text-[#9F2600]">Seller approval is pending</p>
              <p className="mt-1 text-sm leading-6 text-[#9F2600]">Profile and onboarding can be updated now. Product publishing and order operations unlock after verification.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/seller/pending-approval">Review approval status</Link>
            </Button>
          </div>
        </SellerPanel>
      ) : null}

      {profile?.subscriptionPlan ? (
        <SellerPanel className="border-[#D9E2EA] bg-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-base font-black text-[#1F2933]">{profile.subscriptionPlan.name}</p>
                <p className="mt-1 text-sm leading-6 text-[#667085]">
                  Subscription status: {statusLabel(profile.subscriptionStatus)}. Plan capacity is managed by platform support.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/seller/subscription">View subscription</Link>
            </Button>
          </div>
        </SellerPanel>
      ) : null}

      <SellerPanel>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-[#1F2933]">{profile?.storeName}</h2>
                <SellerStatusPill status={profile?.approvalStatus} />
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
                {profile?.profile?.description ?? (serviceEnabled && !retailEnabled
                  ? "Keep services, bookings, availability, and payouts in one workspace."
                  : "Keep store profile, catalogue, orders, delivery, B2B enquiries, and sales reporting in one workspace.")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {sellerReady && profile?.slug ? (
              <Button asChild variant="outline">
                <Link href={`/stores/${profile.slug}` as Route}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View public store
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/seller/store-profile">Edit profile</Link>
            </Button>
            {retailEnabled ? (
              <Button asChild>
                <Link href="/seller/products/new">
                  Add product <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            {serviceEnabled ? (
              <Button asChild>
                <Link href="/seller/services/new">
                  Add service <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </SellerPanel>

      {retailEnabled && !reportQuery.error ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric label="Net sales" value={formatMoney(report?.summary.netSalesPaise ?? 0, profile?.operatingCurrency || "INR")} note="After marketplace commission" />
            <SellerMetric label="Orders" value={report?.summary.orderCount ?? 0} note="Seller split count" />
            <SellerMetric label="Products" value={report?.summary.products ?? 0} note="All seller products" />
            <SellerMetric label="B2B enquiries" value={report?.summary.b2bEnquiries ?? 0} note="Buyer quotation requests" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <SellerPanel>
          <div className="flex items-center justify-between gap-3">
            <SectionHeading title="Recent orders" description="Latest orders containing this store's products." />
            <Button asChild variant="ghost" size="sm">
              <Link href="/seller/orders">View all</Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-3">
            {(report?.recentOrders ?? []).slice(0, 6).map((split) => (
              <Link
                key={split.id}
                href={`/seller/orders/${split.order.orderNumber}`}
                className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                    <PackageCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-black text-[#1F2933]">{split.order.orderNumber}</p>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">{formatDateTime(split.order.createdAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <SellerStatusPill status={split.sellerStatus} />
                  <span className="font-black text-[#163B5C]">{formatMoney(split.sellerSubtotalPaise, split.order.currency)}</span>
                </div>
              </Link>
            ))}
            {(report?.recentOrders ?? []).length === 0 ? (
              <SellerEmptyState title="No orders yet" message="Orders appear here after customers check out with this store's products." />
            ) : null}
          </div>
            </SellerPanel>

            <div className="grid gap-5">
              <SellerPanel>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FDECEC] text-[#D64545]">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading title="Low stock" description="Variants at five units or below." />
            </div>
            <div className="mt-5 grid gap-3">
              {(report?.lowStockProducts ?? []).slice(0, 5).map((variant) => (
                <div key={variant.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <p className="font-black text-[#1F2933]">{variant.product.name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {variant.variantName ?? variant.sku} - {variant.stockQuantity} left
                  </p>
                </div>
              ))}
              {(report?.lowStockProducts ?? []).length === 0 ? <p className="text-sm font-semibold text-[#667085]">No low-stock variants.</p> : null}
            </div>
              </SellerPanel>

              <SellerPanel>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <QuickLink href="/seller/products" label="Products" icon={<Boxes className="h-5 w-5" aria-hidden="true" />} />
                  <QuickLink href="/seller/orders" label="Orders" icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />} />
                  <QuickLink href="/seller/reports" label="Reports" icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />} />
                </div>
              </SellerPanel>
            </div>
          </div>
        </>
      ) : null}
      {serviceEnabled && !retailEnabled ? (
        <SellerPanel>
          <SectionHeading title="Service operations" description="Manage listings, bookings, and working availability." />
          <div className="mt-5 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
            <QuickLink href="/seller/services" label="Services" icon={<Wrench className="h-5 w-5" aria-hidden="true" />} />
            <QuickLink href="/seller/service-bookings" label="Bookings" icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />} />
            <QuickLink href="/seller/service-calendar" label="Calendar" icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />} />
          </div>
        </SellerPanel>
      ) : null}
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link href={href} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-black text-[#1F2933] transition hover:border-[#ED3500]">
      <span className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">{icon}</span>
      {statusLabel(label)}
    </Link>
  );
}
