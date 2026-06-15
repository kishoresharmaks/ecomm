import {
  ArrowRight01Icon,
  BellDotIcon,
  ClothesIcon,
  CouponPercentIcon,
  Grid2X2Icon,
  GridViewIcon,
  HeadsetIcon,
  LaptopIcon,
  MobileNavigator01Icon,
  ShoppingBasket01Icon,
  ShoppingCart01Icon,
  Sofa01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Circle, Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { getCart, listCategories } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";
import type { MobileCategory } from "../../src/types/mobile-home";

type CategoryPalette = {
  accent: string;
  end: string;
  glow: string;
  soft: string;
  start: string;
};

const defaultCategoryPalette: CategoryPalette = {
  accent: "#1683E8",
  end: "#F8FCFF",
  glow: "#B9E0FF",
  soft: "#EFF8FF",
  start: "#E6F4FF",
};

const categoryPalettes: CategoryPalette[] = [
  defaultCategoryPalette,
  { accent: "#9347D8", end: "#FFF9FF", glow: "#E8C8FF", soft: "#F7EDFF", start: "#F4E8FF" },
  { accent: "#F77B14", end: "#FFFDF9", glow: "#FFD19F", soft: "#FFF2E1", start: "#FFF0DE" },
  { accent: "#13A65A", end: "#FAFFFC", glow: "#BDF2D2", soft: "#EBFFF3", start: "#E5FBEA" },
  { accent: "#D88A00", end: "#FFFDF7", glow: "#FFE2A5", soft: "#FFF6DF", start: "#FFF4D9" },
  { accent: "#2576D8", end: "#FAFDFF", glow: "#BBD9FF", soft: "#EEF6FF", start: "#E9F4FF" },
];

export default function CategoriesScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const customerAuth = useMobileCustomerAuth();
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
  const columnCount = width >= 720 ? 3 : 2;

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top + 8, 34) }]}>
      <FlashList
        key={columnCount}
        data={categoriesQuery.isLoading ? [] : categories}
        numColumns={columnCount}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={categoriesQuery.isRefetching} tintColor={colors.primary} onRefresh={() => void categoriesQuery.refetch()} />
        }
        ListHeaderComponent={<CategoriesHeader cartItemCount={cartItemCount} />}
        renderItem={({ item, index }) => <CategoryCard category={item} index={index} />}
        ListEmptyComponent={<CategoryEmptyState columnCount={columnCount} isError={categoriesQuery.isError} isLoading={categoriesQuery.isLoading} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function CategoriesHeader({ cartItemCount }: { cartItemCount: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <View style={styles.titleCluster}>
          <View style={styles.titleIcon}>
            <HugeiconsIcon color={colors.primary} icon={Grid2X2Icon} size={24} strokeWidth={2.15} />
          </View>
          <View style={styles.titleCopy}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
              Discover Categories
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              Explore marketplace collections
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Link asChild href="/account">
            <Pressable style={({ pressed }) => [styles.headerIconButton, pressed ? styles.headerIconButtonPressed : null]}>
              <HugeiconsIcon color={colors.ink} icon={BellDotIcon} size={23} strokeWidth={2} />
              <Text style={styles.notificationDot} />
            </Pressable>
          </Link>
          <Link asChild href="/cart">
            <Pressable style={({ pressed }) => [styles.headerIconButton, pressed ? styles.headerIconButtonPressed : null]}>
              <HugeiconsIcon color={colors.ink} icon={ShoppingCart01Icon} size={24} strokeWidth={2} />
              {cartItemCount > 0 ? <Text style={styles.cartBadge}>{cartItemCount > 99 ? "99+" : cartItemCount}</Text> : null}
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

function CategoryCard({ category, index }: { category: MobileCategory; index: number }) {
  const imageUrl = resolveImageUrl(category.imageUrl);
  const productCount = category._count?.products ?? 0;
  const childCount = category.children?.length ?? category._count?.children ?? 0;
  const description = category.description?.trim();
  const visual = categoryVisual(category, index);
  const meta = childCount > 0 ? `${childCount} subcategories` : `${productCount} products`;

  return (
    <Link asChild href={`/category/${category.slug}` as Href}>
      <Pressable style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}>
        <CategoryGradient gradientId={`category-card-${category.id}-${index}`} palette={visual.palette} />

        <View style={styles.cardTopRow}>
          <View style={[styles.cardIcon, { backgroundColor: visual.palette.soft }]}>
            <HugeiconsIcon color={visual.palette.accent} icon={visual.icon} size={20} strokeWidth={2.05} />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.productPill}>
            {meta}
          </Text>
        </View>

        <View style={[styles.cardImageShell, { backgroundColor: visual.palette.soft }]}>
          {imageUrl ? (
            <RemoteImage fallbackLabel={category.name} resizeMode="contain" style={styles.image} uri={imageUrl} />
          ) : (
            <HugeiconsIcon color={visual.palette.accent} icon={visual.icon} size={48} strokeWidth={1.7} />
          )}
        </View>

        <View style={styles.cardCopy}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {category.name}
          </Text>
          <Text numberOfLines={2} style={styles.cardText}>
            {description || (productCount > 0 ? "Curated products from verified sellers." : "Explore this collection.")}
          </Text>
        </View>

        <View style={styles.cardActionRow}>
          <Text style={[styles.cardActionText, { color: visual.palette.accent }]}>Explore</Text>
          <HugeiconsIcon color={visual.palette.accent} icon={ArrowRight01Icon} size={18} strokeWidth={2.15} />
        </View>
      </Pressable>
    </Link>
  );
}

function CategoryEmptyState({
  columnCount,
  isError,
  isLoading,
}: {
  columnCount: number;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <CategorySkeletonGrid columnCount={columnCount} />;
  }

  return (
    <View style={styles.emptyWrap}>
      <EmptyState
        title={isError ? "Categories could not load" : "No categories found"}
        message={isError ? "Check the API connection and pull to refresh." : "Active categories with approved products will appear here."}
      />
    </View>
  );
}

function CategorySkeletonGrid({ columnCount }: { columnCount: number }) {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: columnCount * 3 }).map((_, index) => (
        <View key={`category-skeleton-${index}`} style={styles.skeletonCard}>
          <View style={styles.skeletonTopRow}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonPill} />
          </View>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonLineLarge} />
          <View style={styles.skeletonLineSmall} />
        </View>
      ))}
    </View>
  );
}

