import { describe, expect, it, vi } from "vitest";
import { ApprovalStatus, CategoryStatus, ProductStatus, SellerStatus } from "@indihub/database";
import { MobileStorefrontService } from "./mobile-storefront.service";

describe("MobileStorefrontService", () => {
  it("returns a compact mobile home payload without desktop-only homepage fields", async () => {
    const { service, storefrontService, cms } = createService();

    const result = await service.getMobileHome({ pincode: "636001", limit: 4 });

    expect(storefrontService.getHome).toHaveBeenCalledWith({ pincode: "636001", limit: 4 });
    expect(cms.listPublishedHomepageSections).toHaveBeenCalled();
    expect(result).toMatchObject({
      banners: [{ id: "banner_1" }],
      categories: [{ id: "category_1" }],
      sections: [{ id: "section_1" }],
      productRails: {
        featured: [{ id: "product_featured" }],
        latest: [],
        deals: [],
      },
      storesNearYou: [{ id: "store_desktop" }],
      supportConfig: { supportEmail: "support@1handindia.com" },
    });
    expect(result).not.toHaveProperty("menus");
    expect(result).not.toHaveProperty("stats");
    expect(result).not.toHaveProperty("homepageSections");
  });

  it("uses GPS-ranked stores when coordinates are accurate enough", async () => {
    const { service, prisma } = createService({
      sellers: [
        seller("far-store", "Far Store", 11.9, 78.3),
        seller("near-store", "Near Store", 11.665, 78.147),
      ],
    });

    const result = await service.getMobileHome({
      latitude: 11.6643,
      longitude: 78.146,
      accuracyMeters: 100,
      limit: 2,
    });

    expect(prisma.client.seller.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
        }),
      }),
    );
    const storesNearYou = result.storesNearYou as Array<{ slug: string; distanceMeters?: number | null }>;

    expect(storesNearYou.map((store) => store.slug)).toEqual([
      "near-store",
      "far-store",
    ]);
    expect(storesNearYou[0]).toMatchObject({
      locationMatchLevel: "GPS",
      distanceMeters: expect.any(Number),
    });
  });

  it("falls back to code or pincode matching when GPS accuracy is too low", async () => {
    const { service, prisma, storefrontService } = createService();

    const result = await service.getMobileHome({
      latitude: 11.6643,
      longitude: 78.146,
      accuracyMeters: 5000,
      pincode: "636001",
    });

    expect(prisma.client.seller.findMany).not.toHaveBeenCalled();
    expect(storefrontService.getHome).toHaveBeenCalledWith({ pincode: "636001" });
    expect(result.storesNearYou).toEqual([{ id: "store_desktop" }]);
  });

  it("honors the mobile GPS accuracy threshold environment variable", async () => {
    vi.stubEnv("MOBILE_GPS_MAX_ACCURACY_METERS", "50");
    const { service, prisma } = createService();

    await service.getMobileHome({
      latitude: 11.6643,
      longitude: 78.146,
      accuracyMeters: 80,
    });

    expect(prisma.client.seller.findMany).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

function createService(input: { sellers?: ReturnType<typeof seller>[] } = {}) {
  const storefrontHome = {
    banners: [{ id: "banner_1" }],
    homepageSections: [{ id: "section_1" }],
    categories: [{ id: "category_1" }],
    storesNearYou: [{ id: "store_desktop" }],
    productRails: {
      featured: [{ id: "product_featured" }],
      latest: [],
      deals: [],
    },
    menus: { header: [] },
    stats: { liveProducts: 1 },
    generatedAt: "2026-06-12T00:00:00.000Z",
  };
  const storefrontService = {
    getHome: vi.fn().mockResolvedValue(storefrontHome),
    getContactConfig: vi.fn().mockResolvedValue({ supportEmail: "support@1handindia.com" }),
  };
  const prisma = {
    client: {
      seller: {
        findMany: vi.fn().mockResolvedValue(input.sellers ?? []),
      },
      product: {
        groupBy: vi.fn().mockResolvedValue(
          (input.sellers ?? []).map((record) => ({
            sellerId: record.id,
            _count: { _all: 3 },
          })),
        ),
      },
    },
  };
  const cms = {
    listPublishedHomepageSections: vi.fn().mockResolvedValue([{ id: "section_1" }]),
  };
  const service = new MobileStorefrontService(storefrontService as never, prisma as never, cms as never);

  return { service, storefrontService, prisma, cms };
}

function seller(slug: string, storeName: string, latitude: number, longitude: number) {
  return {
    id: slug,
    storeName,
    slug,
    sellerType: "MARKETPLACE_SELLER",
    createdAt: new Date("2026-06-12T00:00:00.000Z"),
    profile: {
      logoUrl: null,
      bannerUrl: null,
      description: `${storeName} profile`,
    },
    addresses: [
      {
        area: "Mettu Street",
        city: "Salem",
        state: "Tamil Nadu",
        country: "India",
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SLM",
        localAreaCode: "IN-TN-SLM-METTU",
        pincode: "636001",
        latitude,
        longitude,
      },
    ],
    status: SellerStatus.APPROVED,
    approvalStatus: ApprovalStatus.APPROVED,
    productStatus: ProductStatus.ACTIVE,
    categoryStatus: CategoryStatus.ACTIVE,
  };
}
