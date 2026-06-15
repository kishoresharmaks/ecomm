import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  CheckmarkBadge02Icon,
  DeliveryBox01Icon,
  HeartIcon,
  Location01Icon,
  PackageIcon,
  ReturnRequestIcon,
  Search01Icon,
  Shield01Icon,
  ShoppingCart01Icon,
  SlidersHorizontalIcon,
  Sorting05Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import {
  addWishlistItem,
  getStoreProfile,
  getWishlist,
  listProducts,
  removeWishlistItem,
} from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";
import type { MobileStore } from "../../src/types/mobile-home";
import type { ProductSummary, ProductVariant } from "../../src/types/storefront";

type ProductTab = "all" | "new" | "top";
type SortMode = "relevance" | "newest" | "price_low" | "price_high";
type AvailabilityFilter = "all" | "in_stock" | "deals";
type PriceFilter = "all" | "under_1000" | "between_1000_5000" | "over_5000";
type RatingFilter = "all" | "four_plus";
type StoreProductFilters = {
  availability: AvailabilityFilter;
  price: PriceFilter;
  rating: RatingFilter;
};
type WishlistToggleInput = {
  productId: string;
  wished: boolean;
};

const SCREEN_BG = "#FFFCFB";
const CARD_BG = "#FFFFFF";
const BORDER = "#F3E7E2";
const TEXT = "#111827";
const MUTED = "#6B7280";
const SUCCESS = "#22C55E";
const WARNING = "#F59E0B";
const defaultFilters: StoreProductFilters = {
  availability: "all",
  price: "all",
  rating: "all",
};

export default function StoreDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const market = useMobileMarket();
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<ProductTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [filters, setFilters] = useState<StoreProductFilters>(defaultFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingWishlistProductId, setPendingWishlistProductId] = useState<string | null>(null);
  const effectiveSearch = searchText.trim().length >= 2 ? searchText.trim() : "";

  const storeQuery = useQuery({
    queryKey: ["mobile-store", slug],
    queryFn: () => getStoreProfile(slug),
    enabled: Boolean(slug),
    retry: false,
  });
  const store = storeQuery.data;
  const productsQuery = useInfiniteQuery({
    queryKey: ["mobile-store-products", store?.id, effectiveSearch],
    queryFn: ({ pageParam }) =>
      listProducts({
        cursor: pageParam,
        pagination: "cursor",
        limit: 24,
        ...(store?.id ? { sellerId: store.id } : {}),
        ...(effectiveSearch ? { search: effectiveSearch } : {}),
      }),
    enabled: Boolean(store?.id),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo?.nextCursor ?? undefined,
    retry: false,
  });
  const wishlistQuery = useQuery({
    queryKey: ["mobile-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 30_000,
  });
  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data?.pages],
  );
  const wishlistProductIds = useMemo(
    () => new Set((wishlistQuery.data?.items ?? []).map((item) => item.productId)),
    [wishlistQuery.data?.items],
  );
  const visibleProducts = useMemo(
    () => selectVisibleProducts(products, activeTab, sortMode, filters),
    [activeTab, filters, products, sortMode],
  );
  const refreshing = storeQuery.isRefetching || productsQuery.isRefetching;
  const selectedFilterCount = activeFilterCount(filters);

  function submitSearch() {
    void productsQuery.refetch();
  }

  const wishlistMutation = useMutation({
    mutationFn: async ({ productId, wished }: WishlistToggleInput) => {
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

  if (!slug) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.emptyScreen}>
          <EmptyState title="Shop not found" message="Open a shop again from Local Shops." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlashList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              void storeQuery.refetch();
              void productsQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <StoreHeader
            activeTab={activeTab}
            filters={filters}
            formatPrice={market.format}
            filterCount={selectedFilterCount}
            isLoading={storeQuery.isLoading}
            isProductsLoading={productsQuery.isLoading}
            onBack={() => router.back()}
            onClearFilters={() => setFilters(defaultFilters)}
            onOpenFilter={() => setFilterOpen(true)}
            productCount={visibleProducts.length}
            products={products}
            searchText={searchText}
            setActiveTab={setActiveTab}
            setSearchText={setSearchText}
            sortMode={sortMode}
            store={store}
            submitSearch={submitSearch}
          />
        }
        renderItem={({ item }) => {
          const isWished = wishlistProductIds.has(item.id);

          return (
            <PremiumProductCard
              formatPrice={market.format}
              isWishlistPending={pendingWishlistProductId === item.id}
              isWished={isWished}
              product={item}
              store={store}
              onToggleWishlist={() => toggleWishlist(item.id, isWished)}
            />
          );
        }}
        ListEmptyComponent={
          storeQuery.isLoading || productsQuery.isLoading ? null : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={storeQuery.isError || productsQuery.isError ? "Shop could not load" : "No products found"}
                message={
                  storeQuery.isError || productsQuery.isError
                    ? "Check the API connection and pull to refresh."
                    : effectiveSearch
                      ? "Try another product search in this shop."
                      : "Approved products from this seller will appear here."
                }
              />
            </View>
          )
        }
        ListFooterComponent={
          <StoreFooter
            hasNextPage={Boolean(productsQuery.hasNextPage)}
            isFetchingNextPage={productsQuery.isFetchingNextPage}
            onLoadMore={() => void productsQuery.fetchNextPage()}
            storeName={store?.storeName}
          />
        }
        contentContainerStyle={styles.listContent}
      />
      <ProductFilterModal
        filters={filters}
        formatPrice={market.format}
        open={filterOpen}
        setFilters={setFilters}
        setSortMode={setSortMode}
        sortMode={sortMode}
        onClose={() => setFilterOpen(false)}
        onReset={() => {
          setFilters(defaultFilters);
          setSortMode("relevance");
        }}
      />
    </SafeAreaView>
  );
}

