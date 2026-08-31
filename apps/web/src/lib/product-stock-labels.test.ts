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

  it("calculates aggregate stock and variant breakdown for multi-variant products", () => {
    const multiVariantOneEmpty = {
      attributes: { condition: "New" },
      variants: [
        { status: "ACTIVE", stockQuantity: 500 },
        { status: "ACTIVE", stockQuantity: 0 },
      ],
    } as unknown as ProductSummary;

    expect(sellerProductStockBadge(multiVariantOneEmpty)).toEqual({
      label: "500 in stock (1 out of stock)",
      tone: "warning",
    });

    const multiVariantOneLow = {
      attributes: { condition: "New" },
      variants: [
        { status: "ACTIVE", stockQuantity: 500 },
        { status: "ACTIVE", stockQuantity: 3 },
      ],
    } as unknown as ProductSummary;

    expect(sellerProductStockBadge(multiVariantOneLow)).toEqual({
      label: "503 in stock (1 low stock)",
      tone: "warning",
    });

    const multiVariantHealthy = {
      attributes: { condition: "New" },
      variants: [
        { status: "ACTIVE", stockQuantity: 500 },
        { status: "ACTIVE", stockQuantity: 100 },
      ],
    } as unknown as ProductSummary;

    expect(sellerProductStockBadge(multiVariantHealthy)).toEqual({
      label: "600 in stock (2 variants)",
      tone: "info",
    });
  });
});

function productWithCondition(condition: string, stockQuantity: number) {
  return {
    attributes: { condition },
    variants: [{ status: "ACTIVE", stockQuantity }],
  } as unknown as ProductSummary;
}
