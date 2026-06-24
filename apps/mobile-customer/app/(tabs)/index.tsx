import {
  ArrowDown01Icon,
  Award01Icon,
  BellDotIcon,
  Clock01Icon,
  ClothesIcon,
  CouponPercentIcon,
  DeliveryBox01Icon,
  FlashIcon,
  Grid2X2Icon,
  HeadsetIcon,
  HeartIcon,
  LaptopIcon,
  Location01Icon,
  MobileNavigator01Icon,
  RefreshIcon,
  ReturnRequestIcon,
  Search01Icon,
  Shield01Icon,
  ShoppingBasket01Icon,
  ShoppingCart01Icon,
  Sofa01Icon,
  StarIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { Link, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SvgUri } from "react-native-svg";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  type ImageStyle,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "../../src/components/empty-state";
import { DealCard } from "../../src/components/deal-card";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth, type MobileCustomerAuthStatus } from "../../src/auth/mobile-auth-context";
import { useMobileHome } from "../../src/features/home/use-mobile-home";
import { composePersonalizedHomeRails } from "../../src/features/home/personalized-ranking";
import { announceCurrencyChange, useMobileMarket } from "../../src/features/market/mobile-market";
import { withStorefrontMaintenance } from "../../src/features/maintenance/mobile-maintenance-gate";
import { getCart, listCustomerOrders, listLocationCountries, searchLocationAreas, type MobileLocationCountry } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { useLocationStore } from "../../src/state/location-store";
import { useRecentProductsStore, type RecentProductSnapshot } from "../../src/state/recent-products-store";
import { colors } from "../../src/theme";
import type {
  MobileBanner,
  MobileCategory,
  MobileHome,
  MobileHomepageSection,
  MobileHomepageSectionItem,
  MobileProduct,
  MobileStore,
} from "../../src/types/mobile-home";
import type { LocationArea, SelectedLocation } from "../../src/types/storefront";

type ProductRailVariant = "lead" | "compact";

type HomeFeedItem =
  | { id: "hero"; type: "hero"; banners: MobileBanner[] }
  | { id: "personalized"; type: "personalized"; home: MobileHome }
  | { id: "trust"; type: "trust" }
  | { id: "categories"; type: "categories"; categories: MobileCategory[] }
  | { id: string; type: "admin-section"; section: MobileHomepageSection; products: MobileProduct[] }
  | { actionHref: Href; badge?: string; icon: IconSvgElement; id: string; products: MobileProduct[]; title: string; type: "product-rail"; variant: ProductRailVariant }
  | { id: "stores"; type: "stores"; stores: MobileStore[] };

type NormalizedSectionItem = {
  label: string;
  description: string;
  imageUrl: string | null;
  linkUrl: string;
  badge: string;
};

type MobilePersonalizedProduct = {
  badge?: string;
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  id: string;
  imageUrl: string | null;
  mrpPaise: number | null;
  name: string;
  pricePaise: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  sellerId?: string | null;
  sellerName: string;
  sellerSlug?: string | null;
  slug: string;
  stockQuantity?: number | null;
  variantStatus?: string | null;
  viewedAt?: string | null;
};

type CustomerQuickAction = {
  background: string;
  href: Href;
  icon: IconSvgElement;
  label: string;
  tone: string;
};

type PersonalizedRailCardVariant = "standard" | ProductRailVariant;

type FeaturedCategory = {
  accent: string;
  aliases: string[];
  background: string;
  fallbackHref: Href;
  icon: IconSvgElement;
  label: string;
};

const HERO_CAROUSEL_INTERVAL_MS = 5000;
const QUICK_ACTION_TILE_WIDTH = 90;
const QUICK_ACTION_TILE_GAP = 14;
const PERSONALIZED_RAIL_SIDE_PADDING = 20;
const PERSONALIZED_RAIL_CARD_GAP = 16;

// Standard product card dimensions - consistent across all card types
const STANDARD_CARD_WIDTH = 160;
const STANDARD_IMAGE_HEIGHT = 120;
const CARDS_PER_VIEW = 3; // Show only 3 products per view

const trustItems = [
  { title: "Verified Sellers", subtitle: "Trusted & safe", icon: Shield01Icon, color: colors.primary, background: "#FFF2EE" },
  { title: "Best Prices", subtitle: "Great deals", icon: Award01Icon, color: "#15935D", background: "#EAF9EF" },
  { title: "Easy Returns", subtitle: "Hassle-free", icon: ReturnRequestIcon, color: "#7C3AED", background: "#F1E7FF" },
  { title: "24/7 Support", subtitle: "We're here", icon: HeadsetIcon, color: "#2F80ED", background: "#EAF3FF" },
] satisfies Array<{ title: string; subtitle: string; icon: IconSvgElement; color: string; background: string }>;

// hardcoded for now; promote to CMS only if customer quick actions need admin control
const customerQuickActions = [
  { background: "#FFF2EE", href: "/track-order" as Href, icon: DeliveryBox01Icon, label: "Track Order", tone: colors.primary },
  { background: "#EAF9EF", href: "/orders" as Href, icon: RefreshIcon, label: "Reorder", tone: "#15935D" },
  { background: "#FFF0F5", href: "/account/wishlist" as Href, icon: HeartIcon, label: "Wishlist", tone: "#E11D48" },
  { background: "#EAF3FF", href: "/account/support" as Href, icon: HeadsetIcon, label: "Support", tone: "#2F80ED" },
  { background: "#FFF4DF", href: "/deals" as Href, icon: CouponPercentIcon, label: "Offers", tone: "#F47B20" },
  { background: "#F1E7FF", href: "/local-shops" as Href, icon: Store01Icon, label: "Nearby Stores", tone: "#7C3AED" },
] satisfies CustomerQuickAction[];

const featuredCategories = [
  {
    accent: "#F74D8A",
    aliases: ["mobile", "phone"],
    background: "#FFE4EE",
    fallbackHref: "/categories" as Href,
    icon: MobileNavigator01Icon,
    label: "Mobiles",
  },
  {
    accent: "#111827",
    aliases: ["fashion", "cloth", "apparel", "wear"],
    background: "#F1E7FF",
    fallbackHref: "/categories" as Href,
    icon: ClothesIcon,
    label: "Fashion",
  },
  {
    accent: "#15935D",
    aliases: ["home", "living", "furniture"],
    background: "#EAF9EF",
    fallbackHref: "/categories" as Href,
    icon: Sofa01Icon,
    label: "Home & Living",
  },
  {
    accent: "#F47B20",
    aliases: ["electronic", "gadget", "laptop"],
    background: "#FFF4DF",
    fallbackHref: "/categories" as Href,
    icon: LaptopIcon,
    label: "Electronics",
  },
  {
    accent: "#2F80ED",
    aliases: ["grocery", "food", "daily"],
    background: "#EAF3FF",
    fallbackHref: "/categories" as Href,
    icon: ShoppingBasket01Icon,
    label: "Grocery",
  },
  {
    accent: "#6B3F35",
    aliases: [],
    background: "#FFFCFB",
    fallbackHref: "/categories" as Href,
    icon: Grid2X2Icon,
    label: "All Categories",
  },
] satisfies FeaturedCategory[];

function HomeScreen() {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const homeQuery = useMobileHome(selectedLocation);
  const feedItems = useMemo(() => buildFeed(homeQuery.data), [homeQuery.data]);

  return (
    <Screen padded={false}>
      <FlashList
        contentContainerStyle={styles.feedContent}
        data={feedItems}
        getItemType={(item) => item.type}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={homeQuery.isRefetching} tintColor={colors.primary} onRefresh={() => void homeQuery.refetch()} />
        }
        ListHeaderComponent={<HomeHeader selectedLocation={selectedLocation} />}
        ListEmptyComponent={<HomeEmptyState isError={homeQuery.isError} isLoading={homeQuery.isLoading} />}
        renderItem={({ item }) => <HomeFeedCard item={item} />}
      />
    </Screen>
  );
}

export default withStorefrontMaintenance(HomeScreen);

