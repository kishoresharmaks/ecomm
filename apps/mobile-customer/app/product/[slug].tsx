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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildProductDetailContent } from "@indihub/shared-types";
import { Link, Stack, type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  getWishlist,
  listProducts,
  removeWishlistItem,
} from "../../src/features/storefront/storefront-api";
import { useProductReviews } from "../../src/features/storefront/use-mobile-reviews";
import { RatingDisplay } from "../../src/components/rating-display";
import { formatDate } from "../../src/features/account/account-ui";
import { resolveImageUrl } from "../../src/lib/image-url";
import { useRecentProductsStore } from "../../src/state/recent-products-store";
import { colors } from "../../src/theme";
import type { MobileProduct } from "../../src/types/mobile-home";
import type { MobileProductReview, ProductImage, ProductSummary, ProductVariant } from "../../src/types/storefront";

/* ─── return policy: only shown when admin has configured it ─── */

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
  const _rememberRecentProduct = useRecentProductsStore((state) => state.rememberRecentProduct);

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
    return items.filter((item) => item.id !== product?.id && item.slug !== product?.slug).slice(0, 8);
  }, [product?.id, product?.slug, recommendationsQuery.data?.items]);

  /* ─── return policy: derived from product attributes (seller-set) ─── */
  const productReturnPolicy = useMemo(() => {
    if (!product) return null;
    const attrs = (product.attributes ?? {}) as Record<string, unknown>;
    const eligibility = String(attrs.returnEligibility ?? "").trim();
    const refundDays = Number(attrs.returnWindowDays ?? 0);
    const replacementDays = Number(attrs.replacementWindowDays ?? 0);
    if (!eligibility) return null;

    let label = "";
    if (eligibility === "Non-returnable") {
      label = "Non-returnable";
    } else if (eligibility === "Return and replacement") {
      const parts = [];
      if (refundDays > 0) parts.push(`${refundDays}-day refund return`);
      if (replacementDays > 0) parts.push(`${replacementDays}-day replacement`);
      label = parts.join(" / ") || "Return and replacement";
    } else if (eligibility === "Return only") {
      label = refundDays > 0 ? `${refundDays}-day refund return` : "Return only";
    } else if (eligibility === "Replacement only") {
      label = replacementDays > 0 ? `${replacementDays}-day replacement` : "Replacement only";
    } else if (eligibility === "Service/warranty only") {
      label = "Service/warranty only";
    } else {
      label = eligibility;
    }
    return { eligibility, label, isNonReturnable: eligibility === "Non-returnable" };
  }, [product]);
  const isWholesaleSeller = product?.seller?.sellerType === "WHOLESALE_DISTRIBUTOR";

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

  /* ─── loading / error states ─── */
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

  const isEnquiryOnly = product.listingMode === "ENQUIRY_ONLY";
  const isOutOfStock = Boolean(selectedVariant && selectedVariant.stockQuantity <= 0);
  const _isRegionRestricted = false;
  const unavailableReason = isEnquiryOnly
    ? null
    : isOutOfStock
      ? "Selected option is out of stock."
      : "";

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: product.name }} />
      <View style={styles.productScreen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Gallery ─── */}
          <ProductGallery onSelectImage={setSelectedImageUrl} product={product} selectedImageUrl={selectedImageUrl} />

          {/* ─── Summary (name, price, rating, actions) ─── */}
          <View style={styles.section}>
            <ProductSummaryBlock
              formatPrice={market.format}
              isWishlistPending={pendingWishlistProductId === product.id}
              isWished={wishlistProductIds.has(product.id)}
              product={product}
              selectedVariant={selectedVariant}
              onShare={() => { void shareProduct(product, selectedVariant, market.format); }}
              onToggleWishlist={() => toggleWishlist(product.id, wishlistProductIds.has(product.id))}
            />
          </View>

          {/* ─── Variant selector ─── */}
          {product.variants.length > 1 && (
            <View style={styles.section}>
              <VariantSelector
                formatPrice={market.format}
                onSelectVariant={(variantId) => {
                  setSelectedVariantId(variantId);
                  setQuantity(1);
                  setAddedMessage("");
                }}
                product={product}
                selectedVariantId={selectedVariant?.id ?? null}
              />
            </View>
          )}

          {/* ─── Quantity ─── */}
          {!isEnquiryOnly && selectedVariant && (
            <View style={styles.section}>
              <QuantitySelector
                onChangeQuantity={setQuantity}
                quantity={quantity}
                selectedVariant={selectedVariant}
              />
            </View>
          )}

          {/* ─── Description ─── */}
          <View style={styles.section}>
            <DescriptionBlock product={product} selectedVariant={selectedVariant} />
          </View>

          {/* ─── Seller ─── */}
          <View style={styles.section}>
            <SellerBlock product={product} />
          </View>

          {/* ─── Reviews ─── */}
          <View style={styles.section}>
            <ReviewsSection product={product} />
          </View>

          {/* ─── Recommendations ─── */}
          {recommendations.length >= 4 && (
            <View style={styles.section}>
              <RecommendationsBlock
                formatPrice={market.format}
                isWishlistPending={(productId) => pendingWishlistProductId === productId}
                isWished={(productId) => wishlistProductIds.has(productId)}
                onToggleWishlist={toggleWishlist}
                products={recommendations}
              />
            </View>
          )}

          {/* spacer for action bar */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* ─── Action Bar (sticky bottom) ─── */}
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
          productReturnPolicy={productReturnPolicy}
          selectedVariant={selectedVariant}
          unavailableReason={unavailableReason}
          isWholesaleSeller={isWholesaleSeller}
        />
      </View>
    </Screen>
  );
}

