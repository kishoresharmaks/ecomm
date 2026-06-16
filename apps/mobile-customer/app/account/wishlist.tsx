import { Delete02Icon, HeartIcon, ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import {
  getWishlist,
  removeWishlistItem,
  type MobileWishlistSummary,
} from "../../src/features/storefront/storefront-api";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { AccountLoadingState, accountErrorMessage, RetryState, SignInRequiredState } from "../../src/features/account/account-ui";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

export default function WishlistScreen() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const market = useMobileMarket();
  const [actionError, setActionError] = useState("");

  const wishlistQuery = useQuery({
    queryKey: ["mobile-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeWishlistItem(customerAuth.authHeaders, productId),
    onMutate: () => setActionError(""),
    onSuccess: async () => {
      setActionError("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-wishlist", customerAuth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] });
    },
    onError: (error) => setActionError(accountErrorMessage(error, "Wishlist item could not be removed.")),
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || wishlistQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
        <AccountLoadingState title="Loading wishlist..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
        <SignInRequiredState title="Sign in to view wishlist" />
      </>
    );
  }

  if (wishlistQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
        <RetryState
          title="Wishlist could not load"
          message={accountErrorMessage(wishlistQuery.error, "Check your connection and refresh wishlist.")}
          onRetry={() => void wishlistQuery.refetch()}
        />
      </>
    );
  }

  const items = wishlistQuery.data?.items ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.headerCard}>
              <View style={styles.headerIcon}>
                <HugeiconsIcon color={colors.primary} icon={HeartIcon} size={30} strokeWidth={2.1} />
              </View>
              <View style={styles.headerBody}>
                <Text style={styles.title}>Wishlist</Text>
                <Text style={styles.subtitle}>{items.length} saved product{items.length === 1 ? "" : "s"}</Text>
              </View>
            </View>
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <EmptyState title="No saved products" message="Products you save with the heart icon will appear here." />
          </View>
        }
        renderItem={({ item }) => (
          <WishlistCard
            formatPrice={market.format}
            item={item}
            removing={removeMutation.isPending}
            onRemove={() => removeMutation.mutate(item.productId)}
          />
        )}
      />
    </>
  );
}

function WishlistCard({
  formatPrice,
  item,
  onRemove,
  removing,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  item: MobileWishlistSummary["items"][number];
  onRemove: () => void;
  removing: boolean;
}) {
  const router = useRouter();
  const product = item.product;
  const imageUrl = resolveImageUrl(product.images?.[0]?.url);
  const firstVariant = product.variants?.[0];

  return (
    <View style={styles.productCard}>
      <Pressable style={styles.productBody} onPress={() => router.push(`/product/${product.slug}`)}>
        <RemoteImage fallbackLabel={product.name} style={styles.productImage} uri={imageUrl} />
        <View style={styles.productInfo}>
          <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
          <Text numberOfLines={1} style={styles.productMeta}>{product.seller?.storeName ?? "1HandIndia seller"}</Text>
          <Text style={styles.productPrice}>{formatPrice(firstVariant?.pricePaise)}</Text>
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <Pressable style={styles.viewButton} onPress={() => router.push(`/product/${product.slug}`)}>
          <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={16} strokeWidth={2.2} />
          <Text style={styles.viewButtonText}>View</Text>
        </Pressable>
        <Pressable disabled={removing} style={styles.removeButton} onPress={onRemove}>
          {removing ? <ActivityIndicator color={colors.danger} size="small" /> : <HugeiconsIcon color={colors.danger} icon={Delete02Icon} size={18} strokeWidth={2.1} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 110,
  },
  headerCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    padding: 14,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  actionError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 12,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  productBody: {
    flexDirection: "row",
    gap: 12,
  },
  productImage: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    height: 84,
    width: 84,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  productMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  productPrice: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  viewButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
  },
  viewButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: "#FEF3F2",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 48,
  },
});
