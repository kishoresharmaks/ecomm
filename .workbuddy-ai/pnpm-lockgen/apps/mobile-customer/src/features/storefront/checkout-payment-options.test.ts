import { describe, expect, it } from "vitest";
import { checkoutPaymentOptions } from "./checkout-payment-options";
import type { MobileCheckoutPaymentMethodsResponse } from "./storefront-api";

describe("checkoutPaymentOptions", () => {
  it("keeps Razorpay in backend-provided checkout methods", () => {
    const response: MobileCheckoutPaymentMethodsResponse = {
      methods: [
        { method: "RAZORPAY", label: "Razorpay", enabled: true, note: "Pay online." },
        { method: "COD", label: "Cash on delivery", enabled: true, note: "Pay at delivery." },
      ],
    };

    expect(checkoutPaymentOptions(response, false).map((method) => method.method)).toEqual(["RAZORPAY", "COD"]);
  });

  it("falls back only when backend methods are still loading", () => {
    expect(checkoutPaymentOptions(undefined, false).map((method) => method.method)).toEqual(["COD", "MANUAL"]);
    expect(checkoutPaymentOptions(undefined, true)).toEqual([]);
  });
});
