import { describe, expect, it, vi } from "vitest";
import { StorefrontStoreRankingService } from "./storefront-store-ranking.service";

describe("StorefrontStoreRankingService", () => {
  it("ranks exact location tiers before broader matches", async () => {
    const service = rankingService({
      sellers: [
        seller("local-pin", { localAreaCode: "IN-TN-SLM-FR", pincode: "636016" }),
        seller("local-only", { localAreaCode: "IN-TN-SLM-FR", pincode: "636001" }),
        seller("pin-only", { localAreaCode: "IN-TN-SLM-OLD", pincode: "636016" }),
        seller("city", { cityCode: "IN-TN-SLM" }),
        seller("state", { cityCode: "IN-TN-CBE" }),
        seller("country", { stateCode: "IN-KA", cityCode: "IN-KA-BLR" }),
        seller("none", { countryCode: "US", stateCode: "US-CA", cityCode: "US-CA-SFO" }),
      ],
    });

    const result = await service.rankHomeStores({
      query: {
        countryCode: " in ",
        stateCode: " in-tn ",
        cityCode: " in-tn-slm ",
        localAreaCode: " in-tn-slm-fr ",
        pincode: "636 016",
        limit: 7,
      },
      dateSeed: new Date("2026-06-30T00:00:00.000Z"),
    });

    expect(result.mode).toBe("LOCATION_MATCH");
    expect(result.stores.map((store) => store.seller.slug)).toEqual([
      "local-pin",
      "local-only",
      "pin-only",
      "city",
      "state",
      "country",
      "none",
    ]);
    expect(result.stores.map((store) => store.rankingReason)).toEqual([
      "LOCAL_AREA_AND_PINCODE",
      "LOCAL_AREA",
      "PINCODE",
      "CITY",
      "STATE",
      "COUNTRY",
      "DAILY_ROTATION",
    ]);
  });

  it("uses GPS only as a tie-breaker inside the same exact tier", async () => {
    const service = rankingService({
      sellers: [
        seller("city-far", {
          cityCode: "IN-TN-SLM",
          latitude: 11.7,
          longitude: 78.18,
        }),
        seller("state-near", {
          cityCode: "IN-TN-CBE",
          latitude: 11.66431,
          longitude: 78.14601,
        }),
        seller("city-near", {
          cityCode: "IN-TN-SLM",
          latitude: 11.66432,
          longitude: 78.14602,
        }),
      ],
    });

    const result = await service.rankHomeStores({
      query: {
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SLM",
        latitude: 11.6643,
        longitude: 78.146,
        accuracyMeters: 25,
        limit: 3,
      },
      dateSeed: new Date("2026-06-30T00:00:00.000Z"),
    });

    expect(result.mode).toBe("LOCATION_MATCH");
    expect(result.stores.map((store) => store.seller.slug)).toEqual([
      "city-near",
      "city-far",
      "state-near",
    ]);
  });

  it("ranks signed-in customer stores by latest non-cancelled order before repeat count when no location exists", async () => {
    const service = rankingService({
      sellers: [seller("repeat-older"), seller("latest-once"), seller("never-ordered")],
      customerOrderRows: [
        orderRow("repeat-older", "2026-06-10T00:00:00.000Z"),
        orderRow("repeat-older", "2026-06-11T00:00:00.000Z"),
        orderRow("latest-once", "2026-06-20T00:00:00.000Z"),
      ],
    });

    const result = await service.rankHomeStores({
      query: { limit: 3 },
      customerId: "customer_1",
      dateSeed: new Date("2026-06-30T00:00:00.000Z"),
    });

    expect(result.mode).toBe("CUSTOMER_RECENT_ORDERS");
    expect(result.stores.map((store) => store.seller.slug).slice(0, 2)).toEqual([
      "latest-once",
      "repeat-older",
    ]);
  });

  it("ranks guest trending stores by recent platform order activity when no location or customer signal exists", async () => {
    const service = rankingService({
      sellers: [seller("two-orders"), seller("one-newer")],
      trendingOrderRows: [
        orderRow("two-orders", "2026-06-10T00:00:00.000Z"),
        orderRow("two-orders", "2026-06-11T00:00:00.000Z"),
        orderRow("one-newer", "2026-06-20T00:00:00.000Z"),
      ],
    });

    const result = await service.rankHomeStores({
      query: { limit: 2 },
      dateSeed: new Date("2026-06-30T00:00:00.000Z"),
    });

    expect(result.mode).toBe("PLATFORM_TRENDING");
    expect(result.stores.map((store) => store.seller.slug)).toEqual(["two-orders", "one-newer"]);
  });

  it("keeps daily rotation stable for the same date seed", async () => {
    const service = rankingService({
      sellers: [seller("alpha"), seller("beta"), seller("gamma")],
    });
    const input = {
      query: { limit: 3 },
      dateSeed: new Date("2026-06-30T00:00:00.000Z"),
    };

    const first = await service.rankHomeStores(input);
    const second = await service.rankHomeStores(input);

    expect(first.mode).toBe("DAILY_ROTATION");
    expect(second.mode).toBe("DAILY_ROTATION");
    expect(second.stores.map((store) => store.seller.slug)).toEqual(
      first.stores.map((store) => store.seller.slug),
    );
  });

  it("excludes approved sellers that have no active approved products", async () => {
    const service = rankingService({
      sellers: [seller("with-products"), seller("zero-products")],
      productCounts: new Map([
        ["with-products", 2],
        ["zero-products", 0],
      ]),
    });

    const result = await service.rankHomeStores({
      query: { limit: 2 },
      dateSeed: new Date("2026-06-30T00:00:00.000Z"),
    });

    expect(result.stores.map((store) => store.seller.slug)).toEqual(["with-products"]);
  });
});

