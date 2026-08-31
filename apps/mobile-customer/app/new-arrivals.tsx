import { FlashIcon, Location01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { EmptyState } from "../src/components/empty-state";
import { ProductCard } from "../src/components/product-card";
import { useMobileHome } from "../src/features/home/use-mobile-home";
import { useMobileMarket } from "../src/features/market/mobile-market";
import { listCustomerOrders } from "../src/features/storefront/storefront-api";
import { useMobileWishlistActions } from "../src/features/storefront/use-mobile-wishlist-actions";
import { useLocationStore } from "../src/state/location-store";
import { useRecentProductsStore, type RecentProductSnapshot } from "../src/state/recent-products-store";
import { colors } from "../src/theme";
import type { MobileProduct } from "../src/types/mobile-home";

type NewArrivalFeedItem = { id: "header"; type: "header"; count: number; mode: "location" | "personalized" } | { id: string; product: MobileProduct; type: "product" };

function NewArrivalsScreen() {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const customerAuth = useMobileCustomerAuth();
  const market = useMobileMarket(selectedLocation.countryCode);
  const wishlist = useMobileWishlistActions();
  const recentProducts = useRecentProductsStore((state) => state.recentProducts);
  const hasLocation = isSpecificLocation(selectedLocation.label);
  const homeQuery = useMobileHome(hasLocation ? selectedLocation : undefined);
  const ordersQuery = useQuery({
    queryKey: ["mobile-orders", customerAuth.authKey, "new-arrivals-fallback"],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, 10),
    enabled: customerAuth.enabled,
    staleTime: 60_000,
  });
  const products = useMemo(() => {
    const latest = homeQuery.data?.productRails.latest ?? [];
    if (hasLocation && latest.length) {
      return latest;
    }

    const fallback = uniqueProducts([
      ...latest,
      ...(homeQuery.data?.productRails.featured ?? []),
      ...recentProducts.map(productFromRecent),
      ...productsFromOrders(ordersQuery.data?.items ?? []),
    ]);

    return fallback;
  }, [hasLocation, homeQuery.data?.productRails.featured, homeQuery.data?.productRails.latest, ordersQuery.data?.items, recentProducts]);
  const feedItems = useMemo<NewArrivalFeedItem[]>(() => [
    { id: "header", type: "header", count: products.length, mode: hasLocation ? "location" : "personalized" },
    ...products.map((product) => ({ id: product.id, product, type: "product" as const })),
  ], [hasLocation, products]);
  const refreshing = homeQuery.isRefetching || ordersQuery.isRefetching;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: "New Arrivals" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={feedItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              void homeQuery.refetch();
              if (customerAuth.enabled) {
                void ordersQuery.refetch();
              }
            }}
          />
        }
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <NewArrivalsHeader count={item.count} mode={item.mode} />;
          }

          return (
            <View style={styles.gridCell}>
              <ProductCard
                compact
                noMargin
                formatPrice={market.format}
                isWishlistPending={wishlist.isPending(item.product.id)}
                isWished={wishlist.isWished(item.product.id)}
                product={item.product}
                onToggleWishlist={() => wishlist.toggleWishlist(item.product.id)}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          homeQuery.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading new arrivals...</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState title="No new arrivals yet" message="Recently added products will appear here as stores publish listings." />
            </View>
          )
        }
      />
    </View>
  );
}

export default NewArrivalsScreen;

function NewArrivalsHeader({ count, mode }: { count: number; mode: "location" | "personalized" }) {
  return (
    <View style={styles.headerCard}>
      <View style={styles.headerIcon}>
        <HugeiconsIcon color={colors.primary} icon={mode === "location" ? Location01Icon : FlashIcon} size={30} strokeWidth={2.1} />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>New Arrivals</Text>
        <Text style={styles.subtitle}>
          {mode === "location" ? "Recently added products from stores matching your location." : "Recent and recommended products based on your activity."}
        </Text>
      </View>
      <Text style={styles.countText}>{count} live</Text>
    </View>
  );
}

function isSpecificLocation(label?: string | null) {
  const normalized = label?.trim().toLowerCase();
  return Boolean(normalized && normalized !== "select location");
}

function productsFromOrders(orders: Awaited<ReturnType<typeof listCustomerOrders>>["items"]) {
  return orders.flatMap((order) =>
    (order.items ?? []).flatMap((item): MobileProduct[] => {
      if (!item.product?.slug || !item.product?.id) {
        return [];
      }
      const unitPrice = item.lineTotalPaise && item.quantity ? Math.round(item.lineTotalPaise / item.quantity) : 0;
      const seller = item.seller
        ? {
            ...(item.seller.id ? { id: item.seller.id } : {}),
            ...(item.seller.slug ? { slug: item.seller.slug } : {}),
            storeName: item.seller.storeName ?? "1HandIndia seller",
          }
        : undefined;
      const category = item.product.category
        ? {
            id: item.product.category.id ?? "",
            name: item.product.category.name ?? "Marketplace",
            slug: item.product.category.slug ?? "marketplace",
          }
        : undefined;
      return [{
        categoryId: item.product.categoryId ?? item.product.category?.id ?? null,
        ...(category ? { category } : {}),
        id: item.product.id,
        images: [{ url: item.product.imageUrl ?? item.product.images?.[0]?.url ?? "" }],
        name: item.productNameSnapshot,
        ...(seller ? { seller } : {}),
        sellerId: item.sellerId ?? item.seller?.id ?? null,
        slug: item.product.slug,
        variants: [{ pricePaise: unitPrice, mrpPaise: null, status: "ACTIVE", stockQuantity: null }],
      }];
    }),
  );
}

function productFromRecent(product: RecentProductSnapshot): MobileProduct {
  const seller = {
    ...(product.sellerId ? { id: product.sellerId } : {}),
    ...(product.sellerSlug ? { slug: product.sellerSlug } : {}),
    storeName: product.sellerName,
  };
  const category = product.categoryName
    ? {
        id: product.categoryId ?? product.categorySlug ?? product.categoryName,
        name: product.categoryName,
        slug: product.categorySlug ?? product.categoryName.toLowerCase().replace(/\s+/g, "-"),
      }
    : undefined;

  return {
    categoryId: product.categoryId ?? null,
    ...(category ? { category } : {}),
    id: product.id,
    images: product.imageUrl ? [{ url: product.imageUrl }] : [],
    name: product.name,
    seller,
    sellerId: product.sellerId ?? null,
    slug: product.slug,
    variants: [{
      pricePaise: product.pricePaise ?? 0,
      mrpPaise: product.mrpPaise,
      status: product.variantStatus ?? "ACTIVE",
      stockQuantity: product.stockQuantity ?? null,
    }],
  };
}

function uniqueProducts(products: MobileProduct[]) {
  const seen = new Set<string>();
  const unique: MobileProduct[] = [];

  for (const product of products) {
    const key = product.id || product.slug;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(product);
  }

  return unique;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  listContent: {
    paddingBottom: 124,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  headerCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FFE0D6",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    marginHorizontal: 5,
    padding: 14,
  },
  headerIcon: {
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
  gridCell: {
    flex: 1,
    padding: 5,
  },
  emptyWrap: {
    padding: 12,
  },
  loading: {
    alignItems: "center",
    gap: 10,
    padding: 28,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
});
