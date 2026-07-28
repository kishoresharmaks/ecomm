import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Header, LoadingState, Screen, StatusChip, ConfirmDialog } from "../../src/components/screen";
import { listSellerCoupons, acceptSellerCoupon, declineSellerCoupon, type SellerCouponParticipation } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "danger",
  REMOVED: "info",
};

const couponStatusLabel = (coupon: SellerCouponParticipation["coupon"]) => {
  if (coupon.discountType === "FREE_SHIPPING") return "Free shipping";
  if (coupon.discountType === "PERCENTAGE") return `${(coupon.discountValueBps ?? 0) / 100}% off`;
  return `${formatMoney(coupon.discountAmountPaise ?? 0)} off`;
};

export default function CouponsScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);

  const couponsQuery = useQuery({
    queryKey: ["seller-coupons", auth.authKey, statusFilter],
    queryFn: () => listSellerCoupons(auth.authHeaders, {
      ...(statusFilter !== "ALL" ? { participationStatus: statusFilter } : {}),
    }),
    enabled: auth.enabled,
  });

  const acceptMutation = useMutation({
    mutationFn: (couponId: string) => acceptSellerCoupon(auth.authHeaders, couponId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-coupons"] });
      setShowAcceptDialog(false);
      setSelectedCouponId(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (couponId: string) => declineSellerCoupon(auth.authHeaders, couponId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-coupons"] });
      setShowDeclineDialog(false);
      setSelectedCouponId(null);
    },
  });

  if (!auth.enabled || couponsQuery.isLoading) {
    return <LoadingState message="Loading coupons..." />;
  }

  const filteredCoupons = couponsQuery.data?.items || [];

  const handleAccept = (couponId: string) => {
    setSelectedCouponId(couponId);
    setShowAcceptDialog(true);
  };

  const handleDecline = (couponId: string) => {
    setSelectedCouponId(couponId);
    setShowDeclineDialog(true);
  };

  const confirmAccept = () => {
    if (selectedCouponId) {
      acceptMutation.mutate(selectedCouponId);
    }
  };

  const confirmDecline = () => {
    if (selectedCouponId) {
      declineMutation.mutate(selectedCouponId);
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Coupons" subtitle="Accept or decline platform coupon campaigns." />
        <Card>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Status Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 8 }}>
            {["ALL", "PENDING", "ACCEPTED", "DECLINED", "REMOVED"].map((status) => (
              <Button
                key={status}
                title={status}
                tone={statusFilter === status ? "primary" : "secondary"}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </ScrollView>
        </Card>
        {filteredCoupons.length ? (
          filteredCoupons.map((item) => (
            <Card key={item.id}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <StatusChip label={item.status} tone={statusTones[item.status] || "info"} />
                <StatusChip label={item.coupon.status} tone={item.coupon.status === "ACTIVE" ? "success" : "info"} />
              </View>
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900", marginBottom: 4 }}>{item.coupon.code}</Text>
              <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>{item.coupon.title}</Text>
              <Text style={{ color: "#374151", fontSize: 14, fontWeight: "900" }}>{couponStatusLabel(item.coupon)}</Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Funding: {item.coupon.fundingSource.replace(/_/g, " ")} • Redemptions: {item.coupon.redemptions?.length ?? 0}
              </Text>
              {item.coupon.redemptions && item.coupon.redemptions.length > 0 ? (
                <Text style={{ color: "#6B7280", fontSize: 12 }}>
                  Your deductions: {formatMoney(item.coupon.redemptions.reduce((total, r) => total + r.sellerFundedDiscountPaise, 0))}
                </Text>
              ) : null}
              <Text style={{ color: "#9CA3AF", fontSize: 10 }}>
                Locked: {item.lockedAt ? "Yes" : "No"}
              </Text>
              {item.status === "PENDING" && !item.lockedAt ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Button
                    title="Accept"
                    onPress={() => handleAccept(item.couponId)}
                    disabled={acceptMutation.isPending}
                  />
                  <Button
                    title="Decline"
                    tone="secondary"
                    onPress={() => handleDecline(item.couponId)}
                    disabled={declineMutation.isPending}
                  />
                </View>
              ) : null}
            </Card>
          ))
        ) : (
          <Card>
            <Text style={{ color: "#6B7280", fontSize: 14, textAlign: "center" }}>
              No coupon campaigns connected to your store.
            </Text>
          </Card>
        )}
        <ConfirmDialog
          visible={showAcceptDialog}
          title="Accept Coupon Campaign"
          message="Accepting will lock your participation after the first redemption. Platform-funded coupons don't affect your settlements."
          onConfirm={confirmAccept}
          onCancel={() => setShowAcceptDialog(false)}
        />
        <ConfirmDialog
          visible={showDeclineDialog}
          title="Decline Coupon Campaign"
          message="Are you sure you want to decline this coupon campaign? You can accept later if still available."
          onConfirm={confirmDecline}
          onCancel={() => setShowDeclineDialog(false)}
        />
      </ScrollView>
    </Screen>
  );
}
