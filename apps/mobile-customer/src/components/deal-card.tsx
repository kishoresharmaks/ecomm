import { HeartIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Link, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { resolveImageUrl } from "../lib/image-url";
import { colors } from "../theme";
import type { MobileProduct } from "../types/mobile-home";
import { RemoteImage } from "./remote-image";

type DealCardProps = {
  badgeText?: string;
  ctaText?: string;
  formatPrice?: (pricePaise?: number | null) => string;
  product: MobileProduct;
  showBadge?: boolean;
};

// Standard card dimensions - consistent across all card types
const STANDARD_CARD_WIDTH = 160;
const STANDARD_IMAGE_HEIGHT = 120;

export function DealCard({ 
  badgeText = "Deal", 
  ctaText = "View deal", 
  formatPrice = defaultFormatPrice, 
  product,
  showBadge = true 
}: DealCardProps) {
  const cardWidth = STANDARD_CARD_WIDTH;
  const imageHeight = STANDARD_IMAGE_HEIGHT;
  const cardHeight = imageHeight + 126;
  const imageUrl = resolveImageUrl(product.images?.[0]?.url);
  const variant = product.variants?.[0];
  const price = variant?.pricePaise;
  const mrp = variant?.mrpPaise ?? null;
  const discount = discountPercent(price, mrp);

  return (
    <Link href={`/product/${product.slug}` as Href} style={[styles.dealCard, { minHeight: cardHeight, width: cardWidth }]}>
      <View style={styles.cardContent}>
        <View style={[styles.dealImageWrap, { height: imageHeight }]}>
          {imageUrl ? <RemoteImage resizeMode="cover" style={styles.dealImage} uri={imageUrl} /> : <ProductImageFallback />}
          {showBadge && discount ? <Text style={styles.dealDiscountBadge}>{badgeText}</Text> : null}
          <View style={styles.productHeartButton}>
            <HugeiconsIcon color="#667085" icon={HeartIcon} size={18} strokeWidth={1.8} />
          </View>
          {product.images && product.images.length > 1 ? <ImageDots count={product.images.length} /> : null}
        </View>
        <View style={styles.textContainer}>
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.dealName}>
            {product.name}
          </Text>
          <View style={styles.priceRow}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.dealPrice}>
              {typeof price === "number" ? formatPrice(price) : "View price"}
            </Text>
            {mrp ? <Text numberOfLines={1} ellipsizeMode="tail" style={styles.mrpText}>{formatPrice(mrp)}</Text> : null}
          </View>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.dealCta}>{ctaText}</Text>
        </View>
      </View>
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

function ProductImageFallback() {
  return (
    <View style={styles.productImageFallback}>
      <Text style={styles.fallbackText}>No Image</Text>
    </View>
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

const styles = StyleSheet.create({
  dealCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 2,
    marginRight: 12,
    overflow: "hidden",
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  cardContent: {
    flex: 1,
    gap: 10,
  },
  dealImageWrap: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  dealImage: {
    height: "100%",
    width: "100%",
  },
  productImageFallback: {
    backgroundColor: "#F8FAFC",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  fallbackText: {
    color: "#9AA4B2",
    fontSize: 12,
    fontWeight: "700",
  },
  dealDiscountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    color: colors.surface,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
    left: 6,
    top: 6,
    zIndex: 2,
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
  imageDots: {
    alignItems: "center",
    bottom: 6,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 2,
  },
  imageDot: {
    backgroundColor: "#D0D5DD",
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  imageDotActive: {
    backgroundColor: colors.primary,
  },
  textContainer: {
    flex: 1,
    gap: 8,
  },
  dealName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    minHeight: 36,
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  dealPrice: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
  },
  mrpText: {
    color: "#9AA4B2",
    fontSize: 11,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  dealCta: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingVertical: 10,
    textAlign: "center",
    marginTop: 4,
  },
});