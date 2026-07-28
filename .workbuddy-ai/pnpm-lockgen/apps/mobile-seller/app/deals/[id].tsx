import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Header, LoadingState, Screen, ConfirmDialog } from "../../src/components/screen";
import { getSellerDeal, enrollSellerDealProducts, removeSellerDealProduct } from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const dealQuery = useQuery({
    queryKey: ["seller-deal", auth.authKey, id],
    queryFn: () => getSellerDeal(auth.authHeaders, id),
    enabled: auth.enabled && Boolean(id),
  });

  const enrollMutation = useMutation({
    mutationFn: (productId: string) => enrollSellerDealProducts(auth.authHeaders, id, [productId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-deal"] });
      queryClient.invalidateQueries({ queryKey: ["seller-deals"] });
      setShowEnrollDialog(false);
      setSelectedProductId(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeSellerDealProduct(auth.authHeaders, id, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-deal"] });
      queryClient.invalidateQueries({ queryKey: ["seller-deals"] });
      setShowRemoveDialog(false);
      setSelectedProductId(null);
    },
  });

  if (!auth.enabled || dealQuery.isLoading) {
    return <LoadingState message="Loading deal details..." />;
  }

  const deal = dealQuery.data;

  if (!deal) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text>Deal not found</Text>
        </ScrollView>
      </Screen>
    );
  }

  const accepted = deal.sellerParticipation?.status === "ACCEPTED";
  const enrolledProductIds = new Set(
    deal.productEnrollments
      ?.filter((enrollment) => enrollment.status === "ENROLLED")
      .map((enrollment) => enrollment.productId) ?? [],
  );

  const handleEnroll = (productId: string) => {
    setSelectedProductId(productId);
    setShowEnrollDialog(true);
  };

  const handleRemove = (productId: string) => {
    setSelectedProductId(productId);
    setShowRemoveDialog(true);
  };

  const confirmEnroll = () => {
    if (selectedProductId) {
      enrollMutation.mutate(selectedProductId);
    }
  };

  const confirmRemove = () => {
    if (selectedProductId) {
      removeMutation.mutate(selectedProductId);
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Deal Details" subtitle={deal.title} />
        <Card>
          <Text style={{ color: "#ED3500", fontSize: 24, fontWeight: "900", marginBottom: 8 }}>
            {deal.discountBps / 100}% off
          </Text>
          {deal.category ? (
            <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>
              Category: {deal.category.name}
            </Text>
          ) : null}
        </Card>
        {deal.description ? (
          <Card>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Description</Text>
            <Text style={{ color: "#6B7280", fontSize: 14 }}>{deal.description}</Text>
          </Card>
        ) : null}
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>Schedule</Text>
          <Text style={{ color: "#6B7280", fontSize: 14 }}>
            {new Date(deal.startsAt).toLocaleDateString()} - {new Date(deal.endsAt).toLocaleDateString()}
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 12 }}>
            Join deadline: {new Date(deal.joinDeadline).toLocaleDateString()}
          </Text>
        </Card>
        <Card>
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 8 }}>
            Eligible Products ({deal.eligibleProducts?.length ?? 0})
          </Text>
          {deal.eligibleProducts?.map((product) => {
            const isEnrolled = enrolledProductIds.has(product.id);
            return (
              <View key={product.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 12, marginBottom: 12 }}>
                <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{product.name}</Text>
                <Text style={{ color: "#6B7280", fontSize: 12 }}>
                  Price: {formatMoney(product.pricePaise)}
                </Text>
                {accepted ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    {isEnrolled ? (
                      <Button
                        title="Remove"
                        tone="secondary"
                        onPress={() => handleRemove(product.id)}
                        disabled={removeMutation.isPending}
                      />
                    ) : (
                      <Button
                        title="Enroll"
                        onPress={() => handleEnroll(product.id)}
                        disabled={enrollMutation.isPending}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
        <Button title="Back" tone="secondary" onPress={() => router.back()} />
        <ConfirmDialog
          visible={showEnrollDialog}
          title="Enroll Product in Deal"
          message="This product will be included in the deal campaign at the discounted price."
          onConfirm={confirmEnroll}
          onCancel={() => setShowEnrollDialog(false)}
        />
        <ConfirmDialog
          visible={showRemoveDialog}
          title="Remove Product from Deal"
          message="This product will no longer be included in the deal campaign."
          onConfirm={confirmRemove}
          onCancel={() => setShowRemoveDialog(false)}
        />
      </ScrollView>
    </Screen>
  );
}
