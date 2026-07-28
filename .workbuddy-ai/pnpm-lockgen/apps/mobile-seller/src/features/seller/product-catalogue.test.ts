import { describe, expect, it } from "vitest";
import {
  buildProductCatalogueQuery,
  productCatalogueStatuses,
  productPrimaryImage,
  summarizeProductVariants,
} from "./product-catalogue";
import type { ProductSummary } from "./seller-api";

describe("product catalogue helpers", () => {
  it("maps filters and valid searches to seller product API queries", () => {
    expect(buildProductCatalogueQuery("all", " a ")).toEqual({});
    expect(buildProductCatalogueQuery("all", " rice ")).toEqual({ search: "rice" });
    expect(buildProductCatalogueQuery("live", "")).toEqual({
      status: "ACTIVE",
      approvalStatus: "APPROVED",
    });
    expect(buildProductCatalogueQuery("under-review", "")).toEqual({
      approvalStatus: "PENDING_APPROVAL",
    });
    expect(buildProductCatalogueQuery("rejected", "")).toEqual({
      approvalStatus: "REJECTED",
    });
    expect(buildProductCatalogueQuery("inactive", "")).toEqual({ status: "INACTIVE" });
    expect(buildProductCatalogueQuery("draft", "")).toEqual({ status: "DRAFT" });
  });

  it("selects the primary image before sorted and legacy fallbacks", () => {
    expect(
      productPrimaryImage({
        id: "product_1",
        name: "Shirt",
        imageUrl: "legacy.jpg",
        images: [
          { url: "second.jpg", sortOrder: 2 },
          { url: "primary.jpg", sortOrder: 3, isPrimary: true },
          { url: "first.jpg", sortOrder: 1 },
        ],
      }),
    ).toBe("primary.jpg");
    expect(
      productPrimaryImage({
        id: "product_2",
        name: "Rice",
        imageUrl: "legacy.jpg",
        images: [
          { url: "second.jpg", sortOrder: 2 },
          { url: "first.jpg", sortOrder: 1 },
        ],
      }),
    ).toBe("first.jpg");
    expect(productPrimaryImage({ id: "product_3", name: "Oil", imageUrl: "legacy.jpg" })).toBe("legacy.jpg");
    expect(productPrimaryImage({ id: "product_4", name: "Soap" })).toBeNull();
  });

  it("summarizes price and stock across every variant", () => {
    const product: ProductSummary = {
      id: "product_1",
      name: "Shirt",
      variants: [
        {
          id: "variant_1",
          pricePaise: 19900,
          stockQuantity: 0,
          currency: "INR",
        },
        {
          id: "variant_2",
          pricePaise: 24900,
          stockQuantity: 4,
          currency: "INR",
        },
        {
          id: "variant_3",
          pricePaise: 29900,
          stockQuantity: 12,
          currency: "INR",
        },
      ],
    };

    expect(summarizeProductVariants(product)).toEqual({
      variantCount: 3,
      totalStock: 16,
      outOfStockCount: 1,
      lowStockCount: 1,
      minPricePaise: 19900,
      maxPricePaise: 29900,
      currency: "INR",
    });
    expect(summarizeProductVariants({ id: "product_2", name: "Empty" })).toEqual({
      variantCount: 0,
      totalStock: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      minPricePaise: null,
      maxPricePaise: null,
      currency: "INR",
    });
  });

  it("presents lifecycle and approval states separately", () => {
    expect(
      productCatalogueStatuses({
        id: "product_1",
        name: "Shirt",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
      }),
    ).toEqual({
      lifecycle: { label: "Live", tone: "success" },
      approval: { label: "Approved", tone: "success" },
    });
  });
});