function rankingService(input: {
  sellers: Array<ReturnType<typeof seller>>;
  productCounts?: Map<string, number>;
  customerOrderRows?: ReturnType<typeof orderRow>[];
  trendingOrderRows?: ReturnType<typeof orderRow>[];
}) {
  const productCounts =
    input.productCounts ?? new Map(input.sellers.map((item) => [item.id, 1]));
  const prisma = {
    client: {
      seller: {
        findMany: vi.fn().mockResolvedValue(input.sellers),
      },
      product: {
        groupBy: vi.fn().mockResolvedValue(
          input.sellers
            .filter((item) => (productCounts.get(item.id) ?? 0) > 0)
            .map((item) => ({
              sellerId: item.id,
              _count: { _all: productCounts.get(item.id) ?? 0 },
            })),
        ),
      },
      orderItem: {
        findMany: vi.fn(async (args: { where?: { order?: { customerId?: string } } }) =>
          args.where?.order?.customerId
            ? (input.customerOrderRows ?? [])
            : (input.trendingOrderRows ?? []),
        ),
      },
      productReview: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
    },
  };

  return new StorefrontStoreRankingService(prisma as never);
}

function seller(
  slug: string,
  address: {
    countryCode?: string;
    stateCode?: string;
    cityCode?: string;
    localAreaCode?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
  } = {},
) {
  return {
    id: slug,
    storeName: slug,
    slug,
    sellerType: "MARKETPLACE_SELLER",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    profile: null,
    addresses: [
      {
        area: "Area",
        city: "Salem",
        state: "Tamil Nadu",
        country: "India",
        countryCode: address.countryCode ?? "IN",
        stateCode: address.stateCode ?? "IN-TN",
        cityCode: address.cityCode ?? "IN-TN-OTHER",
        localAreaCode: address.localAreaCode ?? null,
        pincode: address.pincode ?? "000000",
        latitude: address.latitude ?? null,
        longitude: address.longitude ?? null,
      },
    ],
  };
}

function orderRow(sellerId: string, createdAt: string) {
  return {
    sellerId,
    quantity: 1,
    activeQuantity: 1,
    order: {
      createdAt: new Date(createdAt),
    },
  };
}
