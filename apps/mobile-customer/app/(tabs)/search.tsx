import {
  ArrowLeft02Icon,
  Clock01Icon,
  FilterHorizontalIcon,
  GridViewIcon,
  HeartIcon,
  Search01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RemoteImage } from "../../src/components/remote-image";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { getSearchSuggestions, listCategories, searchStorefront } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { useSearchHistoryStore } from "../../src/state/search-history-store";
import { colors } from "../../src/theme";
import type { MobileCategory } from "../../src/types/mobile-home";
import type { SearchSuggestion, StorefrontSearchItem } from "../../src/types/storefront";

type SearchTypeFilter = "all" | "product" | "store" | "category";
type SearchFeedItem =
  | { id: "suggestions"; type: "suggestions"; suggestions: SearchSuggestion[]; isLoading: boolean }
  | { id: "recent"; type: "recent"; recentSearches: string[] }
  | { id: "categories"; type: "categories"; categories: MobileCategory[]; isLoading: boolean }
  | { id: "results-header"; type: "results-header"; count: number; filter: SearchTypeFilter }
  | { id: "loading-results"; type: "loading-results" }
  | { id: "error"; type: "error"; query: string }
  | { id: "empty"; type: "empty"; query: string }
  | { id: string; type: "result"; result: StorefrontSearchItem }
  | { id: "loading-more"; type: "loading-more" };

type SearchProductVariant = NonNullable<Extract<StorefrontSearchItem, { type: "product" }>["product"]["variants"]>[number] & {
  stockQuantity?: number | null;
};

const searchLimit = 20;
const textColor = "#111827";
const mutedColor = "#6B7280";
const borderColor = "#F3E7E2";
const cardShadow = {
  shadowColor: colors.primary,
  shadowOffset: { height: 8, width: 0 },
  shadowOpacity: 0.06,
  shadowRadius: 30,
  elevation: 2,
};

