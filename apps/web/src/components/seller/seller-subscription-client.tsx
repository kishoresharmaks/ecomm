"use client";

import Link from "next/link";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { getSellerSubscription } from "@/lib/seller-api";
import { formatMoney } from "@/lib/storefront-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerMetric,
  SellerPanel,
  SellerSkeleton,
  formatDateTime,
  isSellerOnboardingRequiredError,
  statusLabel,
  useSellerAuth
} from "./seller-ui";

export function SellerSubscriptionClient() {
  const sellerAuth = useSellerAuth();
  const query = useQuery({
    queryKey: ["seller-subscription", sellerAuth.authKey],
    queryFn: () => getSellerSubscription(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (query.isLoading) {
    return <SellerSkeleton />;
  }

  if (query.error) {
    if (isSellerOnboardingRequiredError(query.error)) {
      return <SellerEmptyState title="Seller onboarding required" message="Submit seller onboarding before subscription details can be shown." action={<Button asChild><Link href="/seller/register">Start onboarding</Link></Button>} />;
    }

    return <SellerErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  const subscription = query.data;
  const plan = subscription?.plan;

  if (!plan) {
    return (
      <SellerEmptyState
        title="No seller plan assigned"
        message="Admin can assign a seller subscription plan, or the default plan will be applied during onboarding."
        action={
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <CreditCard className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-[#1F2933]">{plan.name}</h2>
                {plan.isDefault ? <StatusBadge tone="success">Default</StatusBadge> : null}
                <StatusBadge tone={statusTone(subscription?.subscriptionStatus)}>{statusLabel(subscription?.subscriptionStatus)}</StatusBadge>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
                {plan.description ?? "Your seller subscription controls onboarding capacity and operational plan settings."}
              </p>
              <p className="mt-3 text-sm font-bold text-[#163B5C]">
                Started {formatDateTime(subscription?.subscriptionStartedAt)} / Ends {formatDateTime(subscription?.subscriptionCurrentPeriodEnd)}
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/seller/register">Review onboarding</Link>
          </Button>
        </div>
      </SellerPanel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SellerMetric label="Plan price" value={formatMoney(plan.pricePaise, plan.currency)} note={statusLabel(plan.billingCycle)} />
        <SellerMetric label="Product limit" value={limitLabel(plan.productLimit)} note="Catalogue capacity" />
        <SellerMetric label="Featured slots" value={limitLabel(plan.featuredProductLimit)} note="Admin-managed visibility" />
        <SellerMetric label="B2B enquiries" value={limitLabel(plan.b2bEnquiryLimit)} note="Quotation request capacity" />
      </div>

      <SellerPanel>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#E9F7F1] text-[#0F8A5F]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <SectionHeading
            title="Subscription workflow"
            description="Phase 1 subscriptions are admin-managed. Online recurring payment collection can be connected later after provider approval."
          />
        </div>
      </SellerPanel>
    </div>
  );
}

function limitLabel(value?: number | null) {
  return value === null || value === undefined ? "Unlimited" : value;
}

function statusTone(status?: string | null): "success" | "warning" | "danger" | "info" {
  if (["ACTIVE", "TRIALING"].includes(status ?? "")) {
    return "success";
  }
  if (status === "PENDING_PAYMENT") {
    return "warning";
  }
  if (["EXPIRED", "CANCELLED"].includes(status ?? "")) {
    return "danger";
  }
  return "info";
}
