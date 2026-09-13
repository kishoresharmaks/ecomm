import {
  CheckmarkCircle01Icon,
  HeartIcon,
  MinusSignIcon,
  PencilEdit01Icon,
  PlusSignIcon,
  Share02Icon,
  Shield01Icon,
  ShoppingCart01Icon,
  StarIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildProductDetailContent } from "@indihub/shared-types";
import { Link, Stack, type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { ProductCard } from "../../src/components/product-card";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { withStorefrontMaintenance } from "../../src/features/maintenance/mobile-maintenance-gate";
import {
  addCartItem,
  addWishlistItem,
  getCart,
  getProduct,
  getReturnPolicySettings,
  getWishlist,
  listProducts,
  removeWishlistItem,
} from "../../src/features/storefront/storefront-api";
import { useProductReviews } from "../../src/features/storefront/use-mobile-reviews";
import { RatingDisplay } from "../../src/components/rating-display";
import {
  formatDate,
} from "../../src/features/account/account-ui";
import { resolveImageUrl } from "../../src/lib/image-url";
import { useRecentProductsStore } from "../../src/state/recent-products-store";
import { colors } from "../../src/theme";
import type { MobileProduct } from "../../src/types/mobile-home";
import type { MobileProductReview, ProductImage, ProductSummary, ProductVariant } from "../../src/types/storefront";

type ProductDetailFeedItem =
  | {
      id: "gallery";
      type: "gallery";
      product: ProductSummary;
      selectedImageUrl: string | null;
      onSelectImage: (imageUrl: string | null) => void;
    }
  | {
      id: "summary";
      isWishlistPending: boolean;
      isWished: boolean;
      onShare: () => void;
      onToggleWishlist: () => void;
      product: ProductSummary;
      selectedVariant: ProductVariant | null;
      type: "summary";
    }
  | {
      id: "variants";
      type: "variants";
      product: ProductSummary;
      selectedVariantId: string | null;
      onSelectVariant: (variantId: string) => void;
    }
  | {
      id: "quantity";
      type: "quantity";
      quantity: number;
      selectedVariant: ProductVariant | null;
      onChangeQuantity: (quantity: number) => void;
    }
  | {
      id: "description";
      type: "description";
      product: ProductSummary;
      selectedVariant: ProductVariant | null;
    }
  | { id: "seller"; type: "seller"; product: ProductSummary }
  | {
      id: "recommendations";
      isWishlistPending: (productId: string) => boolean;
      isWished: (productId: string) => boolean;
      onToggleWishlist: (productId: string, wished: boolean) => void;
      products: MobileProduct[];
      type: "recommendations";
    }
  | {
      id: "reviews";
      type: "reviews";
      product: ProductSummary;
    };

function ProductDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const market = useMobileMarket();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState("");
  const [pendingWishlistProductId, setPendingWishlistProductId] = useState<string | null>(null);
  const rememberRecentProduct = useRecentProductsStore((state) => state.rememberRecentProduct);

  const productQuery = useQuery({
    queryKey: ["mobile-product", slug],
    queryFn: () => getProduct(slug),
    enabled: Boolean(slug),
  });
  const product = productQuery.data;
  const cartQuery = useQuery({
    queryKey: ["mobile-cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 15_000,
  });
  const recommendationsQuery = useQuery({
    queryKey: ["mobile-product-recommendations", product?.categoryId, product?.id],
    queryFn: () =>
      listProducts({
        ...(product?.categoryId ? { categoryId: product.categoryId } : {}),
        limit: 12,
        pagination: "cursor",
      }),
    enabled: Boolean(product?.categoryId),
    staleTime: 60_000,
  });
  const wishlistQuery = useQuery({
    queryKey: ["mobile-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 30_000,
  });
  const returnPolicyQuery = useQuery({
    queryKey: ["mobile-return-policy"],
    queryFn: getReturnPolicySettings,
    staleTime: 5 * 60_000,
  });
  const wishlistProductIds = useMemo(
    () => new Set((wishlistQuery.data?.items ?? []).map((item) => item.productId)),
    [wishlistQuery.data?.items],
  );

  const selectedVariant = useMemo(
    () => selectVariant(product, selectedVariantId),
    [product, selectedVariantId],
  );
  const selectedCartItem = useMemo(
    () =>
      selectedVariant
        ? cartQuery.data?.items.find((item) => item.productVariant?.id === selectedVariant.id) ?? null
        : null,
    [cartQuery.data?.items, selectedVariant],
  );
  const recommendations = useMemo(() => {
    const items = recommendationsQuery.data?.items ?? [];
    // Recommendations are client-filtered until the API supports excludeProductId.
    return items.filter((item) => item.id !== product?.id && item.slug !== product?.slug).slice(0, 8);
  }, [product?.id, product?.slug, recommendationsQuery.data?.items]);
  const feedItems = useMemo<ProductDetailFeedItem[]>(
    () => {
      if (!product) {
        return [];
      }

      const items: ProductDetailFeedItem[] = [
        {
          id: "gallery",
          type: "gallery",
          product,
          selectedImageUrl,
          onSelectImage: setSelectedImageUrl,
        },
        {
          id: "summary",
          isWishlistPending: pendingWishlistProductId === product.id,
          isWished: wishlistProductIds.has(product.id),
          onShare: () => {
            void shareProduct(product, selectedVariant, market.format);
          },
          onToggleWishlist: () => toggleWishlist(product.id, wishlistProductIds.has(product.id)),
          product,
          selectedVariant,
          type: "summary",
        },
        {
          id: "variants",
          type: "variants",
          product,
          selectedVariantId: selectedVariant?.id ?? null,
          onSelectVariant: (variantId) => {
            setSelectedVariantId(variantId);
            setQuantity(1);
            setAddedMessage("");
          },
        },
        {
          id: "quantity",
          type: "quantity",
          quantity,
          selectedVariant,
          onChangeQuantity: (nextQuantity) => {
            setQuantity(nextQuantity);
            setAddedMessage("");
          },
        },
        { id: "description", type: "description", product, selectedVariant },
        { id: "seller", type: "seller", product },
        { id: "reviews", type: "reviews", product },
      ];

      if (recommendations.length >= 4) {
        items.push({
          id: "recommendations",
          isWishlistPending: (productId) => pendingWishlistProductId === productId,
          isWished: (productId) => wishlistProductIds.has(productId),
          onToggleWishlist: toggleWishlist,
          products: recommendations,
          type: "recommendations",
        });
      }

      return items;
    },
    [market.format, pendingWishlistProductId, product, quantity, recommendations, selectedImageUrl, selectedVariant, wishlistProductIds],
  );

  useEffect(() => {
    if (!product) {
      return;
    }

    const nextVariant = selectVariant(product, selectedVariantId);
    if (nextVariant?.id && nextVariant.id !== selectedVariantId) {
      setSelectedVariantId(nextVariant.id);
    }

    const primaryImageUrl = primaryProductImage(product);
    setSelectedImageUrl((current) => current ?? primaryImageUrl);
    rememberRecentProduct(product);
  }, [product, rememberRecentProduct, selectedVariantId]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVariant) {
        throw new Error("Choose an available variant before adding to cart.");
      }

      return addCartItem(customerAuth.authHeaders, selectedVariant.id, quantity);
    },
    onSuccess: async () => {
      setAddedMessage("Added to cart");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-cart", customerAuth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-cart-count", customerAuth.authKey] }),
      ]);
    },
  });
  const wishlistMutation = useMutation({
    mutationFn: async ({ productId, wished }: { productId: string; wished: boolean }) => {
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
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Product" }} />
        <EmptyState title="Product not found" message="Open a product again from home or search." />
      </Screen>
    );
  }

  if (productQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Product" }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading product...</Text>
        </View>
      </Screen>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Product" }} />
        <EmptyState title="Product could not load" message="Check the API connection and try again." />
        <Pressable style={styles.retryButton} onPress={() => void productQuery.refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </Screen>
    );
  }

  const canAddToCart =
    customerAuth.enabled &&
    Boolean(selectedVariant) &&
    selectedVariant?.status === "ACTIVE" &&
    (selectedVariant?.stockQuantity ?? 0) >= quantity &&
    product.listingMode !== "ENQUIRY_ONLY";

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: product.name }} />
      <View style={styles.productScreen}>
        <FlashList
          contentContainerStyle={styles.listContent}
          data={feedItems}
          getItemType={(item) => item.type}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductDetailFeed formatPrice={market.format} item={item} />}
        />
        <ProductActionBar
          addedMessage={addedMessage}
          canAddToCart={canAddToCart}
          isBusy={addMutation.isPending}
          isInCart={Boolean(selectedCartItem) || Boolean(addedMessage)}
          isSignedIn={customerAuth.enabled}
          mutationError={addMutation.error}
          onAdd={() => addMutation.mutate()}
          onGoToCart={() => router.push("/cart")}
          onSignIn={() => router.push("/auth/sign-in")}
          product={product}
          returnPolicy={returnPolicyQuery.data ?? null}
          selectedVariant={selectedVariant}
        />
      </View>
    </Screen>
  );
}

