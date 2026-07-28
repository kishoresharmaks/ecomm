import { DealProductEnrollmentStatus, DealStatus } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { DealPricingService } from "./deal-pricing.service";

function activeEnrollment(productId = "product_1") {
  return {
    id: "enrollment_1",
    productId,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    status: DealProductEnrollmentStatus.ENROLLED,
    deal: {
      id: "deal_1",
      title: "Summer Deal",
      discountBps: 2000,
      startsAt: new Date("2026-06-10T00:00:00.000Z"),
      endsAt: new Date("2026-06-20T00:00:00.000Z"),
      status: DealStatus.PUBLISHED,
    },
  };
}

describe("DealPricingService", () => {
  it("calculates effective deal prices without mutating the original amount", () => {
    const service = new DealPricingService({ client: {} } as never);

    expect(service.calculateDealPrice(999, 2000)).toBe(799);
    expect(service.calculateDealPrice(1000, 9000)).toBe(100);
  });

  it("returns the original price when no active enrollment exists", async () => {
    const prisma = {
      client: {
        dealProductEnrollment: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    const service = new DealPricingService(prisma as never);

    await expect(service.resolveVariantPrice({ pricePaise: 125000 }, "product_1")).resolves.toEqual({
      originalUnitPricePaise: 125000,
      effectiveUnitPricePaise: 125000,
      dealDiscountBps: null,
      dealDiscountPaise: 0,
      dealSnapshot: null,
    });
  });

  it("applies an active deal enrollment to variant payloads", async () => {
    const prisma = {
      client: {
        dealProductEnrollment: {
          findMany: vi.fn().mockResolvedValue([activeEnrollment("product_1")]),
        },
      },
    };
    const service = new DealPricingService(prisma as never);

    const products = await service.applyActiveDealsToProducts([
      {
        id: "product_1",
        variants: [{ id: "variant_1", pricePaise: 100000 }],
      },
      {
        id: "product_2",
        variants: [{ id: "variant_2", pricePaise: 50000 }],
      },
    ]);

    expect(products[0]).toMatchObject({
      activeDeal: {
        dealId: "deal_1",
        title: "Summer Deal",
        discountBps: 2000,
      },
      variants: [
        {
          id: "variant_1",
          pricePaise: 80000,
          originalPricePaise: 100000,
          dealPricePaise: 80000,
          dealDiscountBps: 2000,
          dealDiscountPaise: 20000,
          activeDeal: {
            dealId: "deal_1",
          },
        },
      ],
    });
    expect(products[1]).toMatchObject({
      activeDeal: null,
      variants: [
        {
          id: "variant_2",
          pricePaise: 50000,
          originalPricePaise: 50000,
          dealPricePaise: null,
          dealDiscountBps: null,
          dealDiscountPaise: 0,
          activeDeal: null,
        },
      ],
    });
  });
});
