import {
  Delete02Icon,
  MinusSignIcon,
  PlusSignIcon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { accountErrorMessage } from "../../src/features/account/account-ui";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { getCart, removeCartItem, updateCartItem, type MobileCartSummary } from "../../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

export default function CartScreen() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const market = useMobileMarket();
  const [actionError, setActionError] = useState("");
  const cartQueryKey = ["mobile-cart", customerAuth.authKey] as const;
  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    initialData: () => queryClient.getQueryData<MobileCartSummary>(cartQueryKey),
    refetchOnMount: "always",
    staleTime: 0,
  });
  const updateMutation = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) =>
      updateCartItem(customerAuth.authHeaders, cartItemId, quantity),
    onMutate: () => setActionError(""),
    onSuccess: () => void invalidateCart(queryClient, customerAuth.authKey),
    onError: (error) => setActionError(accountErrorMessage(error, "Cart item could not be updated.")),
  });
  const removeMutation = useMutation({
    mutationFn: (cartItemId: string) => removeCartItem(customerAuth.authHeaders, cartItemId),
    onMutate: () => setActionError(""),
    onSuccess: () => void invalidateCart(queryClient, customerAuth.authKey),
    onError: (error) => setActionError(accountErrorMessage(error, "Cart item could not be removed.")),
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing") {
    return (
      <Screen>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Preparing your cart...</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <Screen>
        <Text style={styles.title}>Cart</Text>
        <EmptyState title="Sign in to view cart" message="Your cart is saved securely with your 1HandIndia account." />
        <Link href="/auth/sign-in" style={styles.primaryButton}>
          Sign in
        </Link>
      </Screen>
    );
  }

  const cart = cartQuery.data;
  const items = cart?.items ?? [];

  if (cartQuery.isLoading || (!items.length && cartQuery.isFetching)) {
    return (
      <Screen>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading cart items...</Text>
        </View>
      </Screen>
    );
  }

  if (cartQuery.isError) {
    return (
      <Screen>
        <Text style={styles.title}>Cart</Text>
        <EmptyState title="Cart could not load" message="Check your connection and try again." />
        <Pressable style={styles.primaryButton} onPress={() => void cartQuery.refetch()}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </Screen>
    );
  }

  const subtotalPaise = items.reduce((total, item) => total + item.quantity * cartItemUnitPrice(item), 0);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const busyItemId = updateMutation.variables?.cartItemId ?? removeMutation.variables ?? null;

  return (
    <Screen padded={false}>
      <FlashList
        contentContainerStyle={styles.scrollContent}
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <EmptyState title="Your cart is empty" message="Add products from home or search to see them here." />
            <Link href="/search" style={styles.primaryButton}>
              Start shopping
            </Link>
          </View>
        }
        ListFooterComponent={
          items.length ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryHeaderCopy}>
                  <Text style={styles.summaryEyebrow}>Order estimate</Text>
                  <Text style={styles.summaryTitle}>Ready to checkout</Text>
                </View>
                <Text style={styles.summaryTotal}>{market.format(subtotalPaise)}</Text>
              </View>
              {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cart subtotal</Text>
                <Text style={styles.summaryValue}>{market.format(subtotalPaise)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </Text>
              </View>
              <Text style={styles.summaryHelp}>Delivery, discounts, and platform fees are calculated in checkout.</Text>
              <Pressable style={styles.checkoutButton} onPress={() => router.push("/checkout")}>
                <Text style={styles.checkoutButtonText}>Continue to checkout</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Shopping bag</Text>
              <Text style={styles.title}>Your cart</Text>
              <Text style={styles.subtitle}>
                {itemCount} item{itemCount === 1 ? "" : "s"} saved for a smooth checkout.
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <HugeiconsIcon color={colors.primary} icon={ShoppingCart01Icon} size={28} strokeWidth={2.1} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CartItemRow
            busy={busyItemId === item.id}
            formatPrice={market.format}
            item={item}
            onRemove={() => removeMutation.mutate(item.id)}
            onUpdate={(quantity) => updateMutation.mutate({ cartItemId: item.id, quantity })}
          />
        )}
      />
    </Screen>
  );
}

