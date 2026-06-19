import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Field, Header, LoadingState, Screen, SelectField, StatusChip } from "../../src/components/screen";
import { formatMoney } from "../../src/lib/money";
import { getSellerProfile, getSellerSalesReport, listSellerSubscriptionPlans } from "../../src/features/seller/seller-api";
import { sellerWorkspaceState } from "../../src/features/seller/seller-state";
import { useSellerPushNotificationStatus } from "../../src/features/seller/use-seller-push-notifications";

const SELLER_TYPE_OPTIONS = [
  { label: "Marketplace seller", value: "MARKETPLACE_SELLER" },
  { label: "Hyperlocal store", value: "HYPERLOCAL_STORE" },
  { label: "Wholesale distributor", value: "WHOLESALE_DISTRIBUTOR" },
];

const BUSINESS_TYPE_OPTIONS = [
  { label: "Individual", value: "INDIVIDUAL" },
  { label: "Proprietorship", value: "PROPRIETORSHIP" },
  { label: "Partnership", value: "PARTNERSHIP" },
  { label: "LLP", value: "LLP" },
  { label: "Private limited", value: "PRIVATE_LIMITED" },
  { label: "Public limited", value: "PUBLIC_LIMITED" },
  { label: "Other", value: "OTHER" },
];

export default function SellerDashboardScreen() {
  const auth = useMobileSellerAuth();
  const pushNotifications = useSellerPushNotificationStatus();
  const profileQuery = useQuery({
    queryKey: ["seller-profile", auth.authKey],
    queryFn: () => getSellerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });
  const profileState = sellerWorkspaceState(profileQuery.data, profileQuery.error && "status" in profileQuery.error ? Number(profileQuery.error.status) : undefined);
  const reportQuery = useQuery({
    queryKey: ["seller-sales-report", auth.authKey, "dashboard"],
    queryFn: () => getSellerSalesReport(auth.authHeaders),
    enabled: auth.enabled && profileState === "approved",
  });

  if (auth.status === "signed-out") {
    return <Redirect href="/auth/sign-in" />;
  }
  if (!auth.enabled || profileQuery.isLoading) {
    return <LoadingState message="Preparing seller workspace..." />;
  }
  if (profileState === "needs-onboarding") {
    return <OnboardingScreen />;
  }
  if (profileState === "pending-approval") {
    return (
      <Screen>
        <Header title="Approval pending" subtitle="Your seller registration is submitted. Admin approval is required before catalogue and order tools unlock." />
        <Card>
          <StatusChip label={profileQuery.data?.approvalStatus ?? "PENDING_APPROVAL"} tone="warning" />
          <Text style={{ color: "#6B7280" }}>We will keep this app ready for products, orders, finance, and profile management once the store is approved.</Text>
        </Card>
      </Screen>
    );
  }
  if (profileState === "blocked") {
    return (
      <Screen>
        <Header title="Seller account blocked" subtitle="This store cannot currently use seller operations. Contact admin support for the next step." />
        <Card>
          <StatusChip label={profileQuery.data?.status ?? "BLOCKED"} tone="danger" />
        </Card>
      </Screen>
    );
  }

  const report = reportQuery.data;
  return (
    <Screen>
      <Header title={`Welcome, ${profileQuery.data?.storeName ?? "Seller"}`} subtitle="Track operations, sales, products, and payout readiness." />
      <NotificationStatusCard state={pushNotifications.state} onRefresh={pushNotifications.refresh} />
      <Card>
        <StatusChip label="Approved seller" tone="success" />
        <Metric label="Net sales" value={formatMoney(report?.summary.netSalesPaise)} />
        <Metric label="Orders" value={String(report?.summary.orderCount ?? 0)} />
        <Metric label="Low stock" value={String(report?.summary.lowStockCount ?? 0)} />
      </Card>
      <Card>
        <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Quick actions</Text>
        <Button title="Add product" onPress={() => router.push("/products/new")} />
        <Button title="Review orders" tone="secondary" onPress={() => router.push("/(tabs)/orders")} />
        <Button title="Open finance" tone="secondary" onPress={() => router.push("/(tabs)/finance")} />
      </Card>
      {report?.recentOrders?.length ? (
        <Card>
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Recent orders</Text>
          {report.recentOrders.slice(0, 4).map((split) => (
            <Text key={split.id} style={{ color: "#6B7280", fontWeight: "700" }}>
              {split.order.orderNumber} - {formatMoney(split.sellerSubtotalPaise, split.order.currency ?? "INR")}
            </Text>
          ))}
        </Card>
      ) : (
        <EmptyState title="No recent seller orders" message="New orders containing your products will appear here." />
      )}
    </Screen>
  );
}

