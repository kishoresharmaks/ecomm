import {
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  CheckmarkBadge02Icon,
  FilterHorizontalIcon,
  Location01Icon,
  PackageIcon,
  Search01Icon,
  StarIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Link, type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { listStores, type MobileStoreLocationQuery } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { useLocationStore } from "../../src/state/location-store";
import { colors } from "../../src/theme";
import type { MobileStore } from "../../src/types/mobile-home";
import type { SelectedLocation } from "../../src/types/storefront";

type StoreFilter = "ALL" | "NEW" | "TOP_RATED" | "NEARBY" | "MOST_PRODUCTS";
type StoreSort = "RELEVANCE" | "RATING" | "PRODUCTS" | "NEWEST";

const filters = [
  { key: "ALL", label: "All Stores" },
  { key: "NEW", label: "New" },
  { key: "TOP_RATED", label: "Top Rated" },
  { key: "NEARBY", label: "Nearby" },
  { key: "MOST_PRODUCTS", label: "Most Products" },
] satisfies Array<{ key: StoreFilter; label: string }>;

const sortCycle: StoreSort[] = ["RELEVANCE", "RATING", "PRODUCTS", "NEWEST"];

export default function LocalShopsScreen() {
  const router = useRouter();
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState<StoreFilter>("ALL");
  const [sortMode, setSortMode] = useState<StoreSort>("RELEVANCE");

  const storesQuery = useQuery({
    queryKey: [
      "mobile-stores",
      selectedLocation.countryCode ?? "",
      selectedLocation.stateCode ?? "",
      selectedLocation.cityCode ?? "",
      selectedLocation.localAreaCode ?? "",
      selectedLocation.pincode ?? "",
    ],
    queryFn: () => listStores({ ...locationQuery(selectedLocation), limit: 100 }),
    retry: false,
  });

  const stores = storesQuery.data ?? [];
  const filteredStores = useMemo(() => {
    const searchedStores = filterStores(stores, searchText);
    const focusedStores = applyStoreFilter(searchedStores, activeFilter);
    const preferredSort =
      activeFilter === "TOP_RATED" ? "RATING" : activeFilter === "MOST_PRODUCTS" ? "PRODUCTS" : sortMode;

    return sortStores(focusedStores, preferredSort);
  }, [activeFilter, searchText, sortMode, stores]);

  function cycleSortMode() {
    const currentIndex = sortCycle.indexOf(sortMode);
    setSortMode(sortCycle[(currentIndex + 1) % sortCycle.length] ?? "RELEVANCE");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <FlashList
          contentContainerStyle={styles.listContent}
          data={filteredStores}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={storesQuery.isRefetching} tintColor={colors.primary} onRefresh={() => void storesQuery.refetch()} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.heroRow}>
                <View style={styles.headerCopy}>
                  <View style={styles.titleRow}>
                    <Pressable hitSlop={12} style={styles.backButton} onPress={() => router.push("/")}>
                      <HugeiconsIcon color={colors.ink} icon={ArrowLeft02Icon} size={27} strokeWidth={2.3} />
                    </Pressable>
                    <View style={styles.titleIcon}>
                      <HugeiconsIcon color={colors.primary} icon={Store01Icon} size={24} strokeWidth={2.2} />
                    </View>
                    <Text numberOfLines={1} style={styles.title}>
                      Local Shops
                    </Text>
                  </View>
                  <Text style={styles.subtitle}>Approved sellers and nearby storefronts ranked by location.</Text>
                </View>
                <LocalShopIllustration />
              </View>

              <Pressable style={styles.locationPill} onPress={() => router.push("/account/location" as never)}>
                <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={18} strokeWidth={2.2} />
                <Text numberOfLines={1} style={styles.locationText}>
                  {selectedLocation.label}
                </Text>
                <HugeiconsIcon color={colors.muted} icon={ArrowRight02Icon} size={16} strokeWidth={2.1} />
              </Pressable>

              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <HugeiconsIcon color="#98A2B3" icon={Search01Icon} size={22} strokeWidth={2} />
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setSearchText}
                    placeholder="Search local shops..."
                    placeholderTextColor="#98A2B3"
                    style={styles.searchInput}
                    value={searchText}
                  />
                  {searchText.length > 0 ? (
                    <Pressable hitSlop={10} style={styles.clearButton} onPress={() => setSearchText("")}>
                      <Text style={styles.clearButtonText}>x</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  style={[styles.filterButton, activeFilter === "NEARBY" ? styles.filterButtonActive : null]}
                  onPress={() => setActiveFilter((current) => (current === "NEARBY" ? "ALL" : "NEARBY"))}
                >
                  <HugeiconsIcon
                    color={activeFilter === "NEARBY" ? colors.primary : colors.ink}
                    icon={FilterHorizontalIcon}
                    size={22}
                    strokeWidth={2.1}
                  />
                  <Text style={[styles.filterButtonText, activeFilter === "NEARBY" ? styles.filterButtonTextActive : null]}>
                    Nearby
                  </Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
                {filters.map((filter) => (
                  <Pressable
                    key={filter.key}
                    style={[styles.filterChip, activeFilter === filter.key ? styles.filterChipActive : null]}
                    onPress={() => setActiveFilter(filter.key)}
                  >
                    <Text style={[styles.filterChipText, activeFilter === filter.key ? styles.filterChipTextActive : null]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.resultRow}>
                {storesQuery.isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.loadingText}>Loading shops...</Text>
                  </View>
                ) : (
                  <Text numberOfLines={1} style={styles.countText}>
                    {filteredStores.length} {filteredStores.length === 1 ? "store" : "stores"} found
                  </Text>
                )}
                <Pressable style={styles.sortButton} onPress={cycleSortMode}>
                  <Text style={styles.sortMuted}>Sort:</Text>
                  <Text style={styles.sortValue}>{sortLabel(sortMode)}</Text>
                  <HugeiconsIcon color={colors.primary} icon={ArrowDown01Icon} size={14} strokeWidth={2.3} />
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item }) => <ShopCard store={item} />}
          ListEmptyComponent={
            storesQuery.isLoading ? null : (
              <View style={styles.emptyWrap}>
                <EmptyState
                  title={storesQuery.isError ? "Shops could not load" : "No shops found"}
                  message={
                    storesQuery.isError
                      ? "Check the API connection and pull to refresh."
                      : searchText.trim()
                        ? "Try another store name, city, or filter."
                        : "Approved sellers will appear here after backend approval."
                  }
                />
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

function LocalShopIllustration() {
  return (
    <View style={styles.illustration} pointerEvents="none">
      <View style={[styles.cloud, styles.cloudOne]} />
      <View style={[styles.cloud, styles.cloudTwo]} />
      <View style={[styles.skylineBlock, styles.skylineOne]} />
      <View style={[styles.skylineBlock, styles.skylineTwo]} />
      <View style={[styles.skylineBlock, styles.skylineThree]} />
      <View style={styles.shopBase}>
        <View style={styles.shopRoof} />
        <View style={styles.awningRow}>
          <View style={[styles.awningStripe, styles.awningStripeOrange]} />
          <View style={styles.awningStripe} />
          <View style={[styles.awningStripe, styles.awningStripeOrange]} />
          <View style={styles.awningStripe} />
          <View style={[styles.awningStripe, styles.awningStripeOrange]} />
        </View>
        <View style={styles.shopBody}>
          <View style={styles.shopDoor} />
          <View style={styles.shopWindow} />
        </View>
      </View>
      <View style={styles.pinShape}>
        <View style={styles.pinDot} />
      </View>
      <View style={[styles.shrub, styles.shrubLeft]} />
      <View style={[styles.shrub, styles.shrubRight]} />
    </View>
  );
}

function ShopCard({ store }: { store: MobileStore }) {
  const productCount = store._count?.products ?? 0;
  const rating = store.reviewSummary?.averageRating;
  const reviewCount = store.reviewSummary?.reviewCount ?? 0;
  const isNew = isNewStore(store);

  return (
    <Link href={`/store/${store.slug}` as Href} asChild>
      <Pressable style={styles.shopCard}>
        <Text style={[styles.matchPill, matchPillStyle(store.locationMatchLevel)]}>
          {matchLabel(store.locationMatchLevel)}
        </Text>

        <View style={styles.shopTopRow}>
          <StoreLogo store={store} />
          <View style={styles.shopCopy}>
            <View style={styles.shopTitleRow}>
              <Text numberOfLines={2} style={styles.shopName}>
                {store.storeName}
              </Text>
              <HugeiconsIcon color={colors.success} icon={CheckmarkBadge02Icon} size={18} strokeWidth={2.1} />
            </View>
            <Text numberOfLines={2} style={styles.shopText}>
              {store.profile?.description ?? "Approved 1HandIndia seller with a public storefront."}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaPill}>{productCount} products</Text>
              <Text style={[styles.metaPill, styles.metaPillGreen]}>
                {isNew ? "New store" : ratingLabel(rating)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.locationRatingRow}>
          <View style={styles.cardLocationRow}>
            <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={18} strokeWidth={2.2} />
            <Text numberOfLines={1} style={styles.shopLocation}>
              {sellerLocation(store)}
            </Text>
          </View>
          <View style={styles.ratingRow}>
            <HugeiconsIcon color="#FF9F1A" icon={StarIcon} size={18} strokeWidth={2.2} />
            <Text style={styles.ratingValue}>{rating ? rating.toFixed(1) : "New"}</Text>
            {reviewCount > 0 ? <Text style={styles.reviewCount}>({reviewCount})</Text> : null}
          </View>
        </View>

        <View style={styles.metricFooter}>
          <MetricCell icon={PackageIcon} label="Products" value={String(productCount)} />
          <View style={styles.metricDivider} />
          <MetricCell icon={StarIcon} label="Rating" value={rating ? rating.toFixed(1) : "-"} />
          <View style={styles.actionCell}>
            <View style={styles.openButton}>
              <HugeiconsIcon color={colors.primary} icon={ArrowRight02Icon} size={24} strokeWidth={2.4} />
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function StoreLogo({ store }: { store: MobileStore }) {
  const logoUrl = resolveImageUrl(store.profile?.logoUrl);

  if (logoUrl) {
    return (
      <View style={styles.logoSurface}>
        <RemoteImage fallbackLabel={store.storeName} resizeMode="cover" style={styles.logoImage} uri={logoUrl} />
      </View>
    );
  }

  return (
    <View style={styles.logoFallback}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.logoFallbackText}>
        {storeInitials(store.storeName)}
      </Text>
    </View>
  );
}

function MetricCell({
  icon,
  label,
  value,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCell}>
      <HugeiconsIcon color={colors.ink} icon={icon} size={22} strokeWidth={1.9} />
      <View style={styles.metricCopy}>
        <Text numberOfLines={1} style={styles.metricValue}>
          {value}
        </Text>
        <Text numberOfLines={1} style={styles.metricLabel}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function filterStores(stores: MobileStore[], searchText: string) {
  const query = searchText.trim().toLowerCase();
  if (!query) {
    return stores;
  }

  return stores.filter((store) => {
    const address = store.addresses?.[0];
    const values = [
      store.storeName,
      store.profile?.description ?? "",
      address?.area ?? "",
      address?.city ?? "",
      address?.state ?? "",
      store.slug,
    ]
      .join(" ")
      .toLowerCase();
    return values.includes(query);
  });
}

function applyStoreFilter(stores: MobileStore[], filter: StoreFilter) {
  if (filter === "NEW") {
    return stores.filter(isNewStore);
  }
  if (filter === "TOP_RATED") {
    return stores.filter((store) => (store.reviewSummary?.averageRating ?? 0) >= 4);
  }
  if (filter === "NEARBY") {
    return stores.filter(isLocalMatch);
  }
  if (filter === "MOST_PRODUCTS") {
    return stores.filter((store) => (store._count?.products ?? 0) > 0);
  }

  return stores;
}

function sortStores(stores: MobileStore[], sortMode: StoreSort) {
  return [...stores].sort((first, second) => {
    if (sortMode === "RATING") {
      return compareNumber(second.reviewSummary?.averageRating, first.reviewSummary?.averageRating);
    }
    if (sortMode === "PRODUCTS") {
      return compareNumber(second._count?.products, first._count?.products);
    }
    if (sortMode === "NEWEST") {
      return compareDate(second.createdAt, first.createdAt);
    }

    return (
      locationRank(first.locationMatchLevel) - locationRank(second.locationMatchLevel) ||
      compareNumber(second._count?.products, first._count?.products) ||
      compareNumber(second.reviewSummary?.averageRating, first.reviewSummary?.averageRating) ||
      compareDate(second.createdAt, first.createdAt)
    );
  });
}

function isLocalMatch(store: MobileStore) {
  return ["LOCAL_AREA", "CITY"].includes(store.locationMatchLevel ?? "");
}

function isNewStore(store: MobileStore) {
  if (!store.createdAt) {
    return true;
  }

  const ageMs = Date.now() - new Date(store.createdAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 60 * 24 * 60 * 60 * 1000;
}

function locationQuery(location: SelectedLocation): MobileStoreLocationQuery {
  const query: MobileStoreLocationQuery = {};
  if (location.countryCode) {
    query.countryCode = location.countryCode;
  }
  if (location.stateCode) {
    query.stateCode = location.stateCode;
  }
  if (location.cityCode) {
    query.cityCode = location.cityCode;
  }
  if (location.localAreaCode) {
    query.localAreaCode = location.localAreaCode;
  }
  if (location.pincode) {
    query.pincode = location.pincode;
  }
  return query;
}

function matchLabel(level?: MobileStore["locationMatchLevel"]) {
  if (level === "LOCAL_AREA") {
    return "Area";
  }
  if (level === "CITY") {
    return "City";
  }
  if (level === "STATE") {
    return "State";
  }
  if (level === "COUNTRY") {
    return "National";
  }

  return "Approved";
}

function matchPillStyle(level?: MobileStore["locationMatchLevel"]) {
  if (level === "LOCAL_AREA" || level === "CITY") {
    return styles.matchPillGreen;
  }
  if (level === "STATE" || level === "COUNTRY") {
    return styles.matchPillBlue;
  }

  return styles.matchPillNeutral;
}

function sellerLocation(store: MobileStore) {
  const address = store.addresses?.[0];
  if (!address) {
    return "Location added by seller";
  }

  return [address.area, address.city, address.state].filter(Boolean).join(", ");
}

function sortLabel(sortMode: StoreSort) {
  if (sortMode === "RATING") {
    return "Rating";
  }
  if (sortMode === "PRODUCTS") {
    return "Products";
  }
  if (sortMode === "NEWEST") {
    return "Newest";
  }

  return "Relevance";
}

function ratingLabel(rating?: number | null) {
  return rating ? `${rating.toFixed(1)} rating` : "New store";
}

function compareNumber(first?: number | null, second?: number | null) {
  return (first ?? -1) - (second ?? -1);
}

function compareDate(first?: string, second?: string) {
  return new Date(first ?? 0).getTime() - new Date(second ?? 0).getTime();
}

function locationRank(level?: MobileStore["locationMatchLevel"]) {
  if (level === "LOCAL_AREA") {
    return 0;
  }
  if (level === "CITY") {
    return 1;
  }
  if (level === "STATE") {
    return 2;
  }
  if (level === "COUNTRY") {
    return 3;
  }

  return 4;
}

function storeInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");

  return initials || "1H";
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  screen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  listContent: {
    paddingBottom: 96,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 140,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 32,
  },
  titleIcon: {
    alignItems: "center",
    backgroundColor: "#FFF0EA",
    borderColor: "#FFD7CA",
    borderRadius: 10,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  title: {
    color: "#111827",
    flexShrink: 1,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: 8,
  },
  illustration: {
    height: 148,
    position: "relative",
    width: 152,
  },
  cloud: {
    backgroundColor: "#E9F0F3",
    borderRadius: 999,
    height: 10,
    opacity: 0.9,
    position: "absolute",
  },
  cloudOne: {
    right: 100,
    top: 18,
    width: 40,
  },
  cloudTwo: {
    right: 16,
    top: 10,
    width: 48,
  },
  skylineBlock: {
    backgroundColor: "#EDF3F5",
    bottom: 34,
    opacity: 0.9,
    position: "absolute",
  },
  skylineOne: {
    height: 52,
    left: 4,
    width: 24,
  },
  skylineTwo: {
    height: 76,
    left: 36,
    width: 32,
  },
  skylineThree: {
    height: 58,
    right: 2,
    width: 26,
  },
  shopBase: {
    bottom: 24,
    height: 88,
    left: 44,
    position: "absolute",
    width: 88,
  },
  shopRoof: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: 17,
    left: 8,
    position: "absolute",
    right: 8,
    top: 0,
  },
  awningRow: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    flexDirection: "row",
    height: 30,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 14,
  },
  awningStripe: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  awningStripeOrange: {
    backgroundColor: "#FF9416",
  },
  shopBody: {
    backgroundColor: "#11816F",
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    bottom: 0,
    flexDirection: "row",
    gap: 8,
    height: 44,
    justifyContent: "center",
    left: 10,
    paddingTop: 8,
    position: "absolute",
    right: 10,
  },
  shopDoor: {
    backgroundColor: "#E8FFF6",
    borderColor: "#0B5D52",
    borderRadius: 4,
    borderWidth: 2,
    height: 30,
    width: 20,
  },
  shopWindow: {
    backgroundColor: "#E8FFF6",
    borderColor: "#0B5D52",
    borderRadius: 4,
    borderWidth: 2,
    height: 24,
    width: 22,
  },
  pinShape: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    bottom: 8,
    height: 50,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    width: 50,
  },
  pinDot: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 22,
    width: 22,
  },
  shrub: {
    backgroundColor: "#8AD055",
    borderRadius: 999,
    bottom: 26,
    height: 18,
    position: "absolute",
    width: 30,
  },
  shrubLeft: {
    left: 6,
  },
  shrubRight: {
    right: 58,
  },
  locationPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: "#FFD7CA",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  locationText: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 54,
  },
  clearButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 14,
  },
  filterButtonActive: {
    backgroundColor: "#FFF0EA",
    borderColor: "#FFCAB9",
  },
  filterButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  filterButtonTextActive: {
    color: colors.primary,
  },
  filterScrollContent: {
    gap: 8,
    paddingLeft: 2,
    paddingRight: 18,
    paddingTop: 16,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  filterChipActive: {
    backgroundColor: "#FFF0EA",
    borderColor: "#FFCAB9",
  },
  filterChipText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: "900",
  },
  resultRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 18,
  },
  countText: {
    color: "#344054",
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  sortButton: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 5,
  },
  sortMuted: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  sortValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  loadingRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyWrap: {
    padding: 18,
  },
  shopCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 14,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#101828",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  shopTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  logoSurface: {
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    flexShrink: 0,
    height: 80,
    overflow: "hidden",
    width: 80,
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 8,
    flexShrink: 0,
    height: 80,
    justifyContent: "center",
    overflow: "hidden",
    width: 80,
  },
  logoFallbackText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    width: 60,
  },
  shopCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 56,
  },
  shopTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  shopName: {
    color: "#111827",
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
  },
  shopText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  metaPill: {
    backgroundColor: "#FFF4EF",
    borderRadius: 999,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaPillGreen: {
    backgroundColor: "#E8F8E9",
    color: "#067A3D",
  },
  matchPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    right: 16,
    top: 16,
    zIndex: 2,
  },
  matchPillGreen: {
    backgroundColor: "#DDF4E5",
    color: "#067A3D",
  },
  matchPillBlue: {
    backgroundColor: "#E8F1FF",
    color: "#0B63CE",
  },
  matchPillNeutral: {
    backgroundColor: "#F2F4F7",
    color: colors.muted,
  },
  locationRatingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingBottom: 11,
    paddingHorizontal: 16,
    paddingTop: 1,
  },
  cardLocationRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 7,
    minWidth: 0,
  },
  shopLocation: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 4,
  },
  ratingValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  reviewCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  metricFooter: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 66,
  },
  metricCell: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minWidth: 0,
  },
  metricCopy: {
    minWidth: 0,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  metricDivider: {
    backgroundColor: colors.border,
    height: 38,
    width: 1,
  },
  actionCell: {
    alignItems: "center",
    alignSelf: "stretch",
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    justifyContent: "center",
    width: 88,
  },
  openButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 46,
    justifyContent: "center",
    width: 56,
  },
});
