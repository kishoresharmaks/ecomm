import { apiBaseUrl, MobileApiError, type MobileAuthHeaders } from "../../lib/api";
import type {
  SellerDeliveryPayload,
  SellerOrder,
  SellerOrderPackage,
  SellerOrderShipment,
} from "./seller-api";

export type SellerOrderAction =
  | "ACCEPT"
  | "PROCESSING"
  | "PACKED"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED";

export type TimelineEntry = {
  id: string;
  source: "order" | "delivery" | "shipment" | "package";
  status: string;
  note: string;
  at: string;
};

export type LabelDownloader = (auth: MobileAuthHeaders, labelPath: string) => Promise<Uint8Array>;

export type PackageFormValues = {
  weightGrams: string;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
};

export type DeliveryFormValues = {
  deliveryMode: NonNullable<SellerDeliveryPayload["deliveryMode"]>;
  partnerName: string;
  partnerPhone: string;
  trackingReference: string;
  estimatedDeliveryDate: string;
  deliveryNote: string;
  receiverName: string;
  proofNote: string;
  proofReference: string;
  codCollected: boolean;
  codCollectedAmountRupees: string;
  codCollectionNote: string;
};

export type DeliveryFormErrors = Partial<Record<keyof DeliveryFormValues, string>>;

export function availableSellerOrderActions(order: SellerOrder): SellerOrderAction[] {
  const sellerStatus = order.sellerSplits?.[0]?.sellerStatus ?? "PENDING";
  const deliveryMode = order.deliveryDetail?.deliveryMode ?? order.shipments?.[0]?.deliveryMode ?? "LOCAL_DELIVERY_PARTNER";
  const assignmentStatus = order.deliveryDetail?.assignmentStatus ?? null;

  if (sellerStatus === "CANCELLED" || sellerStatus === "DELIVERED") {
    return [];
  }

  const actions: SellerOrderAction[] = [];
  if (sellerStatus === "PENDING") {
    actions.push("ACCEPT", "CANCELLED");
    return actions;
  }
  if (sellerStatus === "ACCEPTED") {
    actions.push("PROCESSING", "PACKED", "CANCELLED");
    return actions;
  }
  if (sellerStatus === "PROCESSING") {
    actions.push("PACKED", "CANCELLED");
    return actions;
  }
  if (sellerStatus === "DISPATCHED") {
    if (!(deliveryMode === "LOCAL_DELIVERY_PARTNER" && assignmentStatus === "ACCEPTED")) {
      actions.push("DELIVERED");
    }
    return actions;
  }
  return actions;
}

export function createDeliveryForm(order: SellerOrder): DeliveryFormValues {
  return {
    deliveryMode:
      (order.deliveryDetail?.deliveryMode as DeliveryFormValues["deliveryMode"]) ??
      (order.shipments?.[0]?.deliveryMode as DeliveryFormValues["deliveryMode"]) ??
      "THIRD_PARTY_COURIER",
    partnerName: order.deliveryDetail?.partnerName ?? order.shipments?.[0]?.partnerName ?? "",
    partnerPhone: order.deliveryDetail?.partnerPhone ?? order.shipments?.[0]?.partnerPhone ?? "",
    trackingReference: order.deliveryDetail?.trackingReference ?? order.shipments?.[0]?.trackingReference ?? "",
    estimatedDeliveryDate: isoDate(order.deliveryDetail?.estimatedDeliveryDate ?? order.shipments?.[0]?.estimatedDeliveryDate),
    deliveryNote: order.deliveryDetail?.deliveryNote ?? order.shipments?.[0]?.deliveryNote ?? "",
    receiverName: order.deliveryDetail?.receiverName ?? "",
    proofNote: order.deliveryDetail?.proofNote ?? "",
    proofReference: order.deliveryDetail?.proofReference ?? "",
    codCollected: order.deliveryDetail?.codCollectionStatus === "COLLECTED",
    codCollectedAmountRupees: paiseText(order.deliveryDetail?.codCollectedAmountPaise),
    codCollectionNote: order.deliveryDetail?.codCollectionNote ?? "",
  };
}

