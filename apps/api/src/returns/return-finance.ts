export type ProratedAdjustmentInput = {
  totalAllocationPaise: number;
  originalQuantity: number;
  affectedQuantity: number;
  alreadyAffectedQuantity?: number;
};

export function prorateAllocatedPaise(input: ProratedAdjustmentInput) {
  const totalAllocationPaise = nonNegativeInt(input.totalAllocationPaise);
  const originalQuantity = positiveInt(input.originalQuantity, "originalQuantity");
  const affectedQuantity = positiveInt(input.affectedQuantity, "affectedQuantity");
  const alreadyAffectedQuantity = nonNegativeInt(input.alreadyAffectedQuantity ?? 0);

  if (alreadyAffectedQuantity >= originalQuantity) {
    return 0;
  }

  const effectiveAffectedQuantity = Math.min(
    affectedQuantity,
    originalQuantity - alreadyAffectedQuantity,
  );
  const perUnit = Math.floor(totalAllocationPaise / originalQuantity);
  const remainder = totalAllocationPaise % originalQuantity;
  const reachesFinalUnit =
    alreadyAffectedQuantity + effectiveAffectedQuantity >= originalQuantity;

  return perUnit * effectiveAffectedQuantity + (reachesFinalUnit ? remainder : 0);
}

export function buyerRefundAmountForLine(input: {
  grossAmountPaise: number;
  couponAdjustmentPaise: number;
}) {
  return Math.max(
    nonNegativeInt(input.grossAmountPaise) - nonNegativeInt(input.couponAdjustmentPaise),
    0,
  );
}

export function sellerPayoutAdjustmentForLine(input: {
  grossAmountPaise: number;
  sellerFundedCouponAdjustmentPaise: number;
}) {
  return Math.max(
    nonNegativeInt(input.grossAmountPaise) -
      nonNegativeInt(input.sellerFundedCouponAdjustmentPaise),
    0,
  );
}

function positiveInt(value: number, field: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInt(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}
