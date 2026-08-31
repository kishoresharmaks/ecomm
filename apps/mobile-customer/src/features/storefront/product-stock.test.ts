import { describe, expect, it } from "vitest";
import { isProductCardInStock } from "./product-stock";

describe("isProductCardInStock", () => {
  it("returns false for undefined or null variant", () => {
    expect(isProductCardInStock(undefined)).toBe(false);
    expect(isProductCardInStock(null)).toBe(false);
  });

  it("returns true for variant with positive stockQuantity", () => {
    expect(isProductCardInStock({ status: "ACTIVE", stockQuantity: 174 })).toBe(true);
    expect(isProductCardInStock({ status: "ACTIVE", stockQuantity: 1 })).toBe(true);
    expect(isProductCardInStock({ status: null, stockQuantity: 50 })).toBe(true);
  });

  it("returns false for variant with zero or negative stockQuantity", () => {
    expect(isProductCardInStock({ status: "ACTIVE", stockQuantity: 0 })).toBe(false);
    expect(isProductCardInStock({ status: "ACTIVE", stockQuantity: -1 })).toBe(false);
  });

  it("returns true for active variant when stockQuantity is null or omitted in payload projections", () => {
    expect(isProductCardInStock({ status: "ACTIVE", stockQuantity: null })).toBe(true);
    expect(isProductCardInStock({ status: "ACTIVE" })).toBe(true);
    expect(isProductCardInStock({ status: null, stockQuantity: null })).toBe(true);
  });

  it("returns false for inactive, out of stock, or archived variants", () => {
    expect(isProductCardInStock({ status: "INACTIVE", stockQuantity: 100 })).toBe(false);
    expect(isProductCardInStock({ status: "OUT_OF_STOCK", stockQuantity: 100 })).toBe(false);
    expect(isProductCardInStock({ status: "ARCHIVED", stockQuantity: 100 })).toBe(false);
  });
});
