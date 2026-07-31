import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  Button,
  Card,
  ConfirmDialog,
  Header,
  LoadingState,
  QueryErrorState,
  Screen,
  StatusChip,
} from "../../src/components/screen";
import {
  cancelSellerSubscription,
  getSellerSubscription,
} from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

const statusTones: Record<
  string,
  "info" | "success" | "warning" | "danger"
> = {
  ACTIVE: "success",
  CANCELLED: "danger",
  EXPIRED: "danger",
  PENDING_PAYMENT: "warning",
  TRIALING: "success",
};

export default function SubscriptionScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscriptionQuery = useQuery({
    queryKey: ["seller-subscription", auth.authKey],
    queryFn: () => getSellerSubscription(auth.authHeaders),
    enabled: auth.enabled,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSellerSubscription(auth.authHeaders),
    onSuccess: async () => {
      setShowCancelDialog(false);
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["seller-subscription"],
      });
    },
    onError: (caught: Error) => {
      setError(caught.message || "Subscription cancellation failed.");
    },
  });

  if (!auth.enabled || subscriptionQuery.isLoading) {
    return <LoadingState message="Loading subscription..." />;
  }

  if (subscriptionQuery.isError && !subscriptionQuery.data) {
    return (
      <Screen>
        <Header
          title="Subscription"
          subtitle="Review your seller plan, renewal status, and payments."
        />
        <QueryErrorState
          title="Subscription could not be loaded"
          message={errorMessage(subscriptionQuery.error)}
          onRetry={() => void subscriptionQuery.refetch()}
          retrying={subscriptionQuery.isFetching}
        />
      </Screen>
    );
  }

  const subscription = subscriptionQuery.data;
  const currentPlan =
    subscription?.plan ?? subscription?.currentSubscription?.plan ?? null;
  const payments =
    subscription?.payments ??
    subscription?.currentSubscription?.payments ??
    [];
  const canCancel = Boolean(subscription?.billing?.canCancel);
  const cancelAtPeriodEnd = Boolean(
    subscription?.billing?.cancelAtPeriodEnd,
  );
  const cancelsImmediately =
    subscription?.subscriptionStatus === "PENDING_PAYMENT";

  return (
    <Screen
      contentContainerStyle={{ gap: 16 }}
      refreshing={subscriptionQuery.isRefetching}
      onRefresh={() => void subscriptionQuery.refetch()}
    >
      <Header
        title="Subscription"
        subtitle="Review your seller plan, renewal status, and payments."
      />

      {error ? (
        <Card>
          <Text style={{ color: "#B42318", fontWeight: "800" }}>{error}</Text>
        </Card>
      ) : null}

      {subscription && currentPlan ? (
        <Card>
          <Text
            style={{
              color: "#111827",
              fontSize: 16,
              fontWeight: "900",
              marginBottom: 8,
            }}
          >
            Current subscription
          </Text>
          <StatusChip
            label={statusLabel(subscription.subscriptionStatus)}
            tone={
              statusTones[subscription.subscriptionStatus] || "info"
            }
          />
          <Text
            style={{
              color: "#111827",
              fontSize: 20,
              fontWeight: "900",
              marginTop: 10,
            }}
          >
            {currentPlan.name}
          </Text>
          <Text style={{ color: "#ED3500", fontSize: 18, fontWeight: "900" }}>
            {formatMoney(
              currentPlan.pricePaise,
              currentPlan.currency ?? "INR",
            )}
            /{currentPlan.billingCycle.toLowerCase()}
          </Text>
          {subscription.subscriptionCurrentPeriodEnd ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>
              {cancelAtPeriodEnd ? "Access until" : "Next billing"}:{" "}
              {new Date(
                subscription.subscriptionCurrentPeriodEnd,
              ).toLocaleDateString("en-IN")}
            </Text>
          ) : null}
          {subscription.billing?.gracePeriodEndsAt ? (
            <Text
              style={{
                color: "#92400E",
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              Payment grace period ends{" "}
              {new Date(
                subscription.billing.gracePeriodEndsAt,
              ).toLocaleDateString("en-IN")}
              .
            </Text>
          ) : null}
          {cancelAtPeriodEnd ? (
            <Text
              style={{
                color: "#92400E",
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              Renewal is stopped. The plan remains available until the current
              period ends.
            </Text>
          ) : null}
          {subscription.billing?.lastPaymentStatus ? (
            <Text style={{ color: "#6B7280", fontSize: 12 }}>
              Last payment:{" "}
              {statusLabel(subscription.billing.lastPaymentStatus)}
            </Text>
          ) : null}
          <Text style={{ color: "#6B7280", fontSize: 12, lineHeight: 18 }}>
            New subscription purchases and payment authorization are not offered
            in this app.
          </Text>
          {canCancel ? (
            <Button
              title={cancelsImmediately ? "Cancel authorization" : "Stop renewal"}
              tone="secondary"
              disabled={cancelMutation.isPending}
              onPress={() => setShowCancelDialog(true)}
            />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text
            style={{ color: "#6B7280", fontSize: 14, textAlign: "center" }}
          >
            No seller plan is assigned. Contact marketplace support
            before relying on plan limits.
          </Text>
        </Card>
      )}

      <Card>
        <Text
          style={{
            color: "#111827",
            fontSize: 16,
            fontWeight: "900",
            marginBottom: 8,
          }}
        >
          Recent payments
        </Text>
        {payments.length ? (
          payments.slice(0, 5).map((payment) => (
            <View
              key={payment.id}
              style={{
                borderTopWidth: 1,
                borderTopColor: "#E5E7EB",
                paddingTop: 10,
                gap: 3,
              }}
            >
              <Text
                style={{ color: "#111827", fontSize: 14, fontWeight: "900" }}
              >
                {formatMoney(
                  payment.amountPaise,
                  payment.currency ?? currentPlan?.currency ?? "INR",
                )}
              </Text>
              <Text
                style={{ color: "#6B7280", fontSize: 12, fontWeight: "700" }}
              >
                {statusLabel(payment.status)} - {paymentDate(payment)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={{ color: "#6B7280", fontSize: 12 }}>
            No recurring payment attempts have been recorded.
          </Text>
        )}
      </Card>

      <ConfirmDialog
        visible={showCancelDialog}
        title={
          cancelsImmediately
            ? "Cancel payment authorization"
            : "Stop subscription renewal"
        }
        message={
          cancelsImmediately
            ? "This unpaid subscription authorization will be cancelled immediately. No paid plan access has started."
            : "Recurring renewal will stop. Your current plan remains available until the end of its billing period."
        }
        confirmLabel={cancelsImmediately ? "Cancel authorization" : "Stop renewal"}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setShowCancelDialog(false)}
      />
    </Screen>
  );
}

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function paymentDate(payment: {
  paidAt?: string | null;
  failedAt?: string | null;
  createdAt?: string;
}) {
  const value = payment.paidAt ?? payment.failedAt ?? payment.createdAt;
  return value
    ? new Date(value).toLocaleDateString("en-IN")
    : "Date unavailable";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}
