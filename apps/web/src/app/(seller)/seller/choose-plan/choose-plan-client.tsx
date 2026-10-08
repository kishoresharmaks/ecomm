"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Crown,
  Headphones,
  HelpCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Truck,
  Gem,
} from "lucide-react";
import { listSellerSubscriptionPlans, type SellerSubscriptionPlan } from "@/lib/seller-api";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";

// Fallback plans adhering to the exact production database configuration & reference design
const DEFAULT_RETAIL_PLANS: SellerSubscriptionPlan[] = [
  {
    id: "plan-free-trial",
    code: "FREE_TRIAL",
    name: "FREE TRIAL",
    description: "Perfect for getting started",
    pricePaise: 0,
    currency: "INR",
    billingCycle: "MONTHLY",
    trialDays: 0,
    audience: "RETAIL",
    productLimit: 25,
    featuredProductLimit: 0,
    b2bEnquiryLimit: 0,
    commissionDiscountBps: 0,
    isDefault: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "plan-gold-shop-normal",
    code: "GOLD_SHOP_NORMAL",
    name: "GOLD SHOP NORMAL",
    description: "All grocery shop in 1handindia",
    pricePaise: 299900,
    currency: "INR",
    billingCycle: "YEARLY",
    trialDays: 15,
    audience: "RETAIL",
    productLimit: 50,
    featuredProductLimit: 50,
    b2bEnquiryLimit: 100,
    commissionDiscountBps: 2, // 0.02%
    isDefault: false,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "plan-gold-shop-special",
    code: "GOLD_SHOP_SPECIAL",
    name: "GOLD SHOP SPECIAL",
    description: "All grocery shop in 1handindia",
    pricePaise: 599900,
    currency: "INR",
    billingCycle: "YEARLY",
    trialDays: 0,
    audience: "RETAIL",
    productLimit: 100,
    featuredProductLimit: 0,
    b2bEnquiryLimit: 250,
    commissionDiscountBps: 0,
    isDefault: false,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: "plan-pro-yearly",
    code: "PRO_YEARLY",
    name: "PRO YEARLY",
    description: "Higher-capacity plan for established marketplace sellers",
    pricePaise: 999900,
    currency: "INR",
    billingCycle: "YEARLY",
    trialDays: 0,
    audience: "RETAIL",
    productLimit: 250,
    featuredProductLimit: 25,
    b2bEnquiryLimit: 500,
    commissionDiscountBps: 10,
    isDefault: false,
    isActive: true,
    sortOrder: 4,
  },
];

type PlanFeatureItem = {
  text: string;
  isHighlight?: boolean;
  isStar?: boolean;
  badge?: string;
};

function formatInr(paise: number): string {
  const rupees = Math.round(paise / 100);
  return rupees.toLocaleString("en-IN");
}

