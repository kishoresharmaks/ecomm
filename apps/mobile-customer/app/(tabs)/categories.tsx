import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ClothesIcon,
  Grid2X2Icon,
  LaptopIcon,
  MobileNavigator01Icon,
  Search01Icon,
  ShoppingBagIcon,
  SofaIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { withStorefrontMaintenance } from "../../src/features/maintenance/mobile-maintenance-gate";
import { listCategories } from "../../src/features/storefront/storefront-api";
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
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<"featured" | "az">("featured");

  const categoriesQuery = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: listCategories,
    retry: false,
  });

  const categories = categoriesQuery.data ?? [];
  const filteredCategories = useMemo(
    () => filterCategories(categories, searchText, sortMode),
    [categories, searchText, sortMode],
  );
  const popularCategories = useMemo(() => categoriesForOverview(categories), [categories]);
  const visibleSubcategoryGroups = useMemo(
    () => subcategoryGroups(filteredCategories),
    [filteredCategories],
  );
  const allColumnCount = width >= 400 ? 3 : 2;

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
        <CategoriesHeader />
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
          { paddingBottom: Math.max(160, insets.bottom + 140) },
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
                    screenWidth={width}
                  />
                ))}
              </View>
            )}
            <SubcategoryDirectory groups={visibleSubcategoryGroups} />
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

function CategoriesHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerMark}>
        <HugeiconsIcon color="#FFFFFF" icon={Grid2X2Icon} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>Categories</Text>
        <Text style={styles.headerSubtitle}>Browse all marketplace categories</Text>
      </View>
    </View>
  );
}