function StoreHeader({
  activeTab,
  filters,
  formatPrice,
  filterCount,
  isLoading,
  isProductsLoading,
  onBack,
  onClearFilters,
  onOpenFilter,
  productCount,
  products,
  searchText,
  setActiveTab,
  setSearchText,
  sortMode,
  store,
  submitSearch,
}: {
  activeTab: ProductTab;
  filters: StoreProductFilters;
  formatPrice: (pricePaise?: number | null) => string;
  filterCount: number;
  isLoading: boolean;
  isProductsLoading: boolean;
  onBack: () => void;
  onClearFilters: () => void;
  onOpenFilter: () => void;
  productCount: number;
  products: ProductSummary[];
  searchText: string;
  setActiveTab: (value: ProductTab) => void;
  setSearchText: (value: string) => void;
  sortMode: SortMode;
  store: MobileStore | undefined;
  submitSearch: () => void;
}) {
  const logoUrl = resolveImageUrl(store?.profile?.logoUrl);
  const bannerUrl = resolveImageUrl(store?.profile?.bannerUrl);
  const totalProducts = store?._count?.products ?? products.length;
  const rating = store?.reviewSummary?.averageRating;
  const reviewCount = store?.reviewSummary?.reviewCount ?? 0;

  return (
    <View>
      <View style={styles.hero}>
        {bannerUrl ? <RemoteImage fallbackLabel={store?.storeName ?? "Shop"} resizeMode="cover" style={styles.heroImage} uri={bannerUrl} /> : null}
        <View style={styles.heroImageWash} />
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroActions}>
          <Pressable accessibilityRole="button" style={styles.circleButton} onPress={onBack}>
            <HugeiconsIcon color={TEXT} icon={ArrowLeft02Icon} size={24} strokeWidth={2.3} />
          </Pressable>
        </View>

        <View style={styles.heroProfile}>
          <View style={styles.logoFrame}>
            <RemoteImage fallbackLabel={store?.storeName ?? "Shop"} resizeMode="cover" style={styles.logoImage} uri={logoUrl} />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.titleRow}>
              <Text numberOfLines={2} style={styles.heroTitle}>
                {store?.storeName ?? "Loading shop"}
              </Text>
              {store ? <HugeiconsIcon color={SUCCESS} icon={CheckmarkBadge02Icon} size={24} strokeWidth={2.2} /> : null}
            </View>
            <View style={styles.heroPillRow}>
              <Text style={styles.approvedPill}>Approved seller</Text>
              <View style={styles.locationPill}>
                <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={14} strokeWidth={2.2} />
                <Text numberOfLines={1} style={styles.locationPillText}>
                  {shortSellerLocation(store)}
                </Text>
              </View>
            </View>
            <Text numberOfLines={3} style={styles.heroText}>
              {store?.profile?.description ?? "Approved 1HandIndia seller profile with live marketplace products."}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.headerStack}>
        <View style={styles.statsCard}>
          <StatColumn icon={PackageIcon} label="Products" value={`${totalProducts} live`} />
          <View style={styles.verticalRule} />
          <StatColumn icon={StarIcon} label="Rating" value={rating ? `${rating.toFixed(1)}  (${reviewCount})` : "New"} />
          <View style={styles.verticalRule} />
          <StatColumn icon={Shield01Icon} label="Status" value="Approved" />
        </View>

        <View style={styles.benefitsCard}>
          <BenefitItem icon={DeliveryBox01Icon} title="Reliable shipping" subtitle="On-time delivery" />
          <View style={styles.benefitDivider} />
          <BenefitItem icon={ReturnRequestIcon} title="Easy returns" subtitle="Hassle-free returns" />
          <View style={styles.benefitDivider} />
          <BenefitItem icon={Shield01Icon} title="Secure payments" subtitle="100% secure" />
        </View>

        <View style={styles.productsPanel}>
          <View style={styles.searchBox}>
            <HugeiconsIcon color="#8B96A8" icon={Search01Icon} size={24} strokeWidth={2} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setSearchText}
              onSubmitEditing={submitSearch}
              placeholder="Search products in this shop"
              placeholderTextColor="#8B96A8"
              returnKeyType="search"
              style={styles.searchInput}
              value={searchText}
            />
          </View>

          <View style={styles.controlRow}>
            <Pressable style={styles.controlButton} onPress={onOpenFilter}>
              <HugeiconsIcon color={colors.primary} icon={Sorting05Icon} size={20} strokeWidth={2.2} />
              <View style={styles.controlCopy}>
                <Text style={styles.controlText}>Sort</Text>
                <Text numberOfLines={1} style={styles.controlSubText}>{sortLabel(sortMode)}</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.controlButton, filterCount ? styles.controlButtonActive : null]} onPress={onOpenFilter}>
              <HugeiconsIcon color={colors.primary} icon={SlidersHorizontalIcon} size={20} strokeWidth={2.2} />
              <View style={styles.controlCopy}>
                <Text style={styles.controlText}>Filter</Text>
                <Text numberOfLines={1} style={styles.controlSubText}>{filterCount ? `${filterCount} active` : "Options"}</Text>
              </View>
            </Pressable>
          </View>

          {filterCount ? (
            <View style={styles.filterSummaryRow}>
              <Text numberOfLines={1} style={styles.filterSummaryText}>{filterSummary(filters, formatPrice)}</Text>
              <Pressable onPress={onClearFilters}>
                <Text style={styles.clearFilterText}>Clear</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.tabRow}>
            <ProductTabButton active={activeTab === "all"} label="All Products" onPress={() => setActiveTab("all")} />
            <ProductTabButton active={activeTab === "new"} label="New Arrivals" onPress={() => setActiveTab("new")} />
            <ProductTabButton active={activeTab === "top"} label="Top Rated" onPress={() => setActiveTab("top")} />
          </View>

          <View style={styles.productsMetaRow}>
            <Text style={styles.productCountText}>
              {isLoading || isProductsLoading ? "Loading products..." : `${productCount} ${productCount === 1 ? "product" : "products"} found`}
            </Text>
            <Text style={styles.sortText}>{sortLabel(sortMode)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ProductFilterModal({
  filters,
  formatPrice,
  open,
  setFilters,
  setSortMode,
  sortMode,
  onClose,
  onReset,
}: {
  filters: StoreProductFilters;
  formatPrice: (pricePaise?: number | null) => string;
  open: boolean;
  setFilters: (value: StoreProductFilters) => void;
  setSortMode: (value: SortMode) => void;
  sortMode: SortMode;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={styles.sheetTitle}>Filter products</Text>
              <Text style={styles.sheetSubtitle}>Choose sort and product conditions for this shop.</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <FilterGroup title="Sort by">
              <OptionPill active={sortMode === "relevance"} label="Relevance" onPress={() => setSortMode("relevance")} />
              <OptionPill active={sortMode === "newest"} label="Newest" onPress={() => setSortMode("newest")} />
              <OptionPill active={sortMode === "price_low"} label="Price low" onPress={() => setSortMode("price_low")} />
              <OptionPill active={sortMode === "price_high"} label="Price high" onPress={() => setSortMode("price_high")} />
            </FilterGroup>

            <FilterGroup title="Availability">
              <OptionPill active={filters.availability === "all"} label="All items" onPress={() => setFilters({ ...filters, availability: "all" })} />
              <OptionPill active={filters.availability === "in_stock"} label="In stock" onPress={() => setFilters({ ...filters, availability: "in_stock" })} />
              <OptionPill active={filters.availability === "deals"} label="Deals only" onPress={() => setFilters({ ...filters, availability: "deals" })} />
            </FilterGroup>

            <FilterGroup title="Price range">
              <OptionPill active={filters.price === "all"} label="All prices" onPress={() => setFilters({ ...filters, price: "all" })} />
              <OptionPill active={filters.price === "under_1000"} label={`Under ${formatPrice(100_000)}`} onPress={() => setFilters({ ...filters, price: "under_1000" })} />
              <OptionPill active={filters.price === "between_1000_5000"} label={`${formatPrice(100_000)} - ${formatPrice(500_000)}`} onPress={() => setFilters({ ...filters, price: "between_1000_5000" })} />
              <OptionPill active={filters.price === "over_5000"} label={`Above ${formatPrice(500_000)}`} onPress={() => setFilters({ ...filters, price: "over_5000" })} />
            </FilterGroup>

            <FilterGroup title="Rating">
              <OptionPill active={filters.rating === "all"} label="Any rating" onPress={() => setFilters({ ...filters, rating: "all" })} />
              <OptionPill active={filters.rating === "four_plus"} label="4.0 and above" onPress={() => setFilters({ ...filters, rating: "four_plus" })} />
            </FilterGroup>
          </ScrollView>

          <View style={styles.sheetActions}>
            <Pressable style={styles.resetButton} onPress={onReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.applyButton} onPress={onClose}>
              <Text style={styles.applyButtonText}>Apply filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FilterGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.optionGrid}>{children}</View>
    </View>
  );
}

function OptionPill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.optionPill, active ? styles.optionPillActive : null]} onPress={onPress}>
      <Text style={[styles.optionPillText, active ? styles.optionPillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function StatColumn({
  icon,
  label,
  value,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statColumn}>
      <HugeiconsIcon color={colors.primary} icon={icon} size={32} strokeWidth={2.1} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

function BenefitItem({
  icon,
  subtitle,
  title,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.benefitItem}>
      <HugeiconsIcon color={colors.primary} icon={icon} size={26} strokeWidth={2.1} />
      <View style={styles.benefitCopy}>
        <Text numberOfLines={1} style={styles.benefitTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.benefitText}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function ProductTabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
      <View style={[styles.tabUnderline, active ? styles.tabUnderlineActive : null]} />
    </Pressable>
  );
}

function PremiumProductCard({
  formatPrice,
  isWishlistPending,
  isWished,
  onToggleWishlist,
  product,
  store,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  isWishlistPending: boolean;
  isWished: boolean;
  onToggleWishlist: () => void;
  product: ProductSummary;
  store: MobileStore | undefined;
}) {
  const imageUrl = resolveImageUrl(product.images?.[0]?.url);
  const variant = selectVariant(product);
  const price = variant?.dealPricePaise ?? variant?.pricePaise;
  const mrp = variant?.originalPricePaise ?? variant?.mrpPaise ?? null;
  const discount = discountPercent(price, mrp);
  const rating = product.reviewSummary?.averageRating ?? store?.reviewSummary?.averageRating ?? null;
  const reviewCount = product.reviewSummary?.reviewCount ?? store?.reviewSummary?.reviewCount ?? 0;
  const inStock = typeof variant?.stockQuantity === "number" ? variant.stockQuantity > 0 : true;

  return (
    <View style={styles.productCard}>
      <View style={styles.productBody}>
        <View style={styles.productImageWrap}>
          <RemoteImage fallbackLabel={product.name} resizeMode="cover" style={styles.productImage} uri={imageUrl} />
          {discount ? <Text style={styles.discountBadge}>-{discount}%</Text> : null}
          <Pressable
            accessibilityLabel={isWished ? "Remove from wishlist" : "Add to wishlist"}
            accessibilityRole="button"
            accessibilityState={{ busy: isWishlistPending, selected: isWished }}
            disabled={isWishlistPending}
            hitSlop={8}
            style={[
              styles.heartButton,
              isWished ? styles.heartButtonActive : null,
              isWishlistPending ? styles.heartButtonDisabled : null,
            ]}
            onPress={onToggleWishlist}
          >
            {isWishlistPending ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <HugeiconsIcon color={isWished ? colors.primary : "#738097"} icon={HeartIcon} size={24} strokeWidth={isWished ? 2.6 : 2} />
            )}
          </Pressable>
        </View>

        <View style={styles.productInfo}>
          <Text numberOfLines={2} style={styles.productName}>
            {product.name}
          </Text>
          <Text numberOfLines={1} style={styles.productSeller}>
            {product.seller?.storeName ?? store?.storeName ?? "1HandIndia seller"}
          </Text>
          <View style={styles.productBadgeLine}>
            <HugeiconsIcon color={WARNING} icon={StarIcon} size={18} strokeWidth={2.3} />
            <Text style={styles.productRating}>{rating ? rating.toFixed(1) : "New"}</Text>
            {reviewCount ? <Text style={styles.reviewText}>({reviewCount} review{reviewCount === 1 ? "" : "s"})</Text> : null}
          </View>
          <View style={styles.priceRow}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.priceText}>
              {formatPrice(price)}
            </Text>
            {mrp && price && mrp > price ? (
              <Text numberOfLines={1} style={styles.mrpText}>
                {formatPrice(mrp)}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.stockPill, inStock ? styles.stockPillIn : styles.stockPillOut]}>
            {inStock ? "In stock" : "Out of stock"}
          </Text>
          <Link href={`/product/${product.slug}` as Href} asChild>
            <Pressable style={styles.productCta}>
              <HugeiconsIcon color={CARD_BG} icon={ShoppingCart01Icon} size={18} strokeWidth={2.3} />
              <Text style={styles.productCtaText}>View product</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

function StoreFooter({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  storeName,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  storeName: string | undefined;
}) {
  return (
    <View style={styles.footerWrap}>
      {hasNextPage ? (
        <Pressable disabled={isFetchingNextPage} style={[styles.loadMoreButton, isFetchingNextPage ? styles.loadMoreButtonDisabled : null]} onPress={onLoadMore}>
          {isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.loadMoreText}>Load more products</Text>}
        </Pressable>
      ) : null}

      <View style={styles.whyCard}>
        <View style={styles.whyIconWrap}>
          <HugeiconsIcon color={colors.primary} icon={Shield01Icon} size={30} strokeWidth={2.1} />
        </View>
        <View style={styles.whyCopy}>
          <Text style={styles.whyTitle}>Why shop from {storeName ?? "this store"}?</Text>
          <Text style={styles.whyText}>Quality products, secure payments and great customer service.</Text>
        </View>
        <View style={styles.whyBag}>
          <View style={styles.whyBagHandle} />
          <View style={styles.whyBagBody}>
            <HugeiconsIcon color={CARD_BG} icon={CheckmarkBadge02Icon} size={24} strokeWidth={2.1} />
          </View>
        </View>
        <HugeiconsIcon color={MUTED} icon={ArrowRight02Icon} size={24} strokeWidth={2.2} />
      </View>
    </View>
  );
}

function selectVisibleProducts(products: ProductSummary[], activeTab: ProductTab, sortMode: SortMode, filters: StoreProductFilters) {
  const now = Date.now();
  const filtered =
    activeTab === "new"
      ? products.filter((product) => {
          if (!product.createdAt) {
            return false;
          }

          const ageMs = now - new Date(product.createdAt).getTime();
          return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 60 * 24 * 60 * 60 * 1000;
        })
      : products;
  const source = activeTab === "new" && !filtered.length ? products : filtered;
  const filteredByConditions = source.filter((product) => matchesProductFilters(product, filters));

  return [...filteredByConditions].sort((a, b) => {
    if (activeTab === "top") {
      return (b.reviewSummary?.averageRating ?? 0) - (a.reviewSummary?.averageRating ?? 0);
    }
    if (sortMode === "newest") {
      return dateValue(b.createdAt) - dateValue(a.createdAt);
    }
    if (sortMode === "price_low") {
      return priceValue(a) - priceValue(b);
    }
    if (sortMode === "price_high") {
      return priceValue(b) - priceValue(a);
    }

    return 0;
  });
}

function matchesProductFilters(product: ProductSummary, filters: StoreProductFilters) {
  const variant = selectVariant(product);
  const price = productPriceValue(product);
  const rating = product.reviewSummary?.averageRating ?? 0;

  if (filters.availability === "in_stock" && !(variant && variant.stockQuantity > 0)) {
    return false;
  }
  if (filters.availability === "deals" && !productHasDeal(product)) {
    return false;
  }
  if (filters.rating === "four_plus" && rating < 4) {
    return false;
  }
  if (filters.price === "under_1000" && !(price < 100_000)) {
    return false;
  }
  if (filters.price === "between_1000_5000" && !(price >= 100_000 && price <= 500_000)) {
    return false;
  }
  if (filters.price === "over_5000" && !(price > 500_000)) {
    return false;
  }

  return true;
}

function selectVariant(product: ProductSummary): ProductVariant | undefined {
  return product.variants.find((variant) => variant.status === "ACTIVE" && variant.stockQuantity > 0) ?? product.variants[0];
}

function shortSellerLocation(store?: MobileStore) {
  const address = store?.addresses?.[0];
  if (!address) {
    return "Location added";
  }

  return [address.area, address.city].filter(Boolean).join(", ") || address.state || "Location added";
}

function sortLabel(sortMode: SortMode) {
  if (sortMode === "newest") {
    return "Newest";
  }
  if (sortMode === "price_low") {
    return "Price low";
  }
  if (sortMode === "price_high") {
    return "Price high";
  }

  return "Relevance";
}

function priceValue(product: ProductSummary) {
  const variant = selectVariant(product);
  return variant?.dealPricePaise ?? variant?.pricePaise ?? Number.MAX_SAFE_INTEGER;
}

function productPriceValue(product: ProductSummary) {
  const variant = selectVariant(product);
  return variant?.dealPricePaise ?? variant?.pricePaise ?? Number.MAX_SAFE_INTEGER;
}

function productHasDeal(product: ProductSummary) {
  const variant = selectVariant(product);
  const price = variant?.dealPricePaise ?? variant?.pricePaise;
  const mrp = variant?.originalPricePaise ?? variant?.mrpPaise ?? null;
  return Boolean(product.activeDeal || discountPercent(price, mrp));
}

function activeFilterCount(filters: StoreProductFilters) {
  return Number(filters.availability !== "all") + Number(filters.price !== "all") + Number(filters.rating !== "all");
}

function filterSummary(filters: StoreProductFilters, formatPrice: (pricePaise?: number | null) => string) {
  const parts = [
    filters.availability === "in_stock" ? "In stock" : filters.availability === "deals" ? "Deals only" : "",
    filters.price === "under_1000"
      ? `Under ${formatPrice(100_000)}`
      : filters.price === "between_1000_5000"
        ? `${formatPrice(100_000)} - ${formatPrice(500_000)}`
        : filters.price === "over_5000"
          ? `Above ${formatPrice(500_000)}`
          : "",
    filters.rating === "four_plus" ? "4.0+ rating" : "",
  ].filter(Boolean);

  return parts.join(" / ");
}

function dateValue(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function discountPercent(pricePaise?: number | null, mrpPaise?: number | null) {
  if (!pricePaise || !mrpPaise || mrpPaise <= pricePaise) {
    return 0;
  }

  return Math.max(1, Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100));
}

const styles = StyleSheet.create({
  approvedPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF2ED",
    borderColor: "#FFD4C6",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  benefitCopy: {
    flex: 1,
    minWidth: 0,
  },
  benefitDivider: {
    backgroundColor: BORDER,
    height: 48,
    width: 1,
  },
  benefitItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  benefitText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  benefitTitle: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
  },
  benefitsCard: {
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  circleButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "rgba(243,231,226,0.76)",
    borderRadius: 999,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    shadowColor: "#A64B2A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    width: 54,
    elevation: 2,
  },
  compareButton: {
    alignItems: "center",
    borderRightColor: BORDER,
    borderRightWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 64,
  },
  comparePlus: {
    borderColor: "#94A3B8",
    borderRadius: 999,
    borderWidth: 2,
    color: "#667085",
    fontSize: 20,
    fontWeight: "900",
    height: 24,
    lineHeight: 20,
    textAlign: "center",
    width: 24,
  },
  compareText: {
    color: "#667085",
    fontSize: 15,
    fontWeight: "900",
  },
  controlButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    flex: 1,
    gap: 7,
    justifyContent: "flex-start",
    minHeight: 60,
    paddingHorizontal: 16,
  },
  controlButtonActive: {
    backgroundColor: "#FFECE4",
    borderColor: "#FFD4C6",
  },
  controlCopy: {
    flex: 1,
    minWidth: 0,
  },
  controlRow: {
    flexDirection: "row",
    gap: 12,
  },
  controlSubText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  controlText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  filterGroup: {
    marginTop: 22,
  },
  filterGroupTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
  },
  filterSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "84%",
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  filterSummaryRow: {
    alignItems: "center",
    backgroundColor: "#FFF7F3",
    borderColor: "#FFE0D6",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  filterSummaryText: {
    color: "#7A4B3B",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  clearFilterText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  discountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: CARD_BG,
    fontSize: 13,
    fontWeight: "900",
    left: 12,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: "absolute",
    top: 12,
  },
  emptyScreen: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  emptyWrap: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  footerWrap: {
    gap: 18,
    paddingBottom: 30,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  headerStack: {
    gap: 18,
    marginTop: -72,
    paddingHorizontal: 18,
  },
  heartButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    shadowColor: "#9A3A19",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    top: 12,
    width: 50,
    elevation: 2,
  },
  heartButtonActive: {
    backgroundColor: "#FFF2ED",
    borderColor: "#FFD4C6",
  },
  heartButtonDisabled: {
    opacity: 0.74,
  },
  hero: {
    backgroundColor: SCREEN_BG,
    minHeight: 420,
    overflow: "hidden",
    paddingBottom: 104,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  heroActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-start",
    position: "relative",
    zIndex: 3,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroGlowOne: {
    backgroundColor: "rgba(237,53,0,0.08)",
    borderRadius: 999,
    height: 180,
    position: "absolute",
    right: -74,
    top: 88,
    width: 180,
  },
  heroGlowTwo: {
    backgroundColor: "rgba(255,255,255,0.84)",
    borderRadius: 999,
    height: 220,
    left: -90,
    position: "absolute",
    top: 86,
    width: 220,
  },
  heroImage: {
    height: 290,
    opacity: 0.38,
    position: "absolute",
    right: -18,
    top: 22,
    width: "66%",
  },
  heroImageWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,252,251,0.72)",
  },
  heroProfile: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    marginTop: 46,
    position: "relative",
    zIndex: 2,
  },
  heroPillRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  heroText: {
    color: "#475467",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 12,
  },
  heroTitle: {
    color: TEXT,
    flex: 1,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 36,
  },
  listContent: {
    paddingBottom: 22,
  },
  loadMoreButton: {
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 56,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  loadMoreButtonDisabled: {
    backgroundColor: "#F8FAFC",
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  locationPill: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    borderColor: "#FFD4C6",
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    maxWidth: "100%",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  locationPillText: {
    color: "#7A4B3B",
    fontSize: 13,
    fontWeight: "900",
    maxWidth: 170,
  },
  logoFrame: {
    backgroundColor: "#FFF3EE",
    borderColor: "rgba(255,255,255,0.86)",
    borderRadius: 28,
    borderWidth: 3,
    height: 132,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    width: 132,
    elevation: 2,
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(17,24,39,0.22)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  mrpText: {
    color: "#98A2B3",
    fontSize: 14,
    fontWeight: "800",
    textDecorationLine: "line-through",
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  priceText: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 23,
    fontWeight: "900",
    minWidth: 0,
  },
  productActions: {
    borderTopColor: BORDER,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 66,
  },
  productBody: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 20,
    minHeight: 248,
    padding: 16,
  },
  productCard: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 8,
    marginHorizontal: 18,
    marginTop: 24,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 3,
  },
  productCountText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "800",
  },
  productCta: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 17,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  productCtaText: {
    color: CARD_BG,
    fontSize: 13,
    fontWeight: "900",
  },
  productImage: {
    height: "100%",
    width: "100%",
  },
  productImageWrap: {
    backgroundColor: "#FBF4F1",
    borderColor: "#FFF0EA",
    borderWidth: 1,
    borderRadius: 24,
    flex: 0.48,
    minHeight: 216,
    overflow: "hidden",
  },
  productInfo: {
    flex: 0.52,
    justifyContent: "center",
    minWidth: 0,
    paddingVertical: 4,
  },
  productName: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  productRating: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
  },
  productSeller: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
  },
  productsMetaRow: {
    borderTopColor: BORDER,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: 16,
  },
  productsPanel: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  productBadgeLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 10,
  },
  reviewText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
  safeArea: {
    backgroundColor: SCREEN_BG,
    flex: 1,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
  },
  searchInput: {
    color: TEXT,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 58,
    minWidth: 0,
  },
  sortText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  statColumn: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  statLabel: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "900",
  },
  statsCard: {
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 126,
    paddingHorizontal: 12,
    paddingVertical: 18,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 2,
  },
  statValue: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "900",
    maxWidth: "100%",
    textAlign: "center",
  },
  stockPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 10,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stockPillIn: {
    backgroundColor: "#DCFCE7",
    color: "#128143",
  },
  stockPillOut: {
    backgroundColor: "#FEE2E2",
    color: "#B42318",
  },
  tabButton: {
    flex: 1,
    gap: 12,
    minHeight: 46,
  },
  tabRow: {
    flexDirection: "row",
    gap: 18,
  },
  tabText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabUnderline: {
    backgroundColor: "transparent",
    borderRadius: 999,
    height: 2,
  },
  tabUnderlineActive: {
    backgroundColor: colors.primary,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  verticalRule: {
    backgroundColor: BORDER,
    height: 72,
    width: 1,
  },
  whyBag: {
    alignItems: "center",
    height: 68,
    justifyContent: "flex-end",
    width: 70,
  },
  whyBagBody: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 50,
    justifyContent: "center",
    width: 52,
  },
  whyBagHandle: {
    borderColor: "#FFB28E",
    borderRadius: 999,
    borderWidth: 2,
    height: 34,
    position: "absolute",
    top: 0,
    width: 34,
  },
  whyCard: {
    alignItems: "center",
    backgroundColor: "#FFF1EB",
    borderColor: "#FFE0D6",
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 110,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  whyCopy: {
    flex: 1,
    minWidth: 0,
  },
  whyIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 999,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  whyText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  whyTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionPill: {
    backgroundColor: "#FFF7F3",
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionPillText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "900",
  },
  optionPillTextActive: {
    color: CARD_BG,
  },
  sheetActions: {
    borderTopColor: BORDER,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingTop: 14,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#E8DAD4",
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 46,
  },
  sheetHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  sheetSubtitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  sheetTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "900",
  },
  sheetTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  closeButton: {
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  closeButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  resetButton: {
    alignItems: "center",
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
  },
  resetButtonText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "900",
  },
  applyButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
  },
  applyButtonText: {
    color: CARD_BG,
    fontSize: 14,
    fontWeight: "900",
  },
});
