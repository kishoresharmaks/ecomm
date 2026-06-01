"use client";

import Link from "next/link";
import { AlertTriangle, Ban, CreditCard, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import {
  authorizeSellerSubscription,
  cancelSellerSubscription,
  getSellerSubscription,
  verifySellerSubscription,
  type SellerSubscriptionAuthorization,
} from "@/lib/seller-api";
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
  useSellerAuth,
} from "./seller-ui";

type SellerRazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type SellerRazorpayFailureResponse = {
  error?: {
    description?: string;
  };
};

type SellerRazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  handler: (response: SellerRazorpaySuccessResponse) => void;
  modal: {
    ondismiss: () => void;
  };
  theme: {
    color: string;
  };
};

type SellerRazorpayCheckoutInstance = {
  open: () => void;
  on: (
    eventName: "payment.failed",
    handler: (response: SellerRazorpayFailureResponse) => void,
  ) => void;
};

type SellerRazorpayConstructor = new (
  options: SellerRazorpayCheckoutOptions,
) => SellerRazorpayCheckoutInstance;

let razorpayScriptPromise: Promise<void> | null = null;

export function SellerSubscriptionClient() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["seller-subscription", sellerAuth.authKey],
    queryFn: () => getSellerSubscription(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const authorizeMutation = useMutation({
    mutationFn: async () => {
      const authorization = await authorizeSellerSubscription(sellerAuth.authHeaders);
      if (!authorization.requiresPayment) {
        return authorization;
      }

      const checkoutResponse = await openSellerRazorpayCheckout(authorization);
      if (!checkoutResponse) {
        return authorization;
      }

      return verifySellerSubscription(sellerAuth.authHeaders, {
        razorpaySubscriptionId:
          checkoutResponse.razorpay_subscription_id ?? authorization.razorpaySubscriptionId ?? "",
        razorpayPaymentId: checkoutResponse.razorpay_payment_id,
        razorpaySignature: checkoutResponse.razorpay_signature,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller-subscription"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSellerSubscription(sellerAuth.authHeaders),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller-subscription"] });
    },
  });

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (query.isLoading) {
    return <SellerSkeleton />;
  }

  if (query.error) {
    if (isSellerOnboardingRequiredError(query.error)) {
      return (
        <SellerEmptyState
          title="Seller onboarding required"
          message="Submit seller onboarding before subscription details can be shown."
          action={
            <Button asChild>
              <Link href="/seller/register">Start onboarding</Link>
            </Button>
          }
        />
      );
    }

    return <SellerErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  const subscription = query.data;
  const plan = subscription?.plan;
  const currentSubscription = subscription?.currentSubscription;
  const billing = subscription?.billing;
  const payments = subscription?.payments ?? currentSubscription?.payments ?? [];
  const actionError = authorizeMutation.error ?? cancelMutation.error;

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
                <StatusBadge tone={statusTone(subscription?.subscriptionStatus)}>
                  {statusLabel(subscription?.subscriptionStatus)}
                </StatusBadge>
                {billing?.cancelAtPeriodEnd ? (
                  <StatusBadge tone="warning">Cancels at period end</StatusBadge>
                ) : null}
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
                {plan.description ??
                  "Your seller subscription controls catalogue capacity, B2B access, and operational plan settings."}
              </p>
              <p className="mt-3 text-sm font-bold text-[#163B5C]">
                Started {formatDateTime(subscription?.subscriptionStartedAt)} / Renews{" "}
                {formatDateTime(currentSubscription?.nextBillingAt ?? subscription?.subscriptionCurrentPeriodEnd)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {billing?.canAuthorize ? (
              <Button
                type="button"
                onClick={() => authorizeMutation.mutate()}
                disabled={authorizeMutation.isPending}
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                {authorizeMutation.isPending ? "Opening payment" : "Authorize payment"}
              </Button>
            ) : null}
            {billing?.canCancel ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                {cancelMutation.isPending ? "Cancelling" : "Stop renewal"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>
      </SellerPanel>

      {subscription?.subscriptionStatus === "PENDING_PAYMENT" ? (
        <SellerPanel className="border-[#F4C27A] bg-[#FFF8E6]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-[#B76E00]" aria-hidden="true" />
            <div>
              <p className="text-sm font-black text-[#7A4A00]">Payment attention required</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#8A5A00]">
                {billing?.gracePeriodEndsAt
                  ? `Renewal payment failed. New product and B2B growth actions remain available until ${formatDateTime(billing.gracePeriodEndsAt)}.`
                  : "Authorize the recurring payment after seller approval to unlock paid plan benefits."}
              </p>
            </div>
          </div>
        </SellerPanel>
      ) : null}

      {subscription?.subscriptionStatus === "EXPIRED" ? (
        <SellerPanel className="border-[#F5B7B7] bg-[#FDECEC]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-[#B42318]" aria-hidden="true" />
            <div>
              <p className="text-sm font-black text-[#8A1F1F]">Subscription expired</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#8A1F1F]">
                Existing store visibility and order fulfilment remain available. New product and
                B2B growth actions are blocked until payment is authorized.
              </p>
            </div>
          </div>
        </SellerPanel>
      ) : null}

      {actionError ? (
        <p className="rounded-md bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#8A1F1F]">
          {actionError.message}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SellerMetric
          label="Plan price"
          value={formatMoney(plan.pricePaise, plan.currency)}
          note={statusLabel(plan.billingCycle)}
        />
        <SellerMetric label="Product limit" value={limitLabel(plan.productLimit)} note="Catalogue capacity" />
        <SellerMetric label="Featured slots" value={limitLabel(plan.featuredProductLimit)} note="Admin-managed visibility" />
        <SellerMetric label="B2B enquiries" value={limitLabel(plan.b2bEnquiryLimit)} note="Quotation request capacity" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <SellerPanel>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#E9F7F1] text-[#0F8A5F]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="Recurring billing"
              description="Razorpay authorisation, renewal state, grace period, and cancellation are tracked from this seller account."
            />
          </div>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085] md:grid-cols-2">
            <BillingLine label="Provider" value={currentSubscription?.provider ?? "Razorpay"} />
            <BillingLine label="Provider status" value={billing?.providerStatus ?? "Not authorised"} />
            <BillingLine label="Last payment" value={statusLabel(billing?.lastPaymentStatus)} />
            <BillingLine label="Failures" value={String(billing?.paymentFailureCount ?? 0)} />
            <BillingLine label="Grace ends" value={formatDateTime(billing?.gracePeriodEndsAt)} />
            <BillingLine label="Cancel requested" value={billing?.cancelAtPeriodEnd ? "Yes" : "No"} />
          </div>
        </SellerPanel>

        <SellerPanel>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="Recent payments" description="Latest recurring subscription charges and attempts." />
          </div>
          <div className="mt-5 grid gap-3">
            {payments.length ? (
              payments.slice(0, 5).map((payment) => (
                <div key={payment.id} className="rounded-md border border-[#D9E2EA] bg-[#F8FAFC] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#1F2933]">
                        {formatMoney(payment.amountPaise, payment.currency)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#667085]">
                        {payment.providerPaymentId ?? payment.providerInvoiceId ?? "Provider reference pending"}
                      </p>
                    </div>
                    <StatusBadge tone={paymentTone(payment.status)}>{statusLabel(payment.status)}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#667085]">
                    {formatDateTime(payment.paidAt ?? payment.failedAt ?? payment.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-[#667085]">No recurring payment attempts recorded yet.</p>
            )}
          </div>
        </SellerPanel>
      </div>
    </div>
  );
}

function BillingLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      {label}: <span className="font-black text-[#1F2933]">{value || "Not set"}</span>
    </p>
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

function paymentTone(status?: string | null): "success" | "warning" | "danger" | "info" {
  if (status === "PAID" || status === "NOT_REQUIRED") {
    return "success";
  }
  if (status === "FAILED") {
    return "danger";
  }
  if (status === "PENDING") {
    return "warning";
  }
  return "info";
}

async function openSellerRazorpayCheckout(authorization: SellerSubscriptionAuthorization) {
  await loadRazorpayScript();
  const RazorpayConstructor = (window as unknown as { Razorpay?: SellerRazorpayConstructor })
    .Razorpay;
  const checkoutConfig = authorization.checkout;

  if (!RazorpayConstructor || !checkoutConfig) {
    throw new Error("Razorpay Checkout could not be loaded.");
  }

  return new Promise<SellerRazorpaySuccessResponse | null>((resolve, reject) => {
    const options: SellerRazorpayCheckoutOptions = {
      key: checkoutConfig.key,
      subscription_id: checkoutConfig.subscription_id,
      name: checkoutConfig.name,
      description: checkoutConfig.description,
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => resolve(null),
      },
      theme: {
        color: checkoutConfig.theme?.color ?? "#ED3500",
      },
      ...(checkoutConfig.prefill ? { prefill: checkoutConfig.prefill } : {}),
    };
    const checkout = new RazorpayConstructor(options);

    checkout.on("payment.failed", (response) => {
      reject(new Error(response.error?.description ?? "Razorpay subscription payment failed."));
    });
    checkout.open();
  });
}

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only run in the browser."));
  }

  if ((window as unknown as { Razorpay?: SellerRazorpayConstructor }).Razorpay) {
    return Promise.resolve();
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Unable to load Razorpay Checkout.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Unable to load Razorpay Checkout.")),
        { once: true },
      );
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}
