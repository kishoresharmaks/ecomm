import {
  ApprovalStatus,
  SellerCapability,
  SellerStatus,
  SellerSubscriptionStatus,
  SellerTaxRegistrationStatus,
  SellerType,
  UserStatus,
} from "@indihub/database";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { RegisterSellerPushTokenDto } from "./dto/seller-push-token.dto";
import { UpdateSellerProfileDto } from "./dto/seller-profile.dto";
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

describe("seller DTO normalization", () => {
  it("treats a blank optional business type as empty instead of a Prisma enum value", () => {
    const dto = plainToInstance(UpdateSellerProfileDto, { businessType: "" });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.businessType).toBeNull();
  });

  it("accepts current Expo push token format for seller devices", () => {
    const dto = plainToInstance(RegisterSellerPushTokenDto, {
      platform: "android",
      token: "ExpoPushToken[token-1]",
    });

    expect(validateSync(dto)).toEqual([]);
  });
});

describe("SellersService onboarding tax verification", () => {
  it("requires a GST certificate before a GST-registered seller can submit onboarding", async () => {
    const prisma = {
      client: {
        seller: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn(),
      },
    };
    const locations = {
      resolveAddressLocation: vi.fn().mockResolvedValue({
        area: "Gandhipuram",
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "641012",
        country: "India",
        countryCode: "IN",
        stateCode: "33",
        cityCode: "IN-TN-CBE",
        localAreaCode: "IN-TN-CBE-GANDHIPURAM",
      }),
    };
    const service = new SellersService(
      prisma as never,
      locations as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const documents = [
      "ID_PROOF",
      "SIGNATURE_PROOF",
      "ADDRESS_PROOF",
      "BANK_PROOF",
    ].map((documentType) => ({
      documentType,
      fileUrl: `1handindia/sellers/user_1/documents/${documentType.toLowerCase()}.pdf`,
    }));

    await expect(
      service.registerSeller(
        {
          id: "user_1",
          clerkUserId: null,
          email: "seller@example.com",
          roles: [],
        },
        {
          sellerType: SellerType.MARKETPLACE_SELLER,
          storeName: "GST Store",
          businessLegalName: "GST Store Private Limited",
          taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
          gstNumber: "33ABCDE1234F1Z5",
          contactName: "Seller User",
          contactPhone: "+919876543210",
          address: {
            line1: "12 Market Road",
            countryCode: "IN",
            stateCode: "33",
            cityCode: "IN-TN-CBE",
            localAreaCode: "IN-TN-CBE-GANDHIPURAM",
          },
          documents,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });
});
