import { CommissionType, FinanceRuleScope } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
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
