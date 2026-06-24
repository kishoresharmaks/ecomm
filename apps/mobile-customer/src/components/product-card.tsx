import { HeartIcon, ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { resolveImageUrl } from "../lib/image-url";
import { colors } from "../theme";
import type { MobileProduct } from "../types/mobile-home";
import type { ProductSummary } from "../types/storefront";
import { RemoteImage } from "./remote-image";

// Standard card dimensions - consistent across all card types
const STANDARD_IMAGE_HEIGHT = 120;

type ProductCardProduct = MobileProduct | ProductSummary;

type ProductCardProps = {
  compact?: boolean;
  formatPrice?: (pricePaise?: number | null) => string;
  product: ProductCardProduct;
  noMargin?: boolean; // Remove margin when used in grid layouts
};

export function ProductCard({ compact = false, formatPrice = defaultFormatPrice, product, noMargin = false }: ProductCardProps) {
  const imageUrl = resolveImageUrl(product.images?.[0]?.url);
  const variant = product.variants?.[0];
  const price = variant?.pricePaise;
  const mrp = variant?.mrpPaise ?? null;
  const discount = discountPercent(price, mrp);
  const storeName = product.seller?.storeName ?? "1HandIndia seller";
  const stockAwareVariant = variant as Partial<{ status: string; stockQuantity: number }> | undefined;
  const inStock = Boolean(
    variant &&
      (!stockAwareVariant?.status ||
        (stockAwareVariant.status === "ACTIVE" && (stockAwareVariant.stockQuantity ?? 0) > 0)),
  );
  // Use standard image height for consistency
  const imageHeight = compact ? STANDARD_IMAGE_HEIGHT : STANDARD_IMAGE_HEIGHT;

  return (
    <Link asChild href={`/product/${product.slug}` as Href}>
      <Pressable style={({ pressed }) => [styles.card, compact ? styles.cardCompact : null, noMargin ? styles.cardNoMargin : null, pressed ? styles.cardPressed : null]}>
        <View style={[styles.imageWrap, compact ? styles.imageWrapCompact : null, { height: imageHeight }]}>
          <RemoteImage fallbackLabel={product.name} resizeMode="cover" style={styles.image} uri={imageUrl} />
          {discount ? <Text style={styles.discountBadge}>-{discount}%</Text> : null}
          <View style={styles.wishlistButton}>
            <HugeiconsIcon color="#667085" icon={HeartIcon} size={compact ? 17 : 19} strokeWidth={1.8} />
          </View>
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.name, compact ? styles.nameCompact : null]}>
            {product.name}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.seller}>
            {storeName}
          </Text>
          <View style={styles.badgeRow}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.newBadge}>New</Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.stockPill, inStock ? styles.stockPillIn : styles.stockPillOut]}>
              {inStock ? "In stock" : "Out of stock"}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.price, compact ? styles.priceCompact : null]}>
              {formatPrice(price)}
            </Text>
            {mrp && price && mrp > price ? <Text numberOfLines={1} ellipsizeMode="tail" style={styles.mrp}>{formatPrice(mrp)}</Text> : null}
          </View>
        </View>
        {!compact ? (
          <View style={styles.actionBar}>
            <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={15} strokeWidth={2.2} />
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.actionText}>View product</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

export function defaultFormatPrice(pricePaise?: number | null) {
  if (typeof pricePaise !== "number") {
    return "View price";
  }

  return `Rs ${Math.round(pricePaise / 100).toLocaleString("en-IN")}`;
}

function discountPercent(pricePaise?: number | null, mrpPaise?: number | null) {
  if (!pricePaise || !mrpPaise || mrpPaise <= pricePaise) {
    return 0;
  }

  return Math.max(1, Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100));
}

const styles = StyleSheet.create({
  actionBar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginHorizontal: 12,
    marginTop: "auto",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  actionText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    margin: 8,
    minHeight: 334,
    overflow: "hidden",
    padding: 12,
    shadowColor: "#ED3500",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  cardCompact: {
    minHeight: 270,
  },
  cardNoMargin: {
    margin: 0,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  copy: {
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  discountBadge: {
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
  image: {
    height: "100%",
    width: "100%",
  },
  imageWrap: {
    backgroundColor: "#FFFCFB",
    borderRadius: 12,
    minHeight: 150,
    overflow: "hidden",
    width: "100%",
  },
  imageWrapCompact: {
    minHeight: 120,
  },
  mrp: {
    color: "#9AA4B2",
    fontSize: 11,
    fontWeight: "800",
    textDecorationLine: "line-through",
  },
  name: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    minHeight: 38,
  },
  nameCompact: {
    fontSize: 13,
    lineHeight: 18,
    minHeight: 36,
  },
  price: {
    color: colors.primary,
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  priceCompact: {
    fontSize: 16,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  seller: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  newBadge: {
    backgroundColor: "#FFF3ED",
    borderRadius: 6,
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockPill: {
    borderRadius: 6,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockPillIn: {
    backgroundColor: "#EAFBF1",
    color: colors.success,
  },
  stockPillOut: {
    backgroundColor: "#FFE9E9",
    color: colors.danger,
  },
  wishlistButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    elevation: 3,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    shadowColor: "#111827",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    top: 10,
    width: 36,
    zIndex: 2,
  },
});