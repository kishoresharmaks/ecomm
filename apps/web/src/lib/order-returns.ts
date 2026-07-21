import type { AccountOrder } from "./account-api";
import {
  normalizeProductReturnPolicy,
  productPolicyAllowsResolution,
  type ProductReturnReason,
} from "@indihub/shared-types";
import {
  canCustomerSelfCancelOrder,
  customerCancellationUnavailableReason,
} from "./order-cancellation";

export type OrderDetailItem = AccountOrder["items"][number];

// Return request item statuses that still hold quantity against an order item.
// Mirrors `pendingReturnItemStatuses` in apps/api/src/returns/returns.service.ts.
const PENDING_RETURN_ITEM_STATUSES = new Set([
  "PENDING_REVIEW",
  "APPROVED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "RECEIVED",
  "QC_PASSED",
  "REFUND_REQUESTED",
]);

export type CustomerResolution = "REFUND" | "REPLACEMENT";
export type ReturnPolicySettings = {
  returnWindowDays: number;
  replacementWindowDays: number;
};

export type ItemReturnState =
  | { kind: "returnable"; availableQuantity: number }
  | { kind: "non-returnable"; reason: string }
  | { kind: "ineligible"; reason: string }
  | { kind: "in-progress"; reason: string };

/**
 * Active (still-owned) quantity for an order item. Mirrors `activeQuantity`
 * in the returns service so the UI agrees with backend validation.
 */
export function activeQuantityOf(item: OrderDetailItem): number {
  const active = item.activeQuantity ?? 0;
  const cancelled = item.cancelledQuantity ?? 0;
  if (active > 0 || cancelled > 0) {
    return active;
  }
  return item.quantity;
}

/** Quantity currently locked inside an open return/replacement request. */
export function pendingReturnQuantityOf(item: OrderDetailItem): number {
  return (item.returnItems ?? []).reduce((sum, returnItem) => {
    return PENDING_RETURN_ITEM_STATUSES.has(returnItem.status) ? sum + returnItem.quantity : sum;
  }, 0);
}

/** Quantity that can still be cancelled before dispatch. */
export function cancellableQuantityOf(item: OrderDetailItem): number {
  return Math.max(0, activeQuantityOf(item));
}

/** Quantity that can still be sent into a new return/replacement request. */
export function returnableQuantityOf(item: OrderDetailItem): number {
  const available =
    activeQuantityOf(item) - (item.returnedQuantity ?? 0) - pendingReturnQuantityOf(item);
  return Math.max(0, available);
}

/**
 * Reads the item return policy snapshot. Mirrors `itemPolicyAllowsReturn` so a
 * "Non-returnable" policy hides the return CTA on the client too.
 */
export function itemPolicyAllowsReturn(
  item: OrderDetailItem,
  resolution: CustomerResolution = "REFUND",
): boolean {
  return productPolicyAllowsResolution(
    normalizeProductReturnPolicy(item.returnPolicySnapshot),
    resolution,
  );
}

export function returnPolicyLabel(item: OrderDetailItem): string {
  const value =
    item.returnPolicySnapshot?.returnEligibility ??
    (item.returnPolicySnapshot as { returnPolicy?: string | null } | null)?.returnPolicy;
  return typeof value === "string" && value.trim() ? value.trim() : "Returnable";
}

export function returnPolicyDescription(item: OrderDetailItem): string {
  const normalized = normalizeProductReturnPolicy(item.returnPolicySnapshot);
  const available = [
    normalized.returnAllowed ? `${normalized.returnWindowDays}-day refund return` : null,
    normalized.replacementAllowed
      ? `${normalized.replacementWindowDays}-day replacement`
      : null,
  ].filter(Boolean);
  const policy = available.length ? available.join(" / ") : returnPolicyLabel(item);
  const warranty = item.returnPolicySnapshot?.warranty;
  return typeof warranty === "string" && warranty.trim()
    ? `${policy}. Warranty: ${warranty.trim()}.`
    : policy;
}

export function isOrderCancellable(order: AccountOrder): boolean {
  return canCustomerSelfCancelOrder(order);
}

export function orderCancellationUnavailableReason(order: AccountOrder): string {
  return customerCancellationUnavailableReason(order);
}

/**
 * Returns are available only after delivery and once payment is settled or not
 * required. Mirrors `assertOrderCanBeReturned` in the returns service.
 */
export function isOrderDelivered(order: AccountOrder): boolean {
  return order.orderStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED";
}

export function isDeliveredStorePickupOrder(order: AccountOrder): boolean {
  const isStorePickup =
    order.deliveryDetail?.deliveryMode === "STORE_PICKUP" ||
    (Array.isArray(order.shipments) &&
      order.shipments.length > 0 &&
      order.shipments.every((shipment) => shipment.deliveryMode === "STORE_PICKUP"));

  return isStorePickup && isOrderDelivered(order);
}

export function isOrderReturnable(order: AccountOrder): boolean {
  if (isDeliveredStorePickupOrder(order)) {
    return false;
  }

  if (!isOrderDelivered(order)) {
    return false;
  }
  return order.paymentStatus === "PAID" || order.paymentStatus === "NOT_REQUIRED";
}

export function orderReturnUnavailableReason(order: AccountOrder): string {
  if (isDeliveredStorePickupOrder(order)) {
    return "Store pickup orders are final after pickup is marked delivered.";
  }

  if (!isOrderDelivered(order)) {
    return "Returns, refunds, and replacements are available only after delivery.";
  }

  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "NOT_REQUIRED") {
    return "Returns are available only after payment is completed or not required.";
  }

  return "No items in this order are currently eligible for a new return request.";
}

