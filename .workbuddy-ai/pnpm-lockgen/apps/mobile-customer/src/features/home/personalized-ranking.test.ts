import { describe, expect, it } from "vitest";
import { composePersonalizedHomeRails, type PersonalizedRankableProduct } from "./personalized-ranking";

function product(
  id: string,
  overrides: Partial<PersonalizedRankableProduct> = {},
): PersonalizedRankableProduct {
  return {
    id,
    slug: id,
    categoryId: "category-general",
    categoryName: "General",
    categorySlug: "general",
    sellerId: "seller-general",
    sellerName: "General Seller",
    sellerSlug: "general-seller",
    ...overrides,
  };
}

describe("personalized home ranking", () => {
  it("keeps products in the highest intent rail only", () => {
    const rails = composePersonalizedHomeRails({
      cartProducts: [product("p1")],
      buyAgainProducts: [product("p1"), product("p2")],
      recentlyViewedProducts: [product("p1"), product("p2"), product("p3")],
      recommendedProducts: [product("p1"), product("p2"), product("p3"), product("p4"), product("p5")],
      now: new Date("2026-06-15T12:00:00.000Z"),
    });

    expect(rails.continueProducts.map((item) => item.id)).toEqual(["p1"]);
    expect(rails.buyAgainProducts.map((item) => item.id)).toEqual(["p2"]);
    expect(rails.recentlyViewedProducts.map((item) => item.id)).toEqual(["p3"]);
    expect(rails.recommendedProducts.map((item) => item.id)).toEqual(["p4", "p5"]);
  });

  it("scores recommendations from cart, buy-again, and recent signals", () => {
    const rails = composePersonalizedHomeRails({
      cartProducts: [product("cart", { categoryId: "cookware", sellerId: "cart-seller" })],
      buyAgainProducts: [
        product("order-1", { categoryId: "watches", sellerId: "trusted-seller" }),
        product("order-2", { categoryId: "audio", sellerId: "trusted-seller" }),
      ],
      recentlyViewedProducts: [
        product("view-1", {
          categoryId: "copper",
          sellerId: "browsed-seller",
          viewedAt: "2026-06-15T08:00:00.000Z",
        }),
      ],
      recommendedProducts: [
        product("neutral-a", { categoryId: "other", sellerId: "other-a" }),
        product("seller-match", { categoryId: "other", sellerId: "trusted-seller" }),
        product("cart-category-match", { categoryId: "cookware", sellerId: "other-b" }),
        product("recent-category-match", { categoryId: "copper", sellerId: "other-c" }),
        product("neutral-b", { categoryId: "other", sellerId: "other-b" }),
      ],
      now: new Date("2026-06-15T12:00:00.000Z"),
    });

    expect(rails.recommendedProducts.map((item) => item.id)).toEqual([
      "seller-match",
      "cart-category-match",
      "recent-category-match",
      "neutral-a",
      "neutral-b",
    ]);
  });

  it("keeps repeated buy-again purchases as seller affinity before rail dedupe", () => {
    const rails = composePersonalizedHomeRails({
      cartProducts: [product("cart", { categoryId: "cookware", sellerId: "cart-seller" })],
      buyAgainProducts: [
        product("repeat-order", { categoryId: "audio", sellerId: "trusted-seller" }),
        product("repeat-order", { categoryId: "audio", sellerId: "trusted-seller" }),
      ],
      recentlyViewedProducts: [],
      recommendedProducts: [
        product("cart-category-match", { categoryId: "cookware", sellerId: "other-seller" }),
        product("seller-match", { categoryId: "other", sellerId: "trusted-seller" }),
        product("neutral", { categoryId: "other", sellerId: "neutral-seller" }),
      ],
      now: new Date("2026-06-15T12:00:00.000Z"),
    });

    expect(rails.buyAgainProducts.map((item) => item.id)).toEqual(["repeat-order"]);
    expect(rails.recommendedProducts.map((item) => item.id)).toEqual([
      "seller-match",
      "cart-category-match",
      "neutral",
    ]);
  });

  it("uses original API order as the deterministic tie-breaker", () => {
    const rails = composePersonalizedHomeRails({
      cartProducts: [],
      buyAgainProducts: [],
      recentlyViewedProducts: [],
      recommendedProducts: [product("first"), product("second")],
      now: new Date("2026-06-15T12:00:00.000Z"),
    });

    expect(rails.recommendedProducts.map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("hides recommendations when fewer than two clean products remain", () => {
    const rails = composePersonalizedHomeRails({
      cartProducts: [product("cart")],
      buyAgainProducts: [],
      recentlyViewedProducts: [],
      recommendedProducts: [product("cart"), product("only-clean")],
      now: new Date("2026-06-15T12:00:00.000Z"),
    });

    expect(rails.recommendedProducts).toEqual([]);
  });
});
