import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { useSubmitReview } from "../../../src/features/storefront/use-mobile-reviews";
import { ReviewForm } from "../../../src/components/review-form";
import { colors } from "../../../src/theme";

export default function WriteReviewScreen() {
  const params = useLocalSearchParams<{ orderItemId?: string }>();
  const orderItemId = typeof params.orderItemId === "string" ? params.orderItemId : "";
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const { error, isSubmitting, submitReview } = useSubmitReview();

  if (!orderItemId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Write a review" }} />
        <View style={styles.centerState}>
          <Text style={styles.errorText}>Missing order item. Please try from your orders.</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Write a review" }} />
        <View style={styles.centerState}>
          <Text style={styles.errorText}>Sign in to write a review.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Write a review" }} />
      <View style={styles.formWrap}>
        {isSubmitting ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.submittingText}>Submitting your review...</Text>
          </View>
        ) : (
          <ReviewForm
            orderItemId={orderItemId}
            onSubmit={async (payload) => {
              await submitReview(payload);
            }}
            isSubmitting={isSubmitting}
            error={error}
            onCancel={() => router.back()}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formWrap: {
    flex: 1,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 60,
  },
  submittingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 16,
  },
});