export function validateDeliveryForm(
  order: SellerOrder,
  action: SellerOrderAction,
  values: DeliveryFormValues,
): { valid: boolean; errors: DeliveryFormErrors; payload: SellerDeliveryPayload } {
  const errors: DeliveryFormErrors = {};
  const partnerName = textOrUndefined(values.partnerName);
  const partnerPhone = textOrUndefined(values.partnerPhone);
  const estimatedDeliveryDate = textOrUndefined(values.estimatedDeliveryDate);
  const deliveryNote = textOrUndefined(values.deliveryNote);
  const payload: SellerDeliveryPayload = {
    deliveryMode: values.deliveryMode,
    ...(partnerName ? { partnerName } : {}),
    ...(partnerPhone ? { partnerPhone } : {}),
    ...(estimatedDeliveryDate ? { estimatedDeliveryDate } : {}),
    ...(deliveryNote ? { deliveryNote } : {}),
  };

  if (action === "DISPATCHED") {
    payload.status = "DISPATCHED";
    if (values.deliveryMode === "THIRD_PARTY_COURIER") {
      const tracking = normalizedTrackingReference(values.trackingReference);
      if (!tracking) {
        errors.trackingReference = "Tracking reference is required for courier dispatch.";
      } else if (tracking.length > 120) {
        errors.trackingReference = "Tracking reference must be 120 characters or fewer.";
      } else {
        payload.trackingReference = tracking;
      }
    } else if (values.trackingReference.trim()) {
      payload.trackingReference = normalizedTrackingReference(values.trackingReference);
    }
  }

  if (action === "PACKED") {
    payload.status = "PACKED";
  }

  if (action === "DELIVERED") {
    payload.status = "DELIVERED";
    const receiverName = textOrUndefined(values.receiverName);
    const proofNote = textOrUndefined(values.proofNote);
    const proofReference = textOrUndefined(values.proofReference);
    if (receiverName) {
      payload.receiverName = receiverName;
    }
    if (proofNote) {
      payload.proofNote = proofNote;
    }
    if (proofReference) {
      payload.proofReference = proofReference;
    }

    if (isCodOrder(order) && values.codCollected) {
      const amountPaise = rupeesToPaise(values.codCollectedAmountRupees);
      if (amountPaise <= 0) {
        errors.codCollectedAmountRupees = "Collected COD amount must be greater than zero.";
      } else if (amountPaise > sellerPayablePaise(order)) {
        errors.codCollectedAmountRupees = "Collected COD amount cannot be above this seller order total.";
      } else {
        payload.codCollected = true;
        payload.codCollectedAmountPaise = amountPaise;
        const codCollectionNote = textOrUndefined(values.codCollectionNote);
        if (codCollectionNote) {
          payload.codCollectionNote = codCollectionNote;
        }
      }
    }
  }

  if (action === "CANCELLED") {
    payload.status = "CANCELLED";
  }

  return { valid: Object.keys(errors).length === 0, errors, payload };
}

export function packageUpdatePayload(
  values: PackageFormValues,
  markReadyForBooking: boolean,
) {
  const weightGrams = positiveInt(values.weightGrams);
  const lengthCm = positiveInt(values.lengthCm);
  const breadthCm = positiveInt(values.breadthCm);
  const heightCm = positiveInt(values.heightCm);
  return {
    ...(weightGrams ? { weightGrams } : {}),
    ...(lengthCm ? { lengthCm } : {}),
    ...(breadthCm ? { breadthCm } : {}),
    ...(heightCm ? { heightCm } : {}),
    ...(markReadyForBooking ? { markReadyForBooking: true } : {}),
  };
}