function HomeHeader({ selectedLocation }: { selectedLocation: SelectedLocation }) {
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const [searchText, setSearchText] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const cartQuery = useQuery({
    queryKey: ["mobile-cart-count", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 30_000,
  });
  const cartItemCount =
    cartQuery.data?.items.reduce((total, item) => total + Math.max(0, item.quantity), 0) ?? 0;

  function submitSearch() {
    const q = searchText.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>1</Text>
          </View>
          <View>
            <Text style={styles.logoText}>
              Hand<Text style={styles.logoAccent}>India</Text>
            </Text>
            <Text style={styles.logoSubtext}>Smart shopping, verified sellers.</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Link asChild href="/account">
            <Pressable style={({ pressed }) => [styles.headerIconButton, pressed ? styles.headerIconButtonPressed : null]}>
              <HugeiconsIcon color={colors.ink} icon={BellDotIcon} size={26} strokeWidth={2} />
              <Text style={styles.notificationDot} />
            </Pressable>
          </Link>
          <Link asChild href="/cart">
            <Pressable style={({ pressed }) => [styles.headerIconButton, pressed ? styles.headerIconButtonPressed : null]}>
              <HugeiconsIcon color={colors.ink} icon={ShoppingCart01Icon} size={27} strokeWidth={2} />
              {cartItemCount > 0 ? (
                <Text style={styles.cartBadge}>{cartItemCount > 99 ? "99+" : cartItemCount}</Text>
              ) : null}
            </Pressable>
          </Link>
        </View>
      </View>
      <Pressable style={styles.locationWrap} onPress={() => setLocationOpen(true)}>
        <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={22} strokeWidth={2.1} />
        <Text numberOfLines={1} style={styles.locationText}>
          {selectedLocation.label}
        </Text>
        <HugeiconsIcon color={colors.ink} icon={ArrowDown01Icon} size={15} strokeWidth={2} />
      </Pressable>
      <View style={styles.searchBox}>
        <HugeiconsIcon color="#B33A1B" icon={Search01Icon} size={26} strokeWidth={1.9} />
        <TextInput
          onChangeText={setSearchText}
          onSubmitEditing={submitSearch}
          placeholder="Search products, stores, brands..."
          placeholderTextColor="#667085"
          returnKeyType="search"
          style={styles.searchInput}
          value={searchText}
        />
        <Pressable style={styles.searchButton} onPress={submitSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>
      <CustomerQuickActionsRail />
      <LocationSelectorModal open={locationOpen} onClose={() => setLocationOpen(false)} />
    </View>
  );
}

function CustomerQuickActionsRail() {
  return (
    <View accessibilityLabel="Customer quick actions" style={styles.quickActionsWrap}>
      <ScrollView
        horizontal
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={QUICK_ACTION_TILE_WIDTH + QUICK_ACTION_TILE_GAP}
        contentContainerStyle={styles.quickActionsContent}
      >
        {customerQuickActions.map((action) => (
          <Link asChild href={action.href} key={action.label}>
            <Pressable style={({ pressed }) => [styles.quickActionTile, pressed ? styles.quickActionTilePressed : null]}>
              <View style={[styles.quickActionIcon, { backgroundColor: action.background }]}>
                <HugeiconsIcon color={action.tone} icon={action.icon} size={34} strokeWidth={2.15} />
              </View>
              <Text numberOfLines={2} style={styles.quickActionLabel}>
                {action.label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

function LocationSelectorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const setSelectedLocation = useLocationStore((state) => state.setSelectedLocation);
  const market = useMobileMarket(selectedLocation.countryCode);
  const [countryCode, setCountryCode] = useState(selectedLocation.countryCode ?? market.countryCode);
  const [locationSearch, setLocationSearch] = useState("Salem");
  const countriesQuery = useQuery({
    queryKey: ["mobile-location-countries"],
    queryFn: listLocationCountries,
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const locationQuery = useQuery({
    queryKey: ["location-areas", countryCode, locationSearch],
    queryFn: () => searchLocationAreas(locationSearch, countryCode),
    enabled: open && locationSearch.trim().length >= 2,
  });
  const countries = countriesQuery.data ?? [];
  const selectedCountry =
    countries.find((country) => country.code === countryCode) ??
    fallbackCountry(countryCode, market.market.countryName, market.market.currency, market.market.locale);

  useEffect(() => {
    if (open) {
      setCountryCode(selectedLocation.countryCode ?? market.countryCode);
    }
  }, [market.countryCode, open, selectedLocation.countryCode]);

  function selectArea(area: LocationArea) {
    setSelectedLocation(locationFromArea(area));
    onClose();
  }

  function useCountrywide() {
    setSelectedLocation({
      label: selectedCountry.name,
      countryCode: selectedCountry.code,
    });
    announceCurrencyChange({
      ...market.market,
      countryCode: selectedCountry.code,
      countryName: selectedCountry.name,
      currency: selectedCountry.currency,
      locale: selectedCountry.locale,
    });
    onClose();
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalOverlay}>
        <View style={styles.locationSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Choose delivery location</Text>
              <Text style={styles.sheetSubtitle}>Products and nearby stores update from backend location matching.</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.locationSearchBox}>
            <HugeiconsIcon color={colors.primary} icon={Search01Icon} size={22} strokeWidth={2} />
            <TextInput
              autoFocus
              onChangeText={setLocationSearch}
              placeholder="Search area, city, or pincode"
              placeholderTextColor={colors.muted}
              style={styles.locationSearchInput}
              value={locationSearch}
            />
          </View>
          <CountrySelector
            countries={countries}
            selectedCountry={selectedCountry}
            selectedCountryCode={countryCode}
            onSelect={setCountryCode}
            onUseCountrywide={useCountrywide}
          />
          {locationQuery.isLoading ? (
            <View style={styles.locationLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.locationLoadingText}>Searching locations...</Text>
            </View>
          ) : null}
          {locationQuery.isError ? (
            <Text style={styles.locationError}>Could not load locations. Check API connection and try again.</Text>
          ) : null}
          <ScrollView style={styles.locationResults} keyboardShouldPersistTaps="handled">
            {(locationQuery.data ?? []).map((area) => (
              <Pressable key={area.id} style={styles.locationResult} onPress={() => selectArea(area)}>
                <Text style={styles.locationResultTitle}>{area.name}</Text>
                <Text style={styles.locationResultText}>
                  {area.city.name}, {area.city.subdivision.name} {area.postalCode ? `- ${area.postalCode}` : ""}
                </Text>
              </Pressable>
            ))}
            {!locationQuery.isLoading && locationQuery.data?.length === 0 ? (
              <Text style={styles.locationEmpty}>No matching areas. Try city name or pincode.</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CountrySelector({
  countries,
  onSelect,
  onUseCountrywide,
  selectedCountry,
  selectedCountryCode,
}: {
  countries: MobileLocationCountry[];
  onSelect: (countryCode: string) => void;
  onUseCountrywide: () => void;
  selectedCountry: MobileLocationCountry;
  selectedCountryCode: string;
}) {
  return (
    <View style={styles.marketSelectorCard}>
      <View style={styles.marketSelectorHeader}>
        <View style={styles.marketSelectorCopy}>
          <Text style={styles.marketSelectorLabel}>Currency and country</Text>
          <Text numberOfLines={1} style={styles.marketSelectorValue}>
            {selectedCountry.currency} - {selectedCountry.name}
          </Text>
        </View>
        <Pressable accessibilityRole="button" style={styles.countrywideButton} onPress={onUseCountrywide}>
          <Text style={styles.countrywideButtonText}>Use country</Text>
        </Pressable>
      </View>
      {countries.length ? (
        <ScrollView horizontal contentContainerStyle={styles.countryRail} showsHorizontalScrollIndicator={false}>
          {countries.map((country) => {
            const active = country.code === selectedCountryCode;
            return (
              <Pressable
                key={country.code}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.countryChip, active ? styles.countryChipActive : null]}
                onPress={() => onSelect(country.code)}
              >
                <Text style={[styles.countryChipText, active ? styles.countryChipTextActive : null]}>{country.currency}</Text>
                <Text numberOfLines={1} style={[styles.countryChipSubtext, active ? styles.countryChipSubtextActive : null]}>
                  {country.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function HomeFeedCard({ item }: { item: HomeFeedItem }) {
  if (item.type === "hero") {
    return <HeroCarousel banners={item.banners} />;
  }

  if (item.type === "personalized") {
    return <PersonalizedHomeSections home={item.home} />;
  }

  if (item.type === "trust") {
    return <TrustStrip />;
  }

  if (item.type === "categories") {
    return <CategoryStrip categories={item.categories} />;
  }

  if (item.type === "admin-section") {
    return <AdminSection products={item.products} section={item.section} />;
  }

  if (item.type === "stores") {
    return <StoreStrip stores={item.stores} />;
  }

  return (
    <ProductSection
      actionHref={item.actionHref}
      icon={item.icon}
      products={item.products}
      title={item.title}
      variant={item.variant}
      {...(item.badge ? { badge: item.badge } : {})}
    />
  );
}

function HeroCarousel({ banners }: { banners: MobileBanner[] }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const slideWidth = Math.max(0, width - 36);
  const slides: Array<MobileBanner | undefined> = banners.length ? banners : [undefined];

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setPrefersReducedMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setPrefersReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (activeIndex < slides.length) {
      return;
    }

    setActiveIndex(0);
    scrollRef.current?.scrollTo({ animated: false, x: 0 });
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || slideWidth <= 0 || prefersReducedMotion) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      const next = (activeIndex + 1) % slides.length;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ animated: true, x: next * slideWidth });
    }, HERO_CAROUSEL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [activeIndex, prefersReducedMotion, slideWidth, slides.length]);

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (slideWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
  }

  return (
    <View style={styles.heroCarouselWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={styles.heroCarousel}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {slides.map((banner, index) => (
          <HeroSlide banner={banner} key={banner?.id ?? `fallback-${index}`} width={slideWidth} />
        ))}
      </ScrollView>
      {slides.length > 1 ? (
        <View style={styles.heroDots}>
          {slides.map((banner, index) => (
            <View
              key={banner?.id ?? index}
              style={[styles.heroDot, index === activeIndex ? styles.heroDotActive : null]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function HeroSlide({ banner, width }: { banner?: MobileBanner | undefined; width: number }) {
  const imageUrl = resolveImageUrl(banner?.mobileImageUrl ?? banner?.imageUrl);

  return (
    <View style={[styles.heroCard, { width }]}>
      {imageUrl ? (
        <RemoteImage resizeMode="cover" style={styles.heroImage} uri={imageUrl} />
      ) : (
        <HeroFallbackArt />
      )}
      <View style={styles.heroScrim} />
      <View style={styles.heroContent}>
        <Text numberOfLines={2} style={styles.heroTitle}>{banner?.title ?? "Month End\nSales Live!"}</Text>
        <Text numberOfLines={2} style={styles.heroSubtitle}>{banner?.subtitle ?? "Shop the best. Save more."}</Text>
        <Link href={(banner?.linkUrl?.startsWith("/") ? banner.linkUrl : "/search") as Href} style={styles.heroButton}>
          Shop Now
        </Link>
      </View>
    </View>
  );
}

function HeroFallbackArt() {
  return (
    <View style={styles.heroFallbackArt}>
      <View style={styles.heroBagLarge} />
      <View style={styles.heroBagSmall} />
      <View style={styles.heroShield} />
      <Text style={styles.heroPercent}>%</Text>
    </View>
  );
}

function RemoteImage({
  resizeMode = "cover",
  style,
  uri,
}: {
  resizeMode?: "cover" | "contain";
  style: StyleProp<ImageStyle>;
  uri: string;
}) {
  if (isSvgImageUrl(uri)) {
    return (
      <View style={[styles.svgImageSurface, style as StyleProp<ViewStyle>]}>
        <SvgUri height="100%" uri={uri} width="100%" />
      </View>
    );
  }

  return <Image resizeMode={resizeMode} source={{ uri }} style={style} />;
}

function isSvgImageUrl(uri: string) {
  const normalized = decodeURIComponent(uri).toLowerCase();
  return normalized.includes(".svg") || normalized.includes("image/svg+xml");
}

function TrustStrip() {
  return (
    <View style={styles.trustCard}>
      {trustItems.map((item, index) => (
        <View key={item.title} style={[styles.trustItem, index > 0 ? styles.trustItemBorder : null]}>
          <View style={[styles.trustIconWrap, { backgroundColor: item.background }]}>
            <HugeiconsIcon color={item.color} icon={item.icon} size={33} strokeWidth={2.05} />
          </View>
          <Text numberOfLines={1} style={styles.trustTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.trustSubtitle}>
            {item.subtitle}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PersonalizedHomeSections({ home }: { home: MobileHome }) {
  const customerAuth = useMobileCustomerAuth();
  const recentProducts = useRecentProductsStore((state) => state.recentProducts);
  const cartQuery = useQuery({
    queryKey: ["mobile-cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 30_000,
  });
  const ordersQuery = useQuery({
    queryKey: ["mobile-orders", customerAuth.authKey, "home-personalized"],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, 8),
    enabled: customerAuth.enabled,
    staleTime: 60_000,
  });
  const cartProducts = useMemo(() => personalizedProductsFromCart(cartQuery.data), [cartQuery.data]);
  // Recent history is platform-local; storage differs, but both surfaces normalize to the same in-memory shape before filtering.
  const recentlyViewedProducts = useMemo(
    () => recentProducts.map(personalizedProductFromRecent),
    [recentProducts],
  );
  const baseRecommendedProducts = useMemo(
    () =>
      uniqueMobilePersonalizedProducts(
        [...home.productRails.deals, ...home.productRails.featured, ...home.productRails.latest].map((product) =>
          personalizedProductFromMobileProduct(product, productHasDeal(product) ? "Deal" : undefined),
        ),
      ).slice(0, 10),
    [home.productRails.deals, home.productRails.featured, home.productRails.latest],
  );
  const buyAgainProducts = useMemo(
    () => personalizedProductsFromOrders(ordersQuery.data?.items ?? []),
    [ordersQuery.data?.items],
  );
  const personalizedRails = useMemo(
    () =>
      composePersonalizedHomeRails({
        buyAgainProducts,
        cartProducts,
        recentlyViewedProducts,
        recommendedProducts: baseRecommendedProducts,
      }),
    [baseRecommendedProducts, buyAgainProducts, cartProducts, recentlyViewedProducts],
  );
  const shouldShowBuyAgain =
    customerAuth.status !== "ready" ||
    ordersQuery.isLoading ||
    ordersQuery.isError ||
    personalizedRails.buyAgainProducts.length > 0;
  const hasAnySection =
    (cartQuery.data?.items.length ?? 0) > 0 ||
    personalizedRails.continueProducts.length > 0 ||
    personalizedRails.recentlyViewedProducts.length > 0 ||
    personalizedRails.recommendedProducts.length > 0 ||
    shouldShowBuyAgain;

  if (!hasAnySection) {
    return null;
  }

  return (
    <View style={styles.personalizedWrap}>
      <MobilePersonalizedRail
        actionHref="/search"
        cardVariant="compact"
        icon={Award01Icon}
        products={personalizedRails.recommendedProducts}
        title="Recommended for you"
      />
      <MobileBuyAgainSection
        authStatus={customerAuth.status}
        isError={ordersQuery.isError}
        isLoading={
          customerAuth.status === "loading" ||
          customerAuth.status === "syncing" ||
          (ordersQuery.isLoading && customerAuth.enabled)
        }
        products={personalizedRails.buyAgainProducts}
        onRetry={() => void ordersQuery.refetch()}
      />
      <MobileCartReminder cart={cartQuery.data} />
      <MobilePersonalizedRail
        actionHref="/cart"
        icon={ShoppingCart01Icon}
        isLoading={cartQuery.isLoading && customerAuth.enabled}
        products={personalizedRails.continueProducts.slice(0, 8)}
        title="Continue shopping"
      />
      <MobilePersonalizedRail
        actionHref="/search"
        icon={Clock01Icon}
        products={personalizedRails.recentlyViewedProducts}
        title="Recently viewed"
      />
    </View>
  );
}

function MobileCartReminder({ cart }: { cart: Awaited<ReturnType<typeof getCart>> | undefined }) {
  const market = useMobileMarket();
  const items = cart?.items ?? [];
  if (!items.length) {
    return null;
  }

  const itemCount = items.reduce((total, item) => total + Math.max(0, item.quantity), 0);
  const subtotal = items.reduce((total, item) => total + Math.max(0, item.quantity) * Math.max(0, item.unitPricePaise ?? 0), 0);

  return (
    <View style={styles.cartReminderCard}>
      <View style={styles.cartReminderIcon}>
        <HugeiconsIcon color={colors.primary} icon={ShoppingCart01Icon} size={24} strokeWidth={2.2} />
      </View>
      <View style={styles.cartReminderCopy}>
        <Text style={styles.cartReminderTitle}>Cart reminder</Text>
        <Text numberOfLines={2} style={styles.cartReminderText}>
          {itemCount} item{itemCount === 1 ? "" : "s"} waiting
          {subtotal > 0 ? ` - ${market.format(subtotal)}` : ""}
        </Text>
      </View>
      <Link href="/cart" style={styles.cartReminderButton}>
        View
      </Link>
    </View>
  );
}

function MobilePersonalizedRail({
  actionHref,
  cardVariant = "standard",
  icon,
  isLoading = false,
  products,
  title,
}: {
  actionHref: Href;
  cardVariant?: PersonalizedRailCardVariant;
  icon: IconSvgElement;
  isLoading?: boolean;
  products: MobilePersonalizedProduct[];
  title: string;
}) {
  // Limit to 3 products per view for consistency
  const displayedProducts = products.slice(0, CARDS_PER_VIEW);
  const { width } = useWindowDimensions();
  const cardWidth = personalizedRailCardWidth(width, cardVariant);

  if (!isLoading && !products.length) {
    return null;
  }

  const snapInterval = cardWidth + PERSONALIZED_RAIL_CARD_GAP;

  return (
    <View style={styles.personalizedSection}>
      <View style={styles.personalizedHeader}>
        <View style={styles.personalizedTitleRow}>
          <View style={styles.personalizedIcon}>
            <HugeiconsIcon color={colors.primary} icon={icon} size={19} strokeWidth={2.1} />
          </View>
          <Text numberOfLines={1} style={styles.personalizedTitle}>
            {title}
          </Text>
        </View>
        <Link href={actionHref} style={styles.personalizedViewAll}>
          View all  →
        </Link>
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={styles.personalizedRail}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={snapInterval}
      >
        {isLoading
          ? [0, 1, 2].map((item, index) => (
            <View key={`personalized-${title}-${item}`} style={index === 2 ? null : styles.personalizedRailItem}>
              <View
                style={[
                  styles.personalizedSkeleton,
                  cardVariant !== "standard" ? styles.recommendedSkeleton : null,
                  { width: cardWidth },
                ]}
              />
            </View>
          ))
          : displayedProducts.map((product, index) => (
            <View
              key={`${title}-${product.id}-${product.slug}`}
              style={index === displayedProducts.length - 1 ? null : styles.personalizedRailItem}
            >
              {cardVariant !== "standard" ? (
                <MobileRecommendedProductCard cardWidth={cardWidth} product={product} variant={cardVariant} />
              ) : (
                <MobilePersonalizedProductCard cardWidth={cardWidth} product={product} />
              )}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

function MobileBuyAgainSection({
  authStatus,
  isError = false,
  isLoading = false,
  onRetry,
  products,
}: {
  authStatus: MobileCustomerAuthStatus;
  isError?: boolean;
  isLoading?: boolean;
  onRetry: () => void;
  products: MobilePersonalizedProduct[];
}) {
  const product = products[0];

  return (
    <View style={styles.buyAgainSection}>
      <SectionHeader actionHref="/orders" icon={RefreshIcon} title="Buy again" />
      {isLoading ? <MobileBuyAgainSkeleton /> : null}
      {!isLoading && (authStatus === "signed-out" || authStatus === "error") ? (
        <MobileBuyAgainStateCard
          ctaHref="/auth/sign-in"
          ctaLabel={authStatus === "error" ? "Sign in again" : "Sign in"}
          icon={RefreshIcon}
          message="Your previous purchases will appear here for quick reordering."
          title={authStatus === "error" ? "Sign in again to buy again" : "Sign in to buy again"}
        />
      ) : null}
      {!isLoading && authStatus === "ready" && isError ? (
        <MobileBuyAgainStateCard
          ctaLabel="Retry"
          icon={RefreshIcon}
          message="We could not load your previous orders right now."
          title="Buy again is unavailable"
          onPress={onRetry}
        />
      ) : null}
      {!isLoading && authStatus === "ready" && !isError && !product ? (
        <MobileBuyAgainStateCard
          ctaHref="/search"
          ctaLabel="Browse products"
          icon={ShoppingBasket01Icon}
          message="Once you place an order, your most recent item will stay ready here."
          title="No past orders yet"
        />
      ) : null}
      {!isLoading && authStatus === "ready" && !isError && product ? <MobileBuyAgainCard product={product} /> : null}
    </View>
  );
}

function MobileBuyAgainSkeleton() {
  return (
    <View style={styles.buyAgainCardSkeleton}>
      <View style={styles.buyAgainSkeletonThumb} />
      <View style={styles.buyAgainSkeletonCopy}>
        <View style={styles.buyAgainSkeletonLineWide} />
        <View style={styles.buyAgainSkeletonLine} />
        <View style={styles.buyAgainSkeletonPrice} />
      </View>
      <View style={styles.buyAgainSkeletonButton} />
    </View>
  );
}

function MobileBuyAgainStateCard({
  ctaHref,
  ctaLabel,
  icon,
  message,
  onPress,
  title,
}: {
  ctaHref?: Href;
  ctaLabel: string;
  icon: IconSvgElement;
  message: string;
  onPress?: () => void;
  title: string;
}) {
  const action = (
    <View style={styles.buyAgainStateButton}>
      <Text style={styles.buyAgainStateButtonText}>{ctaLabel}</Text>
    </View>
  );

  return (
    <View style={styles.buyAgainStateCard}>
      <View style={styles.buyAgainStateIcon}>
        <HugeiconsIcon color={colors.primary} icon={icon} size={25} strokeWidth={2.15} />
      </View>
      <View style={styles.buyAgainStateCopy}>
        <Text numberOfLines={1} style={styles.buyAgainStateTitle}>
          {title}
        </Text>
        <Text numberOfLines={2} style={styles.buyAgainStateText}>
          {message}
        </Text>
      </View>
      {ctaHref ? (
        <Link asChild href={ctaHref}>
          <Pressable accessibilityRole="button" style={({ pressed }) => [pressed ? styles.buyAgainStateButtonPressed : null]}>
            {action}
          </Pressable>
        </Link>
      ) : (
        <Pressable accessibilityRole="button" style={({ pressed }) => [pressed ? styles.buyAgainStateButtonPressed : null]} onPress={onPress}>
          {action}
        </Pressable>
      )}
    </View>
  );
}

function MobileBuyAgainCard({ product }: { product: MobilePersonalizedProduct }) {
  const market = useMobileMarket();
  const { width } = useWindowDimensions();
  const imageUrl = resolveImageUrl(product.imageUrl);
  const compact = width < 380;
  const stock = stockPillState(product);

  return (
    <Link asChild href={`/product/${product.slug}` as Href}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.buyAgainCard,
          compact ? styles.buyAgainCardCompact : null,
          pressed ? styles.buyAgainCardPressed : null,
        ]}
      >
        <View style={styles.buyAgainContentRow}>
          <View style={styles.buyAgainThumb}>
            {imageUrl ? (
              <RemoteImage resizeMode="cover" style={styles.buyAgainImage} uri={imageUrl} />
            ) : (
              <ProductImageFallback compact />
            )}
            <View style={styles.buyAgainImageBadge}>
              <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={12} strokeWidth={2.25} />
            </View>
          </View>
          <View style={styles.buyAgainCopy}>
            <View style={styles.buyAgainMetaRow}>
              <View style={styles.buyAgainTag}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.buyAgainTagText}>Previously ordered</Text>
              </View>
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.buyAgainStockPill, stock.available ? styles.buyAgainStockIn : styles.buyAgainStockOut]}>
                {stock.label}
              </Text>
            </View>
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.buyAgainProductName}>
              {product.name}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.buyAgainSeller}>
              {product.sellerName}
            </Text>
            <View style={styles.buyAgainPriceRow}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.buyAgainPrice}>
                {product.pricePaise !== null ? market.format(product.pricePaise) : "View price"}
              </Text>
              {product.mrpPaise && product.pricePaise && product.mrpPaise > product.pricePaise ? (
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.buyAgainMrp}>
                  {market.format(product.mrpPaise)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={[styles.buyAgainButton, compact ? styles.buyAgainButtonCompact : null]}>
          <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={18} strokeWidth={2.2} />
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.buyAgainButtonText}>Buy Again</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function truncateText(text: string, maxLength: number = 12): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

function MobileRecommendedProductCard({
  cardWidth,
  product,
  variant,
}: {
  cardWidth: number;
  product: MobilePersonalizedProduct;
  variant: ProductRailVariant;
}) {
  const market = useMobileMarket();
  const imageUrl = resolveImageUrl(product.imageUrl);
  const isLead = variant === "lead";
  // Use standard image height for consistency
  const imageHeight = STANDARD_IMAGE_HEIGHT;
  const badge = premiumBadgeLabel(product);
  const stock = stockPillState(product);
  const hasRating = typeof product.rating === "number" && product.rating > 0;

  return (
    <Link asChild href={`/product/${product.slug}` as Href}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.recommendedProductCard,
          isLead ? styles.recommendedProductCardLead : styles.recommendedProductCardCompact,
          { width: cardWidth },
          pressed ? styles.recommendedProductCardPressed : null,
        ]}
      >
        <View style={[styles.recommendedImageWrap, isLead ? styles.recommendedImageWrapLead : styles.recommendedImageWrapCompact, { height: imageHeight }]}>
          {imageUrl ? (
            <RemoteImage resizeMode="cover" style={styles.recommendedProductImage} uri={imageUrl} />
          ) : (
            <ProductImageFallback compact={!isLead} />
          )}
          <View style={styles.recommendedBadge}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.recommendedBadgeText}>
              {truncateText(badge, 8)}
            </Text>
          </View>
          <View style={styles.recommendedHeartButton}>
            <HugeiconsIcon color="#6B7280" icon={HeartIcon} size={19} strokeWidth={1.9} />
          </View>
        </View>
        <View style={[styles.recommendedBody, isLead ? styles.recommendedBodyLead : styles.recommendedBodyCompact]}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.recommendedProductName, isLead ? styles.recommendedProductNameLead : null]}>
            {truncateText(product.name, 25)}
          </Text>
          <View style={styles.recommendedMetaRow}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.recommendedCategoryPillText}
            >
              {product.categoryName || "Marketplace"}
            </Text>
            {hasRating ? (
              <View style={styles.recommendedRatingRow}>
                <HugeiconsIcon color="#22C55E" icon={StarIcon} size={13} strokeWidth={2.5} />
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.recommendedRatingText}>
                  {product.rating?.toFixed(1)}
                </Text>
              </View>
            ) : (
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.recommendedFreshPill}>
                New
              </Text>
            )}
          </View>
          <View style={styles.recommendedFooter}>
            <View style={styles.recommendedPriceBlock}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.recommendedPrice}>
                {product.pricePaise !== null ? market.format(product.pricePaise) : "View price"}
              </Text>
              {product.mrpPaise && product.pricePaise && product.mrpPaise > product.pricePaise ? (
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.recommendedMrp}>
                  {market.format(product.mrpPaise)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function MobilePersonalizedProductCard({
  cardWidth,
  product,
}: {
  cardWidth: number;
  product: MobilePersonalizedProduct;
}) {
  const market = useMobileMarket();
  const imageUrl = resolveImageUrl(product.imageUrl);
  // Use standard image height for consistency
  const imageHeight = STANDARD_IMAGE_HEIGHT;

  return (
    <Link asChild href={`/product/${product.slug}` as Href}>
      <Pressable
        style={({ pressed }) => [
          styles.personalizedProductCard,
          { width: cardWidth },
          pressed ? styles.personalizedProductCardPressed : null,
        ]}
      >
        <View style={[styles.personalizedProductImageWrap, { height: imageHeight }]}>
          {imageUrl ? (
            <RemoteImage resizeMode="cover" style={styles.personalizedProductImage} uri={imageUrl} />
          ) : (
            <ProductImageFallback />
          )}
          {product.badge ? <Text numberOfLines={1} ellipsizeMode="tail" style={styles.personalizedProductBadge}>{product.badge}</Text> : null}
          <View style={styles.productHeartButton}>
            <HugeiconsIcon color="#8A94A6" icon={HeartIcon} size={20} strokeWidth={1.9} />
          </View>
        </View>
        <View style={styles.personalizedProductDetails}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.personalizedProductName}>
            {truncateText(product.name, 20)}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.personalizedProductSeller}>
            {truncateText(product.sellerName, 10)}
          </Text>
          <View style={styles.personalizedPriceRow}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.personalizedPrice}>
              {product.pricePaise !== null ? market.format(product.pricePaise) : "View price"}
            </Text>
            {product.mrpPaise && product.pricePaise && product.mrpPaise > product.pricePaise ? (
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.personalizedMrp}>
                {market.format(product.mrpPaise)}
              </Text>
            ) : null}
          </View>
          <View style={styles.personalizedRatingRow}>
            {product.rating ? (
              <>
                <HugeiconsIcon color="#15935D" icon={StarIcon} size={14} strokeWidth={2.5} />
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.personalizedRatingText}>
                  {product.rating.toFixed(1)}
                  {product.reviewCount ? ` (${product.reviewCount})` : ""}
                </Text>
              </>
            ) : (
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.personalizedRatingPlaceholder}>
                {truncateText(product.categoryName ?? "Marketplace", 10)}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function ProductImageFallback({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.productImageFallback, compact ? styles.productImageFallbackCompact : null]}>
      <HugeiconsIcon color="#F47B20" icon={ShoppingBasket01Icon} size={compact ? 34 : 42} strokeWidth={1.9} />
    </View>
  );
}

function personalizedRailCardWidth(screenWidth: number, variant: PersonalizedRailCardVariant) {
  if (variant === "lead") {
    return Math.min(356, Math.max(300, screenWidth - 58));
  }

  if (variant === "compact") {
    return Math.min(178, Math.max(150, Math.floor((screenWidth - 58) / 2)));
  }

  return Math.min(186, Math.max(166, Math.floor((screenWidth - 58) / 2)));
}

function premiumBadgeLabel(product: MobilePersonalizedProduct) {
  if (product.mrpPaise && product.pricePaise && product.mrpPaise > product.pricePaise) {
    const discount = Math.round(((product.mrpPaise - product.pricePaise) / product.mrpPaise) * 100);
    return discount > 0 ? `-${discount}%` : "Deal";
  }

  return product.badge ?? "Trending";
}

function stockPillState(product: MobilePersonalizedProduct) {
  if (product.variantStatus && product.variantStatus !== "ACTIVE") {
    return { available: false, label: "Out of stock" };
  }

  if (typeof product.stockQuantity === "number") {
    if (product.stockQuantity <= 0) {
      return { available: false, label: "Out of stock" };
    }

    if (product.stockQuantity <= 5) {
      return { available: true, label: "Few left" };
    }
  }

  return { available: true, label: "In stock" };
}

function CategoryStrip({ categories }: { categories: MobileCategory[] }) {
  return (
    <View style={styles.section}>
      <SectionHeader actionHref="/categories" title="Shop by Category" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContent} style={styles.categoryScroll}>
        {featuredCategories.map((featuredCategory) => {
          const category = findMatchingCategory(categories, featuredCategory);
          const imageUrl = resolveImageUrl(category?.imageUrl);
          const href = category ? (`/category/${category.slug}` as Href) : featuredCategory.fallbackHref;
          return (
            <Link key={featuredCategory.label} href={href} style={styles.categoryItem}>
              <View>
                <View style={[styles.categoryCircle, { backgroundColor: featuredCategory.background }]}>
                  {imageUrl ? (
                    <RemoteImage resizeMode="contain" style={styles.categoryImage} uri={imageUrl} />
                  ) : (
                    <HugeiconsIcon color={featuredCategory.accent} icon={featuredCategory.icon} size={34} strokeWidth={2.1} />
                  )}
                </View>
                <Text numberOfLines={1} style={styles.categoryName}>
                  {featuredCategory.label}
                </Text>
              </View>
            </Link>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AdminSection({ section, products }: { section: MobileHomepageSection; products: MobileProduct[] }) {
  const market = useMobileMarket();
  const items = normalizeSectionItems(section.config?.items);
  const description = stringValue(section.config?.subtitle) || stringValue(section.config?.description);
  const ctaLabel = stringValue(section.config?.ctaLabel) || "View all";
  const ctaUrl = stringValue(section.config?.ctaUrl) || stringValue(section.config?.ctaHref);
  const timerEndsAt = stringValue(section.config?.timerEndsAt) || stringValue(section.config?.endsAt);
  const isDeal = section.sectionType === "deal_strip";

  if (isDeal) {
    if (isExpiredTimestamp(timerEndsAt)) {
      return null;
    }

    return (
      <View style={styles.flashSection}>
        <View style={styles.flashIntro}>
          <View style={styles.flashTitleBar}>
            <View style={styles.flashTitleRow}>
              <HugeiconsIcon color="#FFB020" icon={FlashIcon} size={22} strokeWidth={2.2} />
              <Text numberOfLines={1} style={styles.flashLabel}>{section.title}</Text>
            </View>
            {timerEndsAt ? (
              <View style={styles.flashTimerPill}>
                <CountdownText compact endsAt={timerEndsAt} small tone="light" />
              </View>
            ) : null}
          </View>
          <Text style={styles.flashHeadline}>{description || "Grab before it's gone!"}</Text>
          {ctaUrl.startsWith("/") ? (
            <Link href={ctaUrl as Href} style={styles.flashButton}>
              {ctaLabel}
            </Link>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flashProducts}>
          {(products.length ? products : []).slice(0, CARDS_PER_VIEW).map((product) => (
            <DealProductCard key={product.id} formatPrice={market.format} product={product} timerEndsAt={timerEndsAt} />
          ))}
          {!products.length
            ? items.slice(0, CARDS_PER_VIEW).map((item, index) => <AdminMiniCard key={`${section.id}-${index}`} item={item} timerEndsAt={timerEndsAt} />)
            : null}
        </ScrollView>
      </View>
    );
  }

  if (items.length === 0 && !description && !ctaUrl && !products.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader actionHref={ctaUrl.startsWith("/") ? (ctaUrl as Href) : "/search"} actionLabel={ctaLabel} title={section.title} />
      {timerEndsAt ? (
        <View style={styles.timerRow}>
          <CountdownText endsAt={timerEndsAt} />
        </View>
      ) : null}
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      {products.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productScrollContent} style={styles.productScroll}>
          {products.slice(0, CARDS_PER_VIEW).map((product) => (
            <MarketplaceProductCard key={product.id} formatPrice={market.format} product={product} />
          ))}
        </ScrollView>
      ) : null}
      {items.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genericSectionScroll}>
          {items.map((item, index) => (
            <AdminMiniCard key={`${section.id}-${index}`} item={item} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function AdminMiniCard({ item, timerEndsAt }: { item: NormalizedSectionItem; timerEndsAt?: string }) {
  const imageUrl = resolveImageUrl(item.imageUrl);
  const content = (
    <View>
      {imageUrl ? <RemoteImage resizeMode="cover" style={styles.adminMiniImage} uri={imageUrl} /> : <View style={styles.adminMiniFallback} />}
      {item.badge ? <Text style={styles.discountBadge}>{item.badge}</Text> : null}
      <Text numberOfLines={2} style={styles.adminMiniTitle}>
        {item.label}
      </Text>
      {item.description ? (
        <Text numberOfLines={2} style={styles.adminMiniDescription}>
          {item.description}
        </Text>
      ) : null}
      {timerEndsAt ? <CountdownText endsAt={timerEndsAt} small /> : null}
    </View>
  );

  if (item.linkUrl.startsWith("/")) {
    return (
      <Link href={item.linkUrl as Href} style={styles.adminMiniCard}>
        {content}
      </Link>
    );
  }

  return (
    <View style={styles.adminMiniCard}>
      {content}
    </View>
  );
}

function DealProductCard({
  formatPrice,
  product,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  product: MobileProduct;
  timerEndsAt: string;
}) {
  return <DealCard formatPrice={formatPrice} product={product} />;
}

function ProductSection({
  actionHref,
  badge,
  icon,
  products,
  title,
  variant,
}: {
  actionHref: Href;
  badge?: string;
  icon: IconSvgElement;
  products: MobileProduct[];
  title: string;
  variant: ProductRailVariant;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = personalizedRailCardWidth(width, variant);
  const snapInterval = cardWidth + PERSONALIZED_RAIL_CARD_GAP;
  const premiumProducts = useMemo(
    () =>
      uniqueMobilePersonalizedProducts(
        products.map((product) => personalizedProductFromMobileProduct(product, badge)),
      ).slice(0, 10),
    [badge, products],
  );

  if (!premiumProducts.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader actionHref={actionHref} icon={icon} title={title} />
      <ScrollView
        horizontal
        contentContainerStyle={styles.personalizedRail}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={snapInterval}
      >
        {premiumProducts.map((product, index) => (
          <View
            key={`${title}-${product.id}-${product.slug}`}
            style={index === premiumProducts.length - 1 ? null : styles.personalizedRailItem}
          >
            <MobileRecommendedProductCard cardWidth={cardWidth} product={product} variant={variant} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function MarketplaceProductCard({
  formatPrice,
  product,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  product: MobileProduct;
}) {
  const cardWidth = STANDARD_CARD_WIDTH;
  const imageHeight = STANDARD_IMAGE_HEIGHT;
  const cardHeight = imageHeight + 132;
  const imageUrl = resolveImageUrl(product.images?.[0]?.url);
  const variant = product.variants?.[0];
  const price = variant?.pricePaise;
  const mrp = variant?.mrpPaise ?? null;
  const discount = discountPercent(price, mrp);
  const rating = product.reviewSummary?.averageRating ?? null;
  const reviewCount = product.reviewSummary?.reviewCount ?? 0;

  return (
    <Link href={`/product/${product.slug}`} style={[styles.productCard, { minHeight: cardHeight, width: cardWidth }]}>
      <View style={styles.productCardContent}>
        <View style={[styles.productImageWrap, { height: imageHeight }]}>
          {imageUrl ? <RemoteImage resizeMode="cover" style={styles.productImage} uri={imageUrl} /> : <ProductImageFallback />}
          {discount ? <Text style={styles.productDiscountBadge}>Deal</Text> : null}
          <View style={styles.productHeartButton}>
            <HugeiconsIcon color="#667085" icon={HeartIcon} size={20} strokeWidth={1.8} />
          </View>
          {product.images && product.images.length > 1 ? <ImageDots count={product.images.length} /> : null}
        </View>
        <View style={styles.productTextContainer}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.productName}>
            {product.name}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.productSeller}>
            {product.seller?.storeName ?? "1HandIndia seller"}
          </Text>
          <View style={styles.priceRow}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.productPrice}>{typeof price === "number" ? formatPrice(price) : "View price"}</Text>
            {mrp ? <Text numberOfLines={1} ellipsizeMode="tail" style={styles.productMrp}>{formatPrice(mrp)}</Text> : null}
          </View>
          {rating ? (
            <View style={styles.productRatingRow}>
              <HugeiconsIcon color="#15935D" icon={StarIcon} size={14} strokeWidth={2.5} />
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.productRatingText}>
                {rating.toFixed(1)}
                {reviewCount ? ` (${reviewCount})` : ""}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Link>
  );
}

function ImageDots({ count }: { count: number }) {
  return (
    <View style={styles.imageDots}>
      {Array.from({ length: Math.min(4, count) }).map((_, index) => (
        <View key={index} style={[styles.imageDot, index === 0 ? styles.imageDotActive : null]} />
      ))}
    </View>
  );
}

function StoreStrip({ stores }: { stores: MobileStore[] }) {
  if (!stores.length) {
    return null;
  }

  return (
    <View style={styles.section}>
      <SectionHeader actionHref={"/local-shops" as Href} title="Local Shops" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeScrollContent} style={styles.storeScroll}>
        {stores.slice(0, CARDS_PER_VIEW).map((store) => {
          const logoUrl = resolveImageUrl(store.profile?.logoUrl);
          const rating = store.reviewSummary?.averageRating;
          const reviewCount = store.reviewSummary?.reviewCount ?? 0;
          const distanceLabel = formatStoreDistance(store.distanceMeters) ?? storeMatchLabel(store.locationMatchLevel);

          return (
            <Link asChild key={store.id} href={`/store/${store.slug}` as Href}>
              <Pressable style={styles.storeCard}>
                <View style={styles.storeLogoSurface}>
                  {logoUrl ? (
                    <RemoteImage resizeMode="cover" style={styles.storeLogo} uri={logoUrl} />
                  ) : (
                    <Text style={styles.storeLogoInitial}>{storeInitials(store.storeName)}</Text>
                  )}
                </View>
                <View style={styles.storeCompactCopy}>
                  <Text numberOfLines={2} style={styles.storeName}>
                    {store.storeName}
                  </Text>
                  <View style={styles.storeRatingLine}>
                    <Text style={styles.storeRatingBubble}>{rating ? rating.toFixed(1) : "New"}</Text>
                    {rating ? <HugeiconsIcon color="#F59E0B" icon={StarIcon} size={13} strokeWidth={2.4} /> : null}
                    {rating && reviewCount > 0 ? (
                      <Text numberOfLines={1} style={styles.storeReviewText}>
                        ({reviewCount})
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.storeDistanceText}>
                  {distanceLabel}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    </View>
  );
}

/*
function SectionHeader({
  title,
  actionHref,
  actionLabel = "View all",
}: {
  title: string;
  actionHref: Href;
  actionLabel?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Link href={actionHref} style={styles.viewAll}>
        {actionLabel}  â†’
      </Link>
    </View>
  );
}
*/
function SectionHeader({
  title,
  actionHref,
  actionLabel = "View all",
  icon,
}: {
  title: string;
  actionHref: Href;
  actionLabel?: string;
  icon?: IconSvgElement;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon ? (
          <View style={styles.sectionTitleIcon}>
            <HugeiconsIcon color={colors.primary} icon={icon} size={20} strokeWidth={2.1} />
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Link href={actionHref} style={styles.viewAll}>
        {actionLabel}  →
      </Link>
    </View>
  );
}

function CountdownText({
  compact = false,
  endsAt,
  small = false,
  tone = "dark",
}: {
  compact?: boolean;
  endsAt: string;
  small?: boolean;
  tone?: "dark" | "light";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const label = countdownLabel(endsAt, now);
  if (!label) {
    return null;
  }

  const contentColor = tone === "light" ? colors.surface : "#4B5563";

  return (
    <View style={[styles.countdown, small ? styles.countdownSmall : null, compact ? styles.countdownCompact : null]}>
      <HugeiconsIcon color={contentColor} icon={Clock01Icon} size={small ? 14 : 16} strokeWidth={2} />
      <Text style={[styles.countdownText, small ? styles.countdownTextSmall : null, tone === "light" ? styles.countdownTextLight : null]}>{label}</Text>
    </View>
  );
}

function HomeEmptyState({ isError, isLoading }: { isError: boolean; isLoading: boolean }) {
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading marketplace home...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState title="Home could not load" message="Check the API URL or your connection, then pull to refresh." />
      </View>
    );
  }

  return null;
}

function buildFeed(home?: MobileHome): HomeFeedItem[] {
  if (!home) {
    return [];
  }

  const deals = home.productRails.deals.length ? home.productRails.deals : home.productRails.featured;
  const allProducts = uniqueProducts([
    ...home.productRails.deals,
    ...home.productRails.featured,
    ...home.productRails.latest,
  ]);

  const visibleSections = home.sections.filter(isVisibleHomepageSection);
  const customSections = visibleSections.filter(isCustomHomepageSection);
  const operationalSections = visibleSections.filter((section) => !isCustomHomepageSection(section));
  const productRails = buildMobileProductFeedRails(home, allProducts);

  return [
    { id: "hero", type: "hero", banners: home.banners },
    { id: "personalized", type: "personalized", home },
    { id: "trust", type: "trust" },
    { id: "categories", type: "categories", categories: home.categories },
    ...customSections.map((section) => ({
      id: `section-${section.id}`,
      type: "admin-section" as const,
      section,
      products: productsForSection(section, allProducts, deals),
    })),
    ...operationalSections.map((section) => ({
      id: `section-${section.id}`,
      type: "admin-section" as const,
      section,
      products: productsForSection(section, allProducts, deals),
    })),
    ...productRails,
    { id: "stores", type: "stores", stores: home.storesNearYou },
  ];
}

function buildMobileProductFeedRails(home: MobileHome, allProducts: MobileProduct[]): HomeFeedItem[] {
  const todayDeals = uniqueProducts(home.productRails.deals).slice(0, 10);
  const bestSellers = distinctMobileRailProducts(uniqueProducts(home.productRails.featured), todayDeals).slice(0, 10);
  const newArrivals = distinctMobileRailProducts(
    uniqueProducts(home.productRails.latest),
    [...todayDeals, ...bestSellers],
  ).slice(0, 10);
  const nearbyProducts = distinctMobileRailProducts(
    productsFromNearbyStores(allProducts, home.storesNearYou),
    [...todayDeals, ...bestSellers, ...newArrivals],
  ).slice(0, 10);

  return [
    {
      id: "todays-deals",
      type: "product-rail" as const,
      title: "Today's Deals",
      actionHref: "/deals" as Href,
      icon: CouponPercentIcon,
      badge: "Deal",
      products: todayDeals,
      variant: "lead" as const,
    },
    {
      id: "best-sellers",
      type: "product-rail" as const,
      title: "Best Sellers",
      actionHref: "/search?sort=rating" as Href,
      icon: Award01Icon,
      badge: "Best",
      products: bestSellers.length ? bestSellers : uniqueProducts(home.productRails.featured).slice(0, 10),
      variant: "lead" as const,
    },
    {
      id: "new-arrivals",
      type: "product-rail" as const,
      title: "New Arrivals",
      actionHref: "/search?sort=newest" as Href,
      icon: FlashIcon,
      badge: "New",
      products: newArrivals.length ? newArrivals : uniqueProducts(home.productRails.latest).slice(0, 10),
      variant: "compact" as const,
    },
    {
      id: "nearby-products",
      type: "product-rail" as const,
      title: "Nearby Products",
      actionHref: "/local-shops" as Href,
      icon: Location01Icon,
      badge: "Nearby",
      products: nearbyProducts.length ? nearbyProducts : productsFromNearbyStores(allProducts, home.storesNearYou).slice(0, 10),
      variant: "compact" as const,
    },
  ].filter((item) => item.products.length > 0);
}

function productsForSection(section: MobileHomepageSection, products: MobileProduct[], deals: MobileProduct[]) {
  if (section.sectionType === "deal_strip") {
    return deals;
  }

  if (!sectionIsProductSection(section)) {
    return [];
  }

  const selectedIds = new Set(
    (section.config?.items ?? [])
      .map((item) => stringValue(item.sourceId))
      .filter(Boolean),
  );

  if (!selectedIds.size) {
    return products.slice(0, 10);
  }

  return products.filter((product) => selectedIds.has(product.id));
}

function isVisibleHomepageSection(section: MobileHomepageSection) {
  if (section.sectionType !== "deal_strip") {
    return true;
  }

  return !isExpiredTimestamp(stringValue(section.config?.timerEndsAt) || stringValue(section.config?.endsAt));
}

function sectionIsProductSection(section: MobileHomepageSection) {
  return ["featured_products", "product_rail", "products", "new_arrivals", "popular_products"].includes(
    section.sectionType,
  );
}

const BUILT_IN_HOMEPAGE_SECTION_TYPES = new Set([
  "featured_categories",
  "featured_products",
  "featured_stores",
  "deal_strip",
  "seller_cta",
  "service_badges",
  "trust_highlights",
]);

function isCustomHomepageSection(section: MobileHomepageSection) {
  return !BUILT_IN_HOMEPAGE_SECTION_TYPES.has(section.sectionType);
}

function uniqueProducts(products: MobileProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }

    seen.add(product.id);
    return true;
  });
}

function distinctMobileRailProducts(products: MobileProduct[], usedProducts: MobileProduct[]) {
  const used = new Set(usedProducts.map((product) => product.id));
  return products.filter((product) => !used.has(product.id));
}

function productsFromNearbyStores(products: MobileProduct[], stores: MobileStore[]) {
  const nearbySellerIds = new Set(stores.map((store) => store.id));
  if (!nearbySellerIds.size) {
    return [];
  }

  return uniqueProducts(
    products.filter((product) => {
      const sellerId = product.sellerId ?? product.seller?.id ?? null;
      return Boolean(sellerId && nearbySellerIds.has(sellerId));
    }),
  );
}

function normalizeSectionItems(items: MobileHomepageSectionItem[] | undefined): NormalizedSectionItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const label = stringValue(item.label) || stringValue(item.title) || stringValue(item.name);
      if (!label) {
        return null;
      }

      return {
        label,
        description: stringValue(item.description) || stringValue(item.subtitle),
        imageUrl: stringValue(item.imageUrl) || stringValue(item.image) || null,
        linkUrl: stringValue(item.linkUrl) || stringValue(item.href) || stringValue(item.url),
        badge: stringValue(item.badge),
      };
    })
    .filter((item): item is NormalizedSectionItem => Boolean(item));
}

function locationFromArea(area: LocationArea): SelectedLocation {
  const postalCode = area.postalCode?.trim();
  const localArea = area.name.trim();
  const city = area.city.name.trim();
  const state = area.city.subdivision.name.trim();
  const primary = `${localArea}${postalCode ? ` (${postalCode})` : ""}`;
  const labelParts = [primary, city, state].filter(Boolean);

  return {
    label: labelParts.join(", "),
    ...(postalCode ? { pincode: postalCode } : {}),
    countryCode: area.city.subdivision.country.code,
    stateCode: area.city.subdivision.code,
    cityCode: area.city.code,
    localAreaCode: area.code,
  };
}

function fallbackCountry(countryCode: string, name: string, currency: string, locale: string): MobileLocationCountry {
  return {
    code: countryCode,
    currency,
    enabled: true,
    id: `fallback-${countryCode}`,
    locale,
    name,
    phoneCode: "",
    postalCodeLabel: "Postal code",
    sortOrder: 0,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/* function formatPrice(pricePaise?: number | null) {
  if (typeof pricePaise !== "number") {
    return "View price";
  }

  return `₹${Math.round(pricePaise / 100).toLocaleString("en-IN")}`;
}

*/

function storeInitials(storeName: string) {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  const firstWord = words[0] ?? "";
  const secondWord = words[1] ?? "";
  const initials = secondWord ? `${firstWord.charAt(0)}${secondWord.charAt(0)}` : firstWord.slice(0, 2);
  return (initials || "1H").toUpperCase();
}

function formatStoreDistance(distanceMeters?: number | null) {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return null;
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m away`;
  }

  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10_000 ? 1 : 0)} km away`;
}

function storeMatchLabel(matchLevel?: MobileStore["locationMatchLevel"]) {
  if (matchLevel === "LOCAL_AREA") {
    return "Nearby";
  }

  if (matchLevel === "CITY") {
    return "City";
  }

  if (matchLevel === "STATE") {
    return "State";
  }

  if (matchLevel === "COUNTRY") {
    return "India";
  }

  return "Store";
}

function personalizedProductsFromCart(cart: Awaited<ReturnType<typeof getCart>> | undefined) {
  return uniqueMobilePersonalizedProducts(
    (cart?.items ?? [])
      .map((item): MobilePersonalizedProduct | null => {
        const product = item.productVariant?.product;
        if (!product?.slug) {
          return null;
        }

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          imageUrl: product.images?.[0]?.url ?? null,
          categoryId: product.categoryId ?? product.category?.id ?? null,
          categoryName: product.category?.name ?? null,
          categorySlug: product.category?.slug ?? null,
          sellerId: product.sellerId ?? product.seller?.id ?? null,
          sellerName: product.seller?.storeName ?? "1HandIndia seller",
          sellerSlug: product.seller?.slug ?? null,
          pricePaise: item.productVariant?.pricePaise ?? item.unitPricePaise ?? null,
          mrpPaise: item.productVariant?.mrpPaise ?? null,
          badge: "In cart",
          stockQuantity: item.productVariant?.stockQuantity ?? null,
          variantStatus: item.productVariant?.status ?? null,
        } satisfies MobilePersonalizedProduct;
      })
      .filter((item): item is MobilePersonalizedProduct => item !== null),
  );
}

function personalizedProductsFromOrders(orders: Awaited<ReturnType<typeof listCustomerOrders>>["items"]) {
  const orderedProducts = orders.flatMap((order, orderIndex) =>
    (order.items ?? [])
      .map((item): { orderIndex: number; orderedAtMs: number; product: MobilePersonalizedProduct } | null => {
        if (!item.product?.slug) {
          return null;
        }

        return {
          orderIndex,
          orderedAtMs: timestampMs(order.createdAt),
          product: {
            id: item.product.id ?? item.product.slug,
            name: item.productNameSnapshot,
            slug: item.product.slug,
            imageUrl: item.product.imageUrl ?? item.product.images?.[0]?.url ?? null,
            categoryId: item.product.categoryId ?? item.product.category?.id ?? null,
            categoryName: item.product.category?.name ?? null,
            categorySlug: item.product.category?.slug ?? null,
            sellerId: item.sellerId ?? item.seller?.id ?? null,
            sellerName: item.seller?.storeName ?? "1HandIndia seller",
            sellerSlug: item.seller?.slug ?? null,
            pricePaise: item.lineTotalPaise && item.quantity ? Math.round(item.lineTotalPaise / item.quantity) : null,
            mrpPaise: null,
            badge: "Ordered",
            stockQuantity: null,
            variantStatus: null,
          },
        };
      })
      .filter((item): item is { orderIndex: number; orderedAtMs: number; product: MobilePersonalizedProduct } => item !== null),
  );

  orderedProducts.sort((a, b) => b.orderedAtMs - a.orderedAtMs || a.orderIndex - b.orderIndex);

  return orderedProducts.map((item) => item.product).slice(0, 20);
}

function personalizedProductFromMobileProduct(product: MobileProduct, badge?: string): MobilePersonalizedProduct {
  const variant = product.variants?.[0];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.images?.[0]?.url ?? null,
    categoryId: product.categoryId ?? product.category?.id ?? null,
    categoryName: product.category?.name ?? null,
    categorySlug: product.category?.slug ?? null,
    sellerId: product.sellerId ?? product.seller?.id ?? null,
    sellerName: product.seller?.storeName ?? "1HandIndia seller",
    sellerSlug: product.seller?.slug ?? null,
    pricePaise: variant?.pricePaise ?? null,
    mrpPaise: variant?.mrpPaise ?? null,
    rating: product.reviewSummary?.averageRating ?? null,
    reviewCount: product.reviewSummary?.reviewCount ?? null,
    stockQuantity: variant?.stockQuantity ?? null,
    variantStatus: variant?.status ?? null,
    ...(badge ? { badge } : {}),
  };
}

function personalizedProductFromRecent(product: RecentProductSnapshot): MobilePersonalizedProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId ?? null,
    categoryName: product.categoryName ?? null,
    categorySlug: product.categorySlug ?? null,
    sellerId: product.sellerId ?? null,
    sellerName: product.sellerName,
    sellerSlug: product.sellerSlug ?? null,
    pricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise,
    badge: "Viewed",
    stockQuantity: null,
    variantStatus: null,
    viewedAt: product.viewedAt,
  };
}

function uniqueMobilePersonalizedProducts(products: MobilePersonalizedProduct[]) {
  const seen = new Set<string>();
  const unique: MobilePersonalizedProduct[] = [];

  for (const product of products) {
    const key = product.id || product.slug;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(product);
  }

  return unique;
}

function timestampMs(value?: string) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function productHasDeal(product: MobileProduct) {
  const variant = product.variants?.[0];
  return Boolean(variant?.mrpPaise && variant.pricePaise && variant.mrpPaise > variant.pricePaise);
}

function discountPercent(pricePaise?: number | null, mrpPaise?: number | null) {
  if (!pricePaise || !mrpPaise || mrpPaise <= pricePaise) {
    return 0;
  }

  return Math.max(1, Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100));
}

function isExpiredTimestamp(value: string) {
  if (!value) {
    return false;
  }

  const end = new Date(value).getTime();
  return !Number.isNaN(end) && end <= Date.now();
}

function countdownLabel(value: string, now: number) {
  const end = new Date(value).getTime();
  if (Number.isNaN(end)) {
    return null;
  }

  const remainingMs = end - now;
  if (remainingMs <= 0) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")} : ${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}`;
}

function findMatchingCategory(categories: MobileCategory[], featuredCategory: FeaturedCategory) {
  return categories.find((category) => {
    const normalized = `${category.name} ${category.slug}`.toLowerCase();
    return featuredCategory.aliases.some((alias) => normalized.includes(alias));
  });
}

const styles = StyleSheet.create({
  feedContent: {
    backgroundColor: colors.secondary,
    paddingBottom: 194,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  compactIntro: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 11,
    minWidth: 0,
  },
  compactLogoBadge: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderColor: "#F8DED5",
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    width: 48,
  },
  compactIntroCopy: {
    flex: 1,
    minWidth: 0,
  },
  greetingText: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
  },
  compactHeaderTitle: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
    marginTop: 1,
  },
  compactHeaderSubtitle: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: 1,
  },
  iconButton: {
    paddingVertical: 8,
  },
  logoWrap: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    minWidth: 0,
  },
  logoBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    elevation: 5,
    height: 58,
    justifyContent: "center",
    marginRight: 12,
    shadowColor: colors.primary,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    width: 58,
  },
  logoBadgeText: {
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 38,
    fontWeight: "900",
  },
  logoText: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
  },
  logoAccent: {
    color: colors.primary,
  },
  logoSubtext: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "800",
    marginTop: -2,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  locationWrap: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    elevation: 2,
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
    maxWidth: "100%",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
  },
  locationText: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 15,
    fontWeight: "900",
    maxWidth: 286,
  },
  currencyPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF0EC",
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerIconLink: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerIconButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    position: "relative",
    width: 42,
  },
  headerIconButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  notificationDot: {
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 2,
    height: 11,
    position: "absolute",
    right: 8,
    top: 7,
    width: 11,
  },
  cartBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11,
    fontWeight: "900",
    minWidth: 19,
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: "absolute",
    right: 0,
    textAlign: "center",
    top: 2,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    elevation: 5,
    flexDirection: "row",
    gap: 14,
    marginTop: 22,
    paddingLeft: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 30,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 16,
    fontWeight: "700",
    minHeight: 72,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    elevation: 3,
    margin: 6,
    minHeight: 58,
    paddingHorizontal: 24,
    paddingVertical: 17,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  searchButtonText: {
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 16,
    fontWeight: "900",
  },
  quickActionsWrap: {
    marginTop: 24,
  },
  quickActionsContent: {
    gap: QUICK_ACTION_TILE_GAP,
    paddingRight: 20,
  },
  quickActionTile: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 24,
    minHeight: 98,
    paddingHorizontal: 0,
    width: QUICK_ACTION_TILE_WIDTH,
  },
  quickActionTilePressed: {
    opacity: 0.76,
    transform: [{ scale: 0.97 }],
  },
  quickActionIcon: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(237, 53, 0, 0.08)",
    elevation: 1,
    height: 68,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    width: 68,
  },
  quickActionLabel: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
    marginTop: 9,
    textAlign: "center",
  },
  modalOverlay: {
    backgroundColor: "rgba(15, 23, 42, 0.32)",
    flex: 1,
    justifyContent: "flex-end",
  },
  locationSheet: {
    backgroundColor: colors.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    padding: 18,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#CBD5E1",
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 44,
  },
  sheetHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
  },
  sheetSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 270,
  },
  closeButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  locationSearchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginTop: 18,
    paddingHorizontal: 13,
  },
  locationSearchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 50,
  },
  marketSelectorCard: {
    backgroundColor: colors.surface,
    borderColor: "#F8D9CE",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  marketSelectorHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  marketSelectorCopy: {
    flex: 1,
    minWidth: 0,
  },
  marketSelectorLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  marketSelectorValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },
  countrywideButton: {
    backgroundColor: "#FFF0EC",
    borderColor: "#FFD9CF",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countrywideButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  countryRail: {
    gap: 8,
    paddingTop: 10,
  },
  countryChip: {
    backgroundColor: "#FFFCFB",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  countryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  countryChipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  countryChipTextActive: {
    color: colors.surface,
  },
  countryChipSubtext: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
    maxWidth: 84,
  },
  countryChipSubtextActive: {
    color: "#FFE7DF",
  },
  locationLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  locationLoadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  locationError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 14,
  },
  locationResults: {
    marginTop: 10,
  },
  locationResult: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 9,
    padding: 13,
  },
  locationResultTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  locationResultText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  locationEmpty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    padding: 16,
    textAlign: "center",
  },
  heroCarouselWrap: {
    marginHorizontal: 20,
    marginTop: 26,
    position: "relative",
  },
  heroCarousel: {
    borderRadius: 26,
    overflow: "hidden",
  },
  heroCard: {
    backgroundColor: "#FFF0E4",
    borderColor: "#F8E4D8",
    borderRadius: 26,
    borderWidth: 1,
    elevation: 4,
    height: 252,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
  },
  heroImage: {
    bottom: 0,
    height: "100%",
    left: 0,
    opacity: 0.9,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
  heroScrim: {
    backgroundColor: "rgba(255, 244, 235, 0.84)",
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: "60%",
  },
  heroFallbackArt: {
    bottom: 0,
    height: "100%",
    position: "absolute",
    right: 0,
    top: 0,
    width: "58%",
  },
  heroBagLarge: {
    backgroundColor: "#FF8A00",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    bottom: 42,
    height: 110,
    position: "absolute",
    right: 52,
    shadowColor: "#ED3500",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 106,
  },
  heroBagSmall: {
    backgroundColor: "#F97316",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    bottom: 56,
    height: 82,
    position: "absolute",
    right: 18,
    width: 78,
  },
  heroShield: {
    backgroundColor: "#22C55E",
    borderRadius: 999,
    bottom: 124,
    height: 52,
    opacity: 0.92,
    position: "absolute",
    right: 124,
    transform: [{ rotate: "-12deg" }],
    width: 52,
  },
  heroPercent: {
    backgroundColor: "#F54A24",
    borderRadius: 18,
    bottom: 50,
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 30,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    right: 118,
    transform: [{ rotate: "-13deg" }],
  },
  svgImageSurface: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroContent: {
    justifyContent: "center",
    minHeight: 252,
    padding: 24,
    width: "63%",
    zIndex: 2,
  },
  heroPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 12,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  heroSubtitle: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    marginTop: 9,
  },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    borderRadius: 999,
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 14,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  heroDots: {
    alignItems: "center",
    bottom: 14,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  heroDot: {
    backgroundColor: "#D1D5DB",
    borderRadius: 999,
    height: 8,
    width: 10,
  },
  heroDotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  trustCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 3,
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 28,
    paddingHorizontal: 8,
    paddingVertical: 22,
    shadowColor: "#111827",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
  },
  trustItem: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 8,
  },
  trustItemBorder: {
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
  },
  trustTitle: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  trustSubtitle: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },
  trustIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  personalizedWrap: {
    gap: 26,
    marginTop: 26,
  },
  cartReminderCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F5DED5",
    borderRadius: 24,
    borderWidth: 1,
    elevation: 3,
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    padding: 16,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  cartReminderIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  cartReminderCopy: {
    flex: 1,
    minWidth: 0,
  },
  cartReminderTitle: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 15,
    fontWeight: "900",
  },
  cartReminderText: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  cartReminderButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    flexShrink: 0,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  personalizedSection: {
    gap: 14,
  },
  personalizedHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  personalizedTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 9,
    minWidth: 0,
  },
  personalizedIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  personalizedTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 19,
    fontWeight: "900",
  },
  personalizedViewAll: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    flexShrink: 0,
    fontSize: 13,
    fontWeight: "900",
  },
  personalizedRail: {
    paddingLeft: PERSONALIZED_RAIL_SIDE_PADDING,
    paddingRight: PERSONALIZED_RAIL_SIDE_PADDING,
  },
  personalizedRailItem: {
    marginRight: PERSONALIZED_RAIL_CARD_GAP,
  },
  personalizedSkeleton: {
    backgroundColor: "#F4F5F7",
    borderColor: "#EAECF0",
    borderRadius: 24,
    borderWidth: 1,
    height: 284,
    width: 174,
  },
  recommendedSkeleton: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    height: 336,
  },
  recommendedProductCard: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 5,
    overflow: "hidden",
    padding: 10,
    shadowColor: colors.primary,
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
  },
  recommendedProductCardLead: {
    height: 342,
    padding: 12,
  },
  recommendedProductCardCompact: {
    height: 322,
  },
  recommendedProductCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  recommendedImageWrap: {
    alignItems: "center",
    backgroundColor: "#FFF6F1",
    borderColor: "#F8E8E1",
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  recommendedImageWrapLead: {
    borderRadius: 24,
  },
  recommendedImageWrapCompact: {
    borderRadius: 22,
  },
  recommendedProductImage: {
    height: "100%",
    width: "100%",
  },
  recommendedBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    justifyContent: "center",
    left: 10,
    minHeight: 25,
    minWidth: 50,
    paddingHorizontal: 9,
    position: "absolute",
    top: 10,
  },
  recommendedBadgeText: {
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "900",
  },
  recommendedHeartButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    elevation: 4,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    top: 10,
    width: 36,
  },
  recommendedBody: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 10,
  },
  recommendedBodyLead: {
    gap: 7,
  },
  recommendedBodyCompact: {
    gap: 5,
  },
  recommendedProductName: {
    color: "#111827",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12.6,
    fontWeight: "900",
    lineHeight: 17,
    minHeight: 34,
  },
  recommendedProductNameLead: {
    fontSize: 13.8,
    lineHeight: 19,
    minHeight: 38,
  },
  recommendedSellerName: {
    color: "#6B7280",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.8,
    fontWeight: "800",
    minHeight: 14,
  },
  recommendedSellerNameLead: {
    fontSize: 11.5,
    minHeight: 16,
  },
  recommendedMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "space-between",
    minHeight: 24,
  },
  recommendedCategoryPill: {
  backgroundColor: "#FFF5F0",
  borderRadius: 9999,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderWidth: 1,
  borderColor: "#FFE2D5",
  alignItems: "center",
  justifyContent: "center",
  maxWidth: 110,
  minHeight: 28,
},