function AllCategoriesHeader({ onBack, onSearch }: { onBack: () => void; onSearch: () => void }) {
  return (
    <View style={styles.allHeader}>
      <Pressable accessibilityLabel="Back to categories" accessibilityRole="button" style={styles.iconButtonLarge} onPress={onBack}>
        <HugeiconsIcon color="#111827" icon={ArrowLeft01Icon} size={22} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.allHeaderCopy}>
        <Text style={styles.headerTitle}>All Categories</Text>
        <Text style={styles.headerSubtitle}>Browse all categories</Text>
      </View>
      <Pressable accessibilityLabel="Open marketplace search" accessibilityRole="button" style={styles.iconButtonLarge} onPress={onSearch}>
        <HugeiconsIcon color="#111827" icon={Search01Icon} size={22} strokeWidth={2.2} />
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
      <HugeiconsIcon color="#9CA3AF" icon={Search01Icon} size={19} strokeWidth={2} />
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      <Pressable accessibilityRole="button" style={styles.categoryChipActive} onPress={onMorePress}>
        <View style={styles.categoryChipIconActive}>
          <HugeiconsIcon color={colors.primary} icon={Grid2X2Icon} size={20} strokeWidth={2.2} />
        </View>
        <Text style={styles.categoryChipTextActive}>All</Text>
      </Pressable>
      {visible.map((category) => {
        const imageUrl = resolveImageUrl(category.imageUrl);
        return (
          <Pressable
            key={category.id}
            accessibilityLabel={`Open ${category.name}`}
            accessibilityRole="button"
            style={styles.categoryChip}
            onPress={() => router.push(`/category/${category.slug}` as never)}
          >
            <View style={styles.categoryChipIcon}>
              {imageUrl ? (
                <RemoteImage fallbackLabel={category.name} resizeMode="cover" style={styles.chipImage} uri={imageUrl} />
              ) : (
                <View style={[styles.categoryChipFallback, { backgroundColor: categoryVisual(category).background }]}>
                  <HugeiconsIcon color={categoryVisual(category).accent} icon={categoryVisual(category).icon} size={18} strokeWidth={2} />
                </View>
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
          <Text style={styles.moreDots}>+</Text>
        </View>
        <Text style={styles.categoryChipText}>More</Text>
      </Pressable>
    </ScrollView>
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
        <HugeiconsIcon color={colors.primary} icon={ArrowRight01Icon} size={14} strokeWidth={2.4} />
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
  const imageUrl = resolveImageUrl(category.imageUrl);
  const productCount = category._count?.products ?? 0;

  return (
    <Pressable
      accessibilityLabel={`Explore ${category.name}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.popularCard,
        variant === "wide" ? styles.popularCardWide : styles.popularCardTall,
        pressed && styles.pressedOverlay,
      ]}
      onPress={() => router.push(`/category/${category.slug}` as never)}
    >
      <View style={variant === "wide" ? styles.wideImageWrap : styles.popularImageWrap}>
        {imageUrl ? (
          <RemoteImage fallbackLabel={category.name} resizeMode="cover" style={styles.popularImage} uri={imageUrl} />
        ) : (
          <View style={styles.popularImageFallback}>
            <HugeiconsIcon color={colors.muted} icon={categoryVisual(category).icon} size={30} strokeWidth={1.8} />
          </View>
        )}
      </View>
      <View style={[styles.popularBody, variant === "wide" && styles.popularBodyWide]}>
        <Text numberOfLines={1} style={styles.popularTitle}>
          {category.name}
        </Text>
        <View style={styles.popularMeta}>
          <Text style={styles.popularMetaText}>{productCount} products</Text>
          <HugeiconsIcon color="#D1D5DB" icon={ArrowRight01Icon} size={13} strokeWidth={2} />
        </View>
      </View>
    </Pressable>
  );
}

function SubcategoryDirectory({
  groups,
}: {
  groups: Array<{ parent: MobileCategory; children: MobileCategory[] }>;
}) {
  if (!groups.length) {
    return null;
  }

  return (
    <View style={styles.subcategoryDirectory}>
      <View style={styles.directoryTitleRow}>
        <View>
          <Text style={styles.directoryTitle}>Browse Subcategories</Text>
          <Text style={styles.directorySubtitle}>Quickly jump into focused product collections</Text>
        </View>
      </View>
      {groups.map((group) => (
        <SubcategoryFamily key={group.parent.id} group={group} />
      ))}
    </View>
  );
}

function SubcategoryFamily({
  group,
}: {
  group: { parent: MobileCategory; children: MobileCategory[] };
}) {
  const router = useRouter();
  const parentImageUrl = resolveImageUrl(group.parent.imageUrl);

  return (
    <View style={styles.familyPanel}>
      <Pressable
        accessibilityLabel={`Open ${group.parent.name}`}
        accessibilityRole="button"
        style={({ pressed }) => [styles.familyHeader, pressed && styles.pressedOverlayLight]}
        onPress={() => router.push(`/category/${group.parent.slug}` as never)}
      >
        <View style={styles.familyHeaderIcon}>
          {parentImageUrl ? (
            <RemoteImage fallbackLabel={group.parent.name} resizeMode="cover" style={styles.familyHeaderImage} uri={parentImageUrl} />
          ) : (
            <View style={[styles.familyHeaderFallback, { backgroundColor: categoryVisual(group.parent).background }]}>
              <HugeiconsIcon color={categoryVisual(group.parent).accent} icon={categoryVisual(group.parent).icon} size={18} strokeWidth={2} />
            </View>
          )}
        </View>
        <View style={styles.familyHeaderCopy}>
          <Text numberOfLines={1} style={styles.familyTitle}>
            {group.parent.name}
          </Text>
          <Text numberOfLines={1} style={styles.familyMeta}>
            {group.children.length} subcategories
          </Text>
        </View>
        <HugeiconsIcon color="#D1D5DB" icon={ArrowRight01Icon} size={16} strokeWidth={2} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyRail}>
        {group.children.map((child) => (
          <SubcategoryRailCard key={child.id} category={child} />
        ))}
      </ScrollView>
    </View>
  );
}

function SubcategoryRailCard({ category }: { category: MobileCategory }) {
  const router = useRouter();
  const imageUrl = resolveImageUrl(category.imageUrl);

  return (
    <Pressable
      accessibilityLabel={`Open ${category.name}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.familyRailCard, pressed && styles.pressedOverlayLight]}
      onPress={() => router.push(`/category/${category.slug}` as never)}
    >
      <View style={styles.familyRailImageWrap}>
        {imageUrl ? (
          <RemoteImage fallbackLabel={category.name} resizeMode="cover" style={styles.familyRailImage} uri={imageUrl} />
        ) : (
          <View style={[styles.familyRailFallback, { backgroundColor: categoryVisual(category).background }]}>
            <HugeiconsIcon color={categoryVisual(category).accent} icon={categoryVisual(category).icon} size={20} strokeWidth={2} />
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={styles.familyRailTitle}>
        {category.name}
      </Text>
      <Text numberOfLines={1} style={styles.familyRailMeta}>
        {category._count?.products ?? 0} products
      </Text>
    </Pressable>
  );
}

function DiscoverMoreCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.discoverCard, pressed && styles.pressedOverlayLight]} onPress={onPress}>
      <View style={styles.discoverContent}>
        <Text style={styles.discoverTitle}>Explore all categories</Text>
        <Text style={styles.discoverSubtitle}>Find everything you need in one place</Text>
      </View>
      <View style={styles.discoverArrow}>
        <HugeiconsIcon color={colors.primary} icon={ArrowRight01Icon} size={16} strokeWidth={2.2} />
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
          <HugeiconsIcon color="#FFFFFF" icon={ArrowRight01Icon} size={15} strokeWidth={2.2} />
        </Pressable>
      </View>
      {imageUrl ? (
        <RemoteImage fallbackLabel="Hero" resizeMode="cover" style={styles.allHeroImage} uri={imageUrl} />
      ) : (
        <View style={styles.allHeroImageFallback}>
          <HugeiconsIcon color="#D1D5DB" icon={ShoppingBagIcon} size={36} strokeWidth={1.5} />
        </View>
      )}
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
        <HugeiconsIcon color={colors.primary} icon={Grid2X2Icon} size={18} strokeWidth={2.2} />
        <Text style={styles.allToolbarText}>All Categories</Text>
        <Text style={styles.allToolbarCount}>({count})</Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.sortButton} onPress={onToggleSort}>
        <Text style={styles.sortButtonText}>{sortMode === "featured" ? "Sort" : "A-Z"}</Text>
        <HugeiconsIcon color="#9CA3AF" icon={ArrowLeft01Icon} size={13} strokeWidth={2} style={styles.sortChevron} />
      </Pressable>
    </View>
  );
}

function AllCategoryTile({
  category,
  columnCount,
  index,
  screenWidth,
}: {
  category: MobileCategory;
  columnCount: number;
  index: number;
  screenWidth: number;
}) {
  const router = useRouter();
  const imageUrl = resolveImageUrl(category.imageUrl);
  const childCount = category.children?.length ?? category._count?.children ?? 0;

  return (
    <Pressable
      accessibilityLabel={`Open ${category.name}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.allTile, tileSpacing(columnCount, index, screenWidth), pressed && styles.pressedOverlayLight]}
      onPress={() => router.push(`/category/${category.slug}` as never)}
    >
      <View style={styles.allTileImageWrap}>
        {imageUrl ? (
          <RemoteImage fallbackLabel={category.name} resizeMode="cover" style={styles.allTileImage} uri={imageUrl} />
        ) : (
          <View style={[styles.allTileImageFallback, { backgroundColor: categoryVisual(category).background }]}>
            <HugeiconsIcon color={categoryVisual(category).accent} icon={categoryVisual(category).icon} size={columnCount === 2 ? 28 : 32} strokeWidth={2} />
          </View>
        )}
      </View>
      <View style={styles.allTileBody}>
        <Text numberOfLines={2} style={styles.allTileTitle}>
          {category.name}
        </Text>
        <View style={styles.allTileBottom}>
          <Text numberOfLines={1} style={styles.allTileMeta}>
            {childCount > 0 ? `${childCount} Subcategories` : `${category._count?.products ?? 0} Products`}
          </Text>
          <HugeiconsIcon color="#D1D5DB" icon={ArrowRight01Icon} size={13} strokeWidth={2} />
        </View>
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

function subcategoryGroups(categories: MobileCategory[]) {
  return categories
    .map((parent) => ({
      parent,
      children: [...(parent.children ?? [])].sort((a, b) => categoryStrength(b) - categoryStrength(a)),
    }))
    .filter((group) => group.children.length > 0);
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
    return { accent: "#0F8A5F", background: "#EAF8EF", icon: SofaIcon };
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

function tileSpacing(columnCount: number, index: number, screenWidth: number) {
  const gap = 12;
  const containerPad = 16;
  const usableWidth = Math.max(0, screenWidth - containerPad * 2);
  const tileWidth = (usableWidth - (columnCount - 1) * gap) / columnCount;
  return {
    marginRight: (index + 1) % columnCount === 0 ? 0 : gap,
    width: tileWidth,
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
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  allContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pressedOverlay: {
    opacity: 0.88,
  },
  pressedOverlayLight: {
    opacity: 0.75,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerMark: {
    alignItems: "center",
    backgroundColor: "#FFF0EC",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 27,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 1,
  },
  iconButtonLarge: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  allHeader: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  allHeaderCopy: {
    flex: 1,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
  },
  chipRow: {
    gap: 10,
  },
  categoryChip: {
    alignItems: "center",
    minWidth: 52,
  },
  categoryChipActive: {
    alignItems: "center",
    minWidth: 52,
  },
  categoryChipIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    overflow: "hidden",
    width: 46,
  },
  categoryChipIconActive: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  categoryChipFallback: {
    alignItems: "center",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  chipImage: {
    height: "100%",
    width: "100%",
  },
  moreChipIcon: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  moreDots: {
    color: "#9CA3AF",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  categoryChipText: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 7,
    maxWidth: 64,
    textAlign: "center",
  },
  categoryChipTextActive: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 7,
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
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    minHeight: 36,
  },
  sectionActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  popularGrid: {
    gap: 14,
  },
  popularRow: {
    flexDirection: "row",
    gap: 14,
  },
  popularCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F3F4F6",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  popularCardTall: {
    flex: 1,
  },
  popularCardWide: {
    flexDirection: "row",
    height: 150,
  },
  popularImageWrap: {
    height: 150,
  },
  wideImageWrap: {
    height: 150,
    width: "42%",
  },
  popularImage: {
    height: "100%",
    width: "100%",
  },
  popularImageFallback: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  popularBody: {
    padding: 12,
  },
  popularBodyWide: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  popularTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  popularMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  popularMetaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  subcategoryDirectory: {
    marginTop: 24,
    gap: 12,
  },
  directoryTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  directoryTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  directorySubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 3,
  },
  familyPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F3F4F6",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingBottom: 12,
  },
  familyHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  familyHeaderIcon: {
    borderRadius: 12,
    height: 40,
    overflow: "hidden",
    width: 40,
  },
  familyHeaderImage: {
    height: "100%",
    width: "100%",
  },
  familyHeaderFallback: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  familyHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  familyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  familyMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  familyRail: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  familyRailCard: {
    alignItems: "center",
    backgroundColor: "#FEFDFC",
    borderRadius: 12,
    padding: 10,
    width: 104,
  },
  familyRailImageWrap: {
    borderRadius: 12,
    height: 56,
    overflow: "hidden",
    width: 56,
  },
  familyRailImage: {
    height: "100%",
    width: "100%",
  },
  familyRailFallback: {
    alignItems: "center",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  familyRailTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    marginTop: 8,
    minHeight: 22,
    textAlign: "center",
  },
  familyRailMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  discoverCard: {
    alignItems: "center",
    backgroundColor: "#FFF4EF",
    borderRadius: 16,
    flexDirection: "row",
    marginTop: 22,
    padding: 16,
  },
  discoverContent: {
    flex: 1,
  },
  discoverTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  discoverSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 2,
  },
  discoverArrow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  allHero: {
    backgroundColor: "#FFF1EA",
    borderRadius: 18,
    flexDirection: "row",
    minHeight: 155,
    overflow: "hidden",
  },
  allHeroText: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 16,
    zIndex: 1,
  },
  allHeroTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 27,
  },
  allHeroSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 6,
  },
  heroCta: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  heroCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  allHeroImage: {
    height: "100%",
    width: "42%",
  },
  allHeroImageFallback: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "42%",
  },
  allToolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 12,
  },
  allToolbarTitle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  allToolbarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  allToolbarCount: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "600",
  },
  sortButton: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  sortButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
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
    borderColor: "#F3F4F6",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 148,
    overflow: "hidden",
  },
  allTileImageWrap: {
    height: 90,
    overflow: "hidden",
  },
  allTileImage: {
    height: "100%",
    width: "100%",
  },
  allTileImageFallback: {
    alignItems: "center",
    height: 90,
    justifyContent: "center",
    width: "100%",
  },
  allTileBody: {
    padding: 10,
  },
  allTileTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  allTileBottom: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
    marginTop: 4,
  },
  allTileMeta: {
    color: colors.muted,
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
  },
  loading: {
    alignItems: "center",
    paddingVertical: 30,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 10,
  },
  emptyWrap: {
    paddingVertical: 16,
  },
});
