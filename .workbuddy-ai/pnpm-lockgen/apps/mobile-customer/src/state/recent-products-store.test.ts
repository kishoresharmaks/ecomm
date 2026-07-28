import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentProductsStore } from "./recent-products-store";
import type { ProductSummary } from "../types/storefront";

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: vi.fn(async () => undefined),
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
}));

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
  } as ProductSummary;
}

describe("recent products store", () => {
  beforeEach(() => {
    useRecentProductsStore.setState({ recentProducts: [] });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores recently viewed products newest-first and deduped", () => {
    const store = useRecentProductsStore.getState();

    store.rememberRecentProduct(product(1));
    store.rememberRecentProduct(product(2));
    store.rememberRecentProduct(product(1, { name: "Updated Product 1" }));

    expect(useRecentProductsStore.getState().recentProducts).toEqual([
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

  it("keeps only the latest twelve products", () => {
    const store = useRecentProductsStore.getState();

    for (let index = 1; index <= 14; index += 1) {
      store.rememberRecentProduct(product(index));
    }

    const recentProducts = useRecentProductsStore.getState().recentProducts;

    expect(recentProducts).toHaveLength(12);
    expect(recentProducts[0]?.id).toBe("product-14");
    expect(recentProducts.at(-1)?.id).toBe("product-3");
  });
});
