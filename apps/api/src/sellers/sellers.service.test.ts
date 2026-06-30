import {
  ApprovalStatus,
  SellerCapability,
  SellerStatus,
  SellerSubscriptionStatus,
  SellerType,
  UserStatus,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { SellersService } from "./sellers.service";

describe("SellersService profile readback", () => {
  it("returns seller capabilities so added service access survives refresh", async () => {
    const seller = {
      id: "seller_1",
      userId: "user_1",
      storeName: "Harini Store",
      slug: "harini-store",
      sellerType: SellerType.MARKETPLACE_SELLER,
      primaryCapability: SellerCapability.RETAIL,
      enabledCapabilities: [SellerCapability.RETAIL, SellerCapability.SERVICE],
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      subscriptionStartedAt: null,
      subscriptionCurrentPeriodEnd: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      user: {
        email: "seller@example.com",
        phone: "9876543210",
        fullName: "Seller User",
        status: UserStatus.ACTIVE,
      },
      profile: null,
      payoutProfile: null,
      addresses: [],
      serviceAreas: [
        {
          id: "area_1",
          label: "Salem service radius",
          countryCode: "IN",
          stateCode: "IN-TN",
          cityCode: "IN-TN-SALEM",
          localAreaCode: null,
          pincode: "636001",
          latitude: null,
          longitude: null,
          radiusKm: 12,
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ],
      courierProviderSettings: [],
      documents: [],
      subscriptionPlan: null,
      subscriptions: [],
    };
    const prisma = {
      client: {
        seller: {
          findUnique: vi.fn().mockResolvedValue(seller),
        },
      },
    };
    const service = new SellersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const profile = await service.getMySellerProfile({
      id: "user_1",
      clerkUserId: null,
      email: "seller@example.com",
      roles: [],
    });

    expect(profile.primaryCapability).toBe(SellerCapability.RETAIL);
    expect(profile.enabledCapabilities).toEqual([
      SellerCapability.RETAIL,
      SellerCapability.SERVICE,
    ]);
    expect(profile.serviceAreas).toEqual([
      expect.objectContaining({
        label: "Salem service radius",
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-SALEM",
        pincode: "636001",
        radiusKm: 12,
      }),
    ]);
  });
});
