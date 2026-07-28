import {
  Add01Icon,
  Archive01Icon,
  ArrowRight01Icon,
  Edit02Icon,
  PackageIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  Button,
  ConfirmDialog,
  Header,
  QueryErrorState,
  Screen,
  Skeleton,
  StatusChip,
  Toast,
} from "../../src/components/screen";
import {
  PRODUCT_CATALOGUE_FILTERS,
  buildProductCatalogueQuery,
  productCatalogueStatuses,
  productPrimaryImage,
  summarizeProductVariants,
  type ProductCatalogueFilter,
} from "../../src/features/seller/product-catalogue";
import {
  archiveSellerProduct,
  listSellerProducts,
  type PageResult,
  type ProductSummary,
} from "../../src/features/seller/seller-api";
import { resolvePublicImageUri } from "../../src/lib/api";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

const PAGE_SIZE = 30;
const TABLET_BREAKPOINT = 700;

type ProductPages = InfiniteData<PageResult<ProductSummary>, number>;
type ToastState = { visible: boolean; message: string; type: "success" | "error" };

export default function SellerProductsScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ProductCatalogueFilter>("all");
  const [archiveProduct, setArchiveProduct] = useState<ProductSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const catalogueQuery = useMemo(
    () => buildProductCatalogueQuery(activeFilter, debouncedSearch),
    [activeFilter, debouncedSearch],
  );
  const productQueryKey = [
    "seller-products",
    auth.authKey,
    activeFilter,
    catalogueQuery.search ?? "",
  ] as const;
  const productsQuery = useInfiniteQuery({
    queryKey: productQueryKey,
    queryFn: ({ pageParam }) =>
      listSellerProducts(auth.authHeaders, {
        ...catalogueQuery,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    enabled: auth.enabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    placeholderData: (previous) => previous,
    retry: false,
  });
  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data?.pages],
  );
  const totalProducts = productsQuery.data?.pages[0]?.total ?? products.length;
  const columnCount = width >= TABLET_BREAKPOINT ? 2 : 1;
  const searchNeedsMoreCharacters = searchValue.trim().length === 1;
  const hasActiveSearch = Boolean(catalogueQuery.search);
  const updating =
    productsQuery.isFetching
    && !productsQuery.isFetchingNextPage
    && !refreshing
    && products.length > 0;

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => archiveSellerProduct(auth.authHeaders, productId),
    onSuccess: (_product, productId) => {
      queryClient.setQueryData<ProductPages>(productQueryKey, (current) =>
        removeProductFromPages(current, productId),
      );
      setToast({ visible: true, message: "Product archived.", type: "success" });
      void queryClient.invalidateQueries({ queryKey: ["seller-products", auth.authKey] });
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Product could not be archived.",
        type: "error",
      });
    },
  });

  async function refreshCatalogue() {
    setRefreshing(true);
    try {
      await productsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function resetFilters() {
    setSearchValue("");
    setDebouncedSearch("");
    setActiveFilter("all");
  }

  if (!auth.enabled || (productsQuery.isLoading && !productsQuery.data)) {
    return <ProductCatalogueSkeleton />;
  }

  if (productsQuery.isError && !productsQuery.data) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <Header title="Products" subtitle="Manage your catalogue, approval status, price, and stock." />
        <QueryErrorState
          title="Products could not be loaded"
          message={productsQuery.error instanceof Error ? productsQuery.error.message : undefined}
          onRetry={() => {
            void productsQuery.refetch();
          }}
          retrying={productsQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={styles.screen}>
      <FlatList
        key={`product-grid-${columnCount}`}
        data={products}
        keyExtractor={(product) => product.id}
        numColumns={columnCount}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          products.length === 0 ? styles.emptyListContent : null,
        ]}
        {...(columnCount > 1 ? { columnWrapperStyle: styles.columnRow } : {})}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => {
              void refreshCatalogue();
            }}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <CatalogueHeader
            activeFilter={activeFilter}
            error={
              productsQuery.isError && !productsQuery.isFetchNextPageError
                ? productsQuery.error
                : null
            }
            onAdd={() => router.push("/products/new" as Href)}
            onFilterChange={setActiveFilter}
            onRetry={() => {
              void productsQuery.refetch();
            }}
            searchNeedsMoreCharacters={searchNeedsMoreCharacters}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            totalProducts={totalProducts}
            updating={updating}
          />
        }
        ListEmptyComponent={
          <CatalogueEmptyState
            filtered={activeFilter !== "all" || hasActiveSearch}
            onAdd={() => router.push("/products/new" as Href)}
            onReset={resetFilters}
          />
        }
        ListFooterComponent={
          <CatalogueFooter
            hasNextPage={Boolean(productsQuery.hasNextPage)}
            isError={productsQuery.isFetchNextPageError}
            loading={productsQuery.isFetchingNextPage}
            onLoadMore={() => {
              void productsQuery.fetchNextPage();
            }}
            productCount={products.length}
          />
        }
        ItemSeparatorComponent={ProductRowSeparator}
        renderItem={({ item }) => (
          <View style={[styles.itemCell, columnCount > 1 ? styles.tabletItemCell : null]}>
            <ProductCatalogueCard
              archiving={archiveMutation.isPending && archiveMutation.variables === item.id}
              product={item}
              onArchive={() => setArchiveProduct(item)}
              onEdit={() => router.push(`/products/${encodeURIComponent(item.id)}` as Href)}
              onOpen={() => router.push(`/products/detail/${encodeURIComponent(item.id)}` as Href)}
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      <ConfirmDialog
        visible={Boolean(archiveProduct)}
        title="Archive product"
        message={
          archiveProduct
            ? `Archive "${archiveProduct.name}"? It will leave your catalogue and cannot be restored from the seller app.`
            : ""
        }
        confirmLabel="Archive"
        onConfirm={() => {
          if (!archiveProduct || archiveMutation.isPending) return;
          const productId = archiveProduct.id;
          setArchiveProduct(null);
          archiveMutation.mutate(productId);
        }}
        onCancel={() => setArchiveProduct(null)}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );
}

