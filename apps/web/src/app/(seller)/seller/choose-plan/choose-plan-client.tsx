"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, ShieldCheck, Star } from "lucide-react";
import { formatMoney } from "@/lib/storefront-api";
import { listSellerSubscriptionPlans } from "@/lib/seller-api";
import {
  registrationModeFromQuery,
  primaryCapabilityForMode
} from "@/components/seller/seller-registration-navigation";

export function ChoosePlanClient({ initialMode }: { initialMode?: string | null }) {
  const mode = registrationModeFromQuery(initialMode);
  const primaryCapability = primaryCapabilityForMode(mode);

  const plansQuery = useQuery({
    queryKey: ["seller-subscription-plans", mode],
    queryFn: () => listSellerSubscriptionPlans({ audience: primaryCapability }),
  });

  if (plansQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ED3500] border-t-transparent"></div>
      </div>
    );
  }

  if (plansQuery.error) {
    return (
      <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-5 text-sm font-semibold text-[#8A1F1F]">
        Unable to load subscription plans. Please try again.
      </div>
    );
  }

  const plans = plansQuery.data?.items ?? [];

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-8 text-center">
        <h3 className="text-lg font-black text-[#123A5A]">No plans available</h3>
        <p className="mt-2 text-sm text-[#667085]">There are currently no subscription plans available for this business type.</p>
        <Link href={`/seller/register?mode=${mode}`} className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#ED3500] px-5 font-bold text-white hover:bg-[#D12E00]">
          Continue without a plan
        </Link>
      </div>
    );
  }

  // Dynamically recommend the cheapest paid plan
  const recommendedPlanId = plans.filter(p => p.pricePaise > 0).sort((a, b) => a.pricePaise - b.pricePaise)[0]?.id;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isFeatured = plan.id === recommendedPlanId;
        const commissionBps = plan.commissionDiscountBps || 0;
        
        return (
          <div 
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border ${isFeatured ? 'border-[#ED3500] shadow-[0_8px_30px_rgb(237,53,0,0.12)]' : 'border-[#D9E2EA] shadow-sm'} bg-white overflow-hidden transition-transform hover:-translate-y-1`}
          >
            {isFeatured && (
              <div className="absolute top-0 w-full bg-[#ED3500] py-1.5 text-center text-[10px] font-black uppercase tracking-widest text-white">
                Recommended
              </div>
            )}
            <div className={`p-6 ${isFeatured ? 'pt-10' : ''}`}>
              <h3 className="text-xl font-black text-[#123A5A]">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight text-[#1F2933]">
                  {plan.pricePaise > 0 ? formatMoney(plan.pricePaise, plan.currency) : "Free"}
                </span>
                {plan.pricePaise > 0 && <span className="text-sm font-bold text-[#667085]">/{plan.billingCycle.toLowerCase()}</span>}
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-[#667085] h-12">
                {plan.description || `The perfect plan for starting your ${mode.toLowerCase()} business.`}
              </p>
            </div>
            
            <div className="flex-1 bg-[#F8FAFC] p-6 border-t border-[#E5E7EB]">
              <ul className="grid gap-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0F8A5F]" />
                  <span className="text-sm font-semibold text-[#1F2933]">
                    {plan.productLimit ? `Up to ${plan.productLimit} listings` : "Unlimited listings"}
                  </span>
                </li>
                {primaryCapability === "RETAIL" && (
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0F8A5F]" />
                    <span className="text-sm font-semibold text-[#1F2933]">
                      {commissionBps > 0 ? `${commissionBps / 100}% platform commission discount` : "Standard platform commission"}
                    </span>
                  </li>
                )}
                {plan.featuredProductLimit ? (
                  <li className="flex items-start gap-3">
                    <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A623]" />
                    <span className="text-sm font-semibold text-[#1F2933]">
                      {plan.featuredProductLimit} Featured listings
                    </span>
                  </li>
                ) : null}
                <li className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#123A5A]" />
                  <span className="text-sm font-semibold text-[#1F2933]">
                    Dedicated seller support
                  </span>
                </li>
              </ul>
            </div>
            
            <div className="p-6 bg-[#F8FAFC]">
              <Link 
                href={`/seller/register?mode=${mode}&plan=${plan.id}`}
                className={`flex w-full h-12 items-center justify-center gap-2 rounded-lg font-black transition-colors ${
                  isFeatured 
                    ? 'bg-[#ED3500] text-white hover:bg-[#D12E00]' 
                    : 'bg-[#123A5A] text-white hover:bg-[#0A2235]'
                }`}
              >
                Select {plan.name}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
