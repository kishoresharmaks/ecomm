import { GridViewIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, Stack, type Href, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { ProductCard } from "../../src/components/product-card";
import { RemoteImage } from "../../src/components/remote-image";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { getCategory, listProducts } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";
import type { ProductSummary } from "../../src/types/storefront";

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { width } = useWindowDimensions();
  const market = useMobileMarket();
  const [searchText, setSearchText] = useState("");
  const categoryQuery = useQuery({
    queryKey: ["mobile-category", slug],
    queryFn: () => getCategory(slug),
    enabled: Boolean(slug),
    retry: false,
  });
  const category = categoryQuery.data;
  const productsQuery = useInfiniteQuery({
    queryKey: ["mobile-category-products", category?.id, searchText.trim()],
    queryFn: ({ pageParam }) =>
      listProducts({
        cursor: pageParam,
        pagination: "cursor",
        limit: 24,
        ...(category?.id ? { categoryId: category.id } : {}),
        ...(searchText.trim().length >= 2 ? { search: searchText.trim() } : {}),
      }),
    enabled: Boolean(category?.id),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo?.nextCursor ?? undefined,
    retry: false,
  });
  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data?.pages],
  );
  const columnCount = width >= 720 ? 3 : 2;
  const refreshing = categoryQuery.isRefetching || productsQuery.isRefetching;

  function submitSearch() {
    const q = searchText.trim();
    if (q.length >= 2) {
      void productsQuery.refetch();
    }
  }

  if (!slug) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: true, title: "Category" }} />
        <EmptyState title="Category not found" message="Open a category again from the marketplace." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: true, title: category?.name ?? "Category" }} />
      <FlashList
        key={columnCount}
        data={products}
        numColumns={columnCount}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              void categoryQuery.refetch();
              void productsQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <CategoryHeader
            category={category}
            isLoading={categoryQuery.isLoading}
            isProductsLoading={productsQuery.isLoading}
            products={products}
            searchText={searchText}
            setSearchText={setSearchText}
            submitSearch={submitSearch}
          />
        }
        renderItem={({ item }) => <ProductCard formatPrice={market.format} product={item} />}
        ListEmptyComponent={
          categoryQuery.isLoading || productsQuery.isLoading ? null : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={categoryQuery.isError || productsQuery.isError ? "Category could not load" : "No products found"}
                message={
                  categoryQuery.isError || productsQuery.isError
                    ? "Check the API connection and pull to refresh."
                    : searchText.trim()
                      ? "Try a different product search."
                      : "Approved products in this category will appear here."
                }
              />
            </View>
          )
        }
        ListFooterComponent={
          <CategoryFooter
            hasNextPage={Boolean(productsQuery.hasNextPage)}
            isFetchingNextPage={productsQuery.isFetchingNextPage}
            onLoadMore={() => void productsQuery.fetchNextPage()}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function CategoryHeader({
  category,
  isLoading,
  isProductsLoading,
  products,
  searchText,
  setSearchText,
  submitSearch,
}: {
  category: Awaited<ReturnType<typeof getCategory>> | undefined;
  isLoading: boolean;
  isProductsLoading: boolean;
  products: ProductSummary[];
  searchText: string;
  setSearchText: (value: string) => void;
  submitSearch: () => void;
}) {
  const imageUrl = resolveImageUrl(category?.imageUrl);
  const productCount = category?._count?.products ?? products.length;

  return (
    <View>
      <View style={styles.hero}>
        <RemoteImage fallbackLabel={category?.name ?? "Category"} resizeMode="cover" style={styles.heroImage} uri={imageUrl} />
        <View style={styles.heroScrim} />
        <View style={styles.heroContent}>
          <View style={styles.heroIcon}>
            <HugeiconsIcon color={colors.primary} icon={GridViewIcon} size={24} strokeWidth={2.1} />
          </View>
          <Text numberOfLines={2} style={styles.heroTitle}>
            {category?.name ?? "Loading category"}
          </Text>
          <Text numberOfLines={3} style={styles.heroText}>
            {category?.description ?? "Browse approved marketplace products in this category."}
          </Text>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroPill}>{productCount} products</Text>
            {category?.children?.length ? <Text style={styles.heroPill}>{category.children.length} subcategories</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.headerBody}>
        {category?.children?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childScroll}>
            {category.children.map((child) => (
              <Link key={child.id} href={`/category/${child.slug}` as Href} style={styles.childChip}>
                {child.name}
              </Link>
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.searchBox}>
          <HugeiconsIcon color={colors.primary} icon={Search01Icon} size={21} strokeWidth={2} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setSearchText}
            onSubmitEditing={submitSearch}
            placeholder="Search products in this category"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchText}
          />
          <Pressable style={styles.searchButton} onPress={submitSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
        {(isLoading || isProductsLoading) && !products.length ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : null}
        <Text style={styles.resultText}>
          {products.length ? `${products.length} products loaded` : "Live category products"}
        </Text>
      </View>
    </View>
  );
}

function CategoryFooter({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  if (!hasNextPage) {
    return <View style={styles.footerSpacer} />;
  }

  return (
    <View style={styles.footer}>
      <Pressable disabled={isFetchingNextPage} style={[styles.loadMoreButton, isFetchingNextPage ? styles.loadMoreButtonDisabled : null]} onPress={onLoadMore}>
        {isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.loadMoreText}>Load more products</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  childChip: {
    backgroundColor: colors.surface,
    borderColor: "#FFD7CA",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    marginRight: 8,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  childScroll: {
    marginBottom: 16,
  },
  emptyWrap: {
    padding: 20,
  },
  footer: {
    padding: 20,
  },
  footerSpacer: {
    height: 128,
  },
  headerBody: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    height: 250,
    marginHorizontal: 18,
    marginTop: 16,
    overflow: "hidden",
    shadowColor: "#ED3500",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.055,
    shadowRadius: 24,
  },
  heroContent: {
    bottom: 18,
    left: 18,
    position: "absolute",
    right: 18,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    marginBottom: 12,
    width: 44,
  },
  heroImage: {
    height: "100%",
    width: "100%",
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  heroPill: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 999,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(17, 24, 39, 0.46)",
  },
  heroText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 7,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  listContent: {
    paddingBottom: 126,
  },
  loadMoreButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FFD7CA",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    shadowColor: "#ED3500",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  loadMoreButtonDisabled: {
    backgroundColor: "#F3F4F6",
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  resultText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginTop: 12,
  },
  screen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FFE0D6",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingLeft: 12,
    shadowColor: "#ED3500",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    margin: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 50,
  },
});
