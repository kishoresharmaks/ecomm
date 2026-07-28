import { CommissionType, FinanceRuleScope } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { CommissionRulesService } from "./commission-rules.service";
import { FinanceCalculatorService } from "./finance-calculator.service";

describe("FinanceCalculatorService", () => {
  it("uses seller-category rules before global rules and calculates deductions in paise", async () => {
    const tx = {
      commissionRule: {
        findMany: vi.fn().mockResolvedValue([
          rule({ id: "global", scope: FinanceRuleScope.GLOBAL, commissionValueBps: 500 }),
          rule({
            id: "seller_category",
            scope: FinanceRuleScope.SELLER_CATEGORY,
            sellerId: "seller_1",
            categoryId: "category_1",
            commissionValueBps: 1000,
            gstRateBps: 1800,
            tdsRateBps: 100,
            platformFeeType: CommissionType.PERCENTAGE,
            platformFeeValueBps: 200
          })
        ])
      }
    };
    const service = new FinanceCalculatorService({ client: tx } as never);

    const result = await service.calculateSplit(split("category_1", 10000) as never, tx as never);

    expect(result).toMatchObject({
      commissionRuleId: "seller_category",
      grossSalesPaise: 10000,
      commissionPaise: 1000,
      platformFeePaise: 200,
      gstOnCommissionPaise: 216,
      tdsPaise: 100,
      netPayablePaise: 8484
    });
  });

  it("keeps the split rule id empty when multiple category rules are used", async () => {
    const tx = {
      commissionRule: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([rule({ id: "cat_a", scope: FinanceRuleScope.CATEGORY, categoryId: "category_1", commissionValueBps: 500 })])
          .mockResolvedValueOnce([rule({ id: "cat_b", scope: FinanceRuleScope.CATEGORY, categoryId: "category_2", commissionValueBps: 700 })])
      }
    };
    const service = new FinanceCalculatorService({ client: tx } as never);
    const orderSplit = split("category_1", 10000);
    orderSplit.order.items.push(item("item_2", "category_2", 20000));

    const result = await service.calculateSplit(orderSplit as never, tx as never);

    expect(result.commissionRuleId).toBeUndefined();
    expect(result.commissionPaise).toBe(1900);
    expect((result.snapshot as { lines: unknown[] }).lines).toHaveLength(2);
  });

  it("uses the same commission rule engine for service booking settlements", async () => {
    const tx = {
      commissionRule: {
        findMany: vi.fn().mockResolvedValue([
          rule({
            id: "service_rule",
            scope: FinanceRuleScope.SELLER_CATEGORY,
            sellerId: "seller_1",
            categoryId: "category_1",
            commissionValueBps: 800,
            gstRateBps: 1800,
            tdsRateBps: 100,
            tcsRateBps: 25,
            platformFeeType: CommissionType.FIXED,
            platformFeeFixedPaise: 500,
          }),
        ]),
      },
    };
    const service = new FinanceCalculatorService({ client: tx } as never);

    const result = await service.calculateServiceBooking(serviceBooking("category_1") as never, 20_000, tx as never);

    expect(result).toMatchObject({
      commissionRuleId: "service_rule",
      grossAmountPaise: 20_000,
      inspectionFeeGrossPaise: 1_000,
      commissionPaise: 1_600,
      platformFeePaise: 500,
      gstOnCommissionPaise: 378,
      tdsPaise: 200,
      tcsPaise: 50,
      netPayablePaise: 17_272,
    });
    expect(result.snapshot).toMatchObject({
      source: "service_booking",
      ruleId: "service_rule",
      categoryId: "category_1",
      grossAmountPaise: 20_000,
    });
  });

  it("never creates a negative seller payout when configured deductions exceed gross sales", async () => {
    const tx = {
      commissionRule: {
        findMany: vi.fn().mockResolvedValue([
          rule({
            commissionValueBps: 10_000,
            gstRateBps: 1_800,
          }),
        ]),
      },
    };
    const service = new FinanceCalculatorService({ client: tx } as never);

    const result = await service.calculateSplit(split("category_1", 10_000) as never, tx as never);

    expect(result.netPayablePaise).toBe(0);
  });

  it("rejects ambiguous or incomplete payout deduction rules", async () => {
    const service = new CommissionRulesService({} as never);
    const actor = { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [] };

    await expect(service.createRule({
      name: "Seller rule",
      scope: FinanceRuleScope.SELLER,
      sellerId: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab",
      categoryId: "79f4b5b3-1130-4a38-95e2-7d9f910005b9",
      commissionType: CommissionType.PERCENTAGE,
      commissionRatePercent: 10,
    }, actor)).rejects.toThrow("cannot target a category");

    await expect(service.createRule({
      name: "Missing settlement fee",
      scope: FinanceRuleScope.GLOBAL,
      commissionType: CommissionType.PERCENTAGE,
      commissionRatePercent: 10,
      platformFeeType: CommissionType.PERCENTAGE,
    }, actor)).rejects.toThrow("require platformFeeRatePercent");

    await expect(service.createRule({
      name: "Invalid dates",
      scope: FinanceRuleScope.GLOBAL,
      commissionType: CommissionType.PERCENTAGE,
      commissionRatePercent: 10,
      effectiveFrom: "2026-07-27T00:00:00.000Z",
      effectiveTo: "2026-07-26T00:00:00.000Z",
    }, actor)).rejects.toThrow("effectiveFrom must be before effectiveTo");
  });
});

function rule(overrides: Record<string, unknown>) {
  return {
    id: "rule",
    name: "Rule",
    scope: FinanceRuleScope.GLOBAL,
    sellerId: null,
    categoryId: null,
    commissionType: CommissionType.PERCENTAGE,
    commissionValueBps: 0,
    commissionFixedPaise: null,
    gstRateBps: 0,
    tdsRateBps: 0,
    tcsRateBps: 0,
    platformFeeType: CommissionType.MANUAL,
    platformFeeValueBps: null,
    platformFeeFixedPaise: null,
    priority: 100,
    active: true,
    effectiveFrom: null,
    effectiveTo: null,
    createdById: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    ...overrides
  };
}

function split(categoryId: string, lineTotalPaise: number) {
  return {
    id: "split_1",
    sellerId: "seller_1",
    sellerSubtotalPaise: lineTotalPaise,
    refundAdjustmentPaise: 0,
    order: {
      createdAt: new Date("2026-05-20T00:00:00.000Z"),
      items: [item("item_1", categoryId, lineTotalPaise)]
    }
  };
}

function item(id: string, categoryId: string, lineTotalPaise: number) {
  return {
    id,
    sellerId: "seller_1",
    productId: `product_${id}`,
    productVariantId: `variant_${id}`,
    lineTotalPaise,
    product: {
      categoryId
    }
  };
}

function serviceBooking(categoryId: string) {
  return {
    id: "booking_1",
    bookingNumber: "SRV-2026-ABCDEF",
    sellerId: "seller_1",
    serviceListingId: "service_listing_1",
    status: "COMPLETED",
    paymentMode: "INSPECTION_FEE",
    createdAt: new Date("2026-05-20T00:00:00.000Z"),
    inspectionFeePaise: 1_000,
    paidAmountPaise: 20_000,
    listing: {
      id: "service_listing_1",
      title: "AC repair",
      categoryId,
    },
  };
}