const filterOptions: Array<{ value: SearchTypeFilter; label: string; description: string }> = [
  { value: "all", label: "All", description: "Products, shops, and categories" },
  { value: "product", label: "Products", description: "Marketplace product listings" },
  { value: "store", label: "Stores", description: "Approved local shops" },
  { value: "category", label: "Categories", description: "Product departments" },
];

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; type?: string }>();
  const market = useMobileMarket();
  const paramQuery = paramValue(params.q);
  const paramType = parseSearchType(paramValue(params.type));
  const [queryText, setQueryText] = useState(paramQuery);
  const [submittedQuery, setSubmittedQuery] = useState(paramQuery.trim());
  const [activeType, setActiveType] = useState<SearchTypeFilter>(paramType);
  const [filterOpen, setFilterOpen] = useState(false);
  const recentSearches = useSearchHistoryStore((state) => state.recentSearches);
  const addRecentSearch = useSearchHistoryStore((state) => state.addRecentSearch);
  const removeRecentSearch = useSearchHistoryStore((state) => state.removeRecentSearch);
  const clearRecentSearches = useSearchHistoryStore((state) => state.clearRecentSearches);
  const debouncedQuery = useDebouncedValue(queryText.trim(), 260);
  const hasCommittedQuery = submittedQuery.trim().length >= 2;
  const suggestionsEnabled =
    debouncedQuery.length >= 2 && debouncedQuery.toLocaleLowerCase() !== submittedQuery.trim().toLocaleLowerCase();

  useEffect(() => {
    setQueryText(paramQuery);
    setSubmittedQuery(paramQuery.trim());
    setActiveType(paramType);
  }, [paramQuery, paramType]);

  const categoriesQuery = useQuery({
    queryKey: ["mobile-search-categories"],
    queryFn: () => listCategories(),
    staleTime: 5 * 60 * 1000,
  });
  const suggestionsQuery = useQuery({
    queryKey: ["mobile-search-suggestions", debouncedQuery],
    queryFn: () => getSearchSuggestions(debouncedQuery),
    enabled: suggestionsEnabled,
    staleTime: 30_000,
  });
  const searchQuery = useInfiniteQuery({
    queryKey: ["mobile-storefront-search", submittedQuery.trim(), activeType],
    queryFn: ({ pageParam }) =>
      searchStorefront({
        q: submittedQuery.trim(),
        limit: searchLimit,
        cursor: pageParam,
        ...(activeType !== "all" ? { type: activeType } : {}),
      }),
    enabled: hasCommittedQuery,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    retry: false,
  });

  const loadedResults = useMemo(
    () => searchQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [searchQuery.data?.pages],
  );
  const feedItems = useMemo<SearchFeedItem[]>(() => {
    const items: SearchFeedItem[] = [];
    const suggestions = suggestionsQuery.data?.suggestions ?? [];

    if (suggestionsEnabled && (suggestionsQuery.isFetching || suggestions.length)) {
      items.push({ id: "suggestions", type: "suggestions", suggestions, isLoading: suggestionsQuery.isFetching && !suggestions.length });
    }

    if (recentSearches.length) {
      items.push({ id: "recent", type: "recent", recentSearches });
    }

    if (categoriesQuery.isLoading || (!categoriesQuery.isError && (categoriesQuery.data?.length ?? 0) > 0)) {
      items.push({
        id: "categories",
        type: "categories",
        categories: categoriesQuery.data ?? [],
        isLoading: categoriesQuery.isLoading,
      });
    }

    if (hasCommittedQuery) {
      items.push({ id: "results-header", type: "results-header", count: loadedResults.length, filter: activeType });
      if (searchQuery.isLoading) {
        items.push({ id: "loading-results", type: "loading-results" });
      } else if (searchQuery.isError) {
        items.push({ id: "error", type: "error", query: submittedQuery.trim() });
      } else if (!loadedResults.length) {
        items.push({ id: "empty", type: "empty", query: submittedQuery.trim() });
      } else {
        loadedResults.forEach((result, index) => {
          items.push({ id: `result-${index}-${resultIdentifier(result)}`, type: "result", result });
        });
      }

      if (searchQuery.isFetchingNextPage) {
        items.push({ id: "loading-more", type: "loading-more" });
      }
    }

    return items;
  }, [
    activeType,
    categoriesQuery.data,
    categoriesQuery.isError,
    categoriesQuery.isLoading,
    hasCommittedQuery,
    loadedResults,
    recentSearches,
    searchQuery.isError,
    searchQuery.isFetchingNextPage,
    searchQuery.isLoading,
    submittedQuery,
    suggestionsEnabled,
    suggestionsQuery.data?.suggestions,
    suggestionsQuery.isFetching,
  ]);

  function writeSearchUrl(nextQuery: string, nextType: SearchTypeFilter) {
    const q = nextQuery.trim();
    const urlParams: Record<string, string> = {};
    if (q) {
      urlParams.q = q;
    }
    if (q && nextType !== "all") {
      urlParams.type = nextType;
    }

    router.replace({ pathname: "/search", params: urlParams } as Href);
  }

  function commitSearch(text = queryText, nextType = activeType) {
    const q = normalizeSearchTerm(text);
    if (q.length < 2) {
      clearSearch();
      return;
    }

    setQueryText(q);
    setSubmittedQuery(q);
    setActiveType(nextType);
    addRecentSearch(q);
    writeSearchUrl(q, nextType);
  }

  function clearSearch() {
    setQueryText("");
    setSubmittedQuery("");
    setActiveType("all");
    setFilterOpen(false);
    writeSearchUrl("", "all");
  }

  function updateQueryText(value: string) {
    setQueryText(value);
    if (!value.trim() && hasCommittedQuery) {
      setSubmittedQuery("");
      setActiveType("all");
      writeSearchUrl("", "all");
    }
  }

  function selectFilter(nextType: SearchTypeFilter) {
    setActiveType(nextType);
    setFilterOpen(false);
    if (hasCommittedQuery) {
      writeSearchUrl(submittedQuery, nextType);
    }
  }

  function goBack() {
    const navigationRouter = router as typeof router & { canGoBack?: () => boolean };
    if (navigationRouter.canGoBack?.()) {
      router.back();
      return;
    }

    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable accessibilityRole="button" style={styles.backButton} onPress={goBack}>
            <HugeiconsIcon color={textColor} icon={ArrowLeft02Icon} size={27} strokeWidth={2.35} />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Search Marketplace</Text>
            <Text style={styles.subtitle}>Find products, categories, and local shops</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <HugeiconsIcon color="#7A8496" icon={Search01Icon} size={28} strokeWidth={2.15} />
          <TextInput
            autoCapitalize="none"
            onChangeText={updateQueryText}
            onSubmitEditing={() => commitSearch()}
            placeholder="Search marketplace"
            placeholderTextColor="#8993A5"
            returnKeyType="search"
            style={styles.searchInput}
            value={queryText}
          />
          {queryText ? (
            <Pressable accessibilityRole="button" style={styles.clearInputButton} onPress={clearSearch}>
              <Text style={styles.clearInputText}>x</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.searchButton} onPress={() => commitSearch()}>
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
      </View>

      <FlashList
        contentContainerStyle={styles.listContent}
        data={feedItems}
        getItemType={(item) => item.type}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (hasCommittedQuery && searchQuery.hasNextPage && !searchQuery.isFetchingNextPage) {
            void searchQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => {
          if (item.type === "suggestions") {
            return <SuggestionsSection isLoading={item.isLoading} suggestions={item.suggestions} onSelect={(title) => commitSearch(title)} />;
          }
          if (item.type === "recent") {
            return (
              <RecentSearchesSection
                recentSearches={item.recentSearches}
                onClearAll={clearRecentSearches}
                onRemove={removeRecentSearch}
                onSelect={(term) => commitSearch(term)}
              />
            );
          }
          if (item.type === "categories") {
            return <PopularCategoriesSection categories={item.categories} isLoading={item.isLoading} />;
          }
          if (item.type === "results-header") {
            return <ResultsHeader activeType={item.filter} count={item.count} onOpenFilters={() => setFilterOpen(true)} />;
          }
          if (item.type === "loading-results") {
            return <LoadingState label="Searching marketplace..." />;
          }
          if (item.type === "error") {
            return <SearchErrorState onRetry={() => void searchQuery.refetch()} />;
          }
          if (item.type === "empty") {
            return <SearchEmptyState query={item.query} />;
          }
          if (item.type === "loading-more") {
            return <LoadingState compact label="Loading more results..." />;
          }

          return <SearchResultCard formatPrice={market.format} result={item.result} />;
        }}
      />

      <FilterModal activeType={activeType} open={filterOpen} onClose={() => setFilterOpen(false)} onSelect={selectFilter} />
    </SafeAreaView>
  );
}

