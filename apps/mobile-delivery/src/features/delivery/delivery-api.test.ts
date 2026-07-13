import { describe, expect, it } from "vitest";
import {
  sellerToCustomerDistanceLabel,
  sellerToCustomerDistancesKm,
  type DeliveryOrder,
} from "./delivery-api";

const baseOrder: DeliveryOrder = {
  id: "order_1",
  orderNumber: "ORD-1",
  orderStatus: "CONFIRMED",
  paymentStatus: "PENDING",
  deliveryStatus: "PENDING",
  totalPaise: 10000,
  currency: "INR",
  shippingAddressSnapshot: {
    fullName: "Customer",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  shipments: [
    {
      id: "shipment_1",
      shipmentNumber: "SHP-1",
      sellerId: "seller_1",
      seller: {
        id: "seller_1",
        storeName: "Seller",
        pickupAddress: {
          latitude: 12.9352,
          longitude: 77.6245,
        },
      },
      subtotalPaise: 10000,
      shippingPaise: 0,
      codSurchargePaise: 0,
      deliveryMode: "LOCAL_DELIVERY_PARTNER",
      status: "PENDING",
    },
  ],
};

describe("sellerToCustomerDistanceLabel", () => {
  it("returns an approximate seller-to-customer distance in km", () => {
    expect(sellerToCustomerDistancesKm(baseOrder)[0]).toBeGreaterThan(5);
    expect(sellerToCustomerDistanceLabel(baseOrder)).toMatch(/^Approx seller to customer: \d+\.\d km$/);
  });

  it("returns null when either pickup or customer coordinates are missing", () => {
    expect(sellerToCustomerDistanceLabel({ ...baseOrder, shippingAddressSnapshot: null })).toBeNull();
    expect(sellerToCustomerDistanceLabel({ ...baseOrder, shipments: [] })).toBeNull();
  });
});