function NotificationStatusCard({ onRefresh, state }: { onRefresh: () => void; state: string }) {
  if (state === "registered" || state === "checking") {
    return null;
  }

  const message =
    state === "permission-denied"
      ? "Notifications are off. Enable alerts to receive new order and B2B enquiry updates on this device."
      : state === "device-unsupported"
        ? "Push notifications need a real Android or iOS device."
        : state === "expo-go-unsupported"
          ? "Push notifications need a development build or EAS build. Expo Go cannot receive Android seller alerts."
        : "Notification registration could not be completed. Retry after checking network and app settings.";

  return (
    <Card>
      <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>Seller alerts</Text>
      <Text style={{ color: "#6B7280", fontWeight: "700" }}>{message}</Text>
      <Button title="Retry notifications" tone="secondary" onPress={onRefresh} />
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: "#111827", fontSize: 22, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function OnboardingScreen() {
  const auth = useMobileSellerAuth();
  const [sellerType, setSellerType] = useState<"MARKETPLACE_SELLER" | "HYPERLOCAL_STORE" | "WHOLESALE_DISTRIBUTOR">("MARKETPLACE_SELLER");
  const [storeName, setStoreName] = useState("");
  const [businessLegalName, setBusinessLegalName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [subscriptionPlanId, setSubscriptionPlanId] = useState("");
  const queryClient = useQueryClient();
  const plansQuery = useQuery({
    queryKey: ["seller-subscription-plans", "onboarding"],
    queryFn: listSellerSubscriptionPlans,
    enabled: auth.enabled,
  });
  const mutation = useMutation({
    mutationFn: () =>
      onboardSeller(auth.authHeaders, {
        sellerType,
        storeName,
        contactName,
        contactPhone,
        ...(businessLegalName ? { businessLegalName } : {}),
        ...(businessType ? { businessType } : {}),
        ...(gstNumber ? { gstNumber } : {}),
        ...(panNumber ? { panNumber } : {}),
        ...(businessDescription ? { businessDescription } : {}),
        ...(subscriptionPlanId ? { subscriptionPlanId } : {}),
        address: { line1, line2, area, city, state, pincode, country: "India", countryCode: "IN" },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller-profile", auth.authKey] });
    },
  });

  return (
    <Screen>
      <Header title="Register as seller" subtitle="Create the store profile admin will review before product operations open." />
      <Card>
        <SelectField label="Seller type" options={SELLER_TYPE_OPTIONS} selectedValue={sellerType} onSelect={(value) => setSellerType(value as typeof sellerType)} />
        <Field label="Store name" value={storeName} onChangeText={setStoreName} />
        <Field label="Business legal name" value={businessLegalName} onChangeText={setBusinessLegalName} />
        <SelectField label="Business type" options={BUSINESS_TYPE_OPTIONS} selectedValue={businessType} onSelect={setBusinessType} />
        <Field label="GST number" value={gstNumber} onChangeText={setGstNumber} autoCapitalize="characters" />
        <Field label="PAN number" value={panNumber} onChangeText={setPanNumber} autoCapitalize="characters" />
        <Field label="Contact name" value={contactName} onChangeText={setContactName} />
        <Field keyboardType="phone-pad" label="Contact phone" value={contactPhone} onChangeText={setContactPhone} />
        <Field label="Business description" value={businessDescription} onChangeText={setBusinessDescription} multiline />
        <Field label="Address line" value={line1} onChangeText={setLine1} />
        <Field label="Address line 2" value={line2} onChangeText={setLine2} />
        <Field label="Area" value={area} onChangeText={setArea} />
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="State" value={state} onChangeText={setState} />
        <Field keyboardType="number-pad" label="Pincode" value={pincode} onChangeText={setPincode} />
        <SelectField
          label="Subscription plan"
          options={[{ label: "Default plan", value: "" }, ...(plansQuery.data?.items ?? []).map((plan) => ({ label: plan.name, value: plan.id }))]}
          selectedValue={subscriptionPlanId}
          onSelect={setSubscriptionPlanId}
        />
        {mutation.error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{mutation.error instanceof Error ? mutation.error.message : "Registration failed."}</Text> : null}
        <Button disabled={mutation.isPending || !storeName || !contactName || !contactPhone || !line1} title={mutation.isPending ? "Submitting..." : "Submit registration"} onPress={() => mutation.mutate()} />
      </Card>
    </Screen>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { onboardSeller } from "../../src/features/seller/seller-api";
