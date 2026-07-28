import type {
  MobileOrderDetail,
  MobileReturnPolicySettings,
  MobileReturnRequestStatus,
} from "../storefront/storefront-api";

export const mobileReturnResolutions = ["REFUND", "REPLACEMENT"] as const;
export const mobileReverseShipmentModes = ["PLATFORM_PICKUP", "CUSTOMER_SELF_SHIP"] as const;

export type MobileReturnResolution = (typeof mobileReturnResolutions)[number];
export type MobileReverseShipmentMode = (typeof mobileReverseShipmentModes)[number];

export type ReturnFormSelection = Record<string, number>;
export const mobileProductReturnReasons = [
  "Damaged on arrival",
  "Wrong item received",
  "Missing parts or accessories",
  "Product differs from description",
  "Size or fit issue",
  "Defective or not working",
  "Quality not as expected",
  "Changed mind",
] as const;

type ReturnWindowOrder = {
  createdAt?: string | null;
  updatedAt?: string | null;
  customerDeliveryTimeline?: MobileOrderDetail["customerDeliveryTimeline"];
  shipments?: MobileOrderDetail["shipments"];
};

export const defaultMobileReturnPolicySettings: MobileReturnPolicySettings = {
  returnWindowDays: 7,
  replacementWindowDays: 7,
};

const pendingReturnItemStatuses = new Set([
  "PENDING_REVIEW",
  "APPROVED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "RECEIVED",
  "QC_PASSED",
  "REFUND_REQUESTED",
]);

const activeReturnRequestStatuses = new Set([
  "PENDING_REVIEW",
  "AUTO_APPROVED",
  "APPROVED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "QC_PASSED",
]);

export function isDeliveredStorePickupOrder(
  order: Pick<MobileOrderDetail, "deliveryStatus" | "orderStatus" | "deliveryDetail" | "shipments">,
) {
  const delivered = order.orderStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED";
  const storePickup =
    order.deliveryDetail?.deliveryMode === "STORE_PICKUP" ||
    ((order.shipments?.length ?? 0) > 0 &&
      order.shipments?.every((shipment) => shipment.deliveryMode === "STORE_PICKUP"));

  return delivered && Boolean(storePickup);
}

export function orderCanStartReturn(
  order: Pick<MobileOrderDetail, "deliveryStatus" | "orderStatus" | "paymentStatus" | "deliveryDetail" | "shipments">,
) {
  if (isDeliveredStorePickupOrder(order)) {
    return false;
  }

  const delivered = order.orderStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED";
  const paid = order.paymentStatus === "PAID" || order.paymentStatus === "NOT_REQUIRED";
  return delivered && paid;
}

export function availableReturnQuantity(
  item: Pick<
    MobileOrderDetail["items"][number],
    "activeQuantity" | "cancelledQuantity" | "quantity" | "returnItems"
  >,
) {
  return availableReturnQuantityWithRequests(item);
}

export function availableReturnQuantityWithRequests(
  item: Pick<
    MobileOrderDetail["items"][number],
    "activeQuantity" | "cancelledQuantity" | "quantity" | "returnItems"
  >,
) {
  const activeQuantity = activeQuantityOf(item);
  const pendingQuantity = (item.returnItems ?? []).reduce(
    (sum, returnItem) =>
      pendingReturnItemStatuses.has(returnItem.status) ? sum + safeNumber(returnItem.quantity, 0) : sum,
    0,
  );
  return Math.max(0, activeQuantity - pendingQuantity);
}

export function latestOrderReturnRequest(order: Pick<MobileOrderDetail, "items">) {
  const requests = new Map<
    string,
    {
      requestNumber: string;
      status: MobileReturnRequestStatus;
      resolution: string;
      createdAt?: string | null;
    }
  >();

  for (const item of order.items) {
    for (const returnItem of item.returnItems ?? []) {
      const request = returnItem.returnRequest;
      const current = requests.get(request.requestNumber);
      const currentTime = dateTime(current?.createdAt);
      const nextTime = dateTime(request.createdAt ?? returnItem.createdAt);
      if (!current || nextTime >= currentTime) {
        const createdAt = request.createdAt ?? returnItem.createdAt ?? null;
        requests.set(request.requestNumber, {
          requestNumber: request.requestNumber,
          status: request.status,
          resolution: request.resolution,
          createdAt,
        });
      }
    }
  }

  return [...requests.values()].sort((first, second) => dateTime(second.createdAt) - dateTime(first.createdAt))[0] ?? null;
}

export function activeOrderReturnRequest(order: Pick<MobileOrderDetail, "items">) {
  const activeRequests = order.items.flatMap((item) =>
    (item.returnItems ?? [])
      .filter((returnItem) => activeReturnRequestStatuses.has(returnItem.returnRequest.status))
      .map((returnItem) => ({
        requestNumber: returnItem.returnRequest.requestNumber,
        status: returnItem.returnRequest.status,
        resolution: returnItem.returnRequest.resolution,
        createdAt: returnItem.returnRequest.createdAt ?? returnItem.createdAt ?? null,
      })),
  );

  return activeRequests.sort((first, second) => dateTime(second.createdAt) - dateTime(first.createdAt))[0] ?? null;
}

