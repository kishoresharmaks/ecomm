import { compactPayload, getJson, patchJson, postJson, type MobileAuthHeaders } from "../../lib/api";
import type { AddressSnapshot } from "./delivery-api";

export type CursorPage<T> = {
  items: T[];
  limit: number;
  pageInfo?: { hasNextPage: boolean; nextCursor?: string | null };
};

export type ReverseShipmentStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "FAILED"
  | "CANCELLED";

export type ReturnDetail = {
  id: string;
  requestNumber: string;
  status: string;
  resolution: string;
  reason: string;
  totalQuantity: number;
  requestedAmountPaise: number;
  currency: string;
  createdAt?: string;
  order: { orderNumber: string; orderStatus: string; paymentStatus: string; deliveryStatus: string };
  customer?: { id: string; name?: string | null; email?: string | null; phone?: string | null };
  pickupAddress?: AddressSnapshot | null;
  items: Array<{ id: string; productName: string; quantity: number; sellerName?: string; status: string }>;
  reverseShipments: Array<{
    id: string;
    sellerId: string;
    mode: "PLATFORM_PICKUP" | "CUSTOMER_SELF_SHIP";
    status: ReverseShipmentStatus;
    assignmentStatus?: "UNASSIGNED" | "ASSIGNED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
    trackingReference?: string | null;
    proofReference?: string | null;
    pickupProofReference?: string | null;
    receiptProofReference?: string | null;
    pickupNote?: string | null;
    receivedByName?: string | null;
    seller?: {
      id: string;
      storeName: string;
      slug: string;
      contactName?: string | null;
      contactPhone?: string | null;
      destinationAddress?: AddressSnapshot | null;
    };
  }>;
};

export function listDeliveryReturns(
  auth: MobileAuthHeaders,
  query: { search?: string; assignmentStatus?: string; limit?: number; cursor?: string | null } = {},
) {
  return getJson<CursorPage<ReturnDetail>>({ path: "/delivery/returns", auth, searchParams: query });
}

export function getDeliveryReturn(auth: MobileAuthHeaders, requestNumber: string) {
  return getJson<ReturnDetail>({ path: `/delivery/returns/${encodeURIComponent(requestNumber)}`, auth });
}

export function acceptDeliveryReturnPickup(auth: MobileAuthHeaders, requestNumber: string, note?: string) {
  return postJson<ReturnDetail>({
    path: `/delivery/returns/${encodeURIComponent(requestNumber)}/accept`,
    auth,
    body: compactPayload({ note }),
  });
}

export function rejectDeliveryReturnPickup(auth: MobileAuthHeaders, requestNumber: string, note?: string) {
  return postJson<ReturnDetail>({
    path: `/delivery/returns/${encodeURIComponent(requestNumber)}/reject`,
    auth,
    body: compactPayload({ note }),
  });
}

export function updateDeliveryReturnPickup(
  auth: MobileAuthHeaders,
  requestNumber: string,
  payload: {
    status: ReverseShipmentStatus;
    trackingReference?: string | undefined;
    pickupProofReference?: string | undefined;
    note?: string | undefined;
  },
) {
  return patchJson<ReturnDetail>({
    path: `/delivery/returns/${encodeURIComponent(requestNumber)}/pickup`,
    auth,
    body: compactPayload(payload),
  });
}

export function recordDeliveryReturnShipmentReceipt(
  auth: MobileAuthHeaders,
  requestNumber: string,
  shipmentId: string,
  payload: { receiptProofReference?: string | undefined; receivedByName: string; note?: string | undefined },
) {
  return patchJson<ReturnDetail>({
    path: `/delivery/returns/${encodeURIComponent(requestNumber)}/shipments/${encodeURIComponent(shipmentId)}/receipt`,
    auth,
    body: compactPayload({ status: "RECEIVED", ...payload }),
  });
}