function CategoryGradient({ gradientId, palette }: { gradientId: string; palette: CategoryPalette }) {
  return (
    <Svg pointerEvents="none" style={styles.gradientFill}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor={palette.start} stopOpacity="0.58" />
          <Stop offset="0.6" stopColor={palette.end} stopOpacity="0.36" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.2" />
        </LinearGradient>
      </Defs>
      <Rect fill="#FFFFFF" height="100%" width="100%" x="0" y="0" />
      <Rect fill={`url(#${gradientId})`} height="100%" width="100%" x="0" y="0" />
      <Circle cx="87%" cy="18%" fill="#FFFFFF" fillOpacity="0.28" r="28" />
      <Circle cx="16%" cy="92%" fill={palette.glow} fillOpacity="0.12" r="24" />
    </Svg>
  );
}

function categoryVisual(category: MobileCategory, index: number): { icon: IconSvgElement; palette: CategoryPalette } {
  const text = `${category.name} ${category.slug}`.toLowerCase();
  const palette = categoryPaletteAt(index);

  if (/(mobile|phone|smartphone)/.test(text)) {
    return { icon: MobileNavigator01Icon, palette: { ...palette, accent: "#1683E8", soft: "#EFF8FF" } };
  }
  if (/(fashion|cloth|wear|apparel|dress)/.test(text)) {
    return { icon: ClothesIcon, palette: { ...palette, accent: "#9347D8", soft: "#F7EDFF" } };
  }
  if (/(home|living|furniture|decor|kitchen)/.test(text)) {
    return { icon: Sofa01Icon, palette: { ...palette, accent: "#F77B14", soft: "#FFF2E1" } };
  }
  if (/(grocery|food|fresh|vegetable|veg)/.test(text)) {
    return { icon: ShoppingBasket01Icon, palette: { ...palette, accent: "#13A65A", soft: "#EBFFF3" } };
  }
  if (/(electronic|laptop|computer|gadget)/.test(text)) {
    return { icon: LaptopIcon, palette: { ...palette, accent: "#2576D8", soft: "#EEF6FF" } };
  }
  if (/(deal|offer|coupon)/.test(text)) {
    return { icon: CouponPercentIcon, palette: { ...palette, accent: colors.primary, soft: "#FFF2EE" } };
  }
  if (/(store|shop|seller)/.test(text)) {
    return { icon: Store01Icon, palette: { ...palette, accent: "#8D4CD8", soft: "#F7EDFF" } };
  }
  if (/(support|service)/.test(text)) {
    return { icon: HeadsetIcon, palette: { ...palette, accent: "#2576D8", soft: "#EEF6FF" } };
  }

  return { icon: GridViewIcon, palette };
}

