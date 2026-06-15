import { HeartIcon, ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { resolveImageUrl } from "../lib/image-url";
import { colors } from "../theme";
import type { MobileProduct } from "../types/mobile-home";
import type { ProductSummary } from "../types/storefront";
import { RemoteImage } from "./remote-image";

type ProductCardProduct = MobileProduct | ProductSummary;

type ProductCardProps = {
  compact?: boolean;
  formatPrice?: (pricePaise?: number | null) => string;
  product: ProductCardProduct;
};

export function ProductCard({ compact = false, formatPrice = defaultFormatPrice, product }: ProductCardProps) {
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

  return (
    <Link asChild href={`/product/${product.slug}` as Href}>
      <Pressable style={({ pressed }) => [styles.card, compact ? styles.cardCompact : null, pressed ? styles.cardPressed : null]}>
        <View style={[styles.imageWrap, compact ? styles.imageWrapCompact : null]}>
          <RemoteImage fallbackLabel={product.name} resizeMode="contain" style={styles.image} uri={imageUrl} />
          {discount ? <Text style={styles.discountBadge}>-{discount}%</Text> : null}
          <View style={styles.wishlistButton}>
            <HugeiconsIcon color="#667085" icon={HeartIcon} size={compact ? 17 : 19} strokeWidth={1.8} />
          </View>
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={[styles.name, compact ? styles.nameCompact : null]}>
            {product.name}
          </Text>
          <Text numberOfLines={1} style={styles.seller}>
            {storeName}
          </Text>
          <View style={styles.badgeRow}>
            <Text style={styles.newBadge}>New</Text>
            <Text style={[styles.stockPill, inStock ? styles.stockPillIn : styles.stockPillOut]}>
              {inStock ? "In stock" : "Out of stock"}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.price, compact ? styles.priceCompact : null]}>
              {formatPrice(price)}
            </Text>
            {mrp && price && mrp > price ? <Text style={styles.mrp}>{formatPrice(mrp)}</Text> : null}
          </View>
        </View>
        {!compact ? (
          <View style={styles.actionBar}>
            <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={15} strokeWidth={2.2} />
            <Text style={styles.actionText}>View product</Text>
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
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginHorizontal: 12,
    marginTop: "auto",
    minHeight: 42,
  },
  actionText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    flex: 1,
    margin: 8,
    minHeight: 334,
    overflow: "hidden",
    padding: 10,
    shadowColor: "#ED3500",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  cardCompact: {
    minHeight: 270,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  copy: {
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  discountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    color: colors.surface,
    fontSize: 11,
    fontWeight: "900",
    left: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: "absolute",
    top: 8,
  },
  image: {
    height: "100%",
    width: "100%",
  },
  imageWrap: {
    backgroundColor: "#FFFCFB",
    borderRadius: 22,
    height: 166,
    overflow: "hidden",
    width: "100%",
  },
  imageWrapCompact: {
    height: 142,
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
    fontWeight: "900",
    lineHeight: 19,
  },
  nameCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  price: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "900",
    minWidth: 0,
  },
  priceCompact: {
    fontSize: 16,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  seller: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  newBadge: {
    backgroundColor: "#FFF3ED",
    borderRadius: 999,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  stockPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    shadowColor: "#111827",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    top: 10,
    width: 38,
  },
});
