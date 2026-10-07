import { describe, expect, it } from "vitest";
import { getEffectivePaymentStatus, statusTone } from "./admin-order-utils";

describe("getEffectivePaymentStatus", () => {
  it("returns REFUNDED when paymentStatus is explicitly REFUNDED", () => {
    expect(
      getEffectivePaymentStatus({
        orderStatus: "CANCELLED",
        paymentStatus: "REFUNDED",
      }),
    ).toBe("REFUNDED");
  });

  it("returns REFUNDED when a paid order was cancelled", () => {
    expect(
      getEffectivePaymentStatus({
        orderStatus: "CANCELLED",
        paymentStatus: "PAID",
      }),
    ).toBe("REFUNDED");
  });

  it("returns REFUNDED when payments array has a refunded payment", () => {
    expect(
      getEffectivePaymentStatus({
        orderStatus: "CANCELLED",
        paymentStatus: "PAID",
        payments: [{ status: "REFUNDED" }],
      }),
    ).toBe("REFUNDED");
  });

  it("returns REFUNDED when refundRequests contains an approved/successful refund", () => {
    expect(
      getEffectivePaymentStatus({
        orderStatus: "CANCELLED",
        paymentStatus: "PAID",
        refundRequests: [{ status: "SUCCESS" }],
      }),
    ).toBe("REFUNDED");
  });

  it("returns REFUND_PENDING when refund is being processed", () => {
    expect(
      getEffectivePaymentStatus({
        orderStatus: "PROCESSING",
        paymentStatus: "PAID",
        refundRequests: [{ status: "PROCESSING" }],
      }),
    ).toBe("REFUND_PENDING");
  });

  it("retains PENDING for unpaid or COD orders that were cancelled", () => {
    expect(
      getEffectivePaymentStatus({
        orderStatus: "CANCELLED",
        paymentStatus: "PENDING",
      }),
    ).toBe("PENDING");
  });
});

describe("statusTone mapping for refunds", () => {
  it("maps REFUNDED to danger tone", () => {
    expect(statusTone("REFUNDED")).toBe("danger");
  });

  it("maps REFUND_PENDING to warning tone", () => {
    expect(statusTone("REFUND_PENDING")).toBe("warning");
  });
});