function categoryPaletteAt(index: number) {
  return categoryPalettes[index % categoryPalettes.length] ?? defaultCategoryPalette;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 4,
    flex: 1,
    height: 220,
    marginHorizontal: 6,
    marginVertical: 7,
    overflow: "hidden",
    padding: 12,
    shadowColor: colors.primary,
    shadowOffset: { height: 9, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  cardActionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
  },
  cardActionText: {
    fontFamily: "Plus Jakarta Sans",
    fontSize: 13.5,
    fontWeight: "900",
  },
  cardCopy: {
    gap: 5,
    marginTop: 9,
  },
  cardIcon: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  cardImageShell: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    borderWidth: 1,
    height: 72,
    justifyContent: "center",
    marginTop: 9,
    overflow: "hidden",
    width: "76%",
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  cardText: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "800",
    lineHeight: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 15.5,
    fontWeight: "900",
    lineHeight: 20,
  },
  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  cartBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: "#FFFFFF",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10,
    fontWeight: "900",
    minWidth: 17,
    overflow: "hidden",
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: "absolute",
    right: -2,
    textAlign: "center",
    top: -4,
  },
  emptyWrap: {
    padding: 18,
  },
  gradientFill: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  header: {
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  headerIconButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  headerIconButtonPressed: {
    backgroundColor: "#FFF4EF",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  listContent: {
    paddingBottom: 108,
    paddingHorizontal: 10,
  },
  notificationDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
    position: "absolute",
    right: 8,
    top: 7,
    width: 8,
  },
  productPill: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderColor: "rgba(243,231,226,0.9)",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.ink,
    flexShrink: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10,
    fontWeight: "900",
    maxWidth: 96,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  screen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexBasis: "46%",
    flexGrow: 1,
    height: 220,
    marginHorizontal: 6,
    marginVertical: 7,
    padding: 12,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
  },
  skeletonIcon: {
    backgroundColor: "#FFF0EA",
    borderRadius: 999,
    height: 36,
    width: 36,
  },
  skeletonImage: {
    alignSelf: "center",
    backgroundColor: "#F4F5F7",
    borderRadius: 20,
    height: 72,
    marginTop: 9,
    width: "76%",
  },
  skeletonLineLarge: {
    backgroundColor: "#E8EAEE",
    borderRadius: 999,
    height: 12,
    marginTop: 16,
    width: "82%",
  },
  skeletonLineSmall: {
    backgroundColor: "#F0F1F4",
    borderRadius: 999,
    height: 10,
    marginTop: 9,
    width: "62%",
  },
  skeletonPill: {
    backgroundColor: "#F4F5F7",
    borderRadius: 999,
    height: 22,
    width: 70,
  },
  skeletonTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subtitle: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12.5,
    fontWeight: "800",
    lineHeight: 18,
  },
  title: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 28,
  },
  titleCluster: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  titleIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderColor: "#FFE3D9",
    borderRadius: 19,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    width: 48,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
});
