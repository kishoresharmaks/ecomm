import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cartTotals,
  formatOrderBaseAmount,
  formatOrderBuyerAmount,
  formatOrderTotal,
  getStorefrontHome,
  primaryImage,
  primaryVariant,
  type CartSummary,
  type ProductSummary,
} from "./storefront-api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cartTotals", () => {
  it("keeps total unit quantity separate from unique product count", () => {
    const cart = {
      id: "cart-1",
      status: "ACTIVE",
      items: [
        {
          id: "cart-item-1",
          quantity: 4,
          unitPricePaise: 25_9900,
          productVariant: {
            product: { id: "product-bag" },
          },
        },
        {
          id: "cart-item-2",
          quantity: 2,
          unitPricePaise: 12_4900,
          productVariant: {
            product: { id: "product-watch" },
          },
        },
        {
          id: "cart-item-3",
          quantity: 1,
          unitPricePaise: 13_4900,
          productVariant: {
            product: { id: "product-bag" },
          },
        },
      ],
    } as unknown as CartSummary;

    expect(cartTotals(cart)).toEqual({
      subtotalPaise: 142_4300,
      itemCount: 7,
      productCount: 2,
    });
  });
});

describe("buyer currency order formatting", () => {
  it("prefers buyer totals and keeps old INR-only orders readable", () => {
    const buyerOrder = {
      totalPaise: 41400,
      currency: "INR",
      buyerCurrency: "GBP",
      buyerTotalMinor: 390,
    };

    expect(formatOrderTotal(buyerOrder)).toBe("£3.90");
    expect(formatOrderBaseAmount(buyerOrder, buyerOrder.totalPaise)).toBe("₹414");
    expect(formatOrderBuyerAmount(buyerOrder, 300, 32000)).toBe("£3");

    expect(
      formatOrderTotal({
        totalPaise: 41400,
        currency: "INR",
      }),
    ).toBe("₹414");
  });
});

describe("product helpers", () => {
  it("handles lightweight order product payloads without image or variant arrays", () => {
    const lightweightProduct = {
      id: "product-1",
      name: "Order item product",
      slug: "order-item-product",
    } as unknown as ProductSummary;

    expect(primaryImage(lightweightProduct)).toBeNull();
    expect(primaryVariant(lightweightProduct)).toBeNull();
  });
});

describe("storefront home API", () => {
  it("sends auth headers and location query fields for signed-in home requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          banners: [],
          homepageSections: [],
          categories: [],
          storesNearYou: [],
          storeRankingMode: "CUSTOMER_RECENT_ORDERS",
          productRails: { featured: [], latest: [], deals: [] },
          stats: {
            liveProducts: 0,
            approvedStores: 0,
            activeCustomers: 0,
            activeCategories: 0,
            verifiedSellers: 0,
            verifiedSellerPercent: 0,
          },
          menus: { header: [], footer: [], legal: [] },
          generatedAt: "2026-06-30T00:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await getStorefrontHome(
      {
        countryCode: "IN",
        latitude: 11.6643,
        longitude: 78.146,
        accuracyMeters: 40,
        limit: 6,
      },
      { bearerToken: "customer-token" },
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/storefront/home?");
    expect(String(url)).toContain("latitude=11.6643");
    expect(String(url)).toContain("accuracyMeters=40");
    expect(new Headers((init as RequestInit).headers).get("authorization")).toBe(
      "Bearer customer-token",
    );
  });
});
