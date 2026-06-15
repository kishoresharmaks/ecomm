import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRecentProducts, rememberRecentProduct } from "./recent-products";
import type { ProductSummary } from "./storefront-api";

const storageKey = "indihub:customer:recent-products";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function product(id: number, overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: `product-${id}`,
    sellerId: "seller-1",
    categoryId: "category-1",
    name: `Product ${id}`,
    slug: `product-${id}`,
    description: "",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    category: {
      id: "category-1",
      name: "Essentials",
      slug: "essentials",
    },
    seller: {
      id: "seller-1",
      storeName: "Local Seller",
      slug: "local-seller",
    },
    images: [{ id: `image-${id}`, url: `/products/${id}.jpg`, isPrimary: true }],
    variants: [
      {
        id: `variant-${id}`,
        sku: `SKU-${id}`,
        pricePaise: id * 1000,
        mrpPaise: id * 1200,
        currency: "INR",
        stockQuantity: 10,
        status: "ACTIVE",
      },
    ],
    ...overrides,
  };
}

describe("recent product storage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createMemoryStorage() });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps recently viewed products newest-first and deduped", () => {
    rememberRecentProduct(product(1));
    rememberRecentProduct(product(2));
    rememberRecentProduct(product(1, { name: "Updated Product 1" }));

    expect(readRecentProducts()).toEqual([
      expect.objectContaining({
        categoryId: "category-1",
        id: "product-1",
        name: "Updated Product 1",
        sellerId: "seller-1",
        viewedAt: "2026-06-15T00:00:00.000Z",
      }),
      expect.objectContaining({ id: "product-2" }),
    ]);
  });

  it("caps the stored list at twelve products", () => {
    for (let index = 1; index <= 14; index += 1) {
      rememberRecentProduct(product(index));
    }

    const recentProducts = readRecentProducts();

    expect(recentProducts).toHaveLength(12);
    expect(recentProducts[0]?.id).toBe("product-14");
    expect(recentProducts.at(-1)?.id).toBe("product-3");
  });

  it("ignores invalid stored values", () => {
    window.localStorage.setItem(storageKey, "{bad-json");

    expect(readRecentProducts()).toEqual([]);
  });
});
