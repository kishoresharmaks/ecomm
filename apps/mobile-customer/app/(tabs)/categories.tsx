import {
  ArrowRight01Icon,
  BellDotIcon,
  ClothesIcon,
  Grid2X2Icon,
  LaptopIcon,
  MobileNavigator01Icon,
  ShoppingCart01Icon,
  Sofa01Icon,
  Search01Icon,
  Store01Icon,
  ShoppingBagIcon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { withStorefrontMaintenance } from "../../src/features/maintenance/mobile-maintenance-gate";
import { getCart, listCategories } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";
import type { MobileCategory } from "../../src/types/mobile-home";
import { useState } from "react";

function CategoriesScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const customerAuth = useMobileCustomerAuth();
  const [searchText, setSearchText] = useState("");
  
  const categoriesQuery = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: listCategories,
    retry: false,
  });
  const cartQuery = useQuery({
    queryKey: ["mobile-cart-count", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 30_000,
  });
  const categories = categoriesQuery.data ?? [];
  const cartItemCount = cartQuery.data?.items.reduce((total, item) => total + Math.max(0, item.quantity), 0) ?? 0;
  
  const displayedCategories = categories;

  const columnCount = width >= 720 ? 3 : 2;
  const cardWidth = (width - 32 - (columnCount - 1) * 12) / columnCount;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <PremiumHeader cartItemCount={cartItemCount} />
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <View style={styles.searchLeft}>
            <HugeiconsIcon color="#6B7280" icon={Search01Icon} size={20} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
            />
          </View>
          <Pressable style={styles.searchButton}>
            <HugeiconsIcon color="#FFFFFF" icon={Search01Icon} size={18} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
      
      <FlashList
        key={columnCount}
        data={categoriesQuery.isLoading ? [] : displayedCategories}
        numColumns={columnCount}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        refreshControl={
          <RefreshControl refreshing={categoriesQuery.isRefetching} tintColor={colors.primary} onRefresh={() => void categoriesQuery.refetch()} />
        }
        renderItem={({ item }) => (
          <View style={[styles.cardWrapper, { width: cardWidth }]}>
            <PremiumCategoryCard category={item} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              title={categoriesQuery.isError ? "Categories could not load" : "No categories found"}
              message={categoriesQuery.isError ? "Check the API connection and pull to refresh." : "Active categories with approved products will appear here."}
            />
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

export default withStorefrontMaintenance(CategoriesScreen);

function PremiumHeader({ cartItemCount }: { cartItemCount: number }) {
  return (
    <View style={styles.premiumHeader}>
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <HugeiconsIcon color={colors.primary} icon={Grid2X2Icon} size={26} strokeWidth={2} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Categories</Text>
            <Text style={styles.headerSubtitle}>Browse all marketplace categories</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Link asChild href="/cart">
            <Pressable style={styles.headerButton}>
              <HugeiconsIcon color="#374151" icon={ShoppingCart01Icon} size={24} strokeWidth={2} />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? "99+" : cartItemCount}</Text>
                </View>
              )}
            </Pressable>
          </Link>
          <Link asChild href="/account">
            <Pressable style={styles.headerButton}>
              <HugeiconsIcon color="#374151" icon={BellDotIcon} size={24} strokeWidth={2} />
              <View style={styles.notificationDot} />
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

function PremiumCategoryCard({ category }: { category: MobileCategory }) {
  const imageUrl = resolveImageUrl(category.imageUrl);
  const productCount = category._count?.products ?? 0;
  const childCount = category.children?.length ?? category._count?.children ?? 0;
  const description = category.description?.trim();
  const router = useRouter();
  
  const visual = categoryVisual(category);
  const hasImage = Boolean(imageUrl);

  const handlePress = () => {
    router.push(`/category/${category.slug}`);
  };

  return (
    <Pressable style={styles.categoryCard} onPress={handlePress}>
      <View style={styles.categoryImageContainer}>
        {hasImage ? (
          <RemoteImage 
            resizeMode="cover" 
            style={styles.categoryImage} 
            uri={imageUrl} 
          />
        ) : (
          <View style={[styles.categoryImage, styles.categoryImageFallback]}>
            <HugeiconsIcon color="#9CA3AF" icon={visual.icon} size={48} strokeWidth={1.5} />
          </View>
        )}
      </View>
      
      <View style={styles.categoryContent}>
        <Text numberOfLines={1} style={styles.categoryName}>
          {category.name}
        </Text>
        
        <Text numberOfLines={2} style={styles.categoryDescription}>
          {description || "Browse products from verified sellers"}
        </Text>
        
        <View style={styles.categoryMeta}>
          <View style={styles.categoryMetaItem}>
            <HugeiconsIcon color="#6B7280" icon={ShoppingBagIcon} size={12} strokeWidth={2} />
            <Text style={styles.categoryMetaText}>{productCount} Products</Text>
          </View>
          {childCount > 0 && (
            <View style={styles.categoryMetaItem}>
              <HugeiconsIcon color="#6B7280" icon={Grid2X2Icon} size={12} strokeWidth={2} />
              <Text style={styles.categoryMetaText}>{childCount} Sub</Text>
            </View>
          )}
        </View>
        
        <View style={styles.categoryFooter}>
          <Text style={styles.categoryExploreText}>Explore</Text>
          <HugeiconsIcon color={colors.primary} icon={ArrowRight01Icon} size={18} strokeWidth={2} />
        </View>
      </View>
    </Pressable>
  );
}

function categoryVisual(category: MobileCategory): { icon: IconSvgElement } {
  const text = `${category.name} ${category.slug}`.toLowerCase();

  if (/(mobile|phone|smartphone)/.test(text)) {
    return { icon: MobileNavigator01Icon };
  }
  if (/(fashion|cloth|wear|apparel|dress)/.test(text)) {
    return { icon: ClothesIcon };
  }
  if (/(home|living|furniture|decor|kitchen)/.test(text)) {
    return { icon: Sofa01Icon };
  }
  if (/(electronics|laptop|computer|tech)/.test(text)) {
    return { icon: LaptopIcon };
  }
  if (/(store|shop|retail)/.test(text)) {
    return { icon: Store01Icon };
  }
  return { icon: ShoppingBagIcon };
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F9FAFB",
    flex: 1,
  },
  premiumHeader: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(237, 53, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 28,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 18,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    position: "relative",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.primary,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  notificationDot: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colors.primary,
    borderRadius: 999,
    width: 8,
    height: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
  },
  searchBar: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
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
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  filterSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  cardWrapper: {
    overflow: "hidden",
  },
  categoryCard: {
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
  categoryImageContainer: {
    height: 140,
    position: "relative",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
  },
  categoryImageFallback: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryContent: {
    padding: 16,
    paddingTop: 16,
    gap: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 20,
  },
  categoryDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 18,
  },
  categoryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  categoryMetaText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  categoryFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  categoryExploreText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  emptyWrap: {
    padding: 20,
  },
});
