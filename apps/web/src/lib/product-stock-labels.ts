import { isSoldResaleProduct } from "@indihub/shared-types";
import type { ProductSummary } from "./storefront-api";

type StockBadgeTone = "info" | "warning" | "danger";

export type SellerProductStockBadge = {
  label: string;
  tone: StockBadgeTone;
};

export function sellerProductStockBadge(product: ProductSummary): SellerProductStockBadge | null {
  const variant = product.variants[0];
  if (!variant) {
    return null;
  }

  if (isSoldResaleProduct(product)) {
    return { label: "Sold", tone: "danger" };
  }

  if (variant.stockQuantity <= 0) {
    return { label: "Out of stock", tone: "warning" };
  }

  return {
    label: `${variant.stockQuantity} in stock`,
    tone: variant.stockQuantity <= 5 ? "warning" : "info",
  };
}
