import { describe, expect, it } from "vitest";
import {
  buyerRefundAmountForLine,
  prorateAllocatedPaise,
  sellerPayoutAdjustmentForLine,
} from "./return-finance";

describe("return finance helpers", () => {
  it("prorates coupon allocation per unit and keeps remainder for the final affected unit", () => {
    expect(
      prorateAllocatedPaise({
        totalAllocationPaise: 100,
        originalQuantity: 3,
        affectedQuantity: 1,
      }),
    ).toBe(33);

    expect(
      prorateAllocatedPaise({
        totalAllocationPaise: 100,
        originalQuantity: 3,
        affectedQuantity: 1,
        alreadyAffectedQuantity: 1,
      }),
    ).toBe(33);

    expect(
      prorateAllocatedPaise({
        totalAllocationPaise: 100,
        originalQuantity: 3,
        affectedQuantity: 1,
        alreadyAffectedQuantity: 2,
      }),
    ).toBe(34);
  });

  it("subtracts all coupon allocation from buyer refund", () => {
    expect(
      buyerRefundAmountForLine({
        grossAmountPaise: 1_000,
        couponAdjustmentPaise: 250,
      }),
    ).toBe(750);
  });

  it("adds back only seller-funded coupon when calculating seller payout adjustment", () => {
    expect(
      sellerPayoutAdjustmentForLine({
        grossAmountPaise: 1_000,
        sellerFundedCouponAdjustmentPaise: 120,
      }),
    ).toBe(880);
  });
});
