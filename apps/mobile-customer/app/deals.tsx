import { FlashIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { EmptyState } from "../src/components/empty-state";
import { ProductCard } from "../src/components/product-card";
import { useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { useMobileMarket } from "../src/features/market/mobile-market";
import { withStorefrontMaintenance } from "../src/features/maintenance/mobile-maintenance-gate";
import { addWishlistItem, getWishlist, listStorefrontDeals, removeWishlistItem } from "../src/features/storefront/storefront-api";
import { colors } from "../src/theme";

function DealsScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const market = useMobileMarket();
  const [pendingWishlistProductId, setPendingWishlistProductId] = useState<string | null>(null);
  const dealsQuery = useInfiniteQuery({
    queryKey: ["mobile-storefront-deals"],
    queryFn: ({ pageParam }) =>
      listStorefrontDeals({
        cursor: pageParam,
        limit: 24,
        pagination: "cursor",
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo?.nextCursor ?? undefined,
    retry: false,
  });
  const products = useMemo(
    () => dealsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [dealsQuery.data?.pages],
  );
  const wishlistQuery = useQuery({
    queryKey: ["mobile-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 30_000,
  });
  const wishlistProductIds = useMemo(
    () => new Set((wishlistQuery.data?.items ?? []).map((item) => item.productId)),
    [wishlistQuery.data?.items],
  );
  const wishlistMutation = useMutation({
    mutationFn: async ({ productId, wished }: { productId: string; wished: boolean }) => {
      if (wished) {
        await removeWishlistItem(customerAuth.authHeaders, productId);
        return;
      }
      await addWishlistItem(customerAuth.authHeaders, productId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-wishlist", customerAuth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] }),
      ]);
    },
    onSettled: () => setPendingWishlistProductId(null),
  });
  const columnCount = width >= 720 ? 3 : 2;

  function toggleWishlist(productId: string, wished: boolean) {
    if (customerAuth.status === "loading" || customerAuth.status === "syncing" || wishlistMutation.isPending) {
      return;
    }
    if (!customerAuth.enabled) {
      router.push("/auth/sign-in");
      return;
    }
    setPendingWishlistProductId(productId);
    wishlistMutation.mutate({ productId, wished });
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: "Offers" }} />
      <FlashList
        key={columnCount}
        contentContainerStyle={styles.listContent}
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={columnCount}
        refreshControl={
          <RefreshControl refreshing={dealsQuery.isRefetching} tintColor={colors.primary} onRefresh={() => void dealsQuery.refetch()} />
        }
        ListHeaderComponent={<DealsHeader count={products.length} isLoading={dealsQuery.isLoading} />}
        ListEmptyComponent={
          dealsQuery.isLoading ? null : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={dealsQuery.isError ? "Offers could not load" : "No offers live"}
                message={
                  dealsQuery.isError
                    ? "Check the API connection and pull to refresh."
                    : "Published marketplace deals will appear here when campaigns are active."
                }
              />
            </View>
          )
        }
        ListFooterComponent={
          <DealsFooter
            hasNextPage={Boolean(dealsQuery.hasNextPage)}
            isFetchingNextPage={dealsQuery.isFetchingNextPage}
            onLoadMore={() => void dealsQuery.fetchNextPage()}
          />
        }
        renderItem={({ item }) => {
          const isWished = wishlistProductIds.has(item.id);
          return (
            <View style={styles.gridCell}>
              <ProductCard
                compact
                noMargin
                formatPrice={market.format}
                isWishlistPending={pendingWishlistProductId === item.id}
                isWished={isWished}
                product={item}
                onToggleWishlist={() => toggleWishlist(item.id, isWished)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

export default withStorefrontMaintenance(DealsScreen);

function DealsHeader({ count, isLoading }: { count: number; isLoading: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.heroIcon}>
        <HugeiconsIcon color={colors.primary} icon={FlashIcon} size={30} strokeWidth={2.15} />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>Offers</Text>
        <Text style={styles.subtitle}>Live marketplace deals from verified sellers.</Text>
      </View>
      <Text style={styles.countText}>{isLoading ? "Loading" : `${count} live`}</Text>
    </View>
  );
}

function DealsFooter({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  if (isFetchingNextPage) {
    return (
      <View style={styles.footerState}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.footerText}>Loading more offers...</Text>
      </View>
    );
  }

  if (!hasNextPage) {
    return <View style={styles.footerSpacer} />;
  }

  return (
    <Pressable style={styles.loadMoreButton} onPress={onLoadMore}>
      <Text style={styles.loadMoreText}>Load more offers</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  listContent: {
    paddingBottom: 110,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  gridCell: {
    flex: 1,
    padding: 5,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FFE0D6",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    marginHorizontal: 8,
    padding: 14,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#FFF0EC",
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  countText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  emptyWrap: {
    padding: 12,
  },
  footerState: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 22,
  },
  footerText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  footerSpacer: {
    height: 28,
  },
  loadMoreButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    marginVertical: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  loadMoreText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
});
