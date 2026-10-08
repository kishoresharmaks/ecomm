"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import { listSellerSubscriptionPlans } from "@/lib/seller-api";

export function ChoosePlanClient({ initialMode: _initialMode }: { initialMode?: string | null }) {
  const plansQuery = useQuery({
    queryKey: ["seller-subscription-plans", "retail"],
    queryFn: () => listSellerSubscriptionPlans({ audience: "RETAIL" }),
  });

  if (plansQuery.isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ED3500] border-t-transparent" />
        <p className="text-sm font-bold text-[#64748B]">Loading subscription plans...</p>
      </div>
    );
  }

  if (plansQuery.error) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#F5B7B7] bg-[#FDECEC] p-6 text-center">
        <p className="text-base font-bold text-[#8A1F1F]">Unable to load subscription plans</p>
        <p className="mt-2 text-sm text-[#8A1F1F]/80">Please check your connection and try again.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-[#8A1F1F]/30 text-[#8A1F1F] hover:bg-[#8A1F1F]/10"
          onClick={() => plansQuery.refetch()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  const rawPlans = plansQuery.data?.items ?? [];

  if (rawPlans.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#D9E2EA] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF4F0] text-[#ED3500]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-xl font-black text-[#0F172A]">No plans available</h3>
        <p className="mt-2 text-sm text-[#64748B]">
          There are currently no active subscription plans configured.
        </p>
        <Button asChild className="mt-6 bg-[#ED3500] font-black text-white hover:bg-[#D42F00]">
          <Link href="/seller/register?mode=retail">
            Continue to Registration
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // Sort plans ascending by price so Free is first, popular/standard is center, and pro is right
  const sortedPlans = [...rawPlans].sort((a, b) => a.pricePaise - b.pricePaise);

  // Recommend the entry-level paid plan (e.g. GOLD SHOP NORMAL)
  const paidPlans = sortedPlans.filter((p) => p.pricePaise > 0);
  const recommendedPlanId =
    paidPlans[0]?.id ?? sortedPlans[0]?.id;

  return (
    <div className="space-y-12">
      {/* ── Stepper & Header Block ────────────────────────────────────────── */}
      <div className="text-center">
        {/* Onboarding Stepper */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-1.5 shadow-xs">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ED3500] text-[11px] font-black text-white">
            1
          </span>
          <span className="text-xs font-black text-[#0F172A]">Select Plan</span>
          <span className="text-xs text-[#CBD5E1]">•</span>
          <span className="text-xs font-semibold text-[#94A3B8]">Step 2: Store Details</span>
          <span className="text-xs text-[#CBD5E1]">•</span>
          <span className="text-xs font-semibold text-[#94A3B8]">Step 3: Verification</span>
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-[#0F172A] sm:text-5xl">
          Choose Your <span className="text-[#ED3500]">Selling Plan</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-relaxed text-[#64748B] sm:text-base">
          Transparent pricing for verified Indian merchants. Start free or upgrade for higher listing volume,
          commission discounts, and priority homepage promotion. Switch or upgrade anytime.
        </p>
      </div>

      {/* ── Responsive Plans Grid ─────────────────────────────────────────── */}
      <div className="mx-auto grid max-w-7xl items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3">
        {sortedPlans.map((plan) => {
          const isFeatured = plan.id === recommendedPlanId;
          const commissionBps = plan.commissionDiscountBps || 0;
          const isFree = plan.pricePaise === 0;

          return (
            <div
              key={plan.id}
              className={`relative flex h-full flex-col rounded-3xl transition-all duration-200 ${
                isFeatured
                  ? "border-2 border-[#ED3500] bg-white shadow-[0_20px_50px_rgba(237,53,0,0.14)] ring-4 ring-[#ED3500]/10 hover:-translate-y-1"
                  : "border border-[#E2E8F0] bg-white shadow-sm hover:border-[#CBD5E1] hover:shadow-lg hover:-translate-y-1"
              }`}
            >
              {/* Featured Badge */}
              {isFeatured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ED3500] px-4 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                    Recommended Plan
                  </span>
                </div>
              )}

              {/* Card Header & Price */}
              <div
                className={`p-7 sm:p-8 ${
                  isFeatured ? "rounded-t-3xl bg-gradient-to-b from-[#FFF5F2] to-white pt-9" : ""
                }`}
              >
                <div>
                  <h3 className="text-2xl font-black capitalize tracking-tight text-[#0F172A]">
                    {plan.name.replace(/_/g, " ")}
                  </h3>
                  <p className="mt-2 h-10 text-xs font-semibold leading-relaxed text-[#64748B] line-clamp-2">
                    {plan.description || "Everything needed to start and scale your store on 1HandIndia."}
                  </p>
                </div>

                {/* Price Display */}
                <div className="mt-4 flex h-20 flex-col justify-end border-t border-[#F1F5F9] pt-4">
                  {isFree ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black tracking-tight text-[#0F172A] sm:text-5xl">
                        ₹0
                      </span>
                      <span className="rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-xs font-black text-[#027A48]">
                        Free Forever
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black tracking-tight text-[#0F172A] sm:text-5xl">
                          {formatMoney(plan.pricePaise, plan.currency)}
                        </span>
                        <span className="text-sm font-bold text-[#64748B]">
                          /{plan.billingCycle.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                        {plan.trialDays > 0
                          ? `${plan.trialDays}-day free trial included • Plus GST`
                          : `Billed ${plan.billingCycle.toLowerCase()} • Plus GST`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="flex flex-1 flex-col justify-between border-t border-[#F1F5F9] bg-[#FAFAFA] p-7 sm:p-8">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#94A3B8]">
                    Included Features
                  </p>
                  <ul className="mt-4 space-y-3.5">
                    {/* Listings */}
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#12B76A]" />
                      <span className="text-xs font-bold text-[#1E293B]">
                        {plan.productLimit
                          ? `Up to ${plan.productLimit.toLocaleString()} catalogue listings`
                          : "Unlimited catalogue listings"}
                      </span>
                    </li>

                    {/* Commission Discount */}
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#12B76A]" />
                      <div className="text-xs font-bold text-[#1E293B]">
                        {commissionBps > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span>{commissionBps / 100}% commission discount</span>
                            <span className="rounded bg-[#ECFDF3] px-1.5 py-0.5 text-[10px] font-black text-[#027A48]">
                              Save More
                            </span>
                          </span>
                        ) : (
                          "Standard marketplace commission"
                        )}
                      </div>
                    </li>

                    {/* Featured Listings */}
                    {plan.featuredProductLimit ? (
                      <li className="flex items-start gap-3">
                        <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
                        <span className="text-xs font-bold text-[#1E293B]">
                          {plan.featuredProductLimit} Homepage featured listings
                        </span>
                      </li>
                    ) : null}

                    {/* B2B Enquiry Limit */}
                    {plan.b2bEnquiryLimit ? (
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#12B76A]" />
                        <span className="text-xs font-bold text-[#1E293B]">
                          Up to {plan.b2bEnquiryLimit} B2B bulk buyer leads
                        </span>
                      </li>
                    ) : (
                      <li className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#12B76A]" />
                        <span className="text-xs font-bold text-[#1E293B]">
                          Verified B2B wholesale enquiries
                        </span>
                      </li>
                    )}

                    {/* Logistics & Delivery */}
                    <li className="flex items-start gap-3">
                      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                      <span className="text-xs font-bold text-[#1E293B]">
                        Doorstep courier pickup & tracking
                      </span>
                    </li>

                    {/* Payouts */}
                    <li className="flex items-start gap-3">
                      <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                      <span className="text-xs font-bold text-[#1E293B]">
                        Direct automated bank payouts
                      </span>
                    </li>

                    {/* Support */}
                    <li className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                      <span className="text-xs font-bold text-[#1E293B]">
                        {isFeatured ? "Priority merchant onboarding support" : "Standard seller help desk"}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action Button Footer - Aligned at bottom */}
              <div className="mt-auto border-t border-[#F1F5F9] bg-[#FAFAFA] p-6 sm:p-7">
                <Link
                  href={`/seller/register?mode=retail&plan=${plan.id}`}
                  className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                    isFeatured
                      ? "bg-[#ED3500] hover:bg-[#D42F00] shadow-md shadow-[#ED3500]/25 !text-white [&_*]:!text-white"
                      : "border-2 border-[#ED3500] bg-white hover:bg-[#ED3500] !text-[#ED3500] hover:!text-white [&_*]:!text-[#ED3500] hover:[&_*]:!text-white"
                  }`}
                  style={isFeatured ? { color: "#ffffff" } : undefined}
                >
                  <span className="text-sm font-extrabold">Select Plan</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Trust Pillars & Enterprise Callout ─────────────────────────────── */}
      <div className="mx-auto max-w-7xl pt-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h4 className="mt-4 text-sm font-black text-[#0F172A]">Zero Hidden Fees</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748B]">
              Transparent commission and subscription rates with no surprise charges.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
              <Truck className="h-5 w-5" />
            </span>
            <h4 className="mt-4 text-sm font-black text-[#0F172A]">Pan-India Logistics</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748B]">
              Pre-integrated Shiprocket courier pickups across 19,000+ Indian pincodes.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
              <Wallet className="h-5 w-5" />
            </span>
            <h4 className="mt-4 text-sm font-black text-[#0F172A]">Fast Direct Payouts</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748B]">
              Automated T+1 direct payouts into your verified Indian bank account.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF4F0] text-[#ED3500]">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <h4 className="mt-4 text-sm font-black text-[#0F172A]">No Lock-In Contract</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748B]">
              Upgrade, downgrade, or cancel your subscription anytime from your seller dashboard.
            </p>
          </div>
        </div>

        {/* Enterprise Callout */}
        <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center sm:p-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#ED3500]">
            <HelpCircle className="h-4 w-4" />
            Need custom volume plans or multi-location inventory support?
          </div>
          <p className="mt-2 text-sm font-semibold text-[#64748B]">
            Reach out to our seller onboarding team for wholesale distributor and enterprise merchant solutions.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4 border-[#CBD5E1] font-bold text-[#334155] hover:bg-[#F8FAFC]">
            <Link href="/contact?topic=seller-enterprise">Contact Merchant Partnerships</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
