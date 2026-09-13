import {
  PencilEdit01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { Stack, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { useCustomerReviews, useDeleteReview } from "../../../src/features/storefront/use-mobile-reviews";
import { RatingDisplay } from "../../../src/components/rating-display";
import { resolveImageUrl } from "../../../src/lib/image-url";
import { colors } from "../../../src/theme";

export default function MyReviewsScreen() {
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();

  const { data, isLoading, isError, refetch } = useCustomerReviews();
  const { deleteReview, isDeleting, error: deleteError } = useDeleteReview();

  const reviews = useMemo(() => data?.items ?? [], [data?.items]);

  const handleDelete = useCallback((review: { id: string; productName: string }) => {
    Alert.alert(
      "Delete review",
      `Remove your review for "${review.productName}"?`,
      [
        { style: "cancel", text: "Cancel" },
        {
          style: "destructive",
          text: "Delete",
          onPress: () => { void deleteReview(review.id); },
        },
      ],
    );
  }, [deleteReview]);

  if (!customerAuth.enabled) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "My Reviews" }} />
        <View style={styles.centerState}>
          <Text style={styles.centerText}>Sign in to view your reviews.</Text>
        </View>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "My Reviews" }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "My Reviews" }} />
        <View style={styles.centerState}>
          <Text style={styles.centerText}>Could not load your reviews.</Text>
          <Pressable style={styles.retryButton} onPress={() => void refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "My Reviews" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={reviews}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyMessage}>Your written reviews will appear here after you rate a product from your orders.</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push("/orders")}>
              <Text style={styles.emptyButtonText}>View orders</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewProductName}>{item.productName}</Text>
              <RatingDisplay averageRating={item.rating} reviewCount={1} size="small" />
            </View>
            <View style={styles.reviewCardBody}>
              {item.title ? <Text style={styles.reviewTitle}>{item.title}</Text> : null}
              {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
              <Text style={styles.reviewDate}>{formatReviewDate(item.submittedAt ?? item.createdAt)}</Text>
              <Text style={styles.reviewStatus}>Status: {item.status}</Text>
            </View>
            {item.productSlug ? (
              <Pressable style={styles.editReviewButton} onPress={() => {
                router.push({ pathname: "/product/[slug]", params: { slug: item.productSlug } });
              }}>
                <HugeiconsIcon color={colors.primary} icon={PencilEdit01Icon} size={15} strokeWidth={2} />
                <Text style={styles.editReviewButtonText}>View product</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.deleteReviewButton}
              onPress={() => handleDelete(item)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color={colors.danger} size="small" />
              ) : (
                <Text style={styles.deleteReviewButtonText}>Delete</Text>
              )}
            </Pressable>
            {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
          </View>
        )}
      />
    </Screen>
  );
}

function formatReviewDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 128,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  reviewCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewProductName: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    marginRight: 12,
  },
  reviewCardBody: {
    gap: 4,
  },
  reviewTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  reviewComment: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  reviewStatus: {
    color: "#9AA4B2",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  editReviewButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  editReviewButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  deleteReviewButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  deleteReviewButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
  },
  deleteError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  emptyMessage: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
});