export default withStorefrontMaintenance(ProductDetailScreen);

function ProductDetailFeed({
  formatPrice,
  item,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  item: ProductDetailFeedItem;
}) {
  if (item.type === "gallery") {
    return <ProductGallery onSelectImage={item.onSelectImage} product={item.product} selectedImageUrl={item.selectedImageUrl} />;
  }

  if (item.type === "summary") {
    return (
      <ProductSummaryBlock
        formatPrice={formatPrice}
        isWishlistPending={item.isWishlistPending}
        isWished={item.isWished}
        product={item.product}
        selectedVariant={item.selectedVariant}
        onShare={item.onShare}
        onToggleWishlist={item.onToggleWishlist}
      />
    );
  }

  if (item.type === "variants") {
    return <VariantSelector formatPrice={formatPrice} onSelectVariant={item.onSelectVariant} product={item.product} selectedVariantId={item.selectedVariantId} />;
  }

  if (item.type === "quantity") {
    return <QuantitySelector onChangeQuantity={item.onChangeQuantity} quantity={item.quantity} selectedVariant={item.selectedVariant} />;
  }

  if (item.type === "seller") {
    return <SellerBlock product={item.product} />;
  }

  if (item.type === "recommendations") {
    return (
      <RecommendationsBlock
        formatPrice={formatPrice}
        isWishlistPending={item.isWishlistPending}
        isWished={item.isWished}
        products={item.products}
        onToggleWishlist={item.onToggleWishlist}
      />
    );
  }

  if (item.type === "reviews") {
    return <ReviewsSection product={item.product} />;
  }

  return <DescriptionBlock product={item.product} selectedVariant={item.selectedVariant} />;
}

