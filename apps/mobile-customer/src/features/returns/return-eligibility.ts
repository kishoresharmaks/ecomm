import type { MobileOrderDetail } from "../storefront/storefront-api";

export const mobileReturnResolutions = ["REFUND", "REPLACEMENT"] as const;
export const mobileReverseShipmentModes = ["PLATFORM_PICKUP", "CUSTOMER_SELF_SHIP"] as const;

export type MobileReturnResolution = (typeof mobileReturnResolutions)[number];
export type MobileReverseShipmentMode = (typeof mobileReverseShipmentModes)[number];

export type ReturnFormSelection = Record<string, number>;

export function orderCanStartReturn(order: Pick<MobileOrderDetail, "deliveryStatus" | "orderStatus" | "paymentStatus">) {
  const delivered = order.orderStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED";
  const paid = order.paymentStatus === "PAID" || order.paymentStatus === "NOT_REQUIRED";
  return delivered && paid;
}

export function availableReturnQuantity(item: Pick<MobileOrderDetail["items"][number], "activeQuantity" | "quantity" | "returnedQuantity">) {
  const activeQuantity = safeNumber(item.activeQuantity, item.quantity);
  const returnedQuantity = safeNumber(item.returnedQuantity, 0);
  return Math.max(0, activeQuantity - returnedQuantity);
}

export function selectedReturnItems(selection: ReturnFormSelection) {
  return Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}

export function validateReturnForm(input: {
  note: string;
  reason: string;
  selection: ReturnFormSelection;
}) {
  const reason = input.reason.trim();
  const note = input.note.trim();
  const items = selectedReturnItems(input.selection);

  if (!items.length) {
    return "validationNoItems";
  }

  if (!reason) {
    return "validationReason";
  }

  if (reason.length > 160) {
    return "validationReasonLength";
  }

  if (note.length > 1000) {
    return "validationNoteLength";
  }

  return null;
}

export function customerSafeReturnDetail(detail: {
  note?: string | null;
  reason?: string | null;
}) {
  return {
    note: detail.note?.trim() || null,
    reason: detail.reason?.trim() || null,
  };
}

function safeNumber(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