export function returnWindowState(
  order: ReturnWindowOrder,
  windowDays: number,
  now = new Date(),
) {
  const normalizedDays = Math.min(365, Math.max(0, Math.round(safeNumber(windowDays, 0))));
  const deliveredAt = orderDeliveredAt(order);
  const deadlineAt = deliveredAt
    ? new Date(deliveredAt.getTime() + normalizedDays * 24 * 60 * 60 * 1000)
    : null;
  const eligible = normalizedDays > 0 && Boolean(deadlineAt && now.getTime() <= deadlineAt.getTime());
  const daysRemaining =
    eligible && deadlineAt
      ? Math.max(0, Math.ceil((deadlineAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;

  return {
    deadlineAt: deadlineAt?.toISOString() ?? null,
    deliveredAt: deliveredAt?.toISOString() ?? null,
    daysRemaining,
    eligible,
    windowDays: normalizedDays,
  };
}

export function orderReturnPolicyState(
  order: ReturnWindowOrder,
  settings: MobileReturnPolicySettings = defaultMobileReturnPolicySettings,
  now = new Date(),
) {
  return {
    refund: returnWindowState(order, settings.returnWindowDays, now),
    replacement: returnWindowState(order, settings.replacementWindowDays, now),
  };
}

export function itemReturnPolicyState(
  order: ReturnWindowOrder,
  item: MobileOrderDetail["items"][number],
  settings: MobileReturnPolicySettings,
  resolution: MobileReturnResolution,
  now = new Date(),
) {
  const policy = mobileItemReturnPolicy(item);
  const allowed =
    resolution === "REPLACEMENT" ? policy.replacementAllowed : policy.returnAllowed;
  const productDays =
    resolution === "REPLACEMENT"
      ? policy.replacementWindowDays
      : policy.returnWindowDays;
  const globalDays =
    resolution === "REPLACEMENT"
      ? settings.replacementWindowDays
      : settings.returnWindowDays;
  const window = returnWindowState(order, Math.min(productDays, globalDays), now);
  return {
    ...window,
    eligible: allowed && window.eligible,
  };
}

export function availableReturnQuantityForResolution(
  order: ReturnWindowOrder,
  item: MobileOrderDetail["items"][number],
  settings: MobileReturnPolicySettings,
  resolution: MobileReturnResolution,
) {
  return itemReturnPolicyState(order, item, settings, resolution).eligible
    ? availableReturnQuantity(item)
    : 0;
}

export function acceptedReturnReasonsForSelection(
  items: MobileOrderDetail["items"],
  selection: ReturnFormSelection,
) {
  const selected = items.filter((item) => (selection[item.id] ?? 0) > 0);
  if (!selected.length) return [];
  const [first, ...rest] = selected;
  return mobileItemReturnPolicy(first!).returnReasons.filter((reason) =>
    rest.every((item) => mobileItemReturnPolicy(item).returnReasons.includes(reason)),
  );
}

export function mobileItemReturnPolicy(item: MobileOrderDetail["items"][number]) {
  const snapshot = item.returnPolicySnapshot ?? {};
  const eligibility = snapshot.returnEligibility?.trim() || "Returnable";
  const returnAllowed =
    snapshot.returnAllowed ??
    ["Returnable", "Return and replacement", "Return only"].includes(eligibility);
  const replacementAllowed =
    snapshot.replacementAllowed ??
    ["Returnable", "Return and replacement", "Replacement only"].includes(eligibility);
  const returnReasons = (snapshot.returnReasons ?? []).filter((reason) =>
    mobileProductReturnReasons.includes(reason as (typeof mobileProductReturnReasons)[number]),
  );
  return {
    returnAllowed,
    replacementAllowed,
    returnWindowDays: returnAllowed
      ? boundedWindowDays(snapshot.returnWindowDays, 7)
      : 0,
    replacementWindowDays: replacementAllowed
      ? boundedWindowDays(snapshot.replacementWindowDays, 7)
      : 0,
    returnReasons: returnReasons.length ? returnReasons : [...mobileProductReturnReasons],
  };
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

function boundedWindowDays(value: number | null | undefined, fallback: number) {
  return Math.min(365, Math.max(0, Math.round(safeNumber(value, fallback))));
}

function activeQuantityOf(
  item: Pick<MobileOrderDetail["items"][number], "activeQuantity" | "cancelledQuantity" | "quantity">,
) {
  const activeQuantity = safeNumber(item.activeQuantity, 0);
  const cancelledQuantity = safeNumber(item.cancelledQuantity, 0);
  return activeQuantity > 0 || cancelledQuantity > 0 ? activeQuantity : item.quantity;
}

function orderDeliveredAt(order: ReturnWindowOrder) {
  const packageDates = (order.shipments ?? [])
    .flatMap((shipment) => shipment.packages ?? [])
    .map((shipmentPackage) => parsedDate(shipmentPackage.deliveredAt))
    .filter((value): value is Date => Boolean(value));
  if (packageDates.length) {
    return new Date(Math.max(...packageDates.map((value) => value.getTime())));
  }

  const timelineDates = (order.customerDeliveryTimeline ?? [])
    .filter((event) => event.status?.toUpperCase() === "DELIVERED" || event.label?.toUpperCase().includes("DELIVER"))
    .map((event) => parsedDate(event.createdAt))
    .filter((value): value is Date => Boolean(value));
  if (timelineDates.length) {
    return new Date(Math.max(...timelineDates.map((value) => value.getTime())));
  }

  return parsedDate(order.updatedAt) ?? parsedDate(order.createdAt);
}

function parsedDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTime(value: string | null | undefined) {
  return parsedDate(value)?.getTime() ?? 0;
}
