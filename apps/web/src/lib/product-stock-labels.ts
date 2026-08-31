import { isSoldResaleProduct } from "@indihub/shared-types";
import type { ProductSummary } from "./storefront-api";

type StockBadgeTone = "info" | "warning" | "danger";

export type SellerProductStockBadge = {
  label: string;
  tone: StockBadgeTone;
};

export function sellerProductStockBadge(product: ProductSummary): SellerProductStockBadge | null {
  if (!product.variants || product.variants.length === 0) {
    return null;
  }

  if (isSoldResaleProduct(product)) {
    return { label: "Sold", tone: "danger" };
  }

  const variants = product.variants;
  const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0);
  const outOfStockCount = variants.filter((v) => (v.stockQuantity ?? 0) <= 0).length;
  const lowStockCount = variants.filter((v) => (v.stockQuantity ?? 0) > 0 && (v.stockQuantity ?? 0) <= 5).length;

  if (totalStock <= 0) {
    return { label: "Out of stock", tone: "warning" };
  }

  if (variants.length > 1) {
    if (outOfStockCount > 0) {
      return {
        label: `${totalStock} in stock (${outOfStockCount} out of stock)`,
        tone: "warning",
      };
    }
    if (lowStockCount > 0) {
      return {
        label: `${totalStock} in stock (${lowStockCount} low stock)`,
        tone: "warning",
      };
    }
    return {
      label: `${totalStock} in stock (${variants.length} variants)`,
      tone: "info",
    };
  }

  const singleVariant = variants[0];
  const stock = singleVariant ? singleVariant.stockQuantity : totalStock;
  return {
    label: `${stock} in stock`,
    tone: stock <= 5 ? "warning" : "info",
  };
}