export default withStorefrontMaintenance(ProductDetailScreen);

/* ─────────────────────────────────────────────────
   SUB-COMPONENTS
   ───────────────────────────────────────────────── */

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
      <Pressable onPress={() => {}} style={styles.heroImageWrap}>
        {heroImage ? (
          <Image
            resizeMode="contain"
            source={{ uri: heroImage }}
            style={styles.heroImage}
          />
        ) : (
          <View style={styles.heroImageFallback}>
            <Text style={styles.heroImageFallbackText}>1HI</Text>
          </View>
        )}
        {images.length > 1 && (
          <View style={styles.imageCountBadge}>
            <Text style={styles.imageCountText}>{images.length}</Text>
          </View>
        )}
      </Pressable>

      {images.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailRail}
        >
          {images.map((image, index) => {
            const imageUrl = resolveImageUrl(image.url);
            const selected = imageUrl === heroImage;
            return (
              <Pressable
                key={`${image.url}-${index}`}
                onPress={() => onSelectImage(imageUrl)}
                style={[styles.thumbnailButton, selected ? styles.thumbnailButtonActive : null]}
              >
                {imageUrl ? (
                  <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.thumbnailImage} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
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
    <View>
      {/* Category tag */}
      <Text style={styles.categoryLabel}>
        {product.category?.name ?? "Marketplace product"}
      </Text>

      {/* Product name */}
      <Text numberOfLines={3} style={styles.productName}>{product.name}</Text>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={styles.priceText}>{formatPrice(price)}</Text>
        {mrp && price && mrp > price ? (
          <>
            <Text style={styles.mrpText}>{formatPrice(mrp)}</Text>
            <View style={styles.discountPill}>
              <Text style={styles.discountPillText}>-{discountPercent}%</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Meta pills */}
      <View style={styles.metaRow}>
        <View style={[styles.metaPill, inStock ? (lowStock ? styles.metaPillWarn : styles.metaPillSuccess) : styles.metaPillDanger]}>
          <Text style={[styles.metaPillText, inStock ? (lowStock ? styles.metaPillWarnText : styles.metaPillSuccessText) : styles.metaPillDangerText]}>
            {!inStock ? "Out of stock" : lowStock ? `Only ${stockQuantity} left` : "In stock"}
          </Text>
        </View>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>
            {rating ? `${rating.toFixed(1)} rating` : "New arrival"}
            {reviewCount ? ` (${reviewCount})` : ""}
          </Text>
        </View>
        {selectedVariant?.activeDeal ? (
          <View style={styles.metaPillDeal}>
            <Text style={styles.metaPillDealText}>{selectedVariant.activeDeal.title}</Text>
          </View>
        ) : null}
      </View>

      {/* Wishlist + Share buttons */}
      <View style={styles.actionButtonsRow}>
        <Pressable
          accessibilityLabel={isWished ? "Remove from wishlist" : "Add to wishlist"}
          accessibilityRole="button"
          accessibilityState={{ busy: isWishlistPending, selected: isWished }}
          disabled={isWishlistPending}
          style={[styles.actionBtn, isWished ? styles.actionBtnActive : null, isWishlistPending ? styles.actionBtnDisabled : null]}
          onPress={onToggleWishlist}
        >
          {isWishlistPending ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <HugeiconsIcon
              color={isWished ? colors.primary : "#667085"}
              icon={HeartIcon}
              size={18}
              strokeWidth={isWished ? 2.6 : 2}
            />
          )}
          <Text style={[styles.actionBtnText, isWished ? styles.actionBtnTextActive : null]}>
            {isWished ? "Saved" : "Wishlist"}
          </Text>
        </Pressable>

        <Pressable accessibilityLabel="Share product" accessibilityRole="button" style={styles.actionBtn} onPress={onShare}>
          <HugeiconsIcon color="#667085" icon={Share02Icon} size={18} strokeWidth={2} />
          <Text style={styles.actionBtnText}>Share</Text>
        </Pressable>
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
  if (product.variants.length <= 1) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>Select option</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantRail}>
        {product.variants.map((variant) => {
          const disabled = variant.status !== "ACTIVE" || variant.stockQuantity <= 0;
          const selected = variant.id === selectedVariantId;
          return (
            <Pressable
              key={variant.id}
              disabled={disabled}
              onPress={() => onSelectVariant(variant.id)}
              style={[
                styles.variantChip,
                selected ? styles.variantChipSelected : null,
                disabled ? styles.variantChipDisabled : null,
              ]}
            >
              <Text numberOfLines={1} style={[styles.variantName, selected ? styles.variantNameSelected : null]}>
                {variant.variantName || variant.sku || "Default"}
              </Text>
              <Text style={[styles.variantPrice, selected ? styles.variantNameSelected : null]}>
                {formatPrice(variantDisplayPrice(variant))}
              </Text>
              {disabled && <Text style={styles.variantDisabledText}>Sold out</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
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
    <View>
      <View style={styles.qtyHeader}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <Text style={[styles.qtyStockText, unavailable ? styles.qtyStockDanger : null]}>
          {unavailable ? "Out of stock" : `${stockQuantity} available`}
        </Text>
      </View>
      <View style={styles.qtyRow}>
        <Pressable
          disabled={quantity <= 1}
          onPress={() => onChangeQuantity(Math.max(1, quantity - 1))}
          style={[styles.qtyBtn, quantity <= 1 ? styles.qtyBtnDisabled : null]}
        >
          <HugeiconsIcon
            color={quantity <= 1 ? "#9AA4B2" : colors.ink}
            icon={MinusSignIcon}
            size={16}
            strokeWidth={2.2}
          />
        </Pressable>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <Pressable
          disabled={unavailable || quantity >= maxQuantity}
          onPress={() => onChangeQuantity(Math.min(maxQuantity, quantity + 1))}
          style={[styles.qtyBtn, unavailable || quantity >= maxQuantity ? styles.qtyBtnDisabled : null]}
        >
          <HugeiconsIcon
            color={unavailable || quantity >= maxQuantity ? "#9AA4B2" : colors.ink}
            icon={PlusSignIcon}
            size={16}
            strokeWidth={2.2}
          />
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
    <View>
      <Text style={styles.sectionTitle}>About this product</Text>

      <Text style={styles.descriptionText}>
        {displayDescription || "Product details will be updated by the seller soon."}
      </Text>
      {isLong && (
        <Pressable onPress={() => setDescExpanded((v) => !v)}>
          <Text style={styles.readMoreText}>{descExpanded ? "Show less" : "Read more"}</Text>
        </Pressable>
      )}

      {/* Highlights */}
      {details.highlights.length > 0 && (
        <View style={styles.highlightBlock}>
          <Text style={styles.highlightTitle}>Key highlights</Text>
          {details.highlights.map((highlight) => (
            <View key={highlight} style={styles.highlightRow}>
              <View style={styles.highlightDot} />
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Specs table */}
      {details.sections.map((detailSection) => (
        <View key={detailSection.key} style={styles.specBlock}>
          <Text style={styles.specTitle}>{detailSection.title}</Text>
          <View style={styles.specTable}>
            {detailSection.rows.map((row, idx) => (
              <View
                key={`${row.scope}-${row.key}`}
                style={[
                  styles.specRow,
                  idx === detailSection.rows.length - 1 ? styles.specRowLast : null,
                ]}
              >
                <Text style={styles.specLabel}>{row.label}</Text>
                <Text style={styles.specValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Trust badge */}
      <View style={styles.trustRow}>
        <View style={styles.trustIcon}>
          <HugeiconsIcon color={colors.success} icon={Shield01Icon} size={14} strokeWidth={2.2} />
        </View>
        <Text style={styles.trustText}>Seller listing verified and approved by 1HandIndia marketplace.</Text>
      </View>
    </View>
  );
}

function SellerBlock({ product }: { product: ProductSummary }) {
  const logoUrl = resolveImageUrl(product.seller?.profile?.logoUrl);
  const sellerSlug = product.seller?.slug;
  const sellerRating = (product.seller as { reviewSummary?: { averageRating?: number } } | undefined)
    ?.reviewSummary?.averageRating;

  if (!sellerSlug) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Sold by</Text>
        <View style={styles.sellerRow}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.sellerLogo} />
          ) : (
            <View style={styles.sellerLogoFallback}>
              <HugeiconsIcon color={colors.primary} icon={Store01Icon} size={22} strokeWidth={2} />
            </View>
          )}
          <View style={styles.sellerInfo}>
            <Text numberOfLines={1} style={styles.sellerName}>
              {product.seller?.storeName ?? "1HandIndia seller"}
            </Text>
            <Text numberOfLines={1} style={styles.sellerDesc}>
              {product.seller?.profile?.description ?? "Approved marketplace seller."}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Sold by</Text>
      <Link asChild href={`/store/${sellerSlug}` as Href}>
        <Pressable style={({ pressed }) => [styles.sellerRow, pressed ? styles.sellerRowPressed : null]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.sellerLogo} />
          ) : (
            <View style={styles.sellerLogoFallback}>
              <HugeiconsIcon color={colors.primary} icon={Store01Icon} size={22} strokeWidth={2} />
            </View>
          )}
          <View style={styles.sellerInfo}>
            <View style={styles.sellerNameRow}>
              <Text numberOfLines={1} style={styles.sellerName}>
                {product.seller?.storeName ?? "1HandIndia seller"}
              </Text>
              {sellerRating ? (
                <View style={styles.sellerRatingBadge}>
                  <HugeiconsIcon icon={StarIcon} size={10} color="#F59E0B" strokeWidth={2} />
                  <Text style={styles.sellerRatingText}>{sellerRating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.sellerDesc}>
              {product.seller?.profile?.description ?? "Approved marketplace seller."}
            </Text>
          </View>
          <Text style={styles.sellerCta}>Visit Store</Text>
        </Pressable>
      </Link>
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
    <View>
      <Text style={styles.sectionTitle}>You may also like</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recoRail}>
        {products.map((product) => {
          const wished = isWished(product.id);
          return (
            <View key={product.id} style={styles.recoCard}>
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
    <View>
      <Text style={styles.sectionTitle}>Ratings & reviews</Text>

      <View style={styles.reviewsHeader}>
        <RatingDisplay averageRating={summaryRating} reviewCount={summaryCount} size="medium" />
        {summaryCount > 3 && (
          <Pressable onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.reviewsToggle}>{expanded ? "Show less" : `See all ${summaryCount}`}</Text>
          </Pressable>
        )}
      </View>

      {reviews.length > 0 && !expanded && <ReviewBreakdown reviews={reviews} />}

      {isLoading ? (
        <View style={styles.reviewsLoading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
        </View>
      ) : reviews.length > 0 ? (
        <View style={styles.reviewsList}>
          {visibleReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewCustomerRow}>
                  <Text style={styles.reviewName}>{review.customerName}</Text>
                  {review.verifiedPurchase && (
                    <View style={styles.verifiedBadge}>
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={11} color={colors.success} strokeWidth={2.2} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
                <View style={styles.reviewStars}>
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
              {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
              {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
              <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.reviewsEmpty}>No reviews yet. Be the first to share your experience.</Text>
      )}

      <Pressable
        style={styles.writeReviewBtn}
        onPress={() => router.push("/orders")}
      >
        <HugeiconsIcon icon={PencilEdit01Icon} size={17} color={colors.surface} strokeWidth={2.2} />
        <Text style={styles.writeReviewText}>Write a review</Text>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────────────────────────
   STICKY ACTION BAR
   ───────────────────────────────────────────────── */

function ProductActionBar({
  addedMessage,
  canAddToCart,
  isBusy,
  isInCart,
  isSignedIn,
  isWholesaleSeller,
  mutationError,
  onAdd,
  onGoToCart,
  onSignIn,
  product,
  productReturnPolicy,
  selectedVariant,
  unavailableReason,
}: {
  addedMessage: string;
  canAddToCart: boolean;
  isBusy: boolean;
  isInCart: boolean;
  isSignedIn: boolean;
  isWholesaleSeller: boolean;
  mutationError: Error | null;
  onAdd: () => void;
  onGoToCart: () => void;
  onSignIn: () => void;
  product: ProductSummary;
  productReturnPolicy: { eligibility: string; label: string; isNonReturnable: boolean } | null;
  selectedVariant: ProductVariant | null;
  unavailableReason: string | null;
}) {
  const router = useRouter();
  const isEnquiryOnly = product.listingMode === "ENQUIRY_ONLY";
  const _isOutOfStock = Boolean(selectedVariant && selectedVariant.stockQuantity <= 0);

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
    <View style={styles.actionBar}>
      {mutationError && <Text style={styles.actionError}>{mutationError.message}</Text>}

      {addedMessage ? (
        <View style={styles.addedToast}>
          <Text style={styles.addedText}>{addedMessage}</Text>
          <Pressable onPress={onGoToCart}>
            <Text style={styles.addedCta}>View cart</Text>
          </Pressable>
        </View>
      ) : null}

      {unavailableReason && <Text style={styles.actionHelp}>{unavailableReason}</Text>}

      {isSignedIn && isInCart && !addedMessage && (
        <Pressable onPress={onGoToCart} style={styles.actionGoToCartBtn}>
          <HugeiconsIcon icon={ShoppingCart01Icon} size={20} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.actionGoToCartText}>Go to cart</Text>
        </Pressable>
      )}

      {isEnquiryOnly ? (
        isWholesaleSeller && (
          <Pressable onPress={handleB2BCTA} style={[styles.actionPrimary, styles.actionPrimaryOutline]}>
            <Text style={[styles.actionPrimaryText, styles.actionPrimaryOutlineText]}>
              {isSignedIn ? "Request Quote (B2B)" : "Sign in to request quote"}
            </Text>
          </Pressable>
        )
      ) : (
        <>
          <Pressable
            disabled={isBusy}
            onPress={isSignedIn ? (isInCart ? onGoToCart : onAdd) : onSignIn}
            style={[styles.actionPrimary, isBusy ? styles.actionPrimaryDisabled : null]}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <HugeiconsIcon icon={ShoppingCart01Icon} size={20} color={colors.surface} strokeWidth={2.2} />
                <Text style={styles.actionPrimaryText}>
                  {!isSignedIn ? "Sign in to add" : isInCart ? "Go to cart" : "Add to cart"}
                </Text>
              </>
            )}
          </Pressable>

          {isWholesaleSeller && (
            <Pressable onPress={handleB2BCTA} style={styles.actionSecondary}>
              <Text style={styles.actionSecondaryText}>Request Quote (B2B)</Text>
            </Pressable>
          )}
        </>
      )}

      {productReturnPolicy && (
        <View style={styles.returnPill}>
          <View style={styles.returnIcon}>
            <HugeiconsIcon
              icon={Shield01Icon}
              size={12}
              color={productReturnPolicy.isNonReturnable ? colors.muted : colors.success}
              strokeWidth={2.2}
            />
          </View>
          <Text style={[
            styles.returnText,
            productReturnPolicy.isNonReturnable ? styles.returnTextDefault : styles.returnTextActive,
          ]}>
            {productReturnPolicy.label}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────── */

function productImages(product: ProductSummary): ProductImage[] {
  return product.images;
}

function primaryProductImage(product: ProductSummary): string | null {
  const campaignImage = resolveImageUrl(product.campaignImageUrl);
  if (campaignImage) return campaignImage;

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
  if (!product) return null;

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

/* ─────────────────────────────────────────────────
   STYLES
   ───────────────────────────────────────────────── */

const styles = StyleSheet.create({
  productScreen: {
    backgroundColor: colors.secondary,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  bottomSpacer: {
    height: 16,
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
    marginHorizontal: 40,
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  /* ─── Gallery ─── */
  gallerySection: {
    backgroundColor: colors.secondary,
    paddingTop: 12,
  },
  heroImageWrap: {
    position: "relative",
  },
  heroImage: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 0,
    borderWidth: 0,
    height: 340,
    width: "100%",
  },
  heroImageFallback: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 0,
    borderWidth: 0,
    height: 340,
    justifyContent: "center",
    width: "100%",
  },
  heroImageFallbackText: {
    color: colors.primary,
    fontSize: 42,
    fontWeight: "900",
  },
  imageCountBadge: {
    position: "absolute",
    bottom: 14,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    paddingHorizontal: 8,
    height: 28,
  },
  imageCountText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
  },
  thumbnailRail: {
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  thumbnailButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1.5,
    height: 72,
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

  /* ─── Sections ─── */
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 0,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 10,
  },

  /* ─── Summary ─── */
  categoryLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  productName: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
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
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  metaPillSuccess: {
    backgroundColor: "#EAFBF1",
  },
  metaPillSuccessText: {
    color: colors.success,
  },
  metaPillWarn: {
    backgroundColor: "#FFF9EB",
  },
  metaPillWarnText: {
    color: colors.warning,
  },
  metaPillDanger: {
    backgroundColor: "#FFE9E9",
  },
  metaPillDangerText: {
    color: colors.danger,
  },
  metaPillDeal: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaPillDealText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "800",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    alignItems: "center",
    backgroundColor: "#FFFCFB",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flex: 1,
    justifyContent: "center",
  },
  actionBtnActive: {
    backgroundColor: "#FFF2ED",
    borderColor: "#FFD6C8",
  },
  actionBtnDisabled: {
    opacity: 0.72,
  },
  actionBtnText: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "900",
  },
  actionBtnTextActive: {
    color: colors.primary,
  },

  /* ─── Variant chips ─── */
  variantRail: {
    gap: 10,
  },
  variantChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: 130,
    alignItems: "center",
  },
  variantChipSelected: {
    backgroundColor: "#FFF3ED",
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  variantChipDisabled: {
    backgroundColor: "#F3F4F6",
  },
  variantName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  variantNameSelected: {
    color: colors.primary,
  },
  variantPrice: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },
  variantDisabledText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },

  /* ─── Quantity ─── */
  qtyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  qtyStockText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
  },
  qtyStockDanger: {
    color: colors.danger,
  },
  qtyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
  },
  qtyBtn: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: "#FFE0D6",
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  qtyBtnDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: colors.border,
  },
  qtyValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    minWidth: 36,
    textAlign: "center",
  },

  /* ─── Description ─── */
  descriptionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  readMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 6,
  },
  highlightBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  highlightTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
  },
  highlightRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  highlightDot: {
    backgroundColor: colors.primary,
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  highlightText: {
    color: "#475467",
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },
  specBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  specTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
  },
  specTable: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  specRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  specRowLast: {
    borderBottomWidth: 0,
  },
  specLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  specValue: {
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
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    padding: 10,
  },
  trustIcon: {
    backgroundColor: "#DCF5EA",
    borderRadius: 999,
    height: 28,
    alignItems: "center",
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

  /* ─── Seller ─── */
  sellerRow: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  sellerRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  sellerLogo: {
    borderRadius: 10,
    height: 44,
    width: 44,
  },
  sellerLogoFallback: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 10,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sellerInfo: {
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
  sellerRatingBadge: {
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
  sellerDesc: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 2,
  },
  sellerCta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },

  /* ─── Recommendations ─── */
  recoRail: {
    gap: 10,
    paddingRight: 4,
  },
  recoCard: {
    width: 155,
  },

  /* ─── Reviews ─── */
  reviewsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reviewsToggle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
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
  reviewsList: {
    gap: 8,
  },
  reviewsEmpty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  reviewCard: {
    backgroundColor: colors.secondary,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reviewCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  reviewName: {
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
  verifiedText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: "900",
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  reviewComment: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  writeReviewBtn: {
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
  writeReviewText: {
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

  /* ─── Action bar (sticky bottom) ─── */
  actionBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: "#111827",
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  actionError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  actionHelp: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  addedToast: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  addedText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "900",
  },
  addedCta: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  actionGoToCartBtn: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 8,
    paddingVertical: 12,
  },
  actionGoToCartText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  actionPrimary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
  },
  actionPrimaryOutline: {
    backgroundColor: "transparent",
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  actionPrimaryDisabled: {
    backgroundColor: "#A8AFBA",
  },
  actionPrimaryText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  actionPrimaryOutlineText: {
    color: colors.primary,
  },
  actionSecondary: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 42,
  },
  actionSecondaryDisabled: {
    borderColor: "#C0C8D4",
  },
  actionSecondaryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  actionSecondaryTextDisabled: {
    color: "#9AA4B2",
  },
  returnPill: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "center",
  },
  returnIcon: {
    borderRadius: 999,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    width: 22,
  },
  returnIconActive: {
    backgroundColor: "#DCF5EA",
  },
  returnIconDefault: {
    backgroundColor: "#F3F4F6",
  },
  returnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  returnTextActive: {
    color: "#15803D",
  },
  returnTextDefault: {
    color: "#6B7280",
  },
});
