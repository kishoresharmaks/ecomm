import { ArrowLeft01Icon, CheckCircle, File02Icon, Grid2X2Icon, Search01Icon, ShoppingCart01Icon, StarIcon, Store01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, Modal } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { withStorefrontMaintenance } from "../../src/features/maintenance/mobile-maintenance-gate";
import { getCategory, listProducts, addCartItem } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { colors } from "../../src/theme";
import type { ProductSummary } from "../../src/types/storefront";

// Sorting options
const SORT_OPTIONS = [
  { label: "Featured", value: "featured" },
  { label: "Popular", value: "popular" },
  { label: "Price: Low-High", value: "price_asc" },
  { label: "Price: High-Low", value: "price_desc" },
  { label: "Rating", value: "rating" },
];

// Standard image height for consistency
const STANDARD_IMAGE_HEIGHT = 140;

// Premium product card component for category page
function PremiumProductCard({ 
  product, 
  formatPrice,
  onAddToCart,
  isAddedToCart
}: { 
  product: ProductSummary;
  formatPrice: (pricePaise?: number | null) => string;
  onAddToCart: (product: ProductSummary) => void;
  isAddedToCart: boolean;
}) {
  const imageUrl = resolveImageUrl(product.images?.[0]?.url);
  const variant = product.variants?.[0];
  const price = variant?.pricePaise;
  const mrp = variant?.mrpPaise ?? null;
  const discount = mrp && price && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const rating = product.reviewSummary?.averageRating ?? null;
  const reviewCount = product.reviewSummary?.reviewCount ?? 0;
  const storeName = product.seller?.storeName ?? "1HandIndia Seller";
  const stockAwareVariant = variant as Partial<{ status: string; stockQuantity: number }> | undefined;
  const inStock = Boolean(
    variant &&
      (!stockAwareVariant?.status ||
        (stockAwareVariant.status === "ACTIVE" && (stockAwareVariant.stockQuantity ?? 0) > 0)),
  );
  const router = useRouter();

  const handleCardPress = () => {
    if (product.slug) {
      router.push(`/product/${product.slug}`);
    }
  };

  return (
    <Pressable style={styles.premiumCard} onPress={handleCardPress}>
      <View style={styles.premiumImageContainer}>
        <RemoteImage 
          resizeMode="cover" 
          style={styles.premiumImage} 
          uri={imageUrl} 
        />
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>New</Text>
        </View>
      </View>
      
      <View style={styles.premiumCardContent}>
        <Text numberOfLines={2} style={styles.productName}>
          {product.name}
        </Text>
        
        <View style={styles.storeRow}>
          <HugeiconsIcon color="#6B7280" icon={Store01Icon} size={12} strokeWidth={2} />
          <Text numberOfLines={1} style={styles.storeName}>
            {storeName}
          </Text>
        </View>
        
        <View style={styles.stockBadgeContainer}>
          <View style={[styles.stockBadge, inStock ? styles.stockInStock : styles.stockOutOfStock]}>
            <Text style={[styles.stockText, inStock ? styles.stockTextIn : styles.stockTextOut]}>
              {inStock ? "In Stock" : "Out of Stock"}
            </Text>
          </View>
        </View>
        
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {typeof price === "number" ? formatPrice(price) : "View price"}
          </Text>
          {mrp && price && mrp > price ? (
            <Text style={styles.mrp}>{formatPrice(mrp)}</Text>
          ) : null}
        </View>
        
        {rating ? (
          <View style={styles.ratingRow}>
            <HugeiconsIcon color="#F59E0B" icon={StarIcon} size={12} strokeWidth={2.5} />
            <Text style={styles.ratingText}>
              {rating.toFixed(1)}
              {reviewCount > 0 && ` (${reviewCount})`}
            </Text>
          </View>
        ) : null}
        
        <Pressable 
          style={[styles.addToCartButton, !inStock && styles.addToCartButtonDisabled, isAddedToCart && styles.addToCartButtonAdded]}
          onPress={(e) => {
            e.stopPropagation();
            if (inStock && !isAddedToCart) {
              onAddToCart(product);
            }
          }}
          disabled={!inStock || isAddedToCart}
        >
          <HugeiconsIcon color="#FFFFFF" icon={ShoppingCart01Icon} size={16} strokeWidth={2} />
          <Text style={styles.addToCartText}>
            {isAddedToCart ? "Added" : (inStock ? "Add" : "Unavailable")}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const router = useRouter();
  const { width } = useWindowDimensions();
  const market = useMobileMarket();
  const auth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [sortOption, setSortOption] = useState("featured");
  const [showSortModal, setShowSortModal] = useState(false);
  const [addedToCartStates, setAddedToCartStates] = useState<Record<string, boolean>>({});
  
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
    () => {
      const allProducts = productsQuery.data?.pages.flatMap((page) => page.items) ?? [];
      
      // Apply client-side sorting based on sortOption
      const sorted = [...allProducts].sort((a, b) => {
        const priceA = a.variants?.[0]?.pricePaise ?? 0;
        const priceB = b.variants?.[0]?.pricePaise ?? 0;
        const ratingA = a.reviewSummary?.averageRating ?? 0;
        const ratingB = b.reviewSummary?.averageRating ?? 0;
        const reviewCountA = a.reviewSummary?.reviewCount ?? 0;
        const reviewCountB = b.reviewSummary?.reviewCount ?? 0;
        
        switch (sortOption) {
          case "price_asc":
            return priceA - priceB;
          case "price_desc":
            return priceB - priceA;
          case "rating":
            // Sort by rating first, then by review count
            if (ratingB !== ratingA) {
              return ratingB - ratingA;
            }
            return reviewCountB - reviewCountA;
          case "popular":
            // Sort by review count as a proxy for popularity
            return reviewCountB - reviewCountA;
          case "featured":
          default:
            // Default order - no sorting (maintain API order)
            return 0;
        }
      });
      
      return sorted;
    },
    [productsQuery.data?.pages, sortOption],
  );
  const columnCount = width >= 720 ? 3 : 2;
  const horizontalPadding = 32;
  const gap = 12;
  const cardWidth = (width - horizontalPadding - (columnCount - 1) * gap) / columnCount;
  const refreshing = categoryQuery.isRefetching || productsQuery.isRefetching;

  const handleAddToCart = async (product: ProductSummary) => {
    if (!auth.enabled) {
      router.push("/auth/sign-in");
      return;
    }

    const variant = product.variants?.[0];
    if (!variant) {
      console.error("No variant found for product:", product.id);
      return;
    }

    try {
      await addCartItem(auth.authHeaders, variant.id, 1);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setAddedToCartStates(prev => ({ ...prev, [product.id]: true }));
      console.log("Added to cart:", product.id);
    } catch (error) {
      console.error("Add to cart failed:", error);
    }
  };

  const handleSortPress = () => {
    setShowSortModal(true);
  };

  const handleSortSelect = (option: string) => {
    setSortOption(option);
    setShowSortModal(false);
    // No need to refetch - sorting is now done client-side
  };

  function submitSearch() {
    const q = searchText.trim();
    if (q.length >= 2) {
      void productsQuery.refetch();
    }
  }

  if (!slug) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <PremiumHeader 
          title="Category" 
          showBack 
          onBack={() => router.back()} 
        />
        <EmptyState title="Category not found" message="Open a category again from the marketplace." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <PremiumHeader 
        title={category?.name ?? "Category"} 
        showBack 
        onBack={() => router.back()} 
      />
      
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
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
      >
        <PremiumHeroBanner category={category} productCount={category?._count?.products ?? products.length} />
        
        <PremiumSearchBar 
          searchText={searchText}
          setSearchText={setSearchText}
          onSubmitSearch={submitSearch}
        />
        
        <ProductCountAndSort 
          productCount={products.length}
          sortOption={sortOption}
          onSortPress={handleSortPress}
        />
        
        {categoryQuery.isLoading || (productsQuery.isLoading && !products.length) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : (
          <View style={styles.productGridContainer}>
            {products.length > 0 ? (
              <FlashList
                key={columnCount}
                data={products}
                numColumns={columnCount}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={[styles.premiumCardWrapper, { width: cardWidth }]}>
                    <PremiumProductCard 
                      product={item} 
                      formatPrice={market.format}
                      onAddToCart={handleAddToCart}
                      isAddedToCart={addedToCartStates[item.id] ?? false}
                    />
                  </View>
                )}
                ListEmptyComponent={
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
                }
                contentContainerStyle={styles.listContent}
              />
            ) : (
              <View style={styles.emptyWrap}>
                <EmptyState
                  title="No products found"
                  message="Approved products in this category will appear here."
                />
              </View>
            )}
          </View>
        )}
        
        {productsQuery.hasNextPage && (
          <View style={styles.loadMoreContainer}>
            <Pressable 
              style={[styles.loadMoreButton, productsQuery.isFetchingNextPage && styles.loadMoreButtonLoading]}
              onPress={() => void productsQuery.fetchNextPage()}
              disabled={productsQuery.isFetchingNextPage}
            >
              {productsQuery.isFetchingNextPage ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.loadMoreText}>Load More</Text>
                  <HugeiconsIcon color="#FFFFFF" icon={ArrowLeft01Icon} size={16} strokeWidth={2} style={{ transform: [{ rotate: "90deg" }] }} />
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
      
      <SortModal 
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        selectedOption={sortOption}
        onSelect={handleSortSelect}
      />
    </View>
  );
}

