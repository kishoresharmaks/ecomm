import { describe, expect, it, vi } from "vitest";
import {
  availableSellerOrderActions,
  buildSellerTimeline,
  createDeliveryForm,
  openSellerPackageLabel,
  packageUpdatePayload,
  validateDeliveryForm,
} from "./order-fulfilment";
import type { SellerOrder } from "./seller-api";

describe("availableSellerOrderActions", () => {
  it("shows accept and cancellation for pending seller orders", () => {
    expect(availableSellerOrderActions(orderWith({ sellerSplits: [{ id: "split_1", sellerStatus: "PENDING" }] }))).toEqual([
      "ACCEPT",
      "CANCELLED",
    ]);
  });

  it("hides delivered action for accepted local delivery partner assignment", () => {
    expect(
      availableSellerOrderActions(
        orderWith({
          sellerSplits: [{ id: "split_1", sellerStatus: "DISPATCHED" }],
          deliveryDetail: {
            deliveryMode: "LOCAL_DELIVERY_PARTNER",
            assignmentStatus: "ACCEPTED",
            status: "DISPATCHED",
          },
        }),
      ),
    ).toEqual([]);
  });

  it("shows delivered action for seller-controlled delivery modes", () => {
    expect(
      availableSellerOrderActions(
        orderWith({
          sellerSplits: [{ id: "split_1", sellerStatus: "DISPATCHED" }],
          deliveryDetail: {
            deliveryMode: "THIRD_PARTY_COURIER",
            assignmentStatus: "UNASSIGNED",
            status: "DISPATCHED",
          },
        }),
      ),
    ).toEqual(["DELIVERED"]);
  });
});

describe("validateDeliveryForm", () => {
  it("requires normalized tracking for courier dispatch", () => {
    const result = validateDeliveryForm(
      orderWith({}),
      "DISPATCHED",
      {
        ...createDeliveryForm(orderWith({})),
        deliveryMode: "THIRD_PARTY_COURIER",
        trackingReference: "  ab12  ",
      },
    );

    expect(result.valid).toBe(true);
    expect(result.payload.trackingReference).toBe("AB12");
  });

  it("blocks courier dispatch without tracking", () => {
    const result = validateDeliveryForm(
      orderWith({}),
      "DISPATCHED",
      {
        ...createDeliveryForm(orderWith({})),
        deliveryMode: "THIRD_PARTY_COURIER",
        trackingReference: "   ",
      },
    );

    expect(result.valid).toBe(false);
    expect(result.errors.trackingReference).toBe("Tracking reference is required for courier dispatch.");
  });

  it("does not turn processing into packed delivery status", () => {
    const result = validateDeliveryForm(
      orderWith({ sellerSplits: [{ id: "split_1", sellerStatus: "ACCEPTED" }] }),
      "PROCESSING",
      createDeliveryForm(orderWith({})),
    );

    expect(result.valid).toBe(true);
    expect(result.payload.status).toBeUndefined();
  });

  it("rejects invalid COD collected values above seller payable amount", () => {
    const result = validateDeliveryForm(
      orderWith({
        payments: [{ id: "payment_1", method: "COD", amountPaise: 10000 }],
        sellerSplits: [{ id: "split_1", sellerStatus: "DISPATCHED", sellerSubtotalPaise: 10000 }],
      }),
      "DELIVERED",
      {
        ...createDeliveryForm(orderWith({})),
        deliveryMode: "THIRD_PARTY_COURIER",
        codCollected: true,
        codCollectedAmountRupees: "120.00",
      },
    );

    expect(result.valid).toBe(false);
    expect(result.errors.codCollectedAmountRupees).toBe("Collected COD amount cannot be above this seller order total.");
  });
});

describe("packageUpdatePayload", () => {
  it("sends only positive integer package dimensions", () => {
    expect(
      packageUpdatePayload(
        {
          weightGrams: "500",
          lengthCm: "30",
          breadthCm: "0",
          heightCm: "abc",
        },
        true,
      ),
    ).toEqual({
      weightGrams: 500,
      lengthCm: 30,
      markReadyForBooking: true,
    });
  });
});

describe("buildSellerTimeline", () => {
  it("sorts and dedupes mixed shipment timeline events", () => {
    const timeline = buildSellerTimeline(
      orderWith({
        statusEvents: [
          { id: "event_1", newStatus: "ACCEPTED", note: "Accepted", createdAt: "2026-06-18T08:00:00.000Z" },
        ],
        deliveryDetail: {
          status: "DISPATCHED",
          events: [
            { id: "delivery_1", newStatus: "DISPATCHED", note: "Out", createdAt: "2026-06-18T09:00:00.000Z" },
            { id: "delivery_2", newStatus: "DISPATCHED", note: "Out", createdAt: "2026-06-18T09:00:00.000Z" },
          ],
        },
        shipments: [
          {
            id: "shipment_1",
            shipmentNumber: "SHIP-1",
            status: "PACKED",
            routedAt: "2026-06-18T10:00:00.000Z",
            packages: [
              {
                id: "package_1",
                packageNumber: "PKG-1",
                bookedAt: "2026-06-18T11:00:00.000Z",
              },
            ],
          },
        ],
      }),
    );

    expect(timeline.map((entry) => entry.status)).toEqual(["BOOKED", "PACKED", "DISPATCHED", "ACCEPTED"]);
    expect(timeline.filter((entry) => entry.status === "DISPATCHED")).toHaveLength(1);
  });
});

describe("openSellerPackageLabel", () => {
  it("downloads, shares, and deletes the temp label file", async () => {
    const writeAsStringAsync = vi.fn().mockResolvedValue(undefined);
    const deleteAsync = vi.fn().mockResolvedValue(undefined);
    const shareAsync = vi.fn().mockResolvedValue(undefined);
    const isAvailableAsync = vi.fn().mockResolvedValue(true);

    vi.doMock("expo-file-system/legacy", () => ({
      cacheDirectory: "file:///cache/",
      writeAsStringAsync,
      deleteAsync,
      EncodingType: { Base64: "base64" },
    }));
    vi.doMock("expo-sharing", () => ({
      isAvailableAsync,
      shareAsync,
    }));

    await openSellerPackageLabel(
      { bearerToken: "token" },
      "/api/seller/packages/package_1/label",
      async () => new Uint8Array([80, 68, 70]),
    );

    expect(writeAsStringAsync).toHaveBeenCalledTimes(1);
    expect(shareAsync).toHaveBeenCalledTimes(1);
    expect(deleteAsync).toHaveBeenCalledTimes(1);
    vi.doUnmock("expo-file-system/legacy");
    vi.doUnmock("expo-sharing");
  });
});

function orderWith(overrides: Partial<SellerOrder>): SellerOrder {
  return {
    id: "order_1",
    orderNumber: "ORD-1",
    status: "CONFIRMED",
    paymentStatus: "PENDING",
    deliveryStatus: "PENDING",
    currency: "INR",
    totalPaise: 10000,
    items: [],
    sellerSplits: [{ id: "split_1", sellerStatus: "ACCEPTED", sellerSubtotalPaise: 10000 }],
    shipments: [],
    payments: [],
    deliveryDetail: null,
    statusEvents: [],
    ...overrides,
  };
}