recommendedCategoryPillText: {
  color: "#E85D2A",
  fontSize: 11,
  fontWeight: "700",
  letterSpacing: 0.2,
  textAlign: "center",
  flexShrink: 1,
},
  recommendedRatingRow: {
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 999,
    flexDirection: "row",
    gap: 3,
    minHeight: 22,
    paddingHorizontal: 6,
  },
  recommendedRatingText: {
    color: "#111827",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.2,
    fontWeight: "900",
  },
  recommendedFreshPill: {
    backgroundColor: "#ECFDF3",
    borderRadius: 999,
    color: "#15935D",
    flexShrink: 0,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  recommendedFooter: {
    alignItems: "flex-start",
    gap: 4,
    minHeight: 46,
  },
  recommendedPriceBlock: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 7,
    minWidth: 0,
  },
  recommendedPrice: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 17,
    fontWeight: "900",
  },
  recommendedMrp: {
    color: "#9AA4B2",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11,
    fontWeight: "800",
    textDecorationLine: "line-through",
  },
  recommendedStockPill: {
    borderRadius: 999,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  recommendedStockIn: {
    backgroundColor: "#ECFDF3",
    color: "#15935D",
  },
  recommendedStockOut: {
    backgroundColor: "#FFF1F0",
    color: colors.primary,
  },
  recommendedCta: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    elevation: 3,
    flexDirection: "row",
    gap: 8,
    height: 38,
    justifyContent: "center",
    marginTop: "auto",
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  recommendedCtaLead: {
    height: 42,
  },
  recommendedCtaCompact: {
    height: 36,
  },
  recommendedCtaText: {
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "900",
  },
  recommendedCtaArrow: {
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 15,
    fontWeight: "900",
    marginTop: -1,
  },
  personalizedProductCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 3,
    height: 286,
    overflow: "hidden",
    padding: 12,
    shadowColor: colors.primary,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },
  personalizedProductCardPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  personalizedProductImageWrap: {
    backgroundColor: "#FFFAF8",
    borderColor: "#F8ECE6",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  personalizedProductImage: {
    height: "100%",
    width: "100%",
  },
  personalizedProductBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10,
    fontWeight: "900",
    left: 7,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
    top: 7,
    zIndex: 2,
  },
  personalizedProductName: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 13.2,
    fontWeight: "700",
    lineHeight: 18,
    minHeight: 36,
  },
  personalizedProductDetails: {
    gap: 6,
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 6,
  },
  personalizedProductSeller: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "800",
  },
  personalizedPriceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 24,
  },
  personalizedPrice: {
    color: colors.primary,
    flexShrink: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 17,
    fontWeight: "900",
  },
  personalizedMrp: {
    color: "#9AA4B2",
    flexShrink: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  personalizedRatingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "flex-start",
    minHeight: 18,
  },
  personalizedRatingStar: {
    color: "#15935D",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    fontWeight: "900",
  },
  personalizedRatingText: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "900",
  },
  personalizedRatingPlaceholder: {
    color: "#98A2B3",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "800",
  },
  buyAgainSection: {
    gap: 12,
    paddingHorizontal: 20,
  },
  buyAgainCardSkeleton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    minHeight: 156,
    padding: 14,
    shadowColor: colors.primary,
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },
  buyAgainSkeletonThumb: {
    backgroundColor: "#FFF2EE",
    borderRadius: 24,
    height: 118,
    width: 118,
  },
  buyAgainSkeletonCopy: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  buyAgainSkeletonLineWide: {
    backgroundColor: "#F6E9E3",
    borderRadius: 999,
    height: 14,
    width: "86%",
  },
  buyAgainSkeletonLine: {
    backgroundColor: "#F7EFEA",
    borderRadius: 999,
    height: 12,
    width: "58%",
  },
  buyAgainSkeletonPrice: {
    backgroundColor: "#FFE2D8",
    borderRadius: 999,
    height: 16,
    width: 74,
  },
  buyAgainSkeletonButton: {
    backgroundColor: "#FFF2EE",
    borderRadius: 999,
    height: 44,
    width: 118,
  },
  buyAgainCard: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 5,
    gap: 14,
    minHeight: 176,
    padding: 14,
    shadowColor: colors.primary,
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 30,
  },
  buyAgainCardCompact: {
    minHeight: 196,
  },
  buyAgainCardPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  buyAgainContentRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: 16,
    minWidth: 0,
  },
  buyAgainThumb: {
    alignItems: "center",
    backgroundColor: "#FFF6F1",
    borderColor: "#F8ECE6",
    borderRadius: 24,
    borderWidth: 1,
    elevation: 2,
    height: 120,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    minWidth: 118,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    width: 118,
  },
  buyAgainImage: {
    height: "100%",
    width: "100%",
  },
  buyAgainImageBadge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    bottom: 9,
    elevation: 3,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 9,
    shadowColor: colors.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    width: 28,
  },
  buyAgainMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "space-between",
    marginBottom: 8,
  },
  buyAgainTag: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFF2EE",
    borderRadius: 999,
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  buyAgainTagText: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "900",
  },
  buyAgainCopy: {
    flex: 1,
    justifyContent: "space-between",
    minWidth: 0,
  },
  buyAgainProductName: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 15.5,
    fontWeight: "900",
    lineHeight: 20,
    minHeight: 40,
  },
  buyAgainSeller: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12.5,
    fontWeight: "800",
    marginTop: 4,
  },
  buyAgainPriceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 7,
    minHeight: 24,
  },
  buyAgainPrice: {
    color: colors.primary,
    flexShrink: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 18,
    fontWeight: "900",
  },
  buyAgainMrp: {
    color: "#9AA4B2",
    flexShrink: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "800",
    textDecorationLine: "line-through",
  },
  buyAgainStockPill: {
    borderRadius: 999,
    flexShrink: 0,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  buyAgainStockIn: {
    backgroundColor: "#ECFDF3",
    color: "#15935D",
  },
  buyAgainStockOut: {
    backgroundColor: "#FFF1F0",
    color: colors.primary,
  },
  buyAgainButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: 999,
    elevation: 3,
    flexDirection: "row",
    flexShrink: 0,
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  buyAgainButtonCompact: {
    alignSelf: "stretch",
  },
  buyAgainButtonText: {
    color: colors.surface,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 13,
    fontWeight: "900",
  },
  buyAgainStateCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 26,
    borderWidth: 1,
    elevation: 3,
    flexDirection: "row",
    gap: 12,
    minHeight: 112,
    padding: 14,
    shadowColor: colors.primary,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 22,
  },
  buyAgainStateIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderColor: "#F8DFD6",
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  buyAgainStateCopy: {
    flex: 1,
    minWidth: 0,
  },
  buyAgainStateTitle: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14.5,
    fontWeight: "900",
  },
  buyAgainStateText: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
  },
  buyAgainStateButton: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderRadius: 15,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
  },
  buyAgainStateButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  buyAgainStateButtonText: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "900",
  },
  section: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  sectionTitleIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sectionTitle: {
    color: colors.ink,
    flexShrink: 1,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 20,
    fontWeight: "900",
  },
  viewAll: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 13,
    fontWeight: "900",
  },
  sectionDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 7,
  },
  categoryScroll: {
    marginTop: 18,
  },
  categoryContent: {
    paddingRight: 20,
  },
  categoryItem: {
    marginRight: 22,
    width: 86,
  },
  categoryCircle: {
    alignItems: "center",
    borderRadius: 48,
    borderWidth: 1,
    borderColor: "rgba(237, 53, 0, 0.07)",
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  categoryImage: {
    borderRadius: 38,
    height: 60,
    width: 60,
  },
  categoryInitial: {
    fontSize: 31,
    fontWeight: "900",
  },
  categoryName: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
    marginTop: 10,
    textAlign: "center",
  },
  flashSection: {
    backgroundColor: "#101C3C",
    borderRadius: 20,
    marginHorizontal: 18,
    marginTop: 26,
    overflow: "hidden",
    padding: 16,
  },
  flashIntro: {
    justifyContent: "center",
  },
  flashTitleBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  flashTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 5,
    minWidth: 0,
  },
  flashLabel: {
    color: colors.surface,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  flashTimerPill: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  flashHeadline: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 10,
  },
  flashButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 999,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 18,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  flashProducts: {
    marginTop: 16,
  },
  dealCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 2,
    marginRight: 12,
    overflow: "hidden",
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  dealImageWrap: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  dealImage: {
    height: "100%",
    width: "100%",
  },
  dealImageFallback: {
    backgroundColor: colors.softSurface,
    height: "100%",
    width: "100%",
  },
  discountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: colors.surface,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    right: 16,
    top: 16,
  },
  dealDiscountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: colors.surface,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    left: 8,
    top: 8,
  },
  productDiscountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    color: colors.surface,
    fontSize: 10,
    fontWeight: "900",
    left: 8,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
    top: 8,
    zIndex: 2,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 8,
  },
  dealPrice: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  dealName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
    marginTop: 10,
    minHeight: 34,
  },
  dealCta: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    overflow: "hidden",
    paddingVertical: 8,
    textAlign: "center",
  },
  mrpText: {
    color: "#9AA4B2",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  countdown: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 9,
  },
  countdownSmall: {
    marginTop: 7,
  },
  countdownCompact: {
    marginTop: 0,
  },
  countdownText: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "800",
  },
  countdownTextLight: {
    color: colors.surface,
  },
  countdownTextSmall: {
    fontSize: 11,
  },
  timerRow: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  genericSectionScroll: {
    marginTop: 14,
  },
  adminMiniCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 12,
    overflow: "hidden",
    padding: 10,
    position: "relative",
    width: 154,
  },
  adminMiniImage: {
    borderRadius: 8,
    height: 112,
    width: "100%",
  },
  adminMiniFallback: {
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 112,
    width: "100%",
  },
  adminMiniTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
    marginTop: 9,
  },
  adminMiniDescription: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 4,
  },
  productScroll: {
    marginTop: 16,
  },
  productScrollContent: {
    alignItems: "stretch",
    paddingBottom: 14,
    paddingRight: 20,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 3,
    marginRight: 18,
    overflow: "hidden",
    padding: 12,
    shadowColor: colors.primary,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
  },
  productCardContent: {
    gap: 10,
  },
  productTextContainer: {
    gap: 6,
  },
  productImageWrap: {
    backgroundColor: "#FFFAF8",
    borderColor: "#F8ECE6",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  productImage: {
    backgroundColor: "#FFFAF8",
    height: "100%",
    width: "100%",
  },
  productImageFallback: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  productImageFallbackCompact: {
    borderRadius: 18,
  },
  productHeartButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    elevation: 3,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    shadowColor: colors.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    top: 8,
    width: 36,
    zIndex: 2,
  },
  productName: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.5,
    minHeight: 39,
  },
  productSeller: {
    color: colors.muted,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "800",
  },
  productBadgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  productTrendBadge: {
    backgroundColor: "#FFF5EF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  productTrendText: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "900",
  },
  productStockBadge: {
    backgroundColor: "#EAF9EF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  productStockText: {
    color: "#087A34",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 10.5,
    fontWeight: "900",
  },
  productPrice: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 18.5,
    fontWeight: "900",
  },
  productMrp: {
    color: "#9AA4B2",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 11.5,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  ratingText: {
    color: colors.primary,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  productCta: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    elevation: 2,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 40,
    paddingHorizontal: 10,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
  },
  productCtaText: {
    color: colors.surface,
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: "900",
    textAlign: "center",
  },
  productRatingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "flex-end",
    marginTop: 8,
  },
  productRatingStar: {
    color: "#15935D",
    fontFamily: "Plus Jakarta Sans",
    fontSize: 14,
    fontWeight: "900",
  },
  productRatingText: {
    color: colors.ink,
    fontFamily: "Plus Jakarta Sans",
    fontSize: 12,
    fontWeight: "900",
  },
  imageDots: {
    alignItems: "center",
    bottom: 8,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  imageDot: {
    backgroundColor: "#D0D5DD",
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  imageDotActive: {
    backgroundColor: colors.primary,
  },
  storeScroll: {
    marginTop: 14,
  },
  storeScrollContent: {
    paddingBottom: 14,
    paddingRight: 20,
  },
  storeCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 20,
    borderWidth: 1,
    elevation: 3,
    flexDirection: "row",
    gap: 9,
    height: 88,
    marginRight: 12,
    overflow: "hidden",
    padding: 10,
    position: "relative",
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    width: 168,
  },
  storeMainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  storeContent: {
    flex: 1,
    minWidth: 0,
  },
  storeTitleLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  storeLogoSurface: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderColor: "#FBE0D7",
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
    height: 44,
    justifyContent: "center",
    overflow: "hidden",
    width: 44,
  },
  storeLogo: {
    height: "100%",
    width: "100%",
  },
  storeLogoInitial: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
  },
  storeCompactCopy: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 16,
  },
  storeRatingLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    marginTop: 4,
    minHeight: 16,
  },
  storeRatingBubble: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  storeReviewText: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
  },
  storeDistanceText: {
    bottom: 10,
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: "800",
    left: 63,
    position: "absolute",
    right: 10,
  },
  storeMatchPill: {
    backgroundColor: "#EAF9EF",
    borderRadius: 999,
    flexShrink: 0,
    maxWidth: 86,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  storeMatchText: {
    color: "#087A34",
    fontSize: 10.5,
    fontWeight: "900",
  },
  storeName: {
    color: colors.ink,
    flex: 1,
    fontSize: 12.5,
    fontWeight: "900",
    lineHeight: 16,
    minWidth: 0,
    textAlign: "left",
  },
  storeDescription: {
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: 4,
    textAlign: "left",
  },
  storePillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  storeSoftPill: {
    backgroundColor: "#FFF2EE",
    borderRadius: 999,
    maxWidth: 104,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  storeSoftPillText: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: "900",
  },
  storeSuccessPill: {
    backgroundColor: "#EAF9EF",
  },
  storeSuccessPillText: {
    color: "#087A34",
  },
  storeLocationRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minWidth: 0,
  },
  storeLocationText: {
    color: colors.muted,
    flex: 1,
    fontSize: 11.5,
    fontWeight: "800",
    minWidth: 0,
  },
  storeFooterRow: {
    alignItems: "center",
    borderTopColor: "#F3E7E2",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingTop: 11,
    width: "100%",
  },
  storeStat: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  storeStatText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  storeOpenButton: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderRadius: 18,
    flexShrink: 0,
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 11,
  },
  storeOpenButtonText: {
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: "900",
  },
  storeOpenArrow: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    marginTop: -1,
  },
  loading: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    margin: 18,
    padding: 18,
  },
  loadingText: {
    color: colors.muted,
    marginTop: 8,
  },
  emptyWrap: {
    padding: 18,
  },
});
