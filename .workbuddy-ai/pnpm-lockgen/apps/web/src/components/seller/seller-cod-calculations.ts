type SellerCodOrder = {
  totalPaise?: number | null;
  subtotalPaise?: number | null;
  platformFeePaise?: number | null;
  sellerSplits?: Array<{
    id?: string | null;
    sellerSubtotalPaise?: number | null;
  }>;
};

type SellerCodSplit = {
  id?: string | null;
  sellerSubtotalPaise?: number | null;
};

type SellerCodShipment = {
  subtotalPaise?: number | null;
  shippingPaise?: number | null;
  codSurchargePaise?: number | null;
};

export function sellerCollectedCodExpectedPaise(
  order: SellerCodOrder,
  sellerSplit: SellerCodSplit | null | undefined,
  sellerShipment: SellerCodShipment | null | undefined,
) {
  const sellerSubtotalPaise =
    positivePaise(sellerSplit?.sellerSubtotalPaise) ??
    positivePaise(sellerShipment?.subtotalPaise);

  if (sellerSubtotalPaise === null) {
    return Math.max(0, order.totalPaise ?? 0);
  }

  return (
    sellerSubtotalPaise +
    (sellerShipment?.shippingPaise ?? 0) +
    (sellerShipment?.codSurchargePaise ?? 0) +
    allocatedBuyerPlatformFeePaise(order, sellerSplit, sellerSubtotalPaise)
  );
}

function allocatedBuyerPlatformFeePaise(
  order: SellerCodOrder,
  sellerSplit: SellerCodSplit | null | undefined,
  sellerSubtotalPaise: number,
) {
  const platformFeePaise = order.platformFeePaise ?? 0;
  const subtotalPaise = order.subtotalPaise ?? 0;
  if (platformFeePaise <= 0 || subtotalPaise <= 0 || sellerSubtotalPaise <= 0) {
    return 0;
  }

  const sellerSplits = (order.sellerSplits ?? []).filter(
    (split) => (split.sellerSubtotalPaise ?? 0) > 0,
  );
  if (sellerSplits.length <= 1) {
    return Math.round((platformFeePaise * sellerSubtotalPaise) / subtotalPaise);
  }

  const targetIndex = sellerSplits.findIndex((split) =>
    sellerSplit?.id
      ? split.id === sellerSplit.id
      : split.sellerSubtotalPaise === sellerSubtotalPaise,
  );
  if (targetIndex < 0) {
    return Math.round((platformFeePaise * sellerSubtotalPaise) / subtotalPaise);
  }

  const allocations = sellerSplits.map((split, index) => {
    const numerator = platformFeePaise * (split.sellerSubtotalPaise ?? 0);
    return {
      index,
      base: Math.floor(numerator / subtotalPaise),
      remainder: numerator % subtotalPaise,
    };
  });
  let remainderPaise =
    platformFeePaise -
    allocations.reduce((sum, allocation) => sum + allocation.base, 0);
  const ranked = [...allocations].sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index,
  );
  const extraIndexes = new Set<number>();
  for (const allocation of ranked) {
    if (remainderPaise <= 0) {
      break;
    }
    extraIndexes.add(allocation.index);
    remainderPaise -= 1;
  }

  const targetAllocation = allocations[targetIndex];
  return targetAllocation
    ? targetAllocation.base + (extraIndexes.has(targetIndex) ? 1 : 0)
    : Math.round((platformFeePaise * sellerSubtotalPaise) / subtotalPaise);
}

function positivePaise(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