function SuggestionsSection({
  isLoading,
  suggestions,
  onSelect,
}: {
  isLoading: boolean;
  suggestions: SearchSuggestion[];
  onSelect: (title: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Suggestions</Text>
      </View>
      {isLoading ? <SuggestionSkeleton /> : null}
      {suggestions.map((suggestion) => (
        <Pressable key={`${suggestion.type}-${suggestion.id}`} style={styles.suggestionRow} onPress={() => onSelect(suggestion.title)}>
          <SearchThumb fallbackLabel={suggestion.title} imageUrl={suggestion.imageUrl ?? null} type={suggestion.type} />
          <View style={styles.suggestionCopy}>
            <Text numberOfLines={1} style={styles.suggestionTitle}>
              {suggestion.title}
            </Text>
            <Text numberOfLines={1} style={styles.suggestionText}>
              {suggestion.subtitle ?? displayTypeLabel(suggestion.type)}
            </Text>
          </View>
          <Text style={styles.resultKind}>{displayTypeLabel(suggestion.type)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RecentSearchesSection({
  recentSearches,
  onClearAll,
  onRemove,
  onSelect,
}: {
  recentSearches: string[];
  onClearAll: () => void;
  onRemove: (term: string) => void;
  onSelect: (term: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Searches</Text>
        <Pressable onPress={onClearAll}>
          <Text style={styles.clearAllText}>Clear all</Text>
        </Pressable>
      </View>
      <View style={styles.chipWrap}>
        {recentSearches.map((term) => (
          <Pressable key={term.toLocaleLowerCase()} style={styles.recentChip} onPress={() => onSelect(term)}>
            <HugeiconsIcon color={mutedColor} icon={Clock01Icon} size={17} strokeWidth={2} />
            <Text numberOfLines={1} style={styles.recentChipText}>
              {term}
            </Text>
            <Pressable hitSlop={8} onPress={() => onRemove(term)}>
              <Text style={styles.removeChipText}>x</Text>
            </Pressable>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PopularCategoriesSection({ categories, isLoading }: { categories: MobileCategory[]; isLoading: boolean }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular Categories</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => <View key={`category-skeleton-${index}`} style={styles.categorySkeletonCard} />)
          : categories.slice(0, 12).map((category) => <PopularCategoryCard category={category} key={category.id} />)}
      </ScrollView>
    </View>
  );
}

function PopularCategoryCard({ category }: { category: MobileCategory }) {
  const imageUrl = resolveImageUrl(category.imageUrl);

  return (
    <Link asChild href={`/category/${category.slug}` as Href}>
      <Pressable style={styles.categoryCard}>
        <RemoteImage fallbackLabel={category.name} resizeMode="contain" style={styles.categoryImage} uri={imageUrl} />
        <Text numberOfLines={1} style={styles.categoryTitle}>
          {category.name}
        </Text>
      </Pressable>
    </Link>
  );
}

function ResultsHeader({
  activeType,
  count,
  onOpenFilters,
}: {
  activeType: SearchTypeFilter;
  count: number;
  onOpenFilters: () => void;
}) {
  return (
    <View style={[styles.section, styles.resultsHeaderSection]}>
      <View style={styles.resultHeaderRow}>
        <Text style={styles.resultHeaderText}>
          Search Results <Text style={styles.resultHeaderMuted}>({count} {count === 1 ? "result" : "results"})</Text>
        </Text>
        <Pressable style={styles.filterButton} onPress={onOpenFilters}>
          <HugeiconsIcon color={mutedColor} icon={FilterHorizontalIcon} size={20} strokeWidth={2.1} />
          <Text style={styles.filterButtonText}>{filterButtonLabel(activeType)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SearchResultCard({
  formatPrice,
  result,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  result: StorefrontSearchItem;
}) {
  if (result.type === "product") {
    return <ProductResultCard formatPrice={formatPrice} result={result} />;
  }
  if (result.type === "store") {
    return <StoreResultCard result={result} />;
  }

  return <CategoryResultCard result={result} />;
}

function ProductResultCard({
  formatPrice,
  result,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  result: Extract<StorefrontSearchItem, { type: "product" }>;
}) {
  const product = result.product;
  const imageUrl = resolveImageUrl(product.images?.[0]?.url);
  const variant = product.variants?.[0] as SearchProductVariant | undefined;
  const mrpPaise = variant?.mrpPaise ?? null;
  const pricePaise = variant?.pricePaise ?? null;
  const stockQuantity = variantStockQuantity(variant);
  const stockLabel = stockQuantity !== null && stockQuantity <= 0 ? "Out of stock" : "In stock";
  const storeName = product.seller?.storeName ?? "1HandIndia seller";

  return (
    <Link asChild href={`/product/${product.slug}` as Href}>
      <Pressable style={styles.resultCard}>
        <View style={styles.productImageWrap}>
          <RemoteImage fallbackLabel={product.name} resizeMode="contain" style={styles.productImage} uri={imageUrl} />
        </View>
        <View style={styles.productResultInfo}>
          <Text numberOfLines={2} style={styles.productResultTitle}>
            {product.name}
          </Text>
          <Text numberOfLines={1} style={styles.resultMetaText}>
            {storeName} - Product
          </Text>
          <View style={styles.badgeRow}>
            <Text style={styles.stockPill}>{stockLabel}</Text>
            <Text style={styles.newBadge}>New</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{formatPrice(pricePaise)}</Text>
            {mrpPaise && pricePaise && mrpPaise > pricePaise ? <Text style={styles.mrpText}>{formatPrice(mrpPaise)}</Text> : null}
          </View>
        </View>
        <View style={styles.heartVisual}>
          <HugeiconsIcon color="#738097" icon={HeartIcon} size={24} strokeWidth={2} />
        </View>
        <Text style={styles.resultTypeLabel}>Product</Text>
      </Pressable>
    </Link>
  );
}

function StoreResultCard({ result }: { result: Extract<StorefrontSearchItem, { type: "store" }> }) {
  const store = result.store;
  const imageUrl = resolveImageUrl(store.profile?.logoUrl);
  const location = storeLocation(store);

  return (
    <Link asChild href={`/store/${store.slug}` as Href}>
      <Pressable style={styles.resultCard}>
        <View style={styles.storeLogoWrap}>
          <RemoteImage fallbackLabel={store.storeName} resizeMode="cover" style={styles.storeLogo} uri={imageUrl} />
        </View>
        <View style={styles.productResultInfo}>
          <Text numberOfLines={2} style={styles.productResultTitle}>
            {store.storeName}
          </Text>
          <Text numberOfLines={1} style={styles.resultMetaText}>
            {location}
          </Text>
          <View style={styles.badgeRow}>
            <Text style={styles.storeBadge}>{store._count?.products ?? 0} products</Text>
            <Text style={styles.newBadge}>Approved</Text>
          </View>
        </View>
        <Text style={styles.resultTypeLabel}>Store</Text>
      </Pressable>
    </Link>
  );
}

function CategoryResultCard({ result }: { result: Extract<StorefrontSearchItem, { type: "category" }> }) {
  const category = result.category;
  const imageUrl = resolveImageUrl(category.imageUrl);

  return (
    <Link asChild href={`/category/${category.slug}` as Href}>
      <Pressable style={styles.resultCard}>
        <View style={styles.storeLogoWrap}>
          <RemoteImage fallbackLabel={category.name} resizeMode="contain" style={styles.storeLogo} uri={imageUrl} />
        </View>
        <View style={styles.productResultInfo}>
          <Text numberOfLines={2} style={styles.productResultTitle}>
            {category.name}
          </Text>
          <Text numberOfLines={1} style={styles.resultMetaText}>
            Browse marketplace categories
          </Text>
          <View style={styles.badgeRow}>
            <Text style={styles.storeBadge}>{category._count?.products ?? 0} products</Text>
          </View>
        </View>
        <Text style={styles.resultTypeLabel}>Category</Text>
      </Pressable>
    </Link>
  );
}

function SearchThumb({
  fallbackLabel,
  imageUrl,
  type,
}: {
  fallbackLabel: string;
  imageUrl?: string | null;
  type: "product" | "store" | "category";
}) {
  const resolved = resolveImageUrl(imageUrl);

  if (resolved) {
    return <RemoteImage fallbackLabel={fallbackLabel} resizeMode="cover" style={styles.suggestionThumb} uri={resolved} />;
  }

  return (
    <View style={styles.suggestionThumbFallback}>
      <HugeiconsIcon
        color={colors.primary}
        icon={type === "store" ? Store01Icon : type === "category" ? GridViewIcon : Search01Icon}
        size={25}
        strokeWidth={2}
      />
    </View>
  );
}

function LoadingState({ compact = false, label }: { compact?: boolean; label: string }) {
  return (
    <View style={[styles.statusCard, compact ? styles.compactStatusCard : null]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function SearchErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>Search could not load</Text>
      <Text style={styles.statusText}>Check the connection and try again.</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function SearchEmptyState({ query }: { query: string }) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>No results for "{query}"</Text>
      <Text style={styles.statusText}>Try another product, shop, or category.</Text>
    </View>
  );
}

function SuggestionSkeleton() {
  return (
    <View style={styles.suggestionSkeleton}>
      <View style={styles.suggestionSkeletonIcon} />
      <View style={styles.suggestionSkeletonCopy}>
        <View style={styles.suggestionSkeletonLine} />
        <View style={styles.suggestionSkeletonSmallLine} />
      </View>
    </View>
  );
}

function FilterModal({
  activeType,
  open,
  onClose,
  onSelect,
}: {
  activeType: SearchTypeFilter;
  open: boolean;
  onClose: () => void;
  onSelect: (type: SearchTypeFilter) => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle}>Filter results</Text>
              <Text style={styles.sheetSubtitle}>Choose what the marketplace search should show.</Text>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={onClose}>
              <Text style={styles.sheetCloseText}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.filterOptionList}>
            {filterOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.filterOption, activeType === option.value ? styles.filterOptionActive : null]}
                onPress={() => onSelect(option.value)}
              >
                <View style={styles.filterOptionIcon}>
                  <HugeiconsIcon
                    color={activeType === option.value ? colors.surface : colors.primary}
                    icon={option.value === "store" ? Store01Icon : option.value === "category" ? GridViewIcon : Search01Icon}
                    size={22}
                    strokeWidth={2.15}
                  />
                </View>
                <View style={styles.filterOptionCopy}>
                  <Text style={[styles.filterOptionTitle, activeType === option.value ? styles.filterOptionTitleActive : null]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.filterOptionText, activeType === option.value ? styles.filterOptionTextActive : null]}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function paramValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function parseSearchType(value: string): SearchTypeFilter {
  return value === "product" || value === "store" || value === "category" ? value : "all";
}

function normalizeSearchTerm(term: string) {
  return term.trim().replace(/\s+/g, " ");
}

function resultIdentifier(result: StorefrontSearchItem) {
  if (result.type === "product") {
    return `product-${result.product.id}`;
  }
  if (result.type === "store") {
    return `store-${result.store.id}`;
  }

  return `category-${result.category.id}`;
}

function displayTypeLabel(value: string) {
  if (!value) {
    return "Result";
  }

  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function filterButtonLabel(activeType: SearchTypeFilter) {
  const option = filterOptions.find((item) => item.value === activeType);
  return option?.label === "All" ? "Filters" : option?.label ?? "Filters";
}

function storeLocation(store: Extract<StorefrontSearchItem, { type: "store" }>["store"]) {
  const address = store.addresses?.[0];
  if (!address) {
    return "Approved marketplace store";
  }

  return [address.area, address.city, address.state].filter(Boolean).join(", ");
}

function variantStockQuantity(variant?: SearchProductVariant) {
  if (typeof variant?.stockQuantity === "number") {
    return variant.stockQuantity;
  }

  return null;
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor,
    borderRadius: 999,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    width: 54,
    ...cardShadow,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  cardBase: {
    backgroundColor: colors.surface,
    borderColor,
    borderWidth: 1,
    ...cardShadow,
  },
  categoryCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    justifyContent: "center",
    marginRight: 12,
    minHeight: 132,
    padding: 12,
    width: 118,
    ...cardShadow,
  },
  categoryImage: {
    backgroundColor: "#FFF7F3",
    borderRadius: 18,
    height: 76,
    width: "100%",
  },
  categoryRail: {
    paddingBottom: 2,
    paddingRight: 22,
  },
  categorySkeletonCard: {
    backgroundColor: "#FFF4EF",
    borderColor,
    borderRadius: 22,
    borderWidth: 1,
    height: 132,
    marginRight: 12,
    width: 118,
  },
  categoryTitle: {
    color: textColor,
    fontSize: 13,
    fontWeight: "900",
    maxWidth: "100%",
    textAlign: "center",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  clearAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  clearInputButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  clearInputText: {
    color: "#6B7280",
    fontSize: 23,
    fontWeight: "500",
    lineHeight: 24,
  },
  compactStatusCard: {
    marginTop: 12,
    minHeight: 58,
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    ...cardShadow,
  },
  filterButtonText: {
    color: textColor,
    fontSize: 14,
    fontWeight: "900",
  },
  filterOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 78,
    padding: 14,
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  filterOptionIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  filterOptionList: {
    gap: 12,
    marginTop: 20,
  },
  filterOptionText: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  filterOptionTextActive: {
    color: "rgba(255,255,255,0.82)",
  },
  filterOptionTitle: {
    color: textColor,
    fontSize: 16,
    fontWeight: "900",
  },
  filterOptionTitleActive: {
    color: colors.surface,
  },
  filterSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 18,
    minHeight: 76,
  },
  heartVisual: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor,
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    top: 16,
    width: 48,
    ...cardShadow,
  },
  listContent: {
    paddingBottom: 128,
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
  newBadge: {
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  priceText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  productImage: {
    height: "100%",
    width: "100%",
  },
  productImageWrap: {
    backgroundColor: "#FFF7F3",
    borderColor: "#FFF0EA",
    borderRadius: 24,
    borderWidth: 1,
    height: 138,
    overflow: "hidden",
    width: 138,
  },
  productResultInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 54,
  },
  productResultTitle: {
    color: textColor,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 23,
  },
  recentChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    maxWidth: "100%",
    minHeight: 44,
    paddingHorizontal: 13,
    ...cardShadow,
  },
  recentChipText: {
    color: textColor,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    maxWidth: 190,
  },
  removeChipText: {
    color: "#697386",
    fontSize: 19,
    fontWeight: "500",
    lineHeight: 21,
  },
  resultCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    marginHorizontal: 18,
    marginTop: 14,
    minHeight: 176,
    padding: 16,
    position: "relative",
    ...cardShadow,
  },
  resultHeaderMuted: {
    color: mutedColor,
    fontSize: 17,
  },
  resultHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  resultHeaderText: {
    color: textColor,
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
  },
  resultKind: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  resultMetaText: {
    color: mutedColor,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 8,
  },
  resultTypeLabel: {
    bottom: 18,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    position: "absolute",
    right: 18,
  },
  resultsHeaderSection: {
    marginTop: 10,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  safeArea: {
    backgroundColor: "#FFFCFB",
    flex: 1,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 76,
    paddingLeft: 18,
    paddingRight: 8,
    ...cardShadow,
  },
  searchButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    justifyContent: "center",
    minHeight: 60,
    paddingHorizontal: 22,
  },
  searchButtonText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: "900",
  },
  searchInput: {
    color: textColor,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    minHeight: 62,
    minWidth: 0,
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 18,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    color: textColor,
    fontSize: 20,
    fontWeight: "900",
  },
  sheetCloseButton: {
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sheetCloseText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
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
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  sheetTitle: {
    color: textColor,
    fontSize: 22,
    fontWeight: "900",
  },
  sheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  statusCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 28,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 16,
    minHeight: 136,
    justifyContent: "center",
    padding: 20,
    ...cardShadow,
  },
  statusText: {
    color: mutedColor,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  statusTitle: {
    color: textColor,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  stockPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    color: "#128143",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  storeBadge: {
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    color: textColor,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  storeLogo: {
    height: "100%",
    width: "100%",
  },
  storeLogoWrap: {
    backgroundColor: "#FFF7F3",
    borderColor: "#FFF0EA",
    borderRadius: 24,
    borderWidth: 1,
    height: 110,
    overflow: "hidden",
    width: 110,
  },
  suggestionCopy: {
    flex: 1,
    minWidth: 0,
  },
  suggestionRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 78,
    padding: 12,
    ...cardShadow,
  },
  suggestionSkeleton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 78,
    marginBottom: 10,
    padding: 12,
  },
  suggestionSkeletonCopy: {
    flex: 1,
    gap: 8,
  },
  suggestionSkeletonIcon: {
    backgroundColor: "#FFF4EF",
    borderRadius: 18,
    height: 54,
    width: 54,
  },
  suggestionSkeletonLine: {
    backgroundColor: "#F4E8E2",
    borderRadius: 999,
    height: 12,
    width: "70%",
  },
  suggestionSkeletonSmallLine: {
    backgroundColor: "#F6EDE8",
    borderRadius: 999,
    height: 10,
    width: "45%",
  },
  suggestionText: {
    color: mutedColor,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  suggestionThumb: {
    backgroundColor: "#FFF7F3",
    borderRadius: 18,
    height: 54,
    width: 54,
  },
  suggestionThumbFallback: {
    alignItems: "center",
    backgroundColor: "#FFF4EF",
    borderRadius: 18,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  suggestionTitle: {
    color: textColor,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  title: {
    color: textColor,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  subtitle: {
    color: mutedColor,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 2,
  },
});
