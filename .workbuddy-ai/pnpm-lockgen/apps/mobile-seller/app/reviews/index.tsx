import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Card, EmptyState, Field, Header, LoadingState, Screen, StatusChip } from "../../src/components/screen";
import { getSellerReviewSummary, listSellerReviews } from "../../src/features/seller/seller-api";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  HIDDEN: "info",
};

export default function ReviewsScreen() {
  const auth = useMobileSellerAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [ratingFilter, setRatingFilter] = useState<number | "ALL">("ALL");

  const summaryQuery = useQuery({
    queryKey: ["seller-review-summary", auth.authKey],
    queryFn: () => getSellerReviewSummary(auth.authHeaders),
    enabled: auth.enabled,
  });

  const reviewsQuery = useQuery({
    queryKey: ["seller-reviews", auth.authKey, searchQuery, statusFilter, ratingFilter],
    queryFn: () => listSellerReviews(auth.authHeaders, {
      limit: 30,
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(ratingFilter !== "ALL" ? { rating: ratingFilter } : {}),
    }),
    enabled: auth.enabled,
  });

  if (!auth.enabled || summaryQuery.isLoading || reviewsQuery.isLoading) {
    return <LoadingState message="Loading reviews..." />;
  }

  const summary = summaryQuery.data;
  const filteredReviews = reviewsQuery.data?.items || [];

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Reviews" subtitle="View customer product reviews and ratings." />
        {summary ? (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Card style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700" }}>Average Rating</Text>
              <Text style={{ color: "#111827", fontSize: 24, fontWeight: "900" }}>
                {summary.summary.reviewCount ? summary.summary.averageRating.toFixed(1) : "N/A"}
              </Text>
            </Card>
            <Card style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700" }}>Total Reviews</Text>
              <Text style={{ color: "#111827", fontSize: 24, fontWeight: "900" }}>
                {summary.summary.reviewCount}
              </Text>
            </Card>
            <Card style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700" }}>Approved</Text>
              <Text style={{ color: "#10B981", fontSize: 24, fontWeight: "900" }}>
                {summary.statusCounts.APPROVED}
              </Text>
            </Card>
            <Card style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "700" }}>Pending</Text>
              <Text style={{ color: "#F59E0B", fontSize: 24, fontWeight: "900" }}>
                {summary.statusCounts.PENDING}
              </Text>
            </Card>
          </View>
        ) : null}
        <Card>
          <Field
            placeholder="Search reviews..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </Card>
        <Card>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Status Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 8 }}>
            {["ALL", "PENDING", "APPROVED", "REJECTED", "HIDDEN"].map((status) => (
              <Pressable
                key={status}
                accessibilityRole="button"
                onPress={() => setStatusFilter(status)}
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: statusFilter === status ? "#ED3500" : "#6B7280", fontSize: 12, fontWeight: "900" }}>
                  {status}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
        <Card>
          <Text style={{ color: "#374151", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>Rating Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 8 }}>
            {[5, 4, 3, 2, 1].map((rating) => (
              <Pressable
                key={rating}
                accessibilityRole="button"
                onPress={() => setRatingFilter(rating)}
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text style={{ color: ratingFilter === rating ? "#ED3500" : "#6B7280", fontSize: 12, fontWeight: "900" }}>
                  {rating} ★
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setRatingFilter("ALL")}
              style={{ paddingHorizontal: 12, paddingVertical: 8 }}
            >
              <Text style={{ color: ratingFilter === "ALL" ? "#ED3500" : "#6B7280", fontSize: 12, fontWeight: "900" }}>
                All
              </Text>
            </Pressable>
          </ScrollView>
        </Card>
        {filteredReviews.length ? (
          filteredReviews.map((review) => (
            <Card key={review.id}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: "#ED3500", fontSize: 16, fontWeight: "900", marginRight: 8 }}>
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </Text>
                <StatusChip label={review.status} tone={statusTones[review.status] || "info"} />
              </View>
              {review.title ? (
                <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginBottom: 4 }}>{review.title}</Text>
              ) : null}
              {review.comment ? (
                <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 8 }}>{review.comment}</Text>
              ) : null}
              <Text style={{ color: "#374151", fontSize: 14, fontWeight: "600" }}>{review.product.name}</Text>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                {review.customer.displayName} • {review.order.orderNumber}
              </Text>
              {review.isVerifiedPurchase ? (
                <Text style={{ color: "#10B981", fontSize: 10, fontWeight: "600" }}>✓ Verified Purchase</Text>
              ) : null}
              <Text style={{ color: "#9CA3AF", fontSize: 10 }}>
                {new Date(review.createdAt).toLocaleDateString()}
              </Text>
            </Card>
          ))
        ) : (
          <EmptyState title="No Reviews" message="No reviews found" />
        )}
      </ScrollView>
    </Screen>
  );
}