function CartItemRow({
  busy,
  formatPrice,
  item,
  onRemove,
  onUpdate,
}: {
  busy: boolean;
  formatPrice: (pricePaise?: number | null) => string;
  item: MobileCartSummary["items"][number];
  onRemove: () => void;
  onUpdate: (quantity: number) => void;
}) {
  const product = item.productVariant?.product;
  const imageUrl = resolveImageUrl(product?.images?.[0]?.url);
  const unitPrice = cartItemUnitPrice(item);
  const mrp = item.productVariant?.mrpPaise ?? null;
  const nextMinusQuantity = Math.max(1, item.quantity - 1);
  const nextPlusQuantity = Math.min(99, item.quantity + 1);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemImageFrame}>
        {imageUrl ? <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.itemImage} /> : <View style={styles.itemImageFallback} />}
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemTopRow}>
          <View style={styles.itemTitleBlock}>
            <Text numberOfLines={2} style={styles.itemName}>
              {product?.name ?? "Cart item"}
            </Text>
            {product?.seller?.storeName ? (
              <Text numberOfLines={1} style={styles.itemSeller}>
                {product.seller.storeName}
              </Text>
            ) : null}
          </View>
          <Pressable disabled={busy} style={styles.removeButton} onPress={onRemove}>
            {busy ? <ActivityIndicator color={colors.primary} size="small" /> : <HugeiconsIcon color={colors.danger} icon={Delete02Icon} size={19} />}
          </Pressable>
        </View>
        <View style={styles.itemPriceRow}>
          <Text style={styles.itemPrice}>{formatPrice(unitPrice)}</Text>
          {mrp && mrp > unitPrice ? <Text style={styles.itemMrp}>{formatPrice(mrp)}</Text> : null}
        </View>
        <View style={styles.quantityRow}>
          <View style={styles.quantityStepper}>
            <Pressable disabled={busy || item.quantity <= 1} style={[styles.qtyButton, item.quantity <= 1 ? styles.qtyButtonDisabled : null]} onPress={() => onUpdate(nextMinusQuantity)}>
              <HugeiconsIcon color={item.quantity <= 1 ? "#9AA4B2" : colors.ink} icon={MinusSignIcon} size={16} strokeWidth={2.2} />
            </Pressable>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <Pressable disabled={busy || item.quantity >= 99} style={styles.qtyButton} onPress={() => onUpdate(nextPlusQuantity)}>
              <HugeiconsIcon color={colors.ink} icon={PlusSignIcon} size={16} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text style={styles.lineTotal}>{formatPrice(unitPrice * item.quantity)}</Text>
        </View>
      </View>
    </View>
  );
}

function cartItemUnitPrice(item: MobileCartSummary["items"][number]) {
  return item.unitPricePaise ?? item.productVariant?.pricePaise ?? 0;
}

async function invalidateCart(queryClient: ReturnType<typeof useQueryClient>, authKey: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["mobile-cart", authKey] }),
    queryClient.invalidateQueries({ queryKey: ["mobile-cart-count", authKey] }),
  ]);
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 128,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    padding: 18,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
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
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 16,
    overflow: "hidden",
    paddingVertical: 14,
    textAlign: "center",
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 4,
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
    padding: 14,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  itemImageFrame: {
    backgroundColor: "#FFF8F5",
    borderRadius: 24,
    height: 120,
    overflow: "hidden",
    width: 112,
  },
  itemImage: {
    backgroundColor: "#F8FAFC",
    height: "100%",
    width: "100%",
  },
  itemImageFallback: {
    backgroundColor: colors.softSurface,
    height: "100%",
    width: "100%",
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  itemTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  itemSeller: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: "#FFF4F0",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  itemPriceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
  },
  itemPrice: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  itemMrp: {
    color: "#9AA4B2",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  quantityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  quantityStepper: {
    alignItems: "center",
    backgroundColor: "#FFFBFA",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  qtyButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  qtyButtonDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: colors.border,
  },
  qtyText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 24,
    textAlign: "center",
  },
  lineTotal: {
    color: colors.primary,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 5,
    marginTop: 8,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 28,
  },
  summaryHeader: {
    alignItems: "flex-start",
    borderBottomColor: "#F3E7E2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 14,
  },
  summaryHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  summaryEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  summaryTotal: {
    color: colors.primary,
    flexShrink: 0,
    fontSize: 22,
    fontWeight: "900",
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  summaryLabel: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "800",
  },
  summaryValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  summaryHelp: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 8,
  },
  actionError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    marginTop: 18,
    paddingVertical: 17,
  },
  checkoutButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
});
