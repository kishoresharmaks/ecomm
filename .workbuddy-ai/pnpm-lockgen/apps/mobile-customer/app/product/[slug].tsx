import {
  CheckmarkCircle01Icon,
  DeliveryTruck01Icon,
  FileCheckIcon,
  HeartIcon,
  MinusSignIcon,
  NoteIcon,
  PlusSignIcon,
  QrCodeIcon,
  Share02Icon,
  Shield01Icon,
  ShoppingCart01Icon,
  Store01Icon,
  TagIcon,
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
import { addCartItem, addWishlistItem, getCart, getProduct, getWishlist, listProducts, removeWishlistItem } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { useRecentProductsStore } from "../../src/state/recent-products-store";
import { colors } from "../../src/theme";
import type { MobileProduct } from "../../src/types/mobile-home";
import type { ProductImage, ProductSummary, ProductVariant } from "../../src/types/storefront";

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
        <Image resizeMode="contain" source={{ uri: heroImage }} style={styles.heroImage} />
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
  const inStock = Boolean(selectedVariant && selectedVariant.status === "ACTIVE" && selectedVariant.stockQuantity > 0);

  return (
    <View style={styles.section}>
      <Text numberOfLines={1} style={styles.categoryLabel}>
        {product.category?.name ?? "Marketplace product"}
      </Text>
      <Text style={styles.productName}>{product.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceText}>{formatPrice(price)}</Text>
        {mrp && price && mrp > price ? <Text style={styles.mrpText}>{formatPrice(mrp)}</Text> : null}
        {discountLabel(selectedVariant) ? <Text style={styles.discountPill}>{discountLabel(selectedVariant)}</Text> : null}
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
            <HugeiconsIcon color={isWished ? colors.primary : "#667085"} icon={HeartIcon} size={18} strokeWidth={isWished ? 2.6 : 2} />
          )}
          <Text numberOfLines={1} style={[styles.productActionText, isWished ? styles.productActionTextActive : null]}>
            {isWished ? "Saved" : "Wishlist"}
          </Text>
        </Pressable>
        <Pressable accessibilityLabel="Share product" accessibilityRole="button" style={styles.productActionButton} onPress={onShare}>
          <HugeiconsIcon color="#667085" icon={Share02Icon} size={18} strokeWidth={2} />
          <Text numberOfLines={1} style={styles.productActionText}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.stockPill, inStock ? styles.stockPillIn : styles.stockPillOut]}>
          {inStock ? `${selectedVariant?.stockQuantity ?? 0} in stock` : "Out of stock"}
        </Text>
        <Text style={styles.metaPill}>
          {rating ? `${rating.toFixed(1)} rating` : "New arrival"}
          {reviewCount ? ` (${reviewCount})` : ""}
        </Text>
        {selectedVariant?.activeDeal ? <Text style={styles.metaPill}>{selectedVariant.activeDeal.title}</Text> : null}
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
              {disabled ? <Text style={styles.variantUnavailable}>Out of stock</Text> : null}
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
          <HugeiconsIcon color={quantity <= 1 ? "#9AA4B2" : colors.ink} icon={MinusSignIcon} size={17} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.qtyText}>{quantity}</Text>
        <Pressable
          disabled={unavailable || quantity >= maxQuantity}
          style={[styles.qtyButton, unavailable || quantity >= maxQuantity ? styles.qtyButtonDisabled : null]}
          onPress={() => onChangeQuantity(Math.min(maxQuantity, quantity + 1))}
        >
          <HugeiconsIcon color={unavailable || quantity >= maxQuantity ? "#9AA4B2" : colors.ink} icon={PlusSignIcon} size={17} strokeWidth={2.2} />
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
    ? `${rawDescription.slice(0, DESC_LIMIT).trimEnd()}\u2026`
    : rawDescription;

  return (
    <View style={styles.section}>
      {/* Header */}
      <Text style={styles.sectionTitle}>About this product</Text>

      {/* Description */}
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
          <View style={styles.detailSectionHeader}>
            <View style={styles.sectionIconBadge}>
              <HugeiconsIcon color="#ED3500" icon={CheckmarkCircle01Icon} size={13} strokeWidth={2.4} />
            </View>
            <Text style={styles.detailSectionTitle}>Key highlights</Text>
          </View>
          {details.highlights.map((highlight, index) => (
            <View key={highlight} style={styles.highlightRow}>
              <View style={styles.highlightNumberBadge}>
                <Text style={styles.highlightNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Detail sections */}
      {details.sections.map((detailSection) => (
        <View key={detailSection.key} style={styles.detailSection}>
          <View style={styles.detailSectionHeader}>
            <View style={styles.sectionIconBadge}>
              <DescriptionSectionIcon sectionKey={detailSection.key} />
            </View>
            <Text style={styles.detailSectionTitle}>{detailSection.title}</Text>
          </View>
          <View style={styles.detailTable}>
            {detailSection.rows.map((row, index) => (
              <View
                key={`${row.scope}-${row.key}`}
                style={[
                  styles.detailRow,
                  index % 2 === 0 ? styles.detailRowEven : styles.detailRowOdd,
                  index === detailSection.rows.length - 1 ? styles.detailRowLast : null,
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
          <HugeiconsIcon color={colors.success} icon={Shield01Icon} size={18} strokeWidth={2.2} />
        </View>
        <Text style={styles.trustText}>Seller listing verified and approved by 1HandIndia marketplace.</Text>
      </View>
    </View>
  );
}

function DescriptionSectionIcon({ sectionKey }: { sectionKey: string }) {
  switch (sectionKey) {
    case "OVERVIEW":
      return <HugeiconsIcon color="#163B5C" icon={NoteIcon} size={13} strokeWidth={2.3} />;
    case "COMPLIANCE":
      return <HugeiconsIcon color="#163B5C" icon={FileCheckIcon} size={13} strokeWidth={2.3} />;
    case "FULFILMENT":
      return <HugeiconsIcon color="#163B5C" icon={DeliveryTruck01Icon} size={13} strokeWidth={2.3} />;
    case "IDENTIFIERS":
      return <HugeiconsIcon color="#163B5C" icon={QrCodeIcon} size={13} strokeWidth={2.3} />;
    case "SPECIFICATIONS":
      return <HugeiconsIcon color="#163B5C" icon={TagIcon} size={13} strokeWidth={2.3} />;
    case "VARIANT":
      return <HugeiconsIcon color="#163B5C" icon={TagIcon} size={13} strokeWidth={2.3} />;
    default:
      return <HugeiconsIcon color="#163B5C" icon={NoteIcon} size={13} strokeWidth={2.3} />;
  }
}

function SellerBlock({ product }: { product: ProductSummary }) {
  const logoUrl = resolveImageUrl(product.seller?.profile?.logoUrl);
  const sellerSlug = product.seller?.slug;
  const sellerRow = (
    <Pressable disabled={!sellerSlug} style={({ pressed }) => [styles.sellerRow, pressed ? styles.sellerRowPressed : null]}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.sellerLogo} />
      ) : (
        <View style={styles.sellerLogoFallback}>
          <HugeiconsIcon color={colors.primary} icon={Store01Icon} size={26} strokeWidth={2} />
        </View>
      )}
      <View style={styles.sellerCopy}>
        <Text numberOfLines={1} style={styles.sellerName}>
          {product.seller?.storeName ?? "1HandIndia seller"}
        </Text>
        <Text numberOfLines={2} style={styles.sellerDescription}>
          {product.seller?.profile?.description ?? "Approved marketplace seller."}
        </Text>
      </View>
      {sellerSlug ? <Text style={styles.sellerAction}>View</Text> : null}
    </Pressable>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sold by</Text>
      {sellerSlug ? <Link asChild href={`/store/${sellerSlug}` as Href}>{sellerRow}</Link> : sellerRow}
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
          style={[styles.addButton, isRegionRestricted ? styles.addButtonDisabled : null]}
          onPress={isRegionRestricted ? undefined : handleB2BCTA}
        >
          <Text style={styles.addButtonText}>
            {isRegionRestricted
              ? "Not available in your region"
              : isSignedIn
                ? "Request Quote (B2B)"
                : "Sign in to request quote"}
          </Text>
        </Pressable>
      ) : (
        <>
          {/* Primary add-to-cart button */}
          <Pressable
            disabled={isBusy || (isSignedIn && !isInCart && !canAddToCart)}
            style={[styles.addButton, isBusy || (isSignedIn && !isInCart && !canAddToCart) ? styles.addButtonDisabled : null]}
            onPress={isSignedIn ? (isInCart ? onGoToCart : onAdd) : onSignIn}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={22} strokeWidth={2.2} />
                <Text style={styles.addButtonText}>{isSignedIn ? (isInCart ? "Go to cart" : "Add to cart") : "Sign in to add"}</Text>
              </>
            )}
          </Pressable>
          {/* Secondary B2B CTA — always visible, even out-of-stock */}
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

function discountLabel(variant: ProductVariant | null) {
  if (!variant) {
    return "";
  }

  if (variant.dealDiscountBps && variant.dealDiscountBps > 0) {
    return `${Math.round(variant.dealDiscountBps / 100)}% off`;
  }

  const price = variantDisplayPrice(variant);
  const mrp = variantOriginalDisplayPrice(variant);
  if (price && mrp && mrp > price) {
    return `${Math.round(((mrp - price) / mrp) * 100)}% off`;
  }

  return "";
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
    paddingBottom: 142,
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
    paddingBottom: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  heroImage: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    height: 330,
    overflow: "hidden",
    width: "100%",
  },
  heroImageFallback: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    height: 330,
    justifyContent: "center",
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
    borderRadius: 18,
    borderWidth: 1,
    height: 66,
    marginLeft: 0,
    marginRight: 10,
    marginTop: 14,
    overflow: "hidden",
    width: 66,
  },
  thumbnailButtonActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  thumbnailImage: {
    height: "100%",
    width: "100%",
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.045,
    shadowRadius: 22,
  },
  categoryLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  productName: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 29,
    marginTop: 6,
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
    fontSize: 25,
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
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  productActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  productActionButton: {
    alignItems: "center",
    backgroundColor: "#FFFCFB",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: "900",
  },
  productActionTextActive: {
    color: colors.primary,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stockPill: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stockPillIn: {
    backgroundColor: "#EAFBF1",
    color: colors.success,
  },
  stockPillOut: {
    backgroundColor: "#FFE9E9",
    color: colors.danger,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
  variantChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginRight: 10,
    minHeight: 78,
    paddingHorizontal: 13,
    paddingVertical: 11,
    width: 150,
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
    fontSize: 13,
    fontWeight: "900",
  },
  variantNameActive: {
    color: colors.primary,
  },
  variantPrice: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 7,
  },
  variantUnavailable: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 5,
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
    marginBottom: 12,
  },
  stockDanger: {
    color: colors.danger,
  },
  quantityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  qtyButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: "#FFE0D6",
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
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
    marginTop: 18,
    paddingTop: 16,
  },
  detailSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  sectionIconBadge: {
    alignItems: "center",
    backgroundColor: "#F0F4F8",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  detailSectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  detailTable: {
    borderColor: "#EEF1F4",
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
  highlightNumberBadge: {
    alignItems: "center",
    backgroundColor: "#FFF0E8",
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    marginTop: 1,
    width: 20,
  },
  highlightNumberText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
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
    borderBottomColor: "#EEF1F4",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailRowEven: {
    backgroundColor: "#FFFFFF",
  },
  detailRowOdd: {
    backgroundColor: "#FAFBFC",
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 10,
  },
  detailLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  detailValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    textAlign: "right",
  },
  trustRow: {
    alignItems: "center",
    backgroundColor: "#F2FCF7",
    borderColor: "#AEDEC8",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    padding: 12,
  },
  trustIconWrap: {
    alignItems: "center",
    backgroundColor: "#DCF5EA",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  trustText: {
    color: "#1A5C3A",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
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
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  sellerRowPressed: {
    transform: [{ scale: 0.99 }],
  },
  sellerLogo: {
    borderRadius: 18,
    height: 54,
    width: 54,
  },
  sellerLogoFallback: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 18,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  sellerCopy: {
    flex: 1,
    minWidth: 0,
  },
  sellerName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  sellerDescription: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 4,
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
    width: 184,
  },
  actionWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
    shadowColor: "#111827",
    shadowOffset: { height: -8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  actionHelp: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
  },
  actionError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
  },
  addedRow: {
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
  goToCartText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 54,
  },
  addButtonDisabled: {
    backgroundColor: "#A8AFBA",
  },
  addButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
  },
  b2bSecondaryButton: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 48,
    marginTop: 6,
  },
  b2bSecondaryButtonDisabled: {
    borderColor: "#C0C8D4",
  },
  b2bSecondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
});
