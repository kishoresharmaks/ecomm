import {
  MinusSignIcon,
  PlusSignIcon,
  Shield01Icon,
  ShoppingCart01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Stack, type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { ProductCard } from "../../src/components/product-card";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { withStorefrontMaintenance } from "../../src/features/maintenance/mobile-maintenance-gate";
import { addCartItem, getCart, getProduct, listProducts } from "../../src/features/storefront/storefront-api";
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
  | { id: "summary"; type: "summary"; product: ProductSummary; selectedVariant: ProductVariant | null }
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
  | { id: "description"; type: "description"; product: ProductSummary }
  | { id: "seller"; type: "seller"; product: ProductSummary }
  | { id: "recommendations"; type: "recommendations"; products: MobileProduct[] };

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
        { id: "summary", type: "summary", product, selectedVariant },
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
        { id: "description", type: "description", product },
        { id: "seller", type: "seller", product },
      ];

      if (recommendations.length >= 4) {
        items.push({ id: "recommendations", type: "recommendations", products: recommendations });
      }

      return items;
    },
    [product, quantity, recommendations, selectedImageUrl, selectedVariant],
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
    return <ProductSummaryBlock formatPrice={formatPrice} product={item.product} selectedVariant={item.selectedVariant} />;
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
    return <RecommendationsBlock formatPrice={formatPrice} products={item.products} />;
  }

  return <DescriptionBlock product={item.product} />;
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
  product,
  selectedVariant,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  product: ProductSummary;
  selectedVariant: ProductVariant | null;
}) {
  const mrp = selectedVariant?.mrpPaise ?? selectedVariant?.originalPricePaise ?? null;
  const price = selectedVariant?.pricePaise;
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
                {formatPrice(item.pricePaise)}
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

function DescriptionBlock({ product }: { product: ProductSummary }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Product details</Text>
      <Text style={styles.descriptionText}>{product.description || "Product details will be updated by the seller soon."}</Text>
      <View style={styles.trustRow}>
        <HugeiconsIcon color={colors.success} icon={Shield01Icon} size={22} strokeWidth={2.1} />
        <Text style={styles.trustText}>Verified seller listing with secure cart pricing from the marketplace backend.</Text>
      </View>
    </View>
  );
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

function RecommendationsBlock({ formatPrice, products }: { formatPrice: (pricePaise?: number | null) => string; products: MobileProduct[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>You may also like</Text>
      <ScrollView horizontal contentContainerStyle={styles.recommendationRail} showsHorizontalScrollIndicator={false}>
        {products.map((product) => (
          <View key={product.id} style={styles.recommendationCard}>
            <ProductCard compact formatPrice={formatPrice} product={product} />
          </View>
        ))}
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
  const unavailableReason =
    product.listingMode === "ENQUIRY_ONLY"
      ? "This product is enquiry-only."
      : selectedVariant && selectedVariant.stockQuantity <= 0
        ? "Selected option is out of stock."
        : "";

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

  const mrp = variant.mrpPaise ?? variant.originalPricePaise ?? null;
  if (mrp && mrp > variant.pricePaise) {
    return `${Math.round(((mrp - variant.pricePaise) / mrp) * 100)}% off`;
  }

  return "";
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
    lineHeight: 21,
  },
  trustRow: {
    alignItems: "center",
    backgroundColor: "#F7FBF9",
    borderColor: "#CFEFE2",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 12,
  },
  trustText: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
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
});