export default withStorefrontMaintenance(CategoryDetailScreen);

// Premium header component
function PremiumHeader({ 
  title, 
  showBack = false, 
  onBack
}: { 
  title: string; 
  showBack?: boolean; 
  onBack?: () => void; 
}) {
  return (
    <View style={styles.premiumHeader}>
      <View style={styles.headerLeft}>
        {showBack && (
          <Pressable style={styles.headerButton} onPress={onBack}>
            <HugeiconsIcon color="#1F2937" icon={ArrowLeft01Icon} size={24} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      <View style={styles.headerRight}>
        {/* Heart icon removed */}
      </View>
    </View>
  );
}

// Premium hero banner component
function PremiumHeroBanner({ category, productCount }: { category: Awaited<ReturnType<typeof getCategory>> | undefined; productCount: number }) {
  const imageUrl = resolveImageUrl(category?.imageUrl);
  
  return (
    <View style={styles.heroBanner}>
      <RemoteImage 
        resizeMode="cover" 
        style={styles.heroBackground} 
        uri={imageUrl} 
      />
      <View style={styles.heroGradient} />
      
      <View style={styles.heroContent}>
        <View style={styles.heroIconContainer}>
          <View style={styles.heroIcon}>
            <HugeiconsIcon color={colors.primary} icon={Grid2X2Icon} size={28} strokeWidth={2} />
          </View>
        </View>
        
        <Text numberOfLines={2} style={styles.heroTitle}>
          {category?.name ?? "Loading category"}
        </Text>
        
        <Text numberOfLines={2} style={styles.heroDescription}>
          {category?.description ?? "Browse approved marketplace products in this category."}
        </Text>
        
        <View style={styles.heroBadges}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{productCount} Products</Text>
          </View>
          {category?.children?.length ? (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{category.children.length} Categories</Text>
            </View>
          ) : null}
        </View>
      </View>
      
       
    </View>
  );
}

// Premium search bar component
function PremiumSearchBar({ 
  searchText, 
  setSearchText, 
  onSubmitSearch 
}: { 
  searchText: string; 
  setSearchText: (value: string) => void; 
  onSubmitSearch: () => void; 
}) {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <View style={styles.searchLeft}>
          <HugeiconsIcon color="#6B7280" icon={Search01Icon} size={20} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products in this category"
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={onSubmitSearch}
            returnKeyType="search"
          />
        </View>
        <Pressable style={styles.searchButton} onPress={onSubmitSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Product count and sort component
function ProductCountAndSort({ 
  productCount, 
  sortOption, 
  onSortPress 
}: { 
  productCount: number; 
  sortOption: string; 
  onSortPress: () => void; 
}) {
  const selectedLabel = SORT_OPTIONS.find(opt => opt.value === sortOption)?.label || "Featured";
  
  return (
    <View style={styles.productCountHeader}>
      <Text style={styles.productCountText}>
        {productCount} Products
      </Text>
      <Pressable style={styles.sortButton} onPress={onSortPress}>
        <Text style={styles.sortButtonText}>{selectedLabel}</Text>
        <HugeiconsIcon color="#6B7280" icon={ArrowLeft01Icon} size={16} strokeWidth={2} style={{ transform: [{ rotate: "90deg" }] }} />
      </Pressable>
    </View>
  );
}

// Sort modal component
function SortModal({ 
  visible, 
  onClose, 
  selectedOption, 
  onSelect 
}: { 
  visible: boolean; 
  onClose: () => void; 
  selectedOption: string; 
  onSelect: (option: string) => void; 
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.sortModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sort By</Text>
            <Pressable onPress={onClose}>
              <HugeiconsIcon color="#6B7280" icon={File02Icon} size={20} strokeWidth={2} />
            </Pressable>
          </View>
          
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.sortOption, selectedOption === option.value && styles.sortOptionSelected]}
              onPress={() => onSelect(option.value)}
            >
              <Text style={[styles.sortOptionText, selectedOption === option.value && styles.sortOptionTextSelected]}>
                {option.label}
              </Text>
              {selectedOption === option.value && (
                <HugeiconsIcon color={colors.primary} icon={CheckCircle} size={18} strokeWidth={2} />
              )}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F9FAFB",
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  
  // Premium header styles
  premiumHeader: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    paddingTop: 50, // Add extra top padding to avoid overlapping with mobile header
  },
  headerLeft: {
    width: 40,
  },
  headerRight: {
    width: 40,
    alignItems: "flex-end",
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
    textAlign: "center",
  },
  
  // Premium hero banner styles
  heroBanner: {
    height: 200,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  heroBackground: {
    width: "100%",
    height: "100%",
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  heroContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  heroIconContainer: {
    marginBottom: 12,
  },
  heroIcon: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 12,
  },
  heroBadges: {
    flexDirection: "row",
    gap: 8,
  },
  heroBadge: {
    backgroundColor: "rgba(237, 53, 0, 0.9)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  filterButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  filterButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  
  // Premium search bar styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  searchBar: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  searchLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingLeft: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
    paddingVertical: 14,
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginRight: 4,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  
  // Product count and sort styles
  productCountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  productCountText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  
  // Product grid styles
  productGridContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  premiumCardWrapper: {
    marginHorizontal: 6,
    overflow: "hidden",
  },
  
  // Premium product card styles
  premiumCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  premiumImageContainer: {
    height: STANDARD_IMAGE_HEIGHT,
    position: "relative",
    backgroundColor: "#F9FAFB",
  },
  premiumImage: {
    width: "100%",
    height: "100%",
  },
  discountBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  discountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  newBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
  },
  premiumCardContent: {
    padding: 12,
    gap: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    lineHeight: 18,
    minHeight: 36,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  storeName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    flex: 1,
  },
  stockBadgeContainer: {
    flexDirection: "row",
  },
  stockBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockInStock: {
    backgroundColor: "#DCFCE7",
  },
  stockOutOfStock: {
    backgroundColor: "#FEE2E2",
  },
  stockText: {
    fontSize: 10,
    fontWeight: "600",
  },
  stockTextIn: {
    color: "#166534",
  },
  stockTextOut: {
    color: "#991B1B",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1F2937",
  },
  mrp: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1F2937",
  },
  addToCartButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  addToCartButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  addToCartButtonAdded: {
    backgroundColor: "#10B981",
  },
  addToCartText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  
  // Loading and empty states
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  emptyWrap: {
    padding: 20,
  },
  
  // Load more styles
  loadMoreContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadMoreButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadMoreButtonLoading: {
    backgroundColor: "#F3F4F6",
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sortModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sortOptionSelected: {
    backgroundColor: "#FEF3C7",
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  sortOptionTextSelected: {
    color: "#D97706",
    fontWeight: "600",
  },
});
