import { describe, expect, it } from "vitest";
import {
  canCustomerSelfCancelOrder,
  customerCancellationUnavailableReason,
  dispatchedCancellationMessage,
  hasOrderLeftSeller,
} from "./order-cancellation";

describe("order cancellation eligibility", () => {
  it("allows customer self cancellation before dispatch", () => {
    expect(
      canCustomerSelfCancelOrder({
        orderStatus: "CONFIRMED",
        deliveryStatus: "PACKED",
        sellerSplits: [{ sellerStatus: "PROCESSING" }],
        shipments: [{ status: "PACKED" }],
      }),
    ).toBe(true);
  });

  it("blocks customer self cancellation once any seller package is dispatched", () => {
    const order = {
      orderStatus: "CONFIRMED",
      deliveryStatus: "PACKED",
      sellerSplits: [{ sellerStatus: "PROCESSING" }, { sellerStatus: "DISPATCHED" }],
      shipments: [{ status: "PACKED" }, { status: "DISPATCHED" }],
    };

    expect(hasOrderLeftSeller(order)).toBe(true);
    expect(canCustomerSelfCancelOrder(order)).toBe(false);
    expect(customerCancellationUnavailableReason(order)).toBe(dispatchedCancellationMessage);
  });
});