function ProductGallery({
  onSelectImage,
  product,
  selectedImageUrl,
}: {
  onSelectImage: (imageUrl: string | null) => void;
  product: ProductSummary;
  selectedImageUrl: string | null;
}) {
  const images = productImages(product);
  const heroImage = selectedImageUrl ?? primaryProductImage(product);

  return (
    <View style={styles.gallerySection}>
      {heroImage ? (
        <Pressable onPress={() => {}} style={styles.heroImageWrap}>
          <Image resizeMode="contain" source={{ uri: heroImage }} style={styles.heroImage} />
          {images.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>{images.length}</Text>
            </View>
          )}
        </Pressable>
      ) : (
        <View style={styles.heroImageFallback}>
          <Text style={styles.heroImageFallbackText}>1HI</Text>
        </View>
      )}
      {images.length > 1 ? (
        <FlashList
          data={images}
          horizontal
          keyExtractor={(image, index) => `${image.url}-${index}`}
          renderItem={({ item }) => {
            const imageUrl = resolveImageUrl(item.url);
            const selected = imageUrl === heroImage;
            return (
              <Pressable
                style={[styles.thumbnailButton, selected ? styles.thumbnailButtonActive : null]}
                onPress={() => onSelectImage(imageUrl)}
              >
                {imageUrl ? <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.thumbnailImage} /> : null}
              </Pressable>
            );
          }}
          showsHorizontalScrollIndicator={false}
        />
      ) : null}
    </View>
  );
}

function ProductSummaryBlock({
  formatPrice,
  isWishlistPending,
  isWished,
  onShare,
  onToggleWishlist,
  product,
  selectedVariant,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  isWishlistPending: boolean;
  isWished: boolean;
  onShare: () => void;
  onToggleWishlist: () => void;
  product: ProductSummary;
  selectedVariant: ProductVariant | null;
}) {
  const mrp = variantOriginalDisplayPrice(selectedVariant);
  const price = variantDisplayPrice(selectedVariant);
  const rating = product.reviewSummary?.averageRating;
  const reviewCount = product.reviewSummary?.reviewCount ?? 0;
  const stockQuantity = selectedVariant?.stockQuantity ?? 0;
  const inStock = Boolean(selectedVariant && selectedVariant.status === "ACTIVE" && stockQuantity > 0);
  const lowStock = inStock && stockQuantity > 0 && stockQuantity < 10;
  const discountPercent = useMemo(() => {
    if (!selectedVariant || !price || !mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  }, [selectedVariant, price, mrp]);

  return (
    <View style={styles.section}>
      <Text numberOfLines={2} style={styles.categoryLabel}>
        {product.category?.name ?? "Marketplace product"}
      </Text>
      <Text numberOfLines={3} style={styles.productName}>{product.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceText}>{formatPrice(price)}</Text>
        {mrp && price && mrp > price ? (
          <>
            <Text style={styles.mrpText}>{formatPrice(mrp)}</Text>
            <Text style={styles.discountPill}>-{discountPercent}%</Text>
          </>
        ) : null}
      </View>
      <View style={styles.productActionRow}>
        <Pressable
          accessibilityLabel={isWished ? "Remove from wishlist" : "Add to wishlist"}
          accessibilityRole="button"
          accessibilityState={{ busy: isWishlistPending, selected: isWished }}
          disabled={isWishlistPending}
          style={[styles.productActionButton, isWished ? styles.productActionButtonActive : null, isWishlistPending ? styles.productActionButtonDisabled : null]}
          onPress={onToggleWishlist}
        >
          {isWishlistPending ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <HugeiconsIcon color={isWished ? colors.primary : "#667085"} icon={HeartIcon} size={17} strokeWidth={isWished ? 2.6 : 2} />
          )}
          <Text numberOfLines={1} style={[styles.productActionText, isWished ? styles.productActionTextActive : null]}>
            {isWished ? "Saved" : "Wishlist"}
          </Text>
        </Pressable>
        <Pressable accessibilityLabel="Share product" accessibilityRole="button" style={styles.productActionButton} onPress={onShare}>
          <HugeiconsIcon color="#667085" icon={Share02Icon} size={17} strokeWidth={2} />
          <Text numberOfLines={1} style={styles.productActionText}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.stockPill, inStock ? (lowStock ? styles.stockPillLow : styles.stockPillIn) : styles.stockPillOut]}>
          {!inStock ? "Out of stock" : lowStock ? `Only ${stockQuantity} left` : "In stock"}
        </Text>
        <Text style={styles.metaPill}>
          {rating ? `${rating.toFixed(1)} rating` : "New arrival"}
          {reviewCount ? ` (${reviewCount})` : ""}
        </Text>
        {selectedVariant?.activeDeal ? <Text style={styles.metaPillDeal}>{selectedVariant.activeDeal.title}</Text> : null}
      </View>
    </View>
  );
}

