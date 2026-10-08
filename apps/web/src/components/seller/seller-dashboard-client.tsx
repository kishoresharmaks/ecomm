"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Package,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, cn } from "@indihub/ui";
import { formatMoney, listCmsAnnouncements, type CmsAnnouncement } from "@/lib/storefront-api";
import {
  buildSellerAnnouncementDismissalUpdate,
  isSellerAnnouncementDismissed,
  resolveSellerAnnouncementTheme,
} from "@/lib/seller-announcement";
import {
  getSellerFinanceReport,
  getSellerProfile,
  getSellerSalesReport,
} from "@/lib/seller-api";
import {
  SellerErrorPanel,
  SellerOnboardingRequired,
  SellerSkeleton,
  SellerStartWelcome,
  SellerStatusPill,
  formatDateTime,
  isSellerApproved,
  isSellerOnboardingRequiredError,
  sellerHasCapability,
  statusLabel,
  useSellerAuth,
} from "./seller-ui";

type OrderFilterTab = "ALL" | "PENDING" | "DISPATCHED" | "DELIVERED";

export function SellerDashboardClient() {
  const sellerAuth = useSellerAuth();
  const [showDeductionsModal, setShowDeductionsModal] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilterTab>("ALL");
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<Record<string, string>>({});
  const [hasLoadedDismissals, setHasLoadedDismissals] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("indihub_seller_dismissed_announcements");
      if (stored) {
        setDismissedAnnouncementIds(JSON.parse(stored));
      }
    } catch {
      // ignore
    } finally {
      setHasLoadedDismissals(true);
    }
  }, []);

  const announcementsQuery = useQuery({
    queryKey: ["seller-cms-announcements"],
    queryFn: () => listCmsAnnouncements("SELLER_DASHBOARD"),
    staleTime: 60_000,
  });

  const handleDismissAnnouncement = (announcement: CmsAnnouncement) => {
    const updated = buildSellerAnnouncementDismissalUpdate(announcement, dismissedAnnouncementIds);
    setDismissedAnnouncementIds(updated);
    try {
      localStorage.setItem("indihub_seller_dismissed_announcements", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const activeAnnouncements = (announcementsQuery.data ?? []).filter((item) => {
    if (!hasLoadedDismissals) return false;
    return !isSellerAnnouncementDismissed(item, dismissedAnnouncementIds);
  });

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const hasSellerProfile = Boolean(profileQuery.data);
  const retailEnabled = sellerHasCapability(profileQuery.data, "RETAIL");
  const serviceEnabled = sellerHasCapability(profileQuery.data, "SERVICE");

  const reportQuery = useQuery({
    queryKey: ["seller-sales-report", sellerAuth.authKey, "dashboard"],
    queryFn: () => getSellerSalesReport(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled && hasSellerProfile && retailEnabled,
    retry: false,
  });

  const financeQuery = useQuery({
    queryKey: ["seller-finance-report", sellerAuth.authKey, "dashboard"],
    queryFn: () => getSellerFinanceReport(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled && hasSellerProfile && retailEnabled,
    retry: false,
  });

  if (!sellerAuth.enabled) {
    return (
      <SellerStartWelcome message="Welcome to 1HandIndia Seller Hub. Choose how you want to join, then sign in or create an account to start selling." />
    );
  }

  if (profileQuery.isLoading || (hasSellerProfile && retailEnabled && reportQuery.isLoading)) {
    return <SellerSkeleton />;
  }

  if (profileQuery.error) {
    if (isSellerOnboardingRequiredError(profileQuery.error)) {
      return (
        <SellerOnboardingRequired message="Submit seller onboarding to unlock dashboard, catalogue, order, B2B, and sales tools." />
      );
    }
    return (
      <SellerErrorPanel
        error={profileQuery.error}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const profile = profileQuery.data;
  const report = reportQuery.data;
  const finance = financeQuery.data;
  const sellerReady = isSellerApproved(profile);
  const operatingCurrency = profile?.operatingCurrency || "INR";

  // Financial calculations
  const totalSalesPaise = report?.summary.totalSalesPaise ?? 0;
  const netSalesPaise = report?.summary.netSalesPaise ?? 0;
  const tdsPaise = report?.summary.tdsPaise ?? 0;
  const tcsPaise = report?.summary.tcsPaise ?? 0;
  const commissionPaise = report?.summary.commissionPaise ?? 0;
  const gstOnCommissionPaise = report?.summary.gstOnCommissionPaise ?? 0;
  const platformFeePaise = report?.summary.platformFeePaise ?? 0;
  const totalDeductionsPaise = Math.max(0, totalSalesPaise - netSalesPaise);

  const eligiblePayoutPaise = finance?.summary.eligiblePaise ?? 0;
  const paidPayoutsPaise = finance?.summary.paidPayoutsPaise ?? 0;

  // Order statistics
  const recentOrders = report?.recentOrders ?? [];
  const pendingOrdersCount = recentOrders.filter(
    (s) => s.sellerStatus === "PENDING" || s.sellerStatus === "PROCESSING",
  ).length;

  const filteredOrders = recentOrders.filter((split) => {
    if (orderFilter === "ALL") return true;
    if (orderFilter === "PENDING") {
      return split.sellerStatus === "PENDING" || split.sellerStatus === "PROCESSING";
    }
    if (orderFilter === "DISPATCHED") {
      return split.sellerStatus === "DISPATCHED" || split.sellerStatus === "IN_TRANSIT";
    }
    if (orderFilter === "DELIVERED") {
      return split.sellerStatus === "DELIVERED";
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Top Hub Command Header ────────────────────────────────────────── */}
      <header className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)] sm:p-6 lg:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 sm:items-center">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFF4F0] to-[#FFE5DE] text-[#ED3500] shadow-inner sm:h-16 sm:w-16">
              <Store className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FFF4F0] px-2.5 py-0.5 text-xs font-bold text-[#ED3500]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  1HandIndia Seller Hub
                </span>
                <SellerStatusPill status={profile?.approvalStatus} />
                {sellerReady ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-bold text-[#027A48]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#12B76A]" />
                    Live Store
                  </span>
                ) : null}
              </div>

              <h1 className="mt-1.5 text-2xl font-black tracking-tight text-[#0F172A] sm:text-3xl">
                {profile?.storeName || "My Store"}
              </h1>

              <p className="mt-1 text-sm font-medium text-[#64748B]">
                {profile?.profile?.description ||
                  "Manage orders, catalogue availability, fulfillment, and verified seller payouts in one workspace."}
              </p>
            </div>
          </div>

          {/* Quick Hub Navigation & Primary CTA */}
          <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
            {sellerReady && profile?.slug ? (
              <Button asChild variant="outline" className="border-[#E2E8F0] text-[#334155] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]">
                <Link href={`/stores/${profile.slug}` as Route} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4 text-[#64748B]" aria-hidden="true" />
                  Public Storefront
                </Link>
              </Button>
            ) : null}

            <Button asChild variant="outline" className="border-[#E2E8F0] text-[#334155] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]">
              <Link href="/seller/store-profile">Store Profile</Link>
            </Button>

            {retailEnabled ? (
              <Button asChild className="bg-[#ED3500] font-bold text-white shadow-sm hover:bg-[#D42F00]">
                <Link href="/seller/products/new">
                  <Boxes className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Add Product
                </Link>
              </Button>
            ) : null}

            {serviceEnabled ? (
              <Button asChild className="bg-[#ED3500] font-bold text-white shadow-sm hover:bg-[#D42F00]">
                <Link href="/seller/services/new">
                  <Wrench className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Add Service
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── 2. Approval & Verification Notices ───────────────────────────────── */}
      {!sellerReady ? (
        <div className="rounded-xl border border-[#FEDF89] bg-[#FFFAEB] p-4 text-[#B54708] sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-bold">Store verification in review</p>
              <p className="mt-0.5 text-sm text-[#B54708]">
                Your onboarding documents are being verified by 1HandIndia merchant operations. You can continue uploading products and configuring store details. Order checkout unlocks automatically upon approval.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="border-[#FDB022] bg-white text-[#B54708] hover:bg-[#FEF08A]">
              <Link href="/seller/pending-approval">Check Status</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── 3. Operational & Financial Announcements from CMS (Dynamic) ─────── */}
      {activeAnnouncements.map((announcement) => {
        const { containerClasses, iconClasses, titleColor, bodyColor, linkColor, customStyle } =
          resolveSellerAnnouncementTheme(
            announcement.tone,
            announcement.backgroundColor,
            announcement.textColor
          );

        const isTaxBreakdownCta =
          announcement.linkUrl === "#tax-breakdown" ||
          announcement.primaryCtaLabel?.toLowerCase().includes("breakdown") ||
          announcement.primaryCtaLabel?.toLowerCase().includes("tax & fee");

        return (
          <div
            key={announcement.id}
            style={customStyle}
            className={cn(
              "relative overflow-hidden rounded-xl border p-4 text-xs transition sm:p-5 sm:text-sm",
              containerClasses
            )}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                  iconClasses
                )}
              >
                {getSellerAnnouncementIcon(announcement.tone)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("font-bold", titleColor)}>
                  {announcement.title}
                </p>
                {announcement.description ? (
                  <p className={cn("mt-1 leading-relaxed", bodyColor)}>
                    {announcement.description}
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  {announcement.primaryCtaLabel ? (
                    isTaxBreakdownCta ? (
                      <button
                        type="button"
                        onClick={() => setShowDeductionsModal(true)}
                        className={cn(
                          "font-bold underline underline-offset-4 hover:opacity-80 transition cursor-pointer",
                          linkColor
                        )}
                      >
                        {announcement.primaryCtaLabel}
                      </button>
                    ) : announcement.linkUrl ? (
                      <Link
                        href={announcement.linkUrl as Route}
                        className={cn("font-bold hover:underline transition", linkColor)}
                      >
                        {announcement.primaryCtaLabel}
                      </Link>
                    ) : (
                      <span className={cn("font-bold", linkColor)}>
                        {announcement.primaryCtaLabel}
                      </span>
                    )
                  ) : null}

                  {announcement.primaryCtaLabel && announcement.secondaryCtaLabel ? (
                    <span className="text-[#94A3B8]">•</span>
                  ) : null}

                  {announcement.secondaryCtaLabel && announcement.secondaryLinkUrl ? (
                    <Link
                      href={announcement.secondaryLinkUrl as Route}
                      className={cn("font-bold hover:underline transition", linkColor)}
                    >
                      {announcement.secondaryCtaLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
              {announcement.isDismissible ? (
                <button
                  type="button"
                  onClick={() => handleDismissAnnouncement(announcement)}
                  className="text-[#64748B] transition hover:text-[#1E293B]"
                  aria-label="Dismiss notice"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* ── 4. Subscription Plan Card (if active) ───────────────────────────── */}
      {profile?.subscriptionPlan ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#FFF4F0] text-[#ED3500]">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                {profile.subscriptionPlan.name} Plan
              </p>
              <p className="text-xs text-[#64748B]">
                Status: <span className="font-semibold text-[#101828]">{statusLabel(profile.subscriptionStatus)}</span> • Managed by 1HandIndia Seller Support
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/seller/subscription">Plan Details</Link>
          </Button>
        </div>
      ) : null}

      {/* ── 5. Executive Operational & Financial Metrics Grid ─────────────────── */}
      {retailEnabled ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Metric 1: Net Sales */}
            <div className="relative flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B]">
                    Net Sales
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ECFDF5] text-[#027A48]">
                    <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#0F172A] sm:text-3xl">
                    {formatMoney(netSalesPaise, operatingCurrency)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[#64748B]">
                  Gross: <span className="font-semibold text-[#334155]">{formatMoney(totalSalesPaise, operatingCurrency)}</span>
                  {totalDeductionsPaise > 0 ? (
                    <span className="ml-1 text-[#DC2626]">
                      (-{formatMoney(totalDeductionsPaise, operatingCurrency)} statutory)
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="mt-4 border-t border-[#F1F5F9] pt-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeductionsModal(true)}
                  className="flex items-center gap-1 text-xs font-bold text-[#ED3500] hover:text-[#C72D00]"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  View Tax & Fee Breakdown
                </button>
              </div>
            </div>

            {/* Metric 2: Orders & Fulfilment */}
            <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B]">
                    Total Orders
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#0F172A] sm:text-3xl">
                    {report?.summary.orderCount ?? 0}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[#64748B]">
                  {pendingOrdersCount > 0 ? (
                    <span className="font-semibold text-[#D97706]">
                      {pendingOrdersCount} awaiting dispatch
                    </span>
                  ) : (
                    <span className="font-semibold text-[#027A48]">
                      All orders up to date
                    </span>
                  )}
                </p>
              </div>

              <div className="mt-4 border-t border-[#F1F5F9] pt-2.5">
                <Link
                  href="/seller/orders"
                  className="flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  Manage Order Shipments
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Metric 3: Available Payout & Wallet */}
            <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B]">
                    Settlement & Wallet
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F5F3FF] text-[#7C3AED]">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#0F172A] sm:text-3xl">
                    {formatMoney(eligiblePayoutPaise, operatingCurrency)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[#64748B]">
                  Paid Out: <span className="font-semibold text-[#334155]">{formatMoney(paidPayoutsPaise, operatingCurrency)}</span>
                </p>
              </div>

              <div className="mt-4 border-t border-[#F1F5F9] pt-2.5">
                <Link
                  href="/seller/finance/wallet"
                  className="flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:text-[#6D28D9]"
                >
                  Request Payout / Wallet
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Metric 4: Inventory & Catalog Health */}
            <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B]">
                    Active Catalogue
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FFF4F0] text-[#ED3500]">
                    <Boxes className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#0F172A] sm:text-3xl">
                    {report?.summary.products ?? 0}
                  </span>
                  <span className="text-xs text-[#64748B]">products</span>
                </div>
                <div className="mt-1.5">
                  {(report?.summary.lowStockCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3F2] px-2 py-0.5 text-xs font-bold text-[#B42318]">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {report?.summary.lowStockCount} items low stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-2 py-0.5 text-xs font-bold text-[#027A48]">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Stock levels healthy
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-[#F1F5F9] pt-2.5">
                <Link
                  href="/seller/products"
                  className="flex items-center gap-1 text-xs font-bold text-[#ED3500] hover:text-[#C72D00]"
                >
                  Manage Products
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          {/* ── 6. Main 2-Column Work Surface (Asymmetric 65% / 35%) ─────────────── */}
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            {/* ── Column 1: Order Fulfilment Hub & Recent Activity ─────────────── */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#0F172A]">
                      Recent Orders & Fulfilment
                    </h2>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Process customer dispatches, track deliveries, and manage splits.
                    </p>
                  </div>

                  <Button asChild variant="outline" size="sm" className="border-[#E2E8F0] font-bold text-[#334155]">
                    <Link href="/seller/orders">
                      View All Orders ({recentOrders.length})
                      <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>

                {/* Filter Tabs */}
                <div className="mt-5 flex flex-wrap gap-1.5 border-b border-[#F1F5F9] pb-3 text-xs font-bold">
                  {(
                    [
                      { key: "ALL", label: `All (${recentOrders.length})` },
                      { key: "PENDING", label: `Awaiting Dispatch (${pendingOrdersCount})` },
                      {
                        key: "DISPATCHED",
                        label: `In Transit (${recentOrders.filter((s) => s.sellerStatus === "DISPATCHED" || s.sellerStatus === "IN_TRANSIT").length})`,
                      },
                      {
                        key: "DELIVERED",
                        label: `Delivered (${recentOrders.filter((s) => s.sellerStatus === "DELIVERED").length})`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setOrderFilter(tab.key)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 transition",
                        orderFilter === tab.key
                          ? "bg-[#0F172A] text-white shadow-sm"
                          : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Orders List */}
                <div className="mt-4 space-y-3">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.slice(0, 6).map((split) => {
                      const order = split.order;
                      const shippingCity =
                        order.shippingAddressSnapshot?.city ||
                        order.shippingAddressSnapshot?.state ||
                        "Standard Delivery";

                      return (
                        <div
                          key={split.id}
                          className="group flex flex-col justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] p-4 transition hover:border-[#ED3500] hover:bg-white hover:shadow-md sm:flex-row sm:items-center"
                        >
                          <div className="flex items-start gap-3.5">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white border border-[#E2E8F0] text-[#ED3500] shadow-sm group-hover:border-[#ED3500]">
                              <PackageCheck className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/seller/orders/${order.orderNumber}` as Route}
                                  className="font-black text-[#0F172A] hover:text-[#ED3500] hover:underline"
                                >
                                  #{order.orderNumber}
                                </Link>
                                <SellerStatusPill status={split.sellerStatus} />
                                {order.paymentStatus === "PAID" ? (
                                  <span className="rounded bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#027A48]">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="rounded bg-[#FFFAEB] px-2 py-0.5 text-[10px] font-bold text-[#B54708]">
                                    COD Pending
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                                <span>{formatDateTime(order.createdAt)}</span>
                                <span>•</span>
                                <span className="font-medium text-[#334155]">{shippingCity}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-row items-center justify-between border-t border-[#F1F5F9] pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                            <div className="text-left sm:text-right">
                              <span className="text-base font-black text-[#0F172A]">
                                {formatMoney(split.sellerSubtotalPaise, order.currency)}
                              </span>
                              <p className="text-[11px] font-medium text-[#64748B]">
                                Seller Subtotal
                              </p>
                            </div>

                            <Button asChild size="sm" variant="ghost" className="mt-1 text-xs font-bold text-[#ED3500] hover:bg-[#FFF4F0] hover:text-[#C72D00]">
                              <Link href={`/seller/orders/${order.orderNumber}` as Route}>
                                {split.sellerStatus === "PENDING" ? "Fulfill Order" : "Order Details"}
                                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center">
                      <Package className="mx-auto h-10 w-10 text-[#94A3B8]" aria-hidden="true" />
                      <p className="mt-2 text-sm font-bold text-[#334155]">
                        No orders match this filter
                      </p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        Try choosing another tab or check your active product listings.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* B2B Demand & Bulk Quotations (if B2B available) */}
              {(report?.summary.b2bEnquiries ?? 0) > 0 || (report?.b2b?.orderCount ?? 0) > 0 ? (
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F0FDF4] text-[#16A34A]">
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-base font-black text-[#0F172A]">
                          B2B Wholesale & Bulk Inquiries
                        </h2>
                        <p className="text-xs text-[#64748B]">
                          Respond to bulk quotation requests and negotiate volume pricing.
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/seller/b2b-enquiries">
                        Manage B2B RFQs
                        <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                      <p className="text-xs font-semibold text-[#64748B]">Active Enquiries</p>
                      <p className="mt-1 text-xl font-black text-[#0F172A]">
                        {report?.summary.b2bEnquiries ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                      <p className="text-xs font-semibold text-[#64748B]">B2B Orders</p>
                      <p className="mt-1 text-xl font-black text-[#0F172A]">
                        {report?.b2b?.orderCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center col-span-2 sm:col-span-1">
                      <p className="text-xs font-semibold text-[#64748B]">B2B Order Value</p>
                      <p className="mt-1 text-xl font-black text-[#027A48]">
                        {formatMoney(report?.b2b?.subtotalPaise ?? 0, operatingCurrency)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Column 2: Restock Alerts, Fast Tools, Store Health ─────────── */}
            <div className="space-y-6">
              {/* Restock & Low Inventory Radar */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FEF3F2] text-[#D64545]">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-base font-black text-[#0F172A]">
                        Low Stock Radar
                      </h3>
                      <p className="text-xs text-[#64748B]">Variants at 5 units or below</p>
                    </div>
                  </div>
                  <Link
                    href="/seller/products"
                    className="text-xs font-bold text-[#ED3500] hover:underline"
                  >
                    Inventory
                  </Link>
                </div>

                <div className="mt-4 space-y-2.5">
                  {(report?.lowStockProducts ?? []).length > 0 ? (
                    (report?.lowStockProducts ?? []).slice(0, 4).map((variant) => (
                      <div
                        key={variant.id}
                        className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 transition hover:border-[#CBD5E1]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-[#0F172A] line-clamp-1">
                            {variant.product.name}
                          </p>
                          <span className="rounded bg-[#FEF3F2] px-1.5 py-0.5 text-[11px] font-black text-[#B42318]">
                            {variant.stockQuantity} left
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#64748B]">
                          SKU: {variant.sku || variant.variantName || "Standard"}
                        </p>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                          <div
                            className="h-full rounded-full bg-[#E11D48]"
                            style={{
                              width: `${Math.min(100, Math.max(10, (variant.stockQuantity / 10) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#E2E8F0] p-6 text-center">
                      <CheckCircle2 className="mx-auto h-7 w-7 text-[#12B76A]" aria-hidden="true" />
                      <p className="mt-2 text-xs font-bold text-[#334155]">
                        All variants well-stocked
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        No stock warnings at present.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Operations Matrix */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-6">
                <h3 className="text-base font-black text-[#0F172A]">
                  Operations Shortcuts
                </h3>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  Direct access to everyday merchant workflows.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <QuickToolCard
                    href="/seller/products"
                    label="Products"
                    desc="Catalog & SKUs"
                    icon={<Boxes className="h-4 w-4" aria-hidden="true" />}
                  />
                  <QuickToolCard
                    href="/seller/orders"
                    label="Orders"
                    desc="Ship & track"
                    icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
                  />
                  <QuickToolCard
                    href="/seller/reports"
                    label="Reports & Tax"
                    desc="GSTR-1 & Sales"
                    icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                  />
                  <QuickToolCard
                    href="/seller/finance/wallet"
                    label="Wallet & Payouts"
                    desc="Bank settlement"
                    icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                  />
                  <QuickToolCard
                    href="/seller/coupons"
                    label="Coupons"
                    desc="Store promotions"
                    icon={<BadgePercent className="h-4 w-4" aria-hidden="true" />}
                  />
                  <QuickToolCard
                    href="/seller/reviews"
                    label="Reviews"
                    desc="Customer feedback"
                    icon={<Star className="h-4 w-4" aria-hidden="true" />}
                  />
                </div>
              </div>

              {/* Seller Support & Policy Card */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-[#FAFAFA] to-[#F5F5F5] p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A] shadow-sm">
                    <HelpCircle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-[#0F172A]">Need Merchant Support?</h4>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Get quick help with shipping pickups, GST filing, payment questions, or catalogue approval.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Button asChild size="sm" variant="outline" className="h-8 border-[#CBD5E1] bg-white text-xs font-bold text-[#0F172A] hover:bg-[#F8FAFC]">
                        <Link href="/contact" target="_blank">
                          Contact Support
                        </Link>
                      </Button>
                      <Link
                        href="/seller/finance/statements"
                        className="text-xs font-bold text-[#334155] hover:underline"
                      >
                        Statements
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* ── 7. Services Operations Band (If Service capability is enabled) ─────── */}
      {serviceEnabled && !retailEnabled ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <SectionHeading
            title="Service operations"
            description="Manage listings, bookings, and working availability."
          />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <QuickToolCard
              href="/seller/services"
              label="Services"
              desc="Listing catalogue"
              icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
            />
            <QuickToolCard
              href="/seller/service-bookings"
              label="Bookings"
              desc="Customer appointments"
              icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
            />
            <QuickToolCard
              href="/seller/service-calendar"
              label="Calendar"
              desc="Working availability"
              icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            />
          </div>
        </div>
      ) : null}

      {/* ── 8. Interactive Deductions & Tax Transparency Modal / Overlay ──────── */}
      {showDeductionsModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FFF4F0] text-[#ED3500]">
                  <ReceiptText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-black text-[#0F172A]">
                    Financial & Statutory Breakdown
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Full breakdown of gross sales to net payout
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeductionsModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between font-bold text-[#0F172A]">
                <span>Gross Product Sales (Subtotal)</span>
                <span>{formatMoney(totalSalesPaise, operatingCurrency)}</span>
              </div>

              <div className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] p-3.5 space-y-2 text-xs">
                <p className="font-bold text-[#475467]">Statutory Deductions & Marketplace Fees:</p>

                <div className="flex justify-between text-[#334155]">
                  <span>• 1% TDS (u/s 194-O Income Tax Act)</span>
                  <span className="font-semibold text-[#DC2626]">
                    -{formatMoney(tdsPaise, operatingCurrency)}
                  </span>
                </div>

                <div className="flex justify-between text-[#334155]">
                  <span>• 1% TCS (u/s 52 CGST/SGST Act)</span>
                  <span className="font-semibold text-[#DC2626]">
                    -{formatMoney(tcsPaise, operatingCurrency)}
                  </span>
                </div>

                <div className="flex justify-between text-[#334155]">
                  <span>• Marketplace Commission</span>
                  <span className="font-semibold text-[#DC2626]">
                    -{formatMoney(commissionPaise, operatingCurrency)}
                  </span>
                </div>

                <div className="flex justify-between text-[#334155]">
                  <span>• 18% GST on Marketplace Commission</span>
                  <span className="font-semibold text-[#DC2626]">
                    -{formatMoney(gstOnCommissionPaise, operatingCurrency)}
                  </span>
                </div>

                {platformFeePaise > 0 ? (
                  <div className="flex justify-between text-[#334155]">
                    <span>• Seller Platform Fee</span>
                    <span className="font-semibold text-[#DC2626]">
                      -{formatMoney(platformFeePaise, operatingCurrency)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-between border-t border-[#E2E8F0] pt-3 text-base font-black text-[#027A48]">
                <span>Net Store Earnings (Net Sales)</span>
                <span>{formatMoney(netSalesPaise, operatingCurrency)}</span>
              </div>

              {/* Crucial Buyer Fee Clarity */}
              <div className="mt-4 rounded-xl border border-[#E0EAFF] bg-[#EFF6FF] p-3.5 text-xs text-[#1E40AF]">
                <p className="font-bold text-[#1E3A8A]">
                  Regarding Buyer Checkout Platform Fee:
                </p>
                <p className="mt-1 leading-relaxed">
                  The buyer platform fee (e.g. ₹15) charged on orders is paid by the customer directly to 1HandIndia. <strong>It is NOT deducted from your sales subtotal or seller wallet payout.</strong>
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => setShowDeductionsModal(false)}
                className="bg-[#0F172A] font-bold text-white hover:bg-[#1E293B]"
              >
                Got It
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuickToolCard({
  href,
  label,
  desc,
  icon,
}: {
  href: string;
  label: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className="group flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] p-3.5 transition hover:border-[#ED3500] hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A] shadow-xs group-hover:border-[#ED3500] group-hover:text-[#ED3500]">
          {icon}
        </span>
        <span className="font-bold text-xs text-[#0F172A] group-hover:text-[#ED3500]">
          {statusLabel(label)}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[#64748B]">{desc}</p>
    </Link>
  );
}

function getSellerAnnouncementIcon(tone?: string) {
  if (tone === "WARNING") return <AlertTriangle className="h-5 w-5" aria-hidden="true" />;
  if (tone === "SUCCESS") return <CheckCircle2 className="h-5 w-5" aria-hidden="true" />;
  if (tone === "BRAND") return <Sparkles className="h-5 w-5" aria-hidden="true" />;
  return <ShieldCheck className="h-5 w-5" aria-hidden="true" />;
}


