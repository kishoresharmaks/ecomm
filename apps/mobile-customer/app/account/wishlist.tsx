import {
  CheckmarkCircle02Icon,
  Delete02Icon,
  HeartIcon,
  PackageIcon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import {
  addCartItem,
  getWishlist,
  removeWishlistItem,
  type MobileWishlistSummary,
} from "../../src/features/storefront/storefront-api";
import type { ProductSummary, ProductVariant } from "../../src/types/storefront";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { AccountLoadingState, accountErrorMessage, RetryState, SignInRequiredState } from "../../src/features/account/account-ui";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

type WishlistItem = MobileWishlistSummary["items"][number];

export default function WishlistScreen() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const market = useMobileMarket();
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const wishlistQuery = useQuery({
    queryKey: ["mobile-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const items = wishlistQuery.data?.items ?? [];
  const purchasableItems = useMemo(() => items.filter((item) => primaryWishlistVariant(item.product)), [items]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.product.id) && primaryWishlistVariant(item.product)),
    [items, selectedIds],
  );
  const summary = useMemo(() => wishlistSummary(items, selectedItems), [items, selectedItems]);
  const allPurchasableSelected = purchasableItems.length > 0 && purchasableItems.every((item) => selectedIds.has(item.product.id));

  useEffect(() => {
    setSelectedIds((current) => {
      const liveIds = new Set(items.map((item) => item.product.id));
      const next = new Set([...current].filter((id) => liveIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const removeMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      for (const productId of productIds) {
        await removeWishlistItem(customerAuth.authHeaders, productId);
      }
    },
    onMutate: () => {
      setActionError("");
      setActionMessage("");
    },
    onSuccess: async (_, productIds) => {
      setActionMessage(productIds.length === 1 ? "Product removed from wishlist." : `${productIds.length} products removed from wishlist.`);
      setSelectedIds((current) => {
        const next = new Set(current);
        productIds.forEach((id) => next.delete(id));
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["mobile-wishlist", customerAuth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] });
    },
    onError: (error) => setActionError(accountErrorMessage(error, "Wishlist item could not be removed.")),
  });

  const cartMutation = useMutation({
    mutationFn: async (products: ProductSummary[]) => {
      for (const product of products) {
        const variant = primaryWishlistVariant(product);
        if (variant) {
          await addCartItem(customerAuth.authHeaders, variant.id, 1);
        }
      }
    },
    onMutate: () => {
      setActionError("");
      setActionMessage("");
    },
    onSuccess: async (_, products) => {
      setActionMessage(products.length === 1 ? "Product added to cart." : `${products.length} selected products added to cart.`);
      await queryClient.invalidateQueries({ queryKey: ["mobile-cart", customerAuth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-cart-count", customerAuth.authKey] });
    },
    onError: (error) => setActionError(accountErrorMessage(error, "Selected products could not be added to cart.")),
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || wishlistQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
        <AccountLoadingState title="Loading wishlist..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
        <SignInRequiredState title="Sign in to view wishlist" />
      </>
    );
  }

  if (wishlistQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
        <RetryState
          title="Wishlist could not load"
          message={accountErrorMessage(wishlistQuery.error, "Check your connection and refresh wishlist.")}
          onRetry={() => void wishlistQuery.refetch()}
        />
      </>
    );
  }

  function toggleProduct(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      if (allPurchasableSelected) {
        return new Set();
      }
      const next = new Set(current);
      purchasableItems.forEach((item) => next.add(item.product.id));
      return next;
    });
  }

  function addSelectedToCart() {
    if (!selectedItems.length) {
      setActionError("Select available products before adding to cart.");
      return;
    }
    cartMutation.mutate(selectedItems.map((item) => item.product));
  }

  function removeSelected() {
    if (!selectedItems.length) {
      setActionError("Select products before removing.");
      return;
    }
    removeMutation.mutate(selectedItems.map((item) => item.product.id));
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Wishlist" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <WishlistHeader
            actionError={actionError}
            actionMessage={actionMessage}
            allSelected={allPurchasableSelected}
            itemCount={items.length}
            purchasableCount={purchasableItems.length}
            selectedCount={selectedItems.length}
            onAddSelected={addSelectedToCart}
            onRemoveSelected={removeSelected}
            onToggleAll={toggleSelectAll}
            busy={cartMutation.isPending || removeMutation.isPending}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <EmptyState title="No saved products" message="Products you save with the heart icon will appear here." />
          </View>
        }
        ListFooterComponent={
          items.length ? (
            <WishlistFooter
              formatPrice={market.format}
              selectedCount={selectedItems.length}
              summary={summary}
              onAddSelected={addSelectedToCart}
              onRemoveSelected={removeSelected}
              busy={cartMutation.isPending || removeMutation.isPending}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const variant = primaryWishlistVariant(item.product);
          return (
            <WishlistCard
              formatPrice={market.format}
              item={item}
              selected={selectedIds.has(item.product.id)}
              variant={variant}
              busy={cartMutation.isPending || removeMutation.isPending}
              onToggle={() => variant ? toggleProduct(item.product.id) : undefined}
              onAddToCart={() => cartMutation.mutate([item.product])}
              onRemove={() => removeMutation.mutate([item.productId])}
            />
          );
        }}
      />
    </>
  );
}

function WishlistHeader({
  actionError,
  actionMessage,
  allSelected,
  busy,
  itemCount,
  purchasableCount,
  selectedCount,
  onAddSelected,
  onRemoveSelected,
  onToggleAll,
}: {
  actionError: string;
  actionMessage: string;
  allSelected: boolean;
  busy: boolean;
  itemCount: number;
  purchasableCount: number;
  selectedCount: number;
  onAddSelected: () => void;
  onRemoveSelected: () => void;
  onToggleAll: () => void;
}) {
  return (
    <View>
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <HugeiconsIcon color={colors.primary} icon={HeartIcon} size={28} strokeWidth={2.1} />
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.title}>Saved products ({itemCount})</Text>
          <Text style={styles.subtitle}>Select saved items, move them to cart, or remove them from your wishlist.</Text>
        </View>
      </View>

      <View style={styles.bulkBar}>
        <Pressable disabled={!purchasableCount || busy} style={styles.selectAllButton} onPress={onToggleAll}>
          <View style={[styles.checkBox, allSelected ? styles.checkBoxActive : null]}>
            {allSelected ? <HugeiconsIcon color={colors.surface} icon={CheckmarkCircle02Icon} size={14} strokeWidth={2.4} /> : null}
          </View>
          <Text style={styles.selectAllText}>Select all ({purchasableCount})</Text>
        </Pressable>
        <Text style={styles.selectedCount}>{selectedCount} selected</Text>
      </View>

      <View style={styles.bulkActions}>
        <Pressable disabled={!selectedCount || busy} style={[styles.bulkPrimary, (!selectedCount || busy) ? styles.disabledButton : null]} onPress={onAddSelected}>
          <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={17} strokeWidth={2.2} />
          <Text style={styles.bulkPrimaryText}>Add selected to cart</Text>
        </Pressable>
        <Pressable disabled={!selectedCount || busy} style={[styles.bulkSecondary, (!selectedCount || busy) ? styles.disabledLightButton : null]} onPress={onRemoveSelected}>
          <HugeiconsIcon color={colors.primary} icon={Delete02Icon} size={17} strokeWidth={2.2} />
          <Text style={styles.bulkSecondaryText}>Remove selected</Text>
        </Pressable>
      </View>

      {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
      {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}
    </View>
  );
}

function WishlistCard({
  busy,
  formatPrice,
  item,
  onAddToCart,
  onRemove,
  onToggle,
  selected,
  variant,
}: {
  busy: boolean;
  formatPrice: (pricePaise?: number | null) => string;
  item: WishlistItem;
  onAddToCart: () => void;
  onRemove: () => void;
  onToggle: () => void | undefined;
  selected: boolean;
  variant: ProductVariant | null;
}) {
  const router = useRouter();
  const product = item.product;
  const imageUrl = resolveImageUrl(product.images?.find((image) => image.isPrimary)?.url ?? product.images?.[0]?.url);
  const originalPrice = originalVariantPrice(variant);
  const discountPercent = discountPercentForVariant(variant);
  const lowStock = Boolean(variant && variant.stockQuantity > 0 && variant.stockQuantity <= 3);

  return (
    <View style={[styles.productCard, selected ? styles.productCardSelected : null]}>
      <View style={styles.productTopRow}>
        <Pressable
          accessibilityLabel={selected ? `Unselect ${product.name}` : `Select ${product.name}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected, disabled: !variant || busy }}
          disabled={!variant || busy}
          style={[styles.rowCheckBox, selected ? styles.checkBoxActive : null, (!variant || busy) ? styles.disabledLightButton : null]}
          onPress={onToggle}
        >
          {selected ? <HugeiconsIcon color={colors.surface} icon={CheckmarkCircle02Icon} size={14} strokeWidth={2.4} /> : null}
        </Pressable>
        <Pressable style={styles.productBody} onPress={() => router.push(`/product/${product.slug}`)}>
          <RemoteImage fallbackLabel={product.name} resizeMode="cover" style={styles.productImage} uri={imageUrl} />
          <View style={styles.productInfo}>
            <Text numberOfLines={2} ellipsizeMode="tail" style={styles.productName}>{product.name}</Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.productMeta}>{variant?.variantName ?? variant?.sku ?? "Variant unavailable"}</Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.sellerText}>Added from {product.seller?.storeName ?? "1HandIndia seller"}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.detailGrid}>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.productPrice}>{formatPrice(variant?.pricePaise)}</Text>
          {originalPrice ? <Text style={styles.mrpText}>{formatPrice(originalPrice)}</Text> : null}
          {discountPercent > 0 ? <Text style={styles.discountPill}>{discountPercent}% OFF</Text> : null}
        </View>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Added on</Text>
          <Text style={styles.detailValue}>{formatWishlistDate(item.createdAt)}</Text>
        </View>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>Availability</Text>
          {variant && variant.stockQuantity > 0 ? (
            <>
              <Text style={[styles.stockText, lowStock ? styles.lowStockText : null]}>{lowStock ? "Low Stock" : "In Stock"}</Text>
              <Text style={styles.stockHint}>{lowStock ? `Only ${variant.stockQuantity} left` : "Ships in 1-2 days"}</Text>
            </>
          ) : (
            <>
              <Text style={styles.unavailableText}>Unavailable</Text>
              <Text style={styles.stockHint}>Cannot add to cart</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable disabled={!variant || busy} style={[styles.viewButton, (!variant || busy) ? styles.disabledButton : null]} onPress={onAddToCart}>
          <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={16} strokeWidth={2.2} />
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.viewButtonText}>Add to cart</Text>
        </Pressable>
        <Pressable disabled={busy} style={[styles.removeButton, busy ? styles.disabledLightButton : null]} onPress={onRemove}>
          {busy ? <ActivityIndicator color={colors.danger} size="small" /> : <HugeiconsIcon color={colors.danger} icon={Delete02Icon} size={18} strokeWidth={2.1} />}
        </Pressable>
      </View>
    </View>
  );
}

function WishlistFooter({
  busy,
  formatPrice,
  onAddSelected,
  onRemoveSelected,
  selectedCount,
  summary,
}: {
  busy: boolean;
  formatPrice: (pricePaise?: number | null) => string;
  onAddSelected: () => void;
  onRemoveSelected: () => void;
  selectedCount: number;
  summary: ReturnType<typeof wishlistSummary>;
}) {
  return (
    <View style={styles.footerWrap}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Wishlist Summary</Text>
        <SummaryLine label="Total items" value={String(summary.totalItems)} />
        <SummaryLine label="In stock" value={String(summary.inStock)} />
        <SummaryLine label="Low stock" value={String(summary.lowStock)} />
        <SummaryLine label="Total value" value={formatPrice(summary.totalValue)} strong />
      </View>

      <View style={styles.savingsCard}>
        <View style={styles.savingsHeader}>
          <HugeiconsIcon color="#16803A" icon={PackageIcon} size={18} strokeWidth={2.1} />
          <Text style={styles.savingsLabel}>You save</Text>
        </View>
        <Text style={styles.savingsValue}>{formatPrice(summary.savings)}</Text>
        <Text style={styles.savingsMeta}>Total MRP: {formatPrice(summary.mrpTotal)}</Text>
        <Text style={styles.savingsMeta}>Total discount: {summary.discountPercent}%</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Selected Items ({selectedCount})</Text>
        <SummaryLine label="Total price" value={formatPrice(summary.selectedValue)} strong />
        <Pressable disabled={!selectedCount || busy} style={[styles.footerPrimary, (!selectedCount || busy) ? styles.disabledButton : null]} onPress={onAddSelected}>
          <Text style={styles.footerPrimaryText}>Add selected to cart</Text>
        </Pressable>
        <Pressable disabled={!selectedCount || busy} style={[styles.footerSecondary, (!selectedCount || busy) ? styles.disabledLightButton : null]} onPress={onRemoveSelected}>
          <Text style={styles.footerSecondaryText}>Remove selected</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={strong ? styles.summaryStrongValue : styles.summaryValue}>{value}</Text>
    </View>
  );
}

function primaryWishlistVariant(product: ProductSummary) {
  return product.variants?.find((variant) => variant.status === "ACTIVE" && variant.stockQuantity > 0) ?? null;
}

function originalVariantPrice(variant: ProductVariant | null) {
  if (!variant) {
    return null;
  }
  const original = variant.originalPricePaise ?? variant.mrpPaise ?? null;
  return original && original > variant.pricePaise ? original : null;
}

function discountPercentForVariant(variant: ProductVariant | null) {
  const original = originalVariantPrice(variant);
  if (!variant || !original) {
    return 0;
  }
  return Math.round(((original - variant.pricePaise) / original) * 100);
}

function wishlistSummary(items: WishlistItem[], selectedItems: WishlistItem[]) {
  const totals = items.reduce(
    (result, item) => {
      const variant = primaryWishlistVariant(item.product);
      if (!variant) {
        return result;
      }
      const original = originalVariantPrice(variant) ?? variant.pricePaise;
      result.totalValue += variant.pricePaise;
      result.mrpTotal += original;
      result.savings += Math.max(0, original - variant.pricePaise);
      if (variant.stockQuantity > 3) {
        result.inStock += 1;
      } else if (variant.stockQuantity > 0) {
        result.lowStock += 1;
      }
      return result;
    },
    { totalValue: 0, mrpTotal: 0, savings: 0, inStock: 0, lowStock: 0 },
  );

  const selectedValue = selectedItems.reduce((total, item) => total + (primaryWishlistVariant(item.product)?.pricePaise ?? 0), 0);
  const discountPercent = totals.mrpTotal > 0 ? Math.round((totals.savings / totals.mrpTotal) * 10000) / 100 : 0;
  return { ...totals, discountPercent, selectedValue, totalItems: items.length };
}

function formatWishlistDate(value?: string) {
  if (!value) {
    return "Recently";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 110,
  },
  headerCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  bulkBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    padding: 12,
  },
  selectAllButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  checkBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  rowCheckBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    marginTop: 28,
    width: 24,
  },
  checkBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectAllText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  selectedCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  bulkActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  bulkPrimary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
  },
  bulkPrimaryText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  bulkSecondary: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FAD7CB",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
  },
  bulkSecondaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  actionError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 12,
  },
  actionMessage: {
    color: "#16803A",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  productCardSelected: {
    backgroundColor: "#FFFCFB",
    borderColor: colors.primary,
  },
  productTopRow: {
    flexDirection: "row",
    gap: 10,
  },
  productBody: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    minWidth: 0,
  },
  productImage: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    height: 84,
    width: 84,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  productMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  sellerText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
  },
  detailGrid: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
  },
  detailBlock: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  productPrice: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 5,
  },
  mrpText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textDecorationLine: "line-through",
  },
  discountPill: {
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    color: "#16803A",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  stockText: {
    color: "#16803A",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  lowStockText: {
    color: colors.primary,
  },
  unavailableText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  stockHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  viewButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
  },
  viewButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: "#FEF3F2",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 48,
  },
  disabledButton: {
    opacity: 0.45,
  },
  disabledLightButton: {
    opacity: 0.5,
  },
  footerWrap: {
    gap: 12,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  summaryStrongValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  savingsCard: {
    backgroundColor: "#FBFEFC",
    borderColor: "#D9F5E5",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  savingsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  savingsLabel: {
    color: "#064C35",
    fontSize: 13,
    fontWeight: "900",
  },
  savingsValue: {
    color: "#16A34A",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
  },
  savingsMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  footerPrimary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 44,
  },
  footerPrimaryText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  footerSecondary: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FAD7CB",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 44,
  },
  footerSecondaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
});
