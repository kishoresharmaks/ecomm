import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BellDotIcon,
  ClothesIcon,
  Grid2X2Icon,
  LaptopIcon,
  MobileNavigator01Icon,
  Search01Icon,
  ShoppingBagIcon,
  ShoppingCart01Icon,
  Sofa01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { withStorefrontMaintenance } from "../../src/features/maintenance/mobile-maintenance-gate";
import { getCart, listCategories } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";
import type { MobileCategory } from "../../src/types/mobile-home";

type CategoryView = "overview" | "all";
type CategoryVisual = {
  accent: string;
  background: string;
  icon: IconSvgElement;
};

function CategoriesScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const view: CategoryView = params.view === "all" ? "all" : "overview";
  const customerAuth = useMobileCustomerAuth();
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<"featured" | "az">("featured");

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
  const filteredCategories = useMemo(
    () => filterCategories(categories, searchText, sortMode),
    [categories, searchText, sortMode],
  );
  const popularCategories = useMemo(() => categoriesForOverview(categories), [categories]);
  const allColumnCount = width >= 360 ? 3 : 2;

  function showAllCategories() {
    router.push({ pathname: "/categories", params: { view: "all" } } as never);
  }

  function showOverview() {
    router.push("/categories" as never);
  }

  function toggleSortMode() {
    setSortMode((current) => (current === "featured" ? "az" : "featured"));
  }

  const isLoading = categoriesQuery.isLoading;
  const showEmpty = !isLoading && !filteredCategories.length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {view === "all" ? (
        <AllCategoriesHeader onBack={showOverview} onSearch={() => router.push("/search" as never)} />
      ) : (
        <CategoriesHeader cartItemCount={cartItemCount} />
      )}

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={categoriesQuery.isRefetching}
            tintColor={colors.primary}
            onRefresh={() => void categoriesQuery.refetch()}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[
          view === "all" ? styles.allContent : styles.overviewContent,
          { paddingBottom: Math.max(126, insets.bottom + 112) },
        ]}
      >
        {view === "all" ? (
          <>
            <AllCategoriesHero categories={categories} />
            <AllCategoriesToolbar
              count={filteredCategories.length}
              sortMode={sortMode}
              onToggleSort={toggleSortMode}
            />
            {isLoading ? <LoadingState /> : null}
            {showEmpty ? (
              <View style={styles.emptyWrap}>
                <EmptyState
                  title={categoriesQuery.isError ? "Categories could not load" : "No categories found"}
                  message={
                    categoriesQuery.isError
                      ? "Check the API connection and pull to refresh."
                      : "Try another category search."
                  }
                />
              </View>
            ) : (
              <View style={styles.allGrid}>
                {filteredCategories.map((category, index) => (
                  <AllCategoryTile
                    key={category.id}
                    category={category}
                    columnCount={allColumnCount}
                    index={index}
                  />
                ))}
                <RequestCategoryTile columnCount={allColumnCount} index={filteredCategories.length} />
              </View>
            )}
          </>
        ) : (
          <>
            <CategorySearchBar searchText={searchText} setSearchText={setSearchText} />
            <FeaturedCategoryChips categories={categories} onMorePress={showAllCategories} />
            <SectionHeader actionLabel="View all" title="Popular Categories" onAction={showAllCategories} />
            {isLoading ? <LoadingState /> : null}
            {showEmpty ? (
              <View style={styles.emptyWrap}>
                <EmptyState
                  title={categoriesQuery.isError ? "Categories could not load" : "No categories found"}
                  message={
                    categoriesQuery.isError
                      ? "Check the API connection and pull to refresh."
                      : "Active categories with approved products will appear here."
                  }
                />
              </View>
            ) : (
              <PopularCategoryGrid categories={filterCategories(popularCategories, searchText, "featured")} />
            )}
            <DiscoverMoreCard onPress={showAllCategories} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default withStorefrontMaintenance(CategoriesScreen);

function CategoriesHeader({ cartItemCount }: { cartItemCount: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.headerMark}>
          <HugeiconsIcon color="#FFFFFF" icon={Grid2X2Icon} size={26} strokeWidth={2.2} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Categories</Text>
          <Text style={styles.headerSubtitle}>Browse all marketplace categories</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Link asChild href="/cart">
          <Pressable accessibilityLabel="Open cart" accessibilityRole="button" style={styles.iconButton}>
            <HugeiconsIcon color="#1F2937" icon={ShoppingCart01Icon} size={24} strokeWidth={2} />
            {cartItemCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? "99+" : cartItemCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </Link>
        <Link asChild href="/account/notifications">
          <Pressable accessibilityLabel="Open notifications" accessibilityRole="button" style={styles.iconButton}>
            <HugeiconsIcon color="#1F2937" icon={BellDotIcon} size={24} strokeWidth={2} />
            <View style={styles.notificationDot} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function AllCategoriesHeader({ onBack, onSearch }: { onBack: () => void; onSearch: () => void }) {
  return (
    <View style={styles.allHeader}>
      <Pressable accessibilityLabel="Back to categories" accessibilityRole="button" style={styles.iconButtonLarge} onPress={onBack}>
        <HugeiconsIcon color="#111827" icon={ArrowLeft01Icon} size={24} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.allHeaderCopy}>
        <Text style={styles.headerTitle}>All Categories</Text>
        <Text style={styles.headerSubtitle}>Browse all categories</Text>
      </View>
      <Pressable accessibilityLabel="Open marketplace search" accessibilityRole="button" style={styles.iconButtonLarge} onPress={onSearch}>
        <HugeiconsIcon color="#111827" icon={Search01Icon} size={24} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function CategorySearchBar({
  searchText,
  setSearchText,
}: {
  searchText: string;
  setSearchText: (value: string) => void;
}) {
  return (
    <View style={styles.searchBar}>
      <View style={styles.searchLeft}>
        <HugeiconsIcon color="#6B7280" icon={Search01Icon} size={22} strokeWidth={2} />
        <TextInput
          accessibilityLabel="Search categories"
          placeholder="Search categories..."
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>
      <Pressable accessibilityLabel="Search categories" accessibilityRole="button" style={styles.searchButton}>
        <HugeiconsIcon color="#FFFFFF" icon={Search01Icon} size={22} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function FeaturedCategoryChips({
  categories,
  onMorePress,
}: {
  categories: MobileCategory[];
  onMorePress: () => void;
}) {
  const router = useRouter();
  const visible = categories.slice(0, 5);

  return (
    <View style={styles.chipPanel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Pressable accessibilityRole="button" style={styles.categoryChipActive} onPress={onMorePress}>
          <View style={styles.categoryChipIconActive}>
            <HugeiconsIcon color={colors.primary} icon={Grid2X2Icon} size={24} strokeWidth={2.4} />
          </View>
          <Text style={styles.categoryChipTextActive}>All</Text>
        </Pressable>
        {visible.map((category) => {
          const visual = categoryVisual(category);
          const imageUrl = resolveImageUrl(category.imageUrl);
          return (
            <Pressable
              key={category.id}
              accessibilityLabel={`Open ${category.name}`}
              accessibilityRole="button"
              style={styles.categoryChip}
              onPress={() => router.push(`/category/${category.slug}` as never)}
            >
              <View style={[styles.categoryChipIcon, { backgroundColor: visual.background }]}>
                {imageUrl ? (
                  <RemoteImage fallbackLabel={category.name} resizeMode="cover" style={styles.chipImage} uri={imageUrl} />
                ) : (
                  <HugeiconsIcon color={visual.accent} icon={visual.icon} size={24} strokeWidth={2} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.categoryChipText}>
                {shortCategoryName(category.name)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" style={styles.categoryChip} onPress={onMorePress}>
          <View style={styles.moreChipIcon}>
            <Text style={styles.moreDots}>...</Text>
          </View>
          <Text style={styles.categoryChipText}>More</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionHeader({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityRole="button" style={styles.sectionAction} onPress={onAction}>
        <Text style={styles.sectionActionText}>{actionLabel}</Text>
        <HugeiconsIcon color={colors.primary} icon={ArrowRight01Icon} size={17} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function PopularCategoryGrid({ categories }: { categories: MobileCategory[] }) {
  if (!categories.length) {
    return null;
  }

  const [first, second, third] = categories;

  return (
    <View style={styles.popularGrid}>
      <View style={styles.popularRow}>
        {first ? <PopularCategoryCard category={first} variant="tall" /> : null}
        {second ? <PopularCategoryCard category={second} variant="tall" /> : null}
      </View>
      {third ? <PopularCategoryCard category={third} variant="wide" /> : null}
    </View>
  );
}

function PopularCategoryCard({
  category,
  variant,
}: {
  category: MobileCategory;
  variant: "tall" | "wide";
}) {
  const router = useRouter();
  const visual = categoryVisual(category);
  const imageUrl = resolveImageUrl(category.imageUrl);
  const productCount = category._count?.products ?? 0;
  const childCount = category.children?.length ?? category._count?.children ?? 0;

  return (
    <Pressable
      accessibilityLabel={`Explore ${category.name}`}
      accessibilityRole="button"
      style={[styles.popularCard, variant === "wide" ? styles.popularCardWide : styles.popularCardTall]}
      onPress={() => router.push(`/category/${category.slug}` as never)}
    >
      <View style={variant === "wide" ? styles.wideImageWrap : styles.popularImageWrap}>
        <RemoteImage fallbackLabel={category.name} resizeMode="cover" style={styles.popularImage} uri={imageUrl} />
        {variant === "tall" && productCount > 0 ? (
          <View style={styles.trendingBadge}>
            <Text style={styles.trendingBadgeText}>Trending</Text>
          </View>
        ) : null}
      </View>
      <View style={variant === "wide" ? styles.popularWideContent : undefined}>
        <View style={styles.popularBody}>
          <View style={[styles.popularIcon, { backgroundColor: visual.background }]}>
            <HugeiconsIcon color={visual.accent} icon={visual.icon} size={25} strokeWidth={2.1} />
          </View>
          <View style={styles.popularCopy}>
            <Text numberOfLines={2} style={styles.popularTitle}>
              {category.name}
            </Text>
            <Text numberOfLines={1} style={styles.popularSubtitle}>
              {category.description?.trim() || "Quality products from verified sellers"}
            </Text>
          </View>
        </View>
        <View style={styles.popularMeta}>
          <View style={styles.metaPill}>
            <ShoppingBagTiny />
            <Text style={styles.metaText}>{productCount} Products</Text>
          </View>
          <View style={styles.metaPill}>
            <GridTiny />
            <Text style={styles.metaText}>{childCount} Subcategories</Text>
          </View>
        </View>
        <View style={styles.popularFooter}>
          <Text style={styles.exploreText}>Explore</Text>
          <HugeiconsIcon color={colors.primary} icon={ArrowRight01Icon} size={20} strokeWidth={2.4} />
        </View>
      </View>
    </Pressable>
  );
}

function DiscoverMoreCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={styles.discoverCard} onPress={onPress}>
      <View style={styles.discoverIcon}>
        <HugeiconsIcon color="#FFFFFF" icon={ShoppingBagIcon} size={25} strokeWidth={2.2} />
      </View>
      <View style={styles.discoverCopy}>
        <Text style={styles.discoverTitle}>Discover more categories</Text>
        <Text style={styles.discoverSubtitle}>Find everything you need in one place</Text>
      </View>
      <View style={styles.discoverButton}>
        <Text style={styles.discoverButtonText}>Explore All</Text>
        <HugeiconsIcon color="#FFFFFF" icon={ArrowRight01Icon} size={18} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

function AllCategoriesHero({ categories }: { categories: MobileCategory[] }) {
  const router = useRouter();
  const heroCategory = categories.find((category) => resolveImageUrl(category.imageUrl)) ?? categories[0];
  const imageUrl = resolveImageUrl(heroCategory?.imageUrl);

  return (
    <View style={styles.allHero}>
      <View style={styles.allHeroText}>
        <Text style={styles.allHeroTitle}>Find everything you need</Text>
        <Text style={styles.allHeroSubtitle}>Explore top quality products across all categories</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.heroCta}
          onPress={() => {
            if (heroCategory?.slug) {
              router.push(`/category/${heroCategory.slug}` as never);
            } else {
              router.push("/" as never);
            }
          }}
        >
          <Text style={styles.heroCtaText}>Shop Now</Text>
          <HugeiconsIcon color="#FFFFFF" icon={ArrowRight01Icon} size={18} strokeWidth={2.2} />
        </Pressable>
      </View>
      <RemoteImage fallbackLabel="1HI" resizeMode="cover" style={styles.allHeroImage} uri={imageUrl} />
    </View>
  );
}

function AllCategoriesToolbar({
  count,
  onToggleSort,
  sortMode,
}: {
  count: number;
  onToggleSort: () => void;
  sortMode: "featured" | "az";
}) {
  return (
    <View style={styles.allToolbar}>
      <View style={styles.allToolbarTitle}>
        <HugeiconsIcon color={colors.primary} icon={Grid2X2Icon} size={22} strokeWidth={2.3} />
        <Text style={styles.allToolbarText}>All Categories</Text>
        <Text style={styles.allToolbarCount}>({count})</Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.sortButton} onPress={onToggleSort}>
        <Text style={styles.sortButtonText}>{sortMode === "featured" ? "Sort" : "A-Z"}</Text>
        <HugeiconsIcon color="#111827" icon={ArrowLeft01Icon} size={15} strokeWidth={2.2} style={styles.sortChevron} />
      </Pressable>
    </View>
  );
}

function AllCategoryTile({
  category,
  columnCount,
  index,
}: {
  category: MobileCategory;
  columnCount: number;
  index: number;
}) {
  const router = useRouter();
  const visual = categoryVisual(category);
  const imageUrl = resolveImageUrl(category.imageUrl);
  const childCount = category.children?.length ?? category._count?.children ?? 0;

  return (
    <Pressable
      accessibilityLabel={`Open ${category.name}`}
      accessibilityRole="button"
      style={[styles.allTile, tileSpacing(columnCount, index)]}
      onPress={() => router.push(`/category/${category.slug}` as never)}
    >
      <View style={[styles.allTileIcon, { backgroundColor: visual.background }]}>
        {imageUrl ? (
          <RemoteImage fallbackLabel={category.name} resizeMode="cover" style={styles.allTileImage} uri={imageUrl} />
        ) : (
          <HugeiconsIcon color={visual.accent} icon={visual.icon} size={34} strokeWidth={2.1} />
        )}
      </View>
      <Text numberOfLines={2} style={styles.allTileTitle}>
        {category.name}
      </Text>
      <View style={styles.allTileBottom}>
        <Text numberOfLines={1} style={styles.allTileMeta}>
          {childCount > 0 ? `${childCount} Subcategories` : `${category._count?.products ?? 0} Products`}
        </Text>
        <HugeiconsIcon color="#6B7280" icon={ArrowRight01Icon} size={17} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

function RequestCategoryTile({ columnCount, index }: { columnCount: number; index: number }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel="Request a category"
      accessibilityRole="button"
      style={[styles.requestTile, tileSpacing(columnCount, index)]}
      onPress={() => router.push("/support" as never)}
    >
      <View style={styles.requestTileIcon}>
        <HugeiconsIcon color="#FFFFFF" icon={ShoppingBagIcon} size={25} strokeWidth={2.2} />
      </View>
      <Text style={styles.requestTitle}>Can't find what you're looking for?</Text>
      <Text style={styles.requestText}>Request a new category and we'll add it.</Text>
      <View style={styles.requestButton}>
        <Text style={styles.requestButtonText}>Request Category</Text>
      </View>
    </Pressable>
  );
}

function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>Loading categories...</Text>
    </View>
  );
}

function ShoppingBagTiny() {
  return <HugeiconsIcon color="#6B7280" icon={ShoppingBagIcon} size={13} strokeWidth={2} />;
}

function GridTiny() {
  return <HugeiconsIcon color="#6B7280" icon={Grid2X2Icon} size={13} strokeWidth={2} />;
}

function filterCategories(categories: MobileCategory[], searchText: string, sortMode: "featured" | "az") {
  const normalizedSearch = searchText.trim().toLowerCase();
  const filtered = normalizedSearch
    ? categories.filter((category) => {
        const searchable = [
          category.name,
          category.slug,
          category.description,
          ...(category.children ?? []).flatMap((child) => [child.name, child.slug, child.description]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedSearch);
      })
    : [...categories];

  if (sortMode === "az") {
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  return filtered.sort((a, b) => categoryStrength(b) - categoryStrength(a));
}

function categoriesForOverview(categories: MobileCategory[]) {
  return [...categories].sort((a, b) => categoryStrength(b) - categoryStrength(a)).slice(0, 3);
}

function categoryStrength(category: MobileCategory) {
  return (category._count?.products ?? 0) + (category.children?.length ?? category._count?.children ?? 0) * 3;
}

function categoryVisual(category: MobileCategory): CategoryVisual {
  const text = `${category.name} ${category.slug}`.toLowerCase();

  if (/(mobile|phone|smartphone)/.test(text)) {
    return { accent: "#2563EB", background: "#EAF2FF", icon: MobileNavigator01Icon };
  }
  if (/(fashion|cloth|wear|apparel|dress|style)/.test(text)) {
    return { accent: "#7C3AED", background: "#F1E9FF", icon: ClothesIcon };
  }
  if (/(home|living|furniture|decor|kitchen)/.test(text)) {
    return { accent: "#0F8A5F", background: "#EAF8EF", icon: Sofa01Icon };
  }
  if (/(electronics|laptop|computer|tech|audio|headphone)/.test(text)) {
    return { accent: "#0A7BEA", background: "#EAF4FF", icon: LaptopIcon };
  }
  if (/(store|shop|retail|local)/.test(text)) {
    return { accent: "#ED3500", background: "#FFF2ED", icon: Store01Icon };
  }
  if (/(beauty|personal|care|makeup|cosmetic)/.test(text)) {
    return { accent: "#E83E8C", background: "#FFEAF4", icon: ShoppingBagIcon };
  }
  return { accent: colors.primary, background: "#FFF2ED", icon: ShoppingBagIcon };
}

function shortCategoryName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 13) {
    return trimmed;
  }
  return trimmed.split(/[&/ ]+/)[0] || trimmed;
}

function tileSpacing(columnCount: number, index: number) {
  return {
    marginRight: (index + 1) % columnCount === 0 ? 0 : 12,
    width: `${(100 - (columnCount - 1) * 3.2) / columnCount}%` as `${number}%`,
  };
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  overviewContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  allContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 14,
    paddingTop: 12,
  },
  headerLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 14,
  },
  headerMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: 52,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    position: "relative",
    shadowColor: "#111827",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    width: 48,
  },
  iconButtonLarge: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    width: 52,
  },
  cartBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 4,
    position: "absolute",
    right: -3,
    top: -4,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  notificationDot: {
    backgroundColor: colors.primary,
    borderColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1.5,
    height: 10,
    position: "absolute",
    right: 12,
    top: 11,
    width: 10,
  },
  allHeader: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 22,
    paddingBottom: 10,
    paddingTop: 12,
  },
  allHeaderCopy: {
    flex: 1,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 62,
    paddingLeft: 16,
    paddingRight: 6,
    shadowColor: "#111827",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  searchLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 54,
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  chipPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 18,
    paddingVertical: 14,
  },
  chipRow: {
    gap: 16,
    paddingHorizontal: 14,
  },
  categoryChip: {
    alignItems: "center",
    minWidth: 62,
  },
  categoryChipActive: {
    alignItems: "center",
    minWidth: 62,
  },
  categoryChipIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 50,
    justifyContent: "center",
    overflow: "hidden",
    width: 50,
  },
  categoryChipIconActive: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderColor: "#FFD7CA",
    borderRadius: 999,
    borderWidth: 2,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  chipImage: {
    height: "100%",
    width: "100%",
  },
  moreChipIcon: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  moreDots: {
    color: "#4B5563",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 22,
  },
  categoryChipText: {
    color: "#4B5563",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
    maxWidth: 72,
    textAlign: "center",
  },
  categoryChipTextActive: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  sectionAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    minHeight: 44,
  },
  sectionActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  popularGrid: {
    gap: 16,
  },
  popularRow: {
    flexDirection: "row",
    gap: 16,
  },
  popularCard: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#111827",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  popularCardTall: {
    flex: 1,
  },
  popularCardWide: {
    flexDirection: "row",
    minHeight: 164,
  },
  popularWideContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  popularImageWrap: {
    height: 156,
    position: "relative",
  },
  wideImageWrap: {
    height: "100%",
    minHeight: 164,
    width: "42%",
  },
  popularImage: {
    height: "100%",
    width: "100%",
  },
  trendingBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 999,
    left: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: "absolute",
    top: 10,
  },
  trendingBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  popularBody: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  popularIcon: {
    alignItems: "center",
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  popularCopy: {
    flex: 1,
  },
  popularTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
  },
  popularSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },
  popularMeta: {
    backgroundColor: "#F8FAFC",
    borderRadius: 9,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  metaPill: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 4,
  },
  metaText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "800",
  },
  popularFooter: {
    alignItems: "center",
    borderTopColor: "#F3F4F6",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  exploreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  discoverCard: {
    alignItems: "center",
    backgroundColor: "#FFF8F4",
    borderColor: "#FFD9CB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    padding: 16,
  },
  discoverIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  discoverCopy: {
    flex: 1,
  },
  discoverTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  discoverSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },
  discoverButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 11,
    flexDirection: "row",
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 13,
  },
  discoverButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  allHero: {
    backgroundColor: "#FFF1EA",
    borderRadius: 16,
    flexDirection: "row",
    minHeight: 162,
    overflow: "hidden",
  },
  allHeroText: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 18,
    paddingVertical: 18,
    zIndex: 1,
  },
  allHeroTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 33,
  },
  allHeroSubtitle: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 8,
  },
  heroCta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 9,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  heroCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  allHeroImage: {
    height: "100%",
    width: "42%",
  },
  allToolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 12,
  },
  allToolbarTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  allToolbarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  allToolbarCount: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "800",
  },
  sortButton: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 13,
  },
  sortButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  sortChevron: {
    transform: [{ rotate: "-90deg" }],
  },
  allGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },
  allTile: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    minHeight: 138,
    padding: 10,
    shadowColor: "#111827",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  allTileIcon: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 58,
  },
  allTileImage: {
    height: "100%",
    width: "100%",
  },
  allTileTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
    marginTop: 13,
    minHeight: 32,
  },
  allTileBottom: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
    marginTop: 7,
  },
  allTileMeta: {
    color: "#4B5563",
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
  },
  requestTile: {
    backgroundColor: "#FFF4EF",
    borderColor: "#FFE1D6",
    borderRadius: 13,
    borderWidth: 1,
    minHeight: 138,
    padding: 10,
  },
  requestTileIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  requestTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    marginTop: 8,
  },
  requestText: {
    color: "#6B7280",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 13,
    marginTop: 4,
  },
  requestButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 9,
    minHeight: 30,
  },
  requestButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  loading: {
    alignItems: "center",
    paddingVertical: 34,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  emptyWrap: {
    paddingVertical: 18,
  },
});