function CatalogueHeader({
  activeFilter,
  error,
  onAdd,
  onFilterChange,
  onRetry,
  searchNeedsMoreCharacters,
  searchValue,
  setSearchValue,
  totalProducts,
  updating,
}: {
  activeFilter: ProductCatalogueFilter;
  error: unknown;
  onAdd: () => void;
  onFilterChange: (filter: ProductCatalogueFilter) => void;
  onRetry: () => void;
  searchNeedsMoreCharacters: boolean;
  searchValue: string;
  setSearchValue: (value: string) => void;
  totalProducts: number;
  updating: boolean;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>1HandIndia Seller Hub</Text>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>Products</Text>
          <Text style={styles.subtitle}>
            {updating
              ? "Updating catalogue..."
              : `${totalProducts} ${totalProducts === 1 ? "product" : "products"} in this view`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Add product"
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
        >
          <HugeiconsIcon icon={Add01Icon} color={colors.surface} size={20} strokeWidth={2.3} />
          <Text style={styles.addButtonText}>Add product</Text>
        </Pressable>
      </View>

      <View style={styles.searchField}>
        <HugeiconsIcon icon={Search01Icon} color={colors.muted} size={20} strokeWidth={2} />
        <TextInput
          accessibilityLabel="Search products"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setSearchValue}
          placeholder="Search by product name or description"
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={styles.searchInput}
          value={searchValue}
        />
      </View>
      {searchNeedsMoreCharacters ? (
        <Text style={styles.searchHint}>Enter at least 2 characters to search.</Text>
      ) : null}

      <ScrollView
        horizontal
        contentContainerStyle={styles.filterContent}
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        {PRODUCT_CATALOGUE_FILTERS.map((filter) => {
          const selected = filter.value === activeFilter;
          return (
            <Pressable
              key={filter.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onFilterChange(filter.value)}
              style={({ pressed }) => [
                styles.filterButton,
                selected ? styles.filterButtonSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.filterText, selected ? styles.filterTextSelected : null]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.inlineError}>
          <View style={styles.inlineErrorCopy}>
            <Text style={styles.inlineErrorTitle}>Catalogue could not be updated</Text>
            <Text style={styles.inlineErrorText}>
              {error instanceof Error ? error.message : "Check your connection and try again."}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ProductCatalogueCard({
  archiving,
  onArchive,
  onEdit,
  onOpen,
  product,
}: {
  archiving: boolean;
  onArchive: () => void;
  onEdit: () => void;
  onOpen: () => void;
  product: ProductSummary;
}) {
  const imageUri = resolvePublicImageUri(productPrimaryImage(product));
  const summary = summarizeProductVariants(product);
  const statuses = productCatalogueStatuses(product);
  const stockWarning = stockWarningLabel(summary);

  return (
    <View style={styles.productCard}>
      <Pressable
        accessibilityLabel={`Open ${product.name}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.productContent, pressed ? styles.pressedSurface : null]}
      >
        <View style={styles.productMainRow}>
          {imageUri ? (
            <Image
              accessibilityLabel={product.name}
              contentFit="cover"
              source={{ uri: imageUri }}
              style={styles.productImage}
              transition={120}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <HugeiconsIcon icon={PackageIcon} color={colors.primary} size={30} strokeWidth={1.8} />
            </View>
          )}

          <View style={styles.productInfo}>
            <View style={styles.productTitleRow}>
              <Text numberOfLines={2} style={styles.productName}>
                {product.name}
              </Text>
              <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={18} strokeWidth={2} />
            </View>
            <Text numberOfLines={1} style={styles.category}>
              {product.category?.name ?? "Uncategorised product"}
            </Text>
            <View style={styles.statusRow}>
              <StatusChip label={statuses.lifecycle.label} tone={statuses.lifecycle.tone} />
              <StatusChip label={statuses.approval.label} tone={statuses.approval.tone} />
            </View>
          </View>
        </View>

        <View style={styles.commercialSummary}>
          <Text numberOfLines={1} style={styles.price}>
            {productPriceLabel(summary)}
          </Text>
          <Text numberOfLines={1} style={styles.stockSummary}>
            {variantStockLabel(summary.variantCount, summary.totalStock)}
          </Text>
          {stockWarning ? (
            <Text
              numberOfLines={1}
              style={[
                styles.stockWarning,
                summary.outOfStockCount > 0 ? styles.stockDanger : null,
              ]}
            >
              {stockWarning}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityLabel={`Edit ${product.name}`}
          accessibilityRole="button"
          onPress={onEdit}
          style={({ pressed }) => [styles.cardAction, pressed ? styles.pressedSurface : null]}
        >
          <HugeiconsIcon icon={Edit02Icon} color={colors.primary} size={19} strokeWidth={2.1} />
          <Text style={styles.editActionText}>Edit</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable
          accessibilityLabel={`Archive ${product.name}`}
          accessibilityRole="button"
          disabled={archiving}
          onPress={onArchive}
          style={({ pressed }) => [
            styles.cardAction,
            archiving ? styles.disabled : null,
            pressed ? styles.pressedSurface : null,
          ]}
        >
          {archiving ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <HugeiconsIcon icon={Archive01Icon} color={colors.danger} size={19} strokeWidth={2.1} />
          )}
          <Text style={styles.archiveActionText}>{archiving ? "Archiving" : "Archive"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CatalogueEmptyState({
  filtered,
  onAdd,
  onReset,
}: {
  filtered: boolean;
  onAdd: () => void;
  onReset: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <HugeiconsIcon icon={PackageIcon} color={colors.primary} size={32} strokeWidth={1.9} />
      </View>
      <Text style={styles.emptyTitle}>{filtered ? "No matching products" : "Add your first product"}</Text>
      <Text style={styles.emptyText}>
        {filtered
          ? "Try another search or clear the selected catalogue filter."
          : "Create a listing with images, variants, GST details, pricing, stock, and delivery information."}
      </Text>
      <Button
        title={filtered ? "Clear filters" : "Add product"}
        tone={filtered ? "secondary" : "primary"}
        onPress={filtered ? onReset : onAdd}
        style={styles.emptyButton}
      />
    </View>
  );
}

function CatalogueFooter({
  hasNextPage,
  isError,
  loading,
  onLoadMore,
  productCount,
}: {
  hasNextPage: boolean;
  isError: boolean;
  loading: boolean;
  onLoadMore: () => void;
  productCount: number;
}) {
  if (!productCount) return null;

  if (isError) {
    return (
      <View style={styles.footerState}>
        <Text style={styles.footerError}>More products could not be loaded.</Text>
        <Button title="Retry" tone="secondary" onPress={onLoadMore} style={styles.footerButton} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.footerText}>Loading more products...</Text>
      </View>
    );
  }

  if (hasNextPage) {
    return (
      <Button title="Load more products" tone="secondary" onPress={onLoadMore} style={styles.loadMoreButton} />
    );
  }

  return <Text style={styles.endText}>All products in this view are shown.</Text>;
}

function ProductCatalogueSkeleton() {
  return (
    <Screen contentContainerStyle={styles.skeletonScreen}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonEyebrow}>
          <Skeleton height={12} />
        </View>
        <View style={styles.skeletonTitle}>
          <Skeleton height={34} />
        </View>
        <Skeleton height={48} />
        <Skeleton height={44} />
      </View>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <Skeleton height={96} />
          <Skeleton height={42} />
        </View>
      ))}
    </Screen>
  );
}

function ProductRowSeparator() {
  return <View style={styles.rowSeparator} />;
}

function productPriceLabel(summary: ReturnType<typeof summarizeProductVariants>) {
  if (summary.minPricePaise === null || summary.maxPricePaise === null) {
    return "Price not configured";
  }

  const minimum = formatMoney(summary.minPricePaise, summary.currency);
  return summary.minPricePaise === summary.maxPricePaise
    ? minimum
    : `${minimum} - ${formatMoney(summary.maxPricePaise, summary.currency)}`;
}

function variantStockLabel(variantCount: number, totalStock: number) {
  if (!variantCount) return "No variants configured";
  return `${variantCount} ${variantCount === 1 ? "variant" : "variants"} | ${totalStock} units`;
}

function stockWarningLabel(summary: ReturnType<typeof summarizeProductVariants>) {
  const labels: string[] = [];
  if (summary.outOfStockCount) {
    labels.push(`${summary.outOfStockCount} out of stock`);
  }
  if (summary.lowStockCount) {
    labels.push(`${summary.lowStockCount} low stock`);
  }
  return labels.join(" | ");
}

function removeProductFromPages(
  current: ProductPages | undefined,
  productId: string,
): ProductPages | undefined {
  if (!current || !current.pages.some((page) => page.items.some((product) => product.id === productId))) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.filter((product) => product.id !== productId),
      total: page.total > 0 ? page.total - 1 : 0,
    })),
  };
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
    padding: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  columnRow: {
    gap: spacing.sm,
  },
  rowSeparator: {
    height: spacing.sm,
  },
  itemCell: {
    flex: 1,
  },
  tabletItemCell: {
    flexBasis: "48%",
    maxWidth: "49.4%",
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    paddingTop: spacing.lg,
    textTransform: "uppercase",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  titleCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
  pressedSurface: {
    backgroundColor: colors.softSurface,
  },
  searchField: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingVertical: 0,
  },
  searchHint: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
    marginTop: -spacing.sm,
  },
  filterScroll: {
    marginHorizontal: -spacing.lg,
  },
  filterContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  filterButtonSelected: {
    backgroundColor: colors.softSurface,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  filterTextSelected: {
    color: colors.primary,
  },
  inlineError: {
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderColor: "#F4C2C2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  inlineErrorCopy: {
    flex: 1,
    gap: 2,
  },
  inlineErrorTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  inlineErrorText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  retryButton: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: spacing.sm,
  },
  retryButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  productCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden",
  },
  productContent: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  productMainRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  productImage: {
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 92,
    width: 92,
  },
  imagePlaceholder: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 92,
    justifyContent: "center",
    width: 92,
  },
  productInfo: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  productTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
  },
  productName: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  category: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  commercialSummary: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 3,
    paddingTop: spacing.sm,
  },
  price: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  stockSummary: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  stockWarning: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "900",
  },
  stockDanger: {
    color: colors.danger,
  },
  actionRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 48,
  },
  cardAction: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  actionDivider: {
    backgroundColor: colors.border,
    width: 1,
  },
  editActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  archiveActionText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
  emptyState: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: "center",
    maxWidth: 480,
    padding: spacing.xl,
    width: "100%",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: spacing.sm,
    minWidth: 160,
  },
  footerState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  footerError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  footerButton: {
    minWidth: 120,
  },
  loadingMore: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingTop: spacing.sm,
  },
  footerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  loadMoreButton: {
    alignSelf: "center",
    marginTop: spacing.lg,
    minWidth: 180,
  },
  endText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    paddingTop: spacing.lg,
    textAlign: "center",
  },
  errorScreen: {
    gap: spacing.lg,
  },
  skeletonScreen: {
    gap: spacing.sm,
  },
  skeletonHeader: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  skeletonEyebrow: {
    width: 150,
  },
  skeletonTitle: {
    width: 190,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
});
