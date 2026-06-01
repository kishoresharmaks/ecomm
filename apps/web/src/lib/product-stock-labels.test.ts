import { describe, expect, it } from "vitest";
import { sellerProductStockBadge } from "./product-stock-labels";
import type { ProductSummary } from "./storefront-api";

describe("seller product stock labels", () => {
  it("marks sold resale products separately from normal out-of-stock catalogue products", () => {
    expect(sellerProductStockBadge(productWithCondition("Used", 0))).toEqual({
      label: "Sold",
      tone: "danger",
    });
    expect(sellerProductStockBadge(productWithCondition("Refurbished", 0))).toEqual({
      label: "Sold",
      tone: "danger",
    });
    expect(sellerProductStockBadge(productWithCondition("New", 0))).toEqual({
      label: "Out of stock",
      tone: "warning",
    });
  });
});

function productWithCondition(condition: string, stockQuantity: number) {
  return {
    attributes: { condition },
    variants: [{ status: "ACTIVE", stockQuantity }],
  } as unknown as ProductSummary;
}
