import { BadRequestException } from "@nestjs/common";
import { RoleCode, UserStatus } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

describe("OrdersService", () => {
  it("normalizes delivery partner availability query strings before building Prisma filters", async () => {
    const partner = {
      id: "partner_1",
      email: "ravi@example.com",
      phone: "9876543210",
      fullName: "Ravi",
      status: UserStatus.ACTIVE,
      deliveryProfile: {
        isAvailable: true,
        phone: "9876543210",
        vehicleNumber: "TN 30 AB 1234",
        priority: 100,
        serviceCountryCode: "IN",
        serviceStateCode: "IN-TN",
        serviceCityCode: "IN-TN-SALEM",
        serviceAreas: [
          {
            isActive: true,
            pincode: "636304",
            localAreaCode: null,
          },
        ],
        baseLatitude: null,
        baseLongitude: null,
        serviceRadiusKm: null,
        codCashLimitPaise: null,
        notes: null,
      },
      userRoles: [{ role: { code: RoleCode.DELIVERY_PARTNER } }],
    };
    const prisma = createOrdersPrismaMock([partner]);
    const service = new OrdersService(
      prisma as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    await service.listDeliveryPartners({ isAvailable: "true" as never, limit: 100 });

    expect(prisma.client.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryProfile: {
            is: {
              isAvailable: true,
            },
          },
        }),
      }),
    );
  });

  it("rejects invalid delivery partner availability query values", async () => {
    const service = new OrdersService(
      createOrdersPrismaMock([]) as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );

    await expect(service.listDeliveryPartners({ isAvailable: "yes" as never })).rejects.toThrow(BadRequestException);
  });
});

function createOrdersPrismaMock(partners: unknown[]) {
  return {
    client: {
      deliveryDetail: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { codCollectedAmountPaise: 0 } }),
      },
      deliveryPartnerPayout: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amountPaise: 0 }, _count: { _all: 0 } }),
      },
      deliveryPartnerWalletEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amountPaise: 0 }, _count: { _all: 0 } }),
      },
      orderShipment: {
        count: vi.fn().mockResolvedValue(0),
      },
      setting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      user: {
        count: vi.fn().mockResolvedValue(partners.length),
        findMany: vi.fn().mockResolvedValue(partners),
      },
    },
  };
}