export function ChoosePlanClient({ initialMode: _initialMode }: { initialMode?: string | null }) {
  const plansQuery = useQuery({
    queryKey: ["seller-subscription-plans", "retail"],
    queryFn: () => listSellerSubscriptionPlans({ audience: "RETAIL" }),
  });

  const rawPlans = plansQuery.data?.items ?? [];
  const displayPlans = rawPlans.length > 0 ? rawPlans : DEFAULT_RETAIL_PLANS;

  // Sort ascending by price
  const sortedPlans = [...displayPlans].sort((a, b) => a.pricePaise - b.pricePaise);

  // Identify recommended plan (GOLD SHOP NORMAL by code/name, or first paid plan)
  const recommendedPlan =
    sortedPlans.find((p) => p.code === "GOLD_SHOP_NORMAL" || p.name.toUpperCase().includes("GOLD SHOP NORMAL")) ??
    sortedPlans.find((p) => p.pricePaise > 0) ??
    sortedPlans[0];
  const recommendedPlanId = recommendedPlan?.id;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#101828]">
      {/* ── 1. TOP HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-[#F2F4F7] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand Logo & Title */}
          <Link href="/seller" className="group flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-[#F1E5E0] transition-transform group-hover:scale-105">
              <Image
                src="/brand/1handindia_logo.webp"
                alt="1HandIndia Logo"
                width={36}
                height={36}
                priority
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-[#101828]">
                1HandIndia
              </span>
              <span className="text-[11px] font-bold tracking-wider text-[#ED3500]">
                Seller Hub
              </span>
            </div>
          </Link>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/contact?topic=seller"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475467] transition-colors hover:text-[#101828] sm:text-sm"
            >
              <HelpCircle className="h-4 w-4 text-[#667085]" />
              <span className="hidden sm:inline">Help Desk</span>
            </Link>

            <span className="hidden text-[#D0D5DD] sm:inline">|</span>

            <span className="hidden text-xs text-[#475467] md:inline sm:text-sm">
              Already have an account?
            </span>

            <Link
              href="/seller/sign-in"
              className="inline-flex items-center justify-center rounded-full border border-[#D0D5DD] bg-white px-3.5 py-1.5 text-xs font-bold text-[#344054] transition-colors hover:border-[#98A2B3] hover:bg-[#F9FAFB] sm:px-4 sm:text-sm"
            >
              Sign In
            </Link>

            <Link
              href="/seller/register?mode=retail"
              className="inline-flex items-center justify-center rounded-full bg-[#ED3500] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#D42F00] sm:px-4 sm:text-sm"
            >
              Start Selling
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 space-y-10 sm:space-y-12">
        {/* ── 2. ONBOARDING PROGRESS & HERO ─────────────────────────────────── */}
        <div className="space-y-6">
          {/* Top Row: Step Badge & Step Indicator */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Step 1 of 3 Badge */}
            <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#FFDDD2] bg-[#FFF4F0] px-3.5 py-1 text-xs font-bold text-[#ED3500]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Step 1 of 3</span>
            </div>

            {/* Modern SaaS Step Flow */}
            <div className="flex items-center gap-2 self-start sm:self-auto sm:gap-3">
              {/* Step 1 */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ED3500] text-xs font-black text-white shadow-xs">
                  1
                </span>
                <span className="text-xs font-bold text-[#ED3500]">Plan</span>
              </div>

              {/* Connector line */}
              <div className="h-[2px] w-8 bg-[#E4E7EC] sm:w-16" />

              {/* Step 2 */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#D0D5DD] bg-white text-xs font-bold text-[#667085]">
                  2
                </span>
                <span className="text-xs font-semibold text-[#667085] hidden sm:inline">Store Details</span>
              </div>

              {/* Connector line */}
              <div className="h-[2px] w-8 bg-[#E4E7EC] sm:w-16" />

              {/* Step 3 */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#D0D5DD] bg-white text-xs font-bold text-[#667085]">
                  3
                </span>
                <span className="text-xs font-semibold text-[#667085] hidden sm:inline">Verification</span>
              </div>
            </div>
          </div>

          {/* ── 3. TWO-COLUMN HERO SECTION ─────────────────────────────────── */}
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Headlines */}
            <div className="space-y-4 lg:col-span-7">
              <h1 className="text-3xl font-black tracking-tight text-[#101828] sm:text-5xl lg:text-[50px] leading-[1.15]">
                Choose the right plan <br className="hidden sm:inline" />
                for <span className="text-[#ED3500]">your shop</span>
              </h1>
              <p className="max-w-xl text-sm font-medium leading-relaxed text-[#475467] sm:text-base">
                Transparent pricing for verified Indian merchants. Start free or upgrade for higher listing volume,
                lower commission, and priority promotion.
              </p>
            </div>

            {/* Right Column: 3D Seller Store Illustration */}
            <div className="flex justify-center lg:col-span-5 lg:justify-end">
              <div className="relative aspect-[4/3] w-full max-w-[340px] overflow-hidden rounded-3xl bg-transparent transition-transform duration-300 hover:scale-[1.02] sm:max-w-[380px]">
                <Image
                  src="/seller/seller-store-hero.jpg"
                  alt="1HandIndia Seller Store Illustration"
                  fill
                  priority
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. FOUR-COLUMN PRICING GRID ───────────────────────────────────── */}
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-4">
          {sortedPlans.map((plan) => {
            const isFeatured = plan.id === recommendedPlanId;
            const isFree = plan.pricePaise === 0;
            const monthlyEquivalent = isFree ? 0 : Math.round(plan.pricePaise / 12 / 100);
            const commissionBps = plan.commissionDiscountBps || 0;

            // Plan icon & card color styling
            let iconBox = (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F2F4F7] text-[#475467]">
                <ShoppingBag className="h-6 w-6" />
              </div>
            );
            const displayTitle = plan.name.replace(/_/g, " ").toUpperCase();
            const displaySubtitle = plan.description || "Perfect for getting started";

            if (isFeatured || displayTitle.includes("NORMAL")) {
              iconBox = (
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF4F0] text-[#ED3500]">
                  <Store className="h-6 w-6" />
                </div>
              );
            } else if (displayTitle.includes("SPECIAL")) {
              iconBox = (
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FEF6EE] text-[#F59E0B]">
                  <Crown className="h-6 w-6" />
                </div>
              );
            } else if (displayTitle.includes("PRO")) {
              iconBox = (
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F4F3FF] text-[#7F56D9]">
                  <Gem className="h-6 w-6" />
                </div>
              );
            }

            // Construct feature items for each plan
            const features: PlanFeatureItem[] = [];

            if (isFree) {
              features.push({ text: `Up to ${plan.productLimit ?? 25} catalogue listings` });
              features.push({ text: "Standard marketplace commission" });
              features.push({ text: "Verified B2B wholesale enquiries" });
              features.push({ text: "Doorstep courier pickup & tracking" });
              features.push({ text: "Direct automated bank payouts" });
              features.push({ text: "Standard seller help desk" });
            } else if (isFeatured || displayTitle.includes("NORMAL")) {
              features.push({ text: `Up to ${plan.productLimit ?? 50} catalogue listings` });
              features.push({
                text: commissionBps > 0 ? `${commissionBps / 100}% commission discount` : "0.02% commission discount",
                badge: "Save More",
              });
              features.push({
                text: `${plan.featuredProductLimit ?? 50} Homepage featured listings`,
                isStar: true,
              });
              features.push({ text: `Up to ${plan.b2bEnquiryLimit ?? 100} B2B bulk buyer leads` });
              features.push({ text: "Doorstep courier pickup & tracking" });
              features.push({ text: "Direct automated bank payouts" });
              features.push({ text: "Priority merchant onboarding support" });
            } else if (displayTitle.includes("SPECIAL")) {
              features.push({ text: `Up to ${plan.productLimit ?? 100} catalogue listings` });
              features.push({ text: "Standard marketplace commission" });
              features.push({ text: `Up to ${plan.b2bEnquiryLimit ?? 250} B2B bulk buyer leads` });
              features.push({ text: "Doorstep courier pickup & tracking" });
              features.push({ text: "Direct automated bank payouts" });
              features.push({ text: "Standard seller help desk" });
            } else {
              // PRO
              features.push({ text: `Up to ${plan.productLimit ?? 250} catalogue listings` });
              features.push({ text: "Lower marketplace commission" });
              features.push({ text: `Up to ${plan.b2bEnquiryLimit ?? 500} B2B bulk buyer leads` });
              features.push({ text: "Priority homepage promotion" });
              features.push({ text: "Doorstep courier pickup & tracking" });
              features.push({ text: "Direct automated bank payouts" });
              features.push({ text: "Priority support / account manager" });
            }

            return (
              <div
                key={plan.id}
                className={`relative flex h-full flex-col justify-between rounded-[24px] bg-white p-6 transition-all duration-200 hover:-translate-y-1 ${
                  isFeatured
                    ? "border-2 border-[#ED3500] shadow-xl shadow-[#ED3500]/10"
                    : "border border-[#E4E7EC] shadow-xs hover:border-[#D0D5DD] hover:shadow-md"
                }`}
              >
                {/* Most Popular Badge on Recommended Plan */}
                {isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ED3500] px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-md">
                      <Crown className="h-3 w-3 fill-white" />
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Card Top: Icon, Title & Description */}
                <div>
                  <div className="flex items-center gap-3">
                    {iconBox}
                    <div>
                      <h3 className="text-base font-black uppercase tracking-wide text-[#101828]">
                        {displayTitle}
                      </h3>
                      <p className="text-xs text-[#667085] line-clamp-1">
                        {displaySubtitle}
                      </p>
                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold tracking-tight text-[#101828] sm:text-4xl">
                        {isFree ? "₹0" : `₹${formatInr(plan.pricePaise)}`}
                      </span>
                      <span className="text-xs font-semibold text-[#667085]">
                        {isFree ? "Forever" : `/${plan.billingCycle.toLowerCase()}`}
                      </span>
                    </div>

                    {isFree ? (
                      <div className="pt-1">
                        <span className="inline-flex items-center rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-bold text-[#16A34A]">
                          No credit card required
                        </span>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-[#667085]">
                          ≈ ₹{monthlyEquivalent.toLocaleString("en-IN")}/month
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-[11px]">
                          {plan.trialDays > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#FFDDD2] bg-[#FFF4F0] px-2 py-0.5 font-bold text-[#ED3500]">
                              <Calendar className="h-3 w-3" />
                              {plan.trialDays}-day free trial included
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border border-[#EAECF0] bg-[#F9FAFB] px-2 py-0.5 font-medium text-[#475467]">
                              <Calendar className="h-3 w-3 text-[#667085]" />
                              Billed yearly
                            </span>
                          )}
                          <span className="font-semibold text-[#98A2B3]">Plus GST</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="my-5 border-t border-[#F2F4F7]" />

                  {/* Features List */}
                  <ul className="space-y-3 text-xs leading-relaxed">
                    {features.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        {item.isStar ? (
                          <Star className="mt-0.5 h-4 w-4 shrink-0 fill-[#F59E0B] text-[#F59E0B]" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                        )}
                        <div className="flex-1 font-medium text-[#344054]">
                          <span>{item.text}</span>
                          {item.badge && (
                            <span className="ml-1.5 inline-block rounded bg-[#ECFDF3] px-1.5 py-0.2 text-[10px] font-black text-[#16A34A]">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Action Button (Pinned to baseline via mt-auto) */}
                <div className="mt-auto pt-6">
                  <Link
                    href={`/seller/register?mode=retail&plan=${plan.id}`}
                    className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold transition-all duration-150 active:scale-[0.98] ${
                      isFeatured
                        ? "bg-[#ED3500] hover:bg-[#D42F00] text-white shadow-md shadow-[#ED3500]/25 !text-white [&_*]:!text-white"
                        : "border-2 border-[#ED3500] bg-white text-[#ED3500] hover:bg-[#ED3500] hover:text-white [&_*]:text-[#ED3500] hover:[&_*]:text-white"
                    }`}
                    style={isFeatured ? { color: "#ffffff" } : undefined}
                  >
                    <span>{isFree ? "Start Free" : "Select Plan"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 10. HORIZONTAL BENEFITS BAR ──────────────────────────────────── */}
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-6 shadow-xs">
          <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Secure Payments */}
            <div className="flex items-center gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#101828]">Secure Payments</h4>
                <p className="text-xs text-[#667085]">Direct bank payouts</p>
              </div>
            </div>

            {/* Pan India Logistics */}
            <div className="flex items-center gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#101828]">Pan India Logistics</h4>
                <p className="text-xs text-[#667085]">Pickup & tracking support</p>
              </div>
            </div>

            {/* Dedicated Support */}
            <div className="flex items-center gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#101828]">Dedicated Support</h4>
                <p className="text-xs text-[#667085]">Get help when you need it</p>
              </div>
            </div>

            {/* Grow Your Business */}
            <div className="flex items-center gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#101828]">Grow Your Business</h4>
                <p className="text-xs text-[#667085]">Reach more buyers across India</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── WEBSITE FOOTER ────────────────────────────────────────────────── */}
      <StorefrontFooter />
    </div>
  );
}
