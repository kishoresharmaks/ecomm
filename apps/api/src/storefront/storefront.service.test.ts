import { describe, expect, it, vi } from "vitest";
import { StorefrontService } from "./storefront.service";

describe("StorefrontService homepage personalization cache", () => {
  it("does not reuse one customer's ranked stores for another customer", async () => {
    const service = new StorefrontService(
      { client: {} } as never,
      {
        listPublishedBanners: vi.fn().mockResolvedValue([]),
        listPublishedHomepageSections: vi.fn().mockResolvedValue([]),
        listPublishedMenuItems: vi.fn().mockResolvedValue([]),
      } as never,
      {} as never,
      undefined,
      undefined,
    );

    const internals = service as unknown as StorefrontServiceInternals;

    vi.spyOn(internals, "optionalHomeRead").mockImplementation(
      async (_label: string, _cacheKey: string, operation: () => Promise<unknown>) => operation(),
    );
    vi.spyOn(internals, "listHomeCategories").mockResolvedValue([]);
    vi.spyOn(internals, "listPublicCategoryProductCounts").mockResolvedValue([]);
    vi.spyOn(internals, "listHomeProducts").mockResolvedValue([]);
    vi.spyOn(internals, "resolveHomeDealProducts").mockResolvedValue([]);
    vi.spyOn(internals, "getStats").mockResolvedValue({
      liveProducts: 0,
      approvedStores: 0,
      activeCustomers: 0,
      activeCategories: 0,
      verifiedSellers: 0,
      verifiedSellerPercent: 0,
    });
    const listHomeStores = vi
      .spyOn(internals, "listHomeStores")
      .mockImplementation(async (_query: unknown, options: { customerId?: string | null }) => ({
        mode: "CUSTOMER_RECENT_ORDERS",
        stores: [{ id: `store-for-${options.customerId}` }],
      }));

    const first = (await service.getHome(
      { limit: 1 },
      { customerId: "customer_1" },
    )) as StorefrontHomeTestPayload;
    const second = (await service.getHome(
      { limit: 1 },
      { customerId: "customer_2" },
    )) as StorefrontHomeTestPayload;

    expect(listHomeStores).toHaveBeenCalledTimes(2);
    expect(first.storesNearYou).toEqual([{ id: "store-for-customer_1" }]);
    expect(second.storesNearYou).toEqual([{ id: "store-for-customer_2" }]);
  });
});

type StorefrontServiceInternals = {
  optionalHomeRead: (
    label: string,
    cacheKey: string,
    operation: () => Promise<unknown>,
    fallback: unknown,
  ) => Promise<unknown>;
  listHomeCategories: () => Promise<unknown[]>;
  listPublicCategoryProductCounts: () => Promise<unknown[]>;
  listHomeProducts: () => Promise<unknown[]>;
  resolveHomeDealProducts: () => Promise<unknown[]>;
  getStats: () => Promise<Record<string, number>>;
  listHomeStores: (
    query: unknown,
    options: { customerId?: string | null },
  ) => Promise<{ mode: string; stores: Array<{ id: string }> }>;
};

type StorefrontHomeTestPayload = {
  storesNearYou: Array<{ id: string }>;
};