function VariantSelector({
  formatPrice,
  onSelectVariant,
  product,
  selectedVariantId,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  onSelectVariant: (variantId: string) => void;
  product: ProductSummary;
  selectedVariantId: string | null;
}) {
  if (product.variants.length <= 1) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Select option</Text>
      <FlashList
        data={product.variants}
        horizontal
        keyExtractor={(variant) => variant.id}
        renderItem={({ item }) => {
          const disabled = item.status !== "ACTIVE" || item.stockQuantity <= 0;
          const selected = item.id === selectedVariantId;
          return (
            <Pressable
              disabled={disabled}
              style={[
                styles.variantChip,
                selected ? styles.variantChipActive : null,
                disabled ? styles.variantChipDisabled : null,
              ]}
              onPress={() => onSelectVariant(item.id)}
            >
              <Text numberOfLines={1} style={[styles.variantName, selected ? styles.variantNameActive : null]}>
                {item.variantName || item.sku || "Default"}
              </Text>
              <Text style={[styles.variantPrice, selected ? styles.variantNameActive : null]}>
                {formatPrice(variantDisplayPrice(item))}
              </Text>
              {disabled ? <Text style={styles.variantUnavailable}>Sold out</Text> : null}
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

function QuantitySelector({
  onChangeQuantity,
  quantity,
  selectedVariant,
}: {
  onChangeQuantity: (quantity: number) => void;
  quantity: number;
  selectedVariant: ProductVariant | null;
}) {
  const stockQuantity = selectedVariant?.stockQuantity ?? 0;
  const maxQuantity = Math.min(99, Math.max(1, stockQuantity));
  const unavailable = !selectedVariant || selectedVariant.status !== "ACTIVE" || stockQuantity <= 0;

  return (
    <View style={styles.section}>
      <View style={styles.quantityHeader}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <Text style={[styles.stockText, unavailable ? styles.stockDanger : null]}>
          {unavailable ? "Out of stock" : `${stockQuantity} available`}
        </Text>
      </View>
      <View style={styles.quantityRow}>
        <Pressable
          disabled={quantity <= 1}
          style={[styles.qtyButton, quantity <= 1 ? styles.qtyButtonDisabled : null]}
          onPress={() => onChangeQuantity(Math.max(1, quantity - 1))}
        >
          <HugeiconsIcon color={quantity <= 1 ? "#9AA4B2" : colors.ink} icon={MinusSignIcon} size={16} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.qtyText}>{quantity}</Text>
        <Pressable
          disabled={unavailable || quantity >= maxQuantity}
          style={[styles.qtyButton, unavailable || quantity >= maxQuantity ? styles.qtyButtonDisabled : null]}
          onPress={() => onChangeQuantity(Math.min(maxQuantity, quantity + 1))}
        >
          <HugeiconsIcon color={unavailable || quantity >= maxQuantity ? "#9AA4B2" : colors.ink} icon={PlusSignIcon} size={16} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

function DescriptionBlock({
  product,
  selectedVariant,
}: {
  product: ProductSummary;
  selectedVariant: ProductVariant | null;
}) {
  const details = buildProductDetailContent(product, selectedVariant);
  const DESC_LIMIT = 280;
  const rawDescription = product.description || "";
  const [descExpanded, setDescExpanded] = useState(false);
  const isLong = rawDescription.length > DESC_LIMIT;
  const displayDescription = isLong && !descExpanded
    ? `${rawDescription.slice(0, DESC_LIMIT).trimEnd()}…`
    : rawDescription;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>About this product</Text>

      <Text style={styles.descriptionText}>
        {displayDescription || "Product details will be updated by the seller soon."}
      </Text>
      {isLong ? (
        <Pressable onPress={() => setDescExpanded((v) => !v)} style={styles.readMoreButton}>
          <Text style={styles.readMoreText}>{descExpanded ? "Show less" : "Read more"}</Text>
        </Pressable>
      ) : null}

      {/* Highlights */}
      {details.highlights.length ? (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>Key highlights</Text>
          {details.highlights.map((highlight) => (
            <View key={highlight} style={styles.highlightRow}>
              <View style={styles.highlightDot} />
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Detail sections */}
      {details.sections.map((detailSection) => (
        <View key={detailSection.key} style={styles.detailSection}>
          <Text style={styles.detailSectionTitle}>{detailSection.title}</Text>
          <View style={styles.detailTable}>
            {detailSection.rows.map((row, idx) => (
              <View
                key={`${row.scope}-${row.key}`}
                style={[
                  styles.detailRow,
                  idx === detailSection.rows.length - 1 ? styles.detailRowLast : null,
                ]}
              >
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Trust row */}
      <View style={styles.trustRow}>
        <View style={styles.trustIconWrap}>
          <HugeiconsIcon color={colors.success} icon={Shield01Icon} size={16} strokeWidth={2.2} />
        </View>
        <Text style={styles.trustText}>Seller listing verified and approved by 1HandIndia marketplace.</Text>
      </View>
    </View>
  );
}

function SellerBlock({ product }: { product: ProductSummary }) {
  const logoUrl = resolveImageUrl(product.seller?.profile?.logoUrl);
  const sellerSlug = product.seller?.slug;
  const sellerReview = (product.seller as { reviewSummary?: { averageRating?: number } } | undefined)?.reviewSummary;
  const sellerRating = sellerReview?.averageRating;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sold by</Text>
      {sellerSlug ? (
        <Link asChild href={`/store/${sellerSlug}` as Href}>
          <Pressable style={({ pressed }) => [styles.sellerRow, pressed ? styles.sellerRowPressed : null]}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.sellerLogo} />
            ) : (
              <View style={styles.sellerLogoFallback}>
                <HugeiconsIcon color={colors.primary} icon={Store01Icon} size={22} strokeWidth={2} />
              </View>
            )}
            <View style={styles.sellerCopy}>
              <View style={styles.sellerNameRow}>
                <Text numberOfLines={1} style={styles.sellerName}>
                  {product.seller?.storeName ?? "1HandIndia seller"}
                </Text>
                {sellerRating ? (
                  <View style={styles.sellerRatingPill}>
                    <HugeiconsIcon icon={StarIcon} size={10} color="#F59E0B" strokeWidth={2} />
                    <Text style={styles.sellerRatingText}>{sellerRating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={styles.sellerDescription}>
                {product.seller?.profile?.description ?? "Approved marketplace seller."}
              </Text>
            </View>
            <Text style={styles.sellerAction}>Visit Store</Text>
          </Pressable>
        </Link>
      ) : (
        <View style={styles.sellerRow}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.sellerLogo} />
          ) : (
            <View style={styles.sellerLogoFallback}>
              <HugeiconsIcon color={colors.primary} icon={Store01Icon} size={22} strokeWidth={2} />
            </View>
          )}
          <View style={styles.sellerCopy}>
            <Text numberOfLines={1} style={styles.sellerName}>
              {product.seller?.storeName ?? "1HandIndia seller"}
            </Text>
            <Text numberOfLines={1} style={styles.sellerDescription}>
              {product.seller?.profile?.description ?? "Approved marketplace seller."}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function RecommendationsBlock({
  formatPrice,
  isWishlistPending,
  isWished,
  onToggleWishlist,
  products,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  isWishlistPending: (productId: string) => boolean;
  isWished: (productId: string) => boolean;
  onToggleWishlist: (productId: string, wished: boolean) => void;
  products: MobileProduct[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>You may also like</Text>
      <ScrollView horizontal contentContainerStyle={styles.recommendationRail} showsHorizontalScrollIndicator={false}>
        {products.map((product) => {
          const wished = isWished(product.id);
          return (
            <View key={product.id} style={styles.recommendationCard}>
              <ProductCard
                compact
                formatPrice={formatPrice}
                isWishlistPending={isWishlistPending(product.id)}
                isWished={wished}
                product={product}
                onToggleWishlist={() => onToggleWishlist(product.id, wished)}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ReviewBreakdown({ reviews }: { reviews: MobileProductReview[] }) {
  const counts = useMemo(() => {
    const countsMap: Record<number, number> = {};
    for (const r of reviews) {
      const idx = Math.max(0, Math.min(4, r.rating as number));
      countsMap[idx] = (countsMap[idx] || 0) + 1;
    }
    return countsMap;
  }, [reviews]);
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <View style={styles.reviewBreakdown}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = counts[star - 1] ?? 0;
        return (
          <View key={star} style={styles.reviewBreakdownRow}>
            <Text style={styles.reviewBreakdownLabel}>{star}</Text>
            <HugeiconsIcon icon={StarIcon} size={10} color="#F59E0B" strokeWidth={2} />
            <View style={styles.reviewBreakdownBarTrack}>
              <View style={[styles.reviewBreakdownBarFill, { width: `${(count / maxCount) * 100}%` }]} />
            </View>
            <Text style={styles.reviewBreakdownCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReviewsSection({ product }: { product: ProductSummary }) {
  const router = useRouter();
  const { averageRating, reviewCount, reviews, isLoading } = useProductReviews(product.id);
  const summaryRating = averageRating ?? product.reviewSummary?.averageRating ?? 0;
  const summaryCount = reviewCount ?? product.reviewSummary?.reviewCount ?? 0;
  const [expanded, setExpanded] = useState(false);

  const visibleReviews = expanded ? reviews : reviews.slice(0, 3);

  return (
    <View style={styles.section}>
      <View style={styles.reviewsHeader}>
        <View style={styles.reviewsRatingWrap}>
          <RatingDisplay averageRating={summaryRating} reviewCount={summaryCount} size="medium" />
        </View>
        {summaryCount > 3 ? (
          <Pressable onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.reviewsToggleText}>{expanded ? "Show less" : `See all ${summaryCount}`}</Text>
          </Pressable>
        ) : null}
      </View>

      {reviews.length > 0 && !expanded ? (
        <ReviewBreakdown reviews={reviews} />
      ) : null}

      {isLoading ? (
        <View style={styles.reviewsLoading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
        </View>
      ) : reviews.length > 0 ? (
        <View style={styles.reviewsList}>
          {visibleReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <View style={styles.reviewCustomerWrap}>
                  <Text style={styles.reviewCustomerName}>{review.customerName}</Text>
                  {review.verifiedPurchase ? (
                    <View style={styles.verifiedBadge}>
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} color={colors.success} strokeWidth={2.2} />
                      <Text style={styles.verifiedBadgeText}>Verified</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.reviewCardStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <HugeiconsIcon
                      key={star}
                      icon={StarIcon}
                      size={13}
                      color={star <= review.rating ? "#F59E0B" : "#D1D5DB"}
                      strokeWidth={star <= review.rating ? 1.8 : 1.3}
                    />
                  ))}
                </View>
              </View>
              {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
              {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.reviewsEmpty}>No reviews yet. Be the first to share your experience.</Text>
      )}

      <Pressable
        style={styles.writeReviewButton}
        onPress={() => {
          router.push("/orders");
        }}
      >
        <HugeiconsIcon color={colors.surface} icon={PencilEdit01Icon} size={17} strokeWidth={2.2} />
        <Text style={styles.writeReviewButtonText}>Write a review</Text>
      </Pressable>
    </View>
  );
}

function ProductActionBar({
  addedMessage,
  canAddToCart,
  isBusy,
  isInCart,
  isSignedIn,
  mutationError,
  onAdd,
  onGoToCart,
  onSignIn,
  product,
  returnPolicy,
  selectedVariant,
}: {
  addedMessage: string;
  canAddToCart: boolean;
  isBusy: boolean;
  isInCart: boolean;
  isSignedIn: boolean;
  mutationError: Error | null;
  onAdd: () => void;
  onGoToCart: () => void;
  onSignIn: () => void;
  product: ProductSummary;
  returnPolicy: { returnWindowDays: number; replacementWindowDays: number } | null;
  selectedVariant: ProductVariant | null;
}) {
  const router = useRouter();
  const isEnquiryOnly = product.listingMode === "ENQUIRY_ONLY";
  const isOutOfStock = Boolean(selectedVariant && selectedVariant.stockQuantity <= 0);
  // Wire to product.isRegionRestricted when the API exposes that field.
  const isRegionRestricted = false;

  const unavailableReason =
    isEnquiryOnly
      ? null // ENQUIRY_ONLY: B2B CTA replaces the cart button entirely
      : isOutOfStock
        ? "Selected option is out of stock."
        : "";

  const returnLabel = useMemo(() => {
    if (!returnPolicy) return null;
    const days = returnPolicy.returnWindowDays;
    if (days && days > 0) return `${days}-day easy return`;
    return "Non-returnable";
  }, [returnPolicy]);

  function handleB2BCTA() {
    if (!isSignedIn) {
      router.push("/auth/sign-in" as never);
      return;
    }
    const params = new URLSearchParams({ productId: product.id });
    if (product.name) params.set("productName", product.name);
    router.push((`/account/b2b/enquiries/new?${params.toString()}`) as never);
  }

  return (
    <View style={styles.actionWrap}>
      {mutationError ? <Text style={styles.actionError}>{mutationError.message}</Text> : null}
      {addedMessage ? (
        <View style={styles.addedRow}>
          <Text style={styles.addedText}>{addedMessage}</Text>
          <Pressable onPress={onGoToCart}>
            <Text style={styles.goToCartText}>Go to cart</Text>
          </Pressable>
        </View>
      ) : null}
      {unavailableReason ? <Text style={styles.actionHelp}>{unavailableReason}</Text> : null}

      {isEnquiryOnly ? (
        /* ENQUIRY_ONLY: B2B request-quote button is the only CTA */
        <Pressable
          disabled={isRegionRestricted}
          style={[styles.addButton, styles.addButtonOutline, isRegionRestricted ? styles.addButtonDisabled : null]}
          onPress={isRegionRestricted ? undefined : handleB2BCTA}
        >
          <Text style={[styles.addButtonText, styles.addButtonTextOutline]}>
            {isRegionRestricted
              ? "Not available in your region"
              : isSignedIn
                ? "Request Quote (B2B)"
                : "Sign in to request quote"}
          </Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            disabled={isBusy || (isSignedIn && !isInCart && !canAddToCart)}
            style={[styles.addButton, isBusy || (isSignedIn && !isInCart && !canAddToCart) ? styles.addButtonDisabled : null]}
            onPress={isSignedIn ? (isInCart ? onGoToCart : onAdd) : onSignIn}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={20} strokeWidth={2.2} />
                <Text style={styles.addButtonText}>{isSignedIn ? (isInCart ? "Go to cart" : "Add to cart") : "Sign in to add"}</Text>
              </>
            )}
          </Pressable>
          {returnLabel ? (
            <View style={styles.actionReturnPill}>
              <HugeiconsIcon icon={Shield01Icon} size={12} color={colors.success} strokeWidth={2} />
              <Text style={styles.actionReturnText}>{returnLabel}</Text>
            </View>
          ) : null}
          <Pressable
            disabled={isRegionRestricted}
            style={[styles.b2bSecondaryButton, isRegionRestricted ? styles.b2bSecondaryButtonDisabled : null]}
            onPress={isRegionRestricted ? undefined : handleB2BCTA}
          >
            <Text style={[styles.b2bSecondaryButtonText, isRegionRestricted ? { color: colors.muted } : null]}>
              {isRegionRestricted
                ? "B2B not available in your region"
                : "Request Quote (B2B)"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}


function productImages(product: ProductSummary): ProductImage[] {
  return product.images;
}

function primaryProductImage(product: ProductSummary) {
  const campaignImage = resolveImageUrl(product.campaignImageUrl);
  if (campaignImage) {
    return campaignImage;
  }

  const primaryImage = product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null;
  return resolveImageUrl(primaryImage);
}

async function shareProduct(
  product: ProductSummary,
  selectedVariant: ProductVariant | null,
  formatPrice: (pricePaise?: number | null) => string,
) {
  const url = productShareUrl(product.slug);
  const imageUrl = primaryProductImage(product);
  const price = variantDisplayPrice(selectedVariant);
  const lines = [
    product.name,
    typeof price === "number" ? `Price: ${formatPrice(price)}` : "",
    product.seller?.storeName ? `Seller: ${product.seller.storeName}` : "",
    url,
    imageUrl ? `Photo: ${imageUrl}` : "",
  ].filter(Boolean);

  await Share.share({
    message: lines.join("\n"),
    title: product.name,
    url,
  });
}

function productShareUrl(slug: string) {
  const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim() || "https://www.1handindia.com";
  return `${configuredWebUrl.replace(/\/$/, "")}/products/${encodeURIComponent(slug)}`;
}

function selectVariant(product: ProductSummary | undefined, selectedVariantId: string | null) {
  if (!product) {
    return null;
  }

  return (
    product.variants.find((variant) => variant.id === selectedVariantId) ??
    product.variants.find((variant) => variant.status === "ACTIVE" && variant.stockQuantity > 0) ??
    product.variants.find((variant) => variant.status === "ACTIVE") ??
    product.variants[0] ??
    null
  );
}

function variantDisplayPrice(variant: ProductVariant | null | undefined) {
  return variant?.baseDealPricePaise ?? variant?.basePricePaise ?? variant?.dealPricePaise ?? variant?.pricePaise;
}

function variantOriginalDisplayPrice(variant: ProductVariant | null | undefined) {
  return variant?.baseOriginalPricePaise ?? variant?.baseMrpPaise ?? variant?.originalPricePaise ?? variant?.mrpPaise ?? null;
}

const styles = StyleSheet.create({
  productScreen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  listContent: {
    paddingBottom: 130,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    marginTop: 16,
    paddingVertical: 14,
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  gallerySection: {
    backgroundColor: colors.secondary,
    paddingBottom: 8,
    marginHorizontal: 0,
    paddingTop: 12,
  },
  heroImageWrap: {
    position: "relative",
  },
  heroImage: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 260,
    marginHorizontal: 12,
    overflow: "hidden",
    width: "100%",
  },
  imageCountBadge: {
    position: "absolute",
    bottom: 14,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    paddingHorizontal: 8,
  },
  imageCountText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
  },
  heroImageFallback: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    height: 260,
    justifyContent: "center",
    marginHorizontal: 12,
    overflow: "hidden",
    width: "100%",
  },
  heroImageFallbackText: {
    color: colors.primary,
    fontSize: 42,
    fontWeight: "900",
  },
  thumbnailButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1.5,
    height: 72,
    marginLeft: 12,
    marginRight: 10,
    marginTop: 10,
    overflow: "hidden",
    width: 72,
  },
  thumbnailButtonActive: {
    borderColor: colors.primary,
    borderWidth: 2.5,
  },
  thumbnailImage: {
    height: "100%",
    width: "100%",
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
  },
  categoryLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  productName: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    marginTop: 4,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  priceText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  mrpText: {
    color: "#9AA4B2",
    fontSize: 14,
    fontWeight: "800",
    textDecorationLine: "line-through",
  },
  discountPill: {
    backgroundColor: "#FFF0E8",
    borderRadius: 999,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  productActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  productActionButton: {
    alignItems: "center",
    backgroundColor: "#FFFCFB",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  productActionButtonActive: {
    backgroundColor: "#FFF2ED",
    borderColor: "#FFD6C8",
  },
  productActionButtonDisabled: {
    opacity: 0.72,
  },
  productActionText: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "900",
  },
  productActionTextActive: {
    color: colors.primary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  stockPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stockPillIn: {
    backgroundColor: "#EAFBF1",
    color: colors.success,
  },
  stockPillLow: {
    backgroundColor: "#FFF9EB",
    color: colors.warning,
  },
  stockPillOut: {
    backgroundColor: "#FFE9E9",
    color: colors.danger,
  },
  metaPill: {
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaPillDeal: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    color: "#92400E",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 10,
  },
  variantChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 9,
    width: 120,
  },
  variantChipActive: {
    backgroundColor: "#FFF3ED",
    borderColor: colors.primary,
  },
  variantChipDisabled: {
    backgroundColor: "#F3F4F6",
  },
  variantName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  variantNameActive: {
    color: colors.primary,
  },
  variantPrice: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
  variantUnavailable: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },
  quantityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stockText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
  },
  stockDanger: {
    color: colors.danger,
  },
  quantityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  qtyButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: "#FFE0D6",
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  qtyButtonDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: colors.border,
  },
  qtyText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    minWidth: 32,
    textAlign: "center",
  },
  descriptionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  detailSection: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  detailSectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
  },
  detailTable: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  highlightRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 5,
  },
  highlightDot: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 5,
    height: 6,
    justifyContent: "center",
    marginTop: 7,
    width: 6,
  },
  highlightText: {
    color: "#475467",
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  detailRow: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 8,
  },
  detailLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  detailValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
    textAlign: "right",
  },
  trustRow: {
    alignItems: "center",
    backgroundColor: "#F2FCF7",
    borderColor: "#AEDEC8",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 10,
  },
  trustIconWrap: {
    alignItems: "center",
    backgroundColor: "#DCF5EA",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  trustText: {
    color: "#1A5C3A",
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
  },
  readMoreButton: {
    marginTop: 6,
  },
  readMoreText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  sellerRow: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  sellerRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  sellerLogo: {
    borderRadius: 12,
    height: 44,
    width: 44,
  },
  sellerLogoFallback: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sellerCopy: {
    flex: 1,
    minWidth: 0,
  },
  sellerNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sellerName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
  },
  sellerRatingPill: {
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 6,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sellerRatingText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "900",
  },
  sellerDescription: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 2,
  },
  sellerAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  recommendationRail: {
    gap: 8,
    paddingRight: 4,
  },
  recommendationCard: {
    width: 152,
  },
  actionWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
    shadowColor: "#111827",
    shadowOffset: { height: -6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  actionReturnPill: {
    alignItems: "center",
    backgroundColor: "#F0FDF6",
    borderColor: "#BBF7D0",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "center",
  },
  actionReturnText: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "800",
  },
  actionHelp: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  actionError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  addedRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addedText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "900",
  },
  goToCartText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  addButtonOutline: {
    backgroundColor: "transparent",
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  addButtonDisabled: {
    backgroundColor: "#A8AFBA",
  },
  addButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  addButtonTextOutline: {
    color: colors.primary,
  },
  b2bSecondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 42,
    marginTop: 8,
  },
  b2bSecondaryButtonDisabled: {
    borderColor: "#C0C8D4",
  },
  b2bSecondaryButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  reviewsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reviewsRatingWrap: {
    flex: 1,
  },
  reviewsToggleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  reviewsList: {
    gap: 8,
  },
  reviewCard: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  reviewCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reviewCustomerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  reviewCustomerName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  verifiedBadge: {
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 4,
    flexDirection: "row",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  verifiedBadgeText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: "900",
  },
  reviewCardStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 3,
  },
  reviewComment: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 4,
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  reviewsEmpty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  reviewsLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },
  reviewsLoadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  writeReviewButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 46,
    paddingVertical: 12,
  },
  writeReviewButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  reviewBreakdown: {
    backgroundColor: colors.secondary,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1,
    gap: 6,
    marginBottom: 12,
    padding: 12,
  },
  reviewBreakdownRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  reviewBreakdownLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    width: 10,
    textAlign: "right",
  },
  reviewBreakdownBarTrack: {
    backgroundColor: colors.softSurface,
    borderRadius: 3,
    flex: 1,
    height: 6,
    overflow: "hidden",
  },
  reviewBreakdownBarFill: {
    backgroundColor: "#F59E0B",
    borderRadius: 3,
    height: "100%",
  },
  reviewBreakdownCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    width: 18,
    textAlign: "right",
  },
});