/**
 * Per-line refund estimate from the order payload already on the client.
 * Mirrors the backend buyer-refund math (gross minus prorated coupon share).
 * `approximate` is true when a coupon discount makes the final figure depend on
 * remainder allocation the server resolves at submit time.
 */
export function estimateLineRefundPaise(
  item: OrderDetailItem,
  quantity: number,
): { refundPaise: number; approximate: boolean } {
  const safeQuantity = Math.max(0, Math.min(quantity, item.quantity));
  const grossPaise = item.unitPricePaise * safeQuantity;
  const couponTotal = item.couponDiscountPaise ?? 0;
  const perUnitCoupon = item.quantity > 0 ? Math.floor(couponTotal / item.quantity) : 0;
  const couponAdjustment = perUnitCoupon * safeQuantity;
  const refundPaise = Math.max(0, grossPaise - couponAdjustment);
  return { refundPaise, approximate: couponTotal > 0 };
}

export type SelectionSummary = {
  itemCount: number;
  quantityTotal: number;
  refundPaise: number;
  approximate: boolean;
};

export function summarizeSelection(
  items: OrderDetailItem[],
  selection: Map<string, number>,
): SelectionSummary {
  let itemCount = 0;
  let quantityTotal = 0;
  let refundPaise = 0;
  let approximate = false;

  for (const item of items) {
    const quantity = selection.get(item.id) ?? 0;
    if (quantity <= 0) {
      continue;
    }
    itemCount += 1;
    quantityTotal += quantity;
    const estimate = estimateLineRefundPaise(item, quantity);
    refundPaise += estimate.refundPaise;
    approximate = approximate || estimate.approximate;
  }

  return { itemCount, quantityTotal, refundPaise, approximate };
}

/**
 * Classifies how an item should render in the post-delivery returns surface.
 * Only meaningful once `isOrderReturnable(order)` is true.
 */
export function deliveredItemReturnState(
  item: OrderDetailItem,
  resolution: CustomerResolution = "REFUND",
): ItemReturnState {
  if (!itemPolicyAllowsReturn(item, resolution)) {
    return { kind: "non-returnable", reason: returnPolicyLabel(item) };
  }

  const pending = pendingReturnQuantityOf(item);
  const available = returnableQuantityOf(item);

  if (available > 0) {
    return { kind: "returnable", availableQuantity: available };
  }

  if (pending > 0) {
    return {
      kind: "in-progress",
      reason: "A return or replacement request is already in progress for this item.",
    };
  }

  if ((item.returnedQuantity ?? 0) > 0) {
    return { kind: "ineligible", reason: "This item has already been returned." };
  }

  return { kind: "ineligible", reason: "This item is no longer eligible for return." };
}

export function itemReturnWindowState(
  order: AccountOrder,
  item: OrderDetailItem,
  settings: ReturnPolicySettings,
  resolution: CustomerResolution,
  now = new Date(),
) {
  const policy = normalizeProductReturnPolicy(item.returnPolicySnapshot);
  const productDays =
    resolution === "REPLACEMENT"
      ? policy.replacementWindowDays
      : policy.returnWindowDays;
  const globalDays =
    resolution === "REPLACEMENT"
      ? settings.replacementWindowDays
      : settings.returnWindowDays;
  const windowDays = Math.min(productDays, globalDays);
  const deliveredAt = orderDeliveredAt(order);
  const deadlineAt =
    deliveredAt && windowDays > 0
      ? new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
      : null;

  return {
    windowDays,
    deadlineAt,
    eligible:
      itemPolicyAllowsReturn(item, resolution) &&
      Boolean(deadlineAt && now.getTime() <= deadlineAt.getTime()),
  };
}

export function acceptedReasonsForSelection(
  items: OrderDetailItem[],
  selection: Map<string, number>,
): ProductReturnReason[] {
  const selected = items.filter((item) => (selection.get(item.id) ?? 0) > 0);
  if (!selected.length) {
    return [];
  }
  const [first, ...rest] = selected;
  const firstReasons = normalizeProductReturnPolicy(first?.returnPolicySnapshot).returnReasons;
  return firstReasons.filter((reason) =>
    rest.every((item) =>
      normalizeProductReturnPolicy(item.returnPolicySnapshot).returnReasons.includes(reason),
    ),
  );
}

function orderDeliveredAt(order: AccountOrder) {
  const packageDates = (order.shipments ?? [])
    .flatMap((shipment) => shipment.packages ?? [])
    .map((shipmentPackage) => parsedDate(shipmentPackage.deliveredAt))
    .filter((value): value is Date => Boolean(value));
  if (packageDates.length) {
    return new Date(Math.max(...packageDates.map((value) => value.getTime())));
  }
  const timelineDates = (order.customerDeliveryTimeline ?? [])
    .filter(
      (event) =>
        event.completed &&
        (event.code.toUpperCase().includes("DELIVER") ||
          event.label.toUpperCase().includes("DELIVER")),
    )
    .map((event) => parsedDate(event.at))
    .filter((value): value is Date => Boolean(value));
  if (timelineDates.length) {
    return new Date(Math.max(...timelineDates.map((value) => value.getTime())));
  }
  return parsedDate(order.updatedAt) ?? parsedDate(order.createdAt);
}

function parsedDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
