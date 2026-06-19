import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useState } from "react";
import RazorpayCheckout, { type RazorpayOptions } from "react-native-razorpay";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Header, LoadingState, Screen, ConfirmDialog, StatusChip } from "../../src/components/screen";
import {
  listSellerSubscriptionPlans,
  getSellerSubscription,
  authorizeSellerSubscription,
  verifySellerSubscription,
  cancelSellerSubscription,
  type SellerSubscriptionPlan,
  type RazorpayCheckoutAuth
} from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  CANCELLED: "danger",
  EXPIRED: "info",
  PENDING_PAYMENT: "warning",
  TRIALING: "info",
};

export default function SubscriptionScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<SellerSubscriptionPlan | null>(null);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [razorpayData, setRazorpayData] = useState<RazorpayCheckoutAuth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["seller-subscription-plans"],
    queryFn: listSellerSubscriptionPlans,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["seller-subscription", auth.authKey],
    queryFn: () => getSellerSubscription(auth.authHeaders),
    enabled: auth.enabled,
  });

  const authorizeMutation = useMutation({
    mutationFn: () => authorizeSellerSubscription(auth.authHeaders),
    onSuccess: (data) => {
      if (!data.requiresPayment) {
        queryClient.invalidateQueries({ queryKey: ["seller-subscription"] });
        setSelectedPlan(null);
        setRazorpayData(null);
        setShowSubscribeDialog(false);
        setError(null);
        return;
      }
      if (!data.checkout && (!data.keyId || !data.razorpaySubscriptionId)) {
        setError("Subscription checkout could not be prepared. Please try again.");
        return;
      }
      setRazorpayData(data);
      setShowSubscribeDialog(true);
      setError(null);
    },
    onError: (caught: Error) => {
      setError(caught.message || "Subscription authorization failed.");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: { razorpaySubscriptionId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
      verifySellerSubscription(auth.authHeaders, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-subscription"] });
      setShowSubscribeDialog(false);
      setSelectedPlan(null);
      setRazorpayData(null);
      setError(null);
    },
    onError: (caught: Error) => {
      setError(caught.message || "Subscription payment verification failed.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSellerSubscription(auth.authHeaders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-subscription"] });
      setShowCancelDialog(false);
    },
    onError: (caught: Error) => {
      setError(caught.message || "Subscription cancellation failed.");
    },
  });

  if (!auth.enabled || subscriptionQuery.isLoading || plansQuery.isLoading) {
    return <LoadingState message="Loading subscription..." />;
  }

  const plans = plansQuery.data?.items || [];
  const subscription = subscriptionQuery.data;
  const currentPlan = subscription?.plan ?? subscription?.currentSubscription?.plan ?? null;
  const canAuthorize = Boolean(subscription?.billing?.canAuthorize);
  const canCancel = Boolean(subscription?.billing?.canCancel);
  const productLimitText =
    currentPlan?.productLimit === null || currentPlan?.productLimit === undefined
      ? "Unlimited products"
      : `${currentPlan.productLimit} product limit`;
  const b2bLimitText =
    currentPlan?.b2bEnquiryLimit === null || currentPlan?.b2bEnquiryLimit === undefined
      ? "B2B access as assigned"
      : `${currentPlan.b2bEnquiryLimit} B2B enquiry responses`;

  const handleSubscribe = (plan: SellerSubscriptionPlan) => {
    if (currentPlan?.id && plan.id !== currentPlan.id) {
      setError("Plan changes must be requested from admin before payment authorization.");
      return;
    }
    if (!canAuthorize) {
      setError("Subscription payment is not available for this seller account right now.");
      return;
    }
    setSelectedPlan(plan);
    setError(null);
    authorizeMutation.mutate();
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    cancelMutation.mutate();
  };

  return (
    <Screen contentContainerStyle={{ gap: 16 }}>
      <Header title="Subscription" subtitle="Manage seller subscription plans." />
        {error ? (
          <Card>
            <Text style={{ color: "#D64545", fontWeight: "800" }}>{error}</Text>
          </Card>
        ) : null}
        {subscription ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Current Subscription</Text>
            <StatusChip label={subscription.subscriptionStatus} tone={statusTones[subscription.subscriptionStatus] || "info"} />
            {currentPlan ? (
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900", marginTop: 8 }}>
                {currentPlan.name}
              </Text>
            ) : null}
            {subscription.subscriptionCurrentPeriodEnd ? (
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Next billing: {new Date(subscription.subscriptionCurrentPeriodEnd).toLocaleDateString()}
              </Text>
            ) : null}
            {subscription.billing?.lastPaymentStatus ? (
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Last payment: {subscription.billing.lastPaymentStatus}
              </Text>
            ) : null}
            {canCancel ? (
              <Button
                title="Cancel Subscription"
                tone="secondary"
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
              />
            ) : null}
          </Card>
        ) : (
          <Card>
            <Text style={{ color: "#6B7280", fontSize: 14, textAlign: "center" }}>
              No active subscription is assigned. Some seller actions can be limited until an admin assigns an eligible plan.
            </Text>
          </Card>
        )}
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Available Plans</Text>
          {plans.map((plan) => (
            <View key={plan.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 12, marginBottom: 12 }}>
                <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>{plan.name}</Text>
                {plan.description ? (
                  <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 4 }}>{plan.description}</Text>
                ) : null}
                <Text style={{ color: "#ED3500", fontSize: 20, fontWeight: "900", marginBottom: 4 }}>
                  {formatMoney(plan.pricePaise, plan.currency ?? "INR")}/{plan.billingCycle.toLowerCase()}
                </Text>
                <Text style={{ color: "#374151", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>
                  {plan.productLimit === null || plan.productLimit === undefined ? "Unlimited products" : `${plan.productLimit} products`}
                  {" / "}
                  {plan.b2bEnquiryLimit === null || plan.b2bEnquiryLimit === undefined ? "B2B as assigned" : `${plan.b2bEnquiryLimit} B2B responses`}
                </Text>
                <View style={{ gap: 4 }}>
                  {plan.features && plan.features.length > 0 ? (
                    plan.features.map((feature, index) => (
                      <Text key={index} style={{ color: "#6B7280", fontSize: 12 }}>
                        • {feature}
                      </Text>
                    ))
                  ) : (
                    <Text style={{ color: "#9CA3AF", fontSize: 12, fontStyle: "italic" }}>
                      No features listed
                    </Text>
                  )}
                </View>
                {plan.isActive ? (
                  <Button
                    title={
                      authorizeMutation.isPending && selectedPlan?.id === plan.id
                        ? "Preparing..."
                        : currentPlan?.id === plan.id
                          ? canAuthorize
                            ? "Pay for current plan"
                            : "Current Plan"
                          : "Admin assignment required"
                    }
                    tone={currentPlan?.id === plan.id ? "primary" : "secondary"}
                    disabled={currentPlan?.id !== plan.id || !canAuthorize || authorizeMutation.isPending}
                    onPress={() => handleSubscribe(plan)}
                  />
                ) : null}
              </View>
            ))}
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Subscription Notes</Text>
          <Text style={{ color: "#6B7280", fontSize: 14 }}>
            Your current plan controls limits such as catalogue size and B2B access. {currentPlan ? `${productLimitText}; ${b2bLimitText}.` : "Ask admin to assign a seller plan before relying on product or B2B limits."}
          </Text>
        </Card>
        <ConfirmDialog
          visible={showSubscribeDialog}
          title="Subscribe to Plan"
          message={selectedPlan ? `Subscribe to ${selectedPlan.name} for ${formatMoney(selectedPlan.pricePaise)}/${selectedPlan.billingCycle.toLowerCase()}?` : "Subscribe to this plan?"}
          onConfirm={async () => {
            if (!razorpayData) {
              return;
            }
            try {
              let checkout: RazorpayOptions;
              if (razorpayData.checkout) {
                checkout = razorpayData.checkout;
              } else {
                const key = razorpayData.keyId;
                const subscriptionId = razorpayData.razorpaySubscriptionId;
                if (!key || !subscriptionId) {
                  throw new Error("Subscription checkout is missing Razorpay authorization details.");
                }
                checkout = {
                  key,
                  subscription_id: subscriptionId,
                  name: razorpayData.name ?? "1HandIndia",
                  description: razorpayData.description ?? "Seller subscription",
                  theme: { color: "#ED3500" },
                };
              }
              const response = await RazorpayCheckout.open(checkout);
              const razorpayPaymentId = response.razorpay_payment_id;
              const razorpaySignature = response.razorpay_signature;
              const razorpaySubscriptionId = response.razorpay_subscription_id ?? razorpayData.razorpaySubscriptionId;
              if (!razorpayPaymentId || !razorpaySignature || !razorpaySubscriptionId) {
                throw new Error("Razorpay did not return the required payment verification details.");
              }
              verifyMutation.mutate({ razorpaySubscriptionId, razorpayPaymentId, razorpaySignature });
            } catch (caught) {
              setShowSubscribeDialog(false);
              setError(caught instanceof Error ? caught.message : "Subscription payment was not completed.");
            }
          }}
          onCancel={() => {
            setShowSubscribeDialog(false);
            setSelectedPlan(null);
            setRazorpayData(null);
          }}
        />
        <ConfirmDialog
          visible={showCancelDialog}
          title="Cancel Subscription"
          message="Your subscription will remain active until the end of the current billing period. You can resubscribe at any time."
          onConfirm={confirmCancel}
          onCancel={() => setShowCancelDialog(false)}
        />
    </Screen>
  );
}