export function buildSellerTimeline(order: SellerOrder): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const event of order.statusEvents ?? []) {
    if (event.createdAt && event.newStatus) {
      entries.push({
        id: `order-${event.id}`,
        source: "order",
        status: event.newStatus,
        note: event.note ?? event.newStatus,
        at: event.createdAt,
      });
    }
  }

  for (const event of order.deliveryDetail?.events ?? []) {
    if (event.createdAt && event.newStatus) {
      entries.push({
        id: `delivery-${event.id}`,
        source: "delivery",
        status: event.newStatus,
        note: event.note ?? event.newStatus,
        at: event.createdAt,
      });
    }
  }

  for (const shipment of order.shipments ?? []) {
    pushShipmentTime(entries, shipment, "shipment");
    for (const shipmentPackage of shipment.packages ?? []) {
      pushPackageTimes(entries, shipmentPackage);
    }
  }

  const deduped = new Map<string, TimelineEntry>();
  for (const entry of entries) {
    const key = `${entry.source}|${entry.status}|${entry.at}|${entry.note}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return [...deduped.values()].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
}

export async function downloadSellerPackageLabel(auth: MobileAuthHeaders, labelPath: string) {
  const bearerToken = auth.getBearerToken ? await auth.getBearerToken() : auth.bearerToken;
  const response = await fetch(`${apiBaseUrl()}${labelPath}`, {
    headers: {
      Accept: "application/pdf",
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new MobileApiError("Courier label could not be opened right now.", response.status);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes;
}

export function normalizedTrackingReference(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : "";
}

export function sellerPayablePaise(order: SellerOrder) {
  return order.sellerSplits?.[0]?.sellerSubtotalPaise ?? order.totalPaise ?? 0;
}

export function isCodOrder(order: SellerOrder) {
  return (order.payments ?? []).some((payment) => payment.method === "COD");
}

function textOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isoDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function paiseText(value?: number | null) {
  return value && value > 0 ? (value / 100).toFixed(2) : "";
}

function positiveInt(value?: string | number | null) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function rupeesToPaise(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function pushShipmentTime(entries: TimelineEntry[], shipment: SellerOrderShipment, source: TimelineEntry["source"]) {
  const shipmentTime =
    shipment.routingLastAttemptAt ??
    shipment.routingPermanentFailureAt ??
    shipment.routedAt ??
    shipment.codVerifiedAt ??
    shipment.codCollectedAt ??
    shipment.estimatedDeliveryDate ??
    null;
  if (shipment.shipmentNumber && shipment.status && shipmentTime) {
    entries.push({
      id: `${source}-${shipment.id}`,
      source,
      status: shipment.status,
      note: `${shipment.shipmentNumber}: ${shipment.status.replace(/_/g, " ")}`,
      at: shipmentTime,
    });
  }
}

export async function openSellerPackageLabel(
  auth: MobileAuthHeaders,
  labelPath: string,
  downloader: LabelDownloader = downloadSellerPackageLabel,
) {
  const [FileSystem, Sharing] = await Promise.all([
    import("expo-file-system/legacy"),
    import("expo-sharing"),
  ]);
  const fileUri = `${FileSystem.cacheDirectory ?? ""}seller-label-${Date.now()}.pdf`;
  if (!FileSystem.cacheDirectory) {
    throw new MobileApiError("Courier label could not be opened right now.", 0);
  }

  const bytes = await downloader(auth, labelPath);
  const base64 = uint8ArrayToBase64(bytes);

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new MobileApiError("Sharing is not available on this device.", 0);
    }
    await Sharing.shareAsync(fileUri, {
      UTI: "com.adobe.pdf",
      mimeType: "application/pdf",
    });
  } finally {
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // best effort cleanup only
    }
  }
}

function pushPackageTimes(entries: TimelineEntry[], shipmentPackage: SellerOrderPackage) {
  const times: Array<[string | null | undefined, string, string]> = [
    [shipmentPackage.readyForBookingAt, "READY_FOR_BOOKING", "Ready for courier booking"],
    [shipmentPackage.bookedAt, "BOOKED", "Courier booked"],
    [shipmentPackage.pickedUpAt, "PICKED_UP", "Picked up"],
    [shipmentPackage.deliveredAt, "DELIVERED", "Delivered"],
    [shipmentPackage.cancelledAt, "CANCELLED", "Cancelled"],
  ];

  for (const [at, status, note] of times) {
    if (at) {
      entries.push({
        id: `package-${shipmentPackage.id}-${status}`,
        source: "package",
        status,
        note: `${shipmentPackage.packageNumber ?? "Package"}: ${note}`,
        at,
      });
    }
  }
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const chunk = (first << 16) | (second << 8) | third;
    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[chunk & 63] : "=";
  }
  return output;
}
