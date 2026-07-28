import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Header, LoadingState, Screen, StatusChip, ConfirmDialog } from "../../src/components/screen";
import { listSellerDeals, acceptSellerDeal, declineSellerDeal } from "../../src/features/seller/seller-api";

const participationStatusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "danger",
};

export default function DealsScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const dealsQuery = useQuery({
    queryKey: ["seller-deals", auth.authKey],
    queryFn: () => listSellerDeals(auth.authHeaders),
    enabled: auth.enabled,
  });

  const acceptMutation = useMutation({
    mutationFn: (dealId: string) => acceptSellerDeal(auth.authHeaders, dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-deals"] });
      setShowAcceptDialog(false);
      setSelectedDealId(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (dealId: string) => declineSellerDeal(auth.authHeaders, dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-deals"] });
      setShowDeclineDialog(false);
      setSelectedDealId(null);
    },
  });

  if (!auth.enabled || dealsQuery.isLoading) {
    return <LoadingState message="Loading deals..." />;
  }

  const deals = dealsQuery.data?.items || [];

  const handleAccept = (dealId: string) => {
    setSelectedDealId(dealId);
    setShowAcceptDialog(true);
  };

  const handleDecline = (dealId: string) => {
    setSelectedDealId(dealId);
    setShowDeclineDialog(true);
  };

  const confirmAccept = () => {
    if (selectedDealId) {
      acceptMutation.mutate(selectedDealId);
    }
  };

  const confirmDecline = () => {
    if (selectedDealId) {
      declineMutation.mutate(selectedDealId);
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Deals" subtitle="Accept or decline platform deal campaigns." />
        {deals.length ? (
          deals.map((deal) => (
            <Card key={deal.id}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                {deal.sellerParticipation ? (
                  <StatusChip label={deal.sellerParticipation.status} tone={participationStatusTones[deal.sellerParticipation.status] || "info"} />
                ) : null}
                <Text style={{ color: "#ED3500", fontSize: 12, fontWeight: "900", marginLeft: 8 }}>
                  {deal.discountBps / 100}% off
                </Text>
              </View>
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900", marginBottom: 4 }}>{deal.title}</Text>
              {deal.description ? (
                <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 8 }}>{deal.description}</Text>
              ) : null}
              {deal.category ? (
                <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
                  Category: {deal.category.name}
                </Text>
              ) : null}
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                {new Date(deal.startsAt).toLocaleDateString()} - {new Date(deal.endsAt).toLocaleDateString()}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Join by: {new Date(deal.joinDeadline).toLocaleDateString()}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                Eligible products: {deal.sellerEligibleProductCount ?? deal.eligibleProducts?.length ?? 0}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {deal.sellerParticipation?.status === "ACCEPTED" ? (
                  <Button
                    title="Manage Products"
                    onPress={() => router.push(`/deals/${encodeURIComponent(deal.id)}` as Href)}
                  />
                ) : deal.sellerParticipation?.status === "PENDING" ? (
                  <>
                    <Button
                      title="Accept"
                      onPress={() => handleAccept(deal.id)}
                      disabled={acceptMutation.isPending}
                    />
                    <Button
                      title="Decline"
                      tone="secondary"
                      onPress={() => handleDecline(deal.id)}
                      disabled={declineMutation.isPending}
                    />
                  </>
                ) : deal.sellerParticipation?.status === "DECLINED" ? (
                  <Button
                    title="Accept"
                    onPress={() => handleAccept(deal.id)}
                    disabled={acceptMutation.isPending}
                  />
                ) : null}
              </View>
            </Card>
          ))
        ) : (
          <Card>
            <Text style={{ color: "#6B7280", fontSize: 14, textAlign: "center" }}>
              No deal campaigns available right now.
            </Text>
          </Card>
        )}
        <ConfirmDialog
          visible={showAcceptDialog}
          title="Accept Deal Campaign"
          message="Accepting will allow you to enroll eligible products in this deal. You can manage enrollments after acceptance."
          onConfirm={confirmAccept}
          onCancel={() => setShowAcceptDialog(false)}
        />
        <ConfirmDialog
          visible={showDeclineDialog}
          title="Decline Deal Campaign"
          message="Are you sure you want to decline this deal campaign? You can accept later if still available."
          onConfirm={confirmDecline}
          onCancel={() => setShowDeclineDialog(false)}
        />
      </ScrollView>
    </Screen>
  );
}
