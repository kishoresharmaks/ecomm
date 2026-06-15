import { describe, expect, it } from "vitest";
import {
  assertCheckoutCartReady,
  calculateLocationConfidenceScore,
  cleanCheckoutAddressForm,
  cleanCheckoutCustomerNote,
  cleanCheckoutPaymentReference,
} from "./checkout-validation";
import type { MobileCartSummary } from "./storefront-api";

describe("mobile checkout validation", () => {
  it("normalizes and validates Indian delivery addresses", () => {
    expect(
      cleanCheckoutAddressForm({
        area: " Mettu Street ",
        city: " Salem ",
        country: " India ",
        countryCode: " in ",
        fullName: " Kishore ",
        line2: " Near bus stand ",
        line1: " 12 Market Street ",
        stateCode: " IN-TN ",
        cityCode: " IN-TN-SA ",
        localAreaCode: " IN-TN-SA-METTU ",
        latitude: 11.6643,
        longitude: 78.146,
        locationSource: "GPS",
        accuracyMeters: 12.4,
        locationConfidenceScore: 88,
        phone: "+91 98765 43210",
        pincode: "636 114",
        state: " Tamil Nadu ",
        isDefault: true,
      }),
    ).toMatchObject({
      area: "Mettu Street",
      city: "Salem",
      cityCode: "IN-TN-SA",
      countryCode: "IN",
      fullName: "Kishore",
      isDefault: true,
      latitude: 11.6643,
      line2: "Near bus stand",
      localAreaCode: "IN-TN-SA-METTU",
      locationConfidenceScore: 88,
      locationSource: "GPS",
      longitude: 78.146,
      phone: "9876543210",
      pincode: "636114",
      stateCode: "IN-TN",
    });

    expect(() =>
      cleanCheckoutAddressForm({
        city: "Salem",
        fullName: "Kishore",
        line1: "12 Market Street",
        phone: "12345",
        pincode: "636114",
        state: "Tamil Nadu",
      }),
    ).toThrow("valid 10-digit Indian mobile");

    expect(() =>
      cleanCheckoutAddressForm({
        city: "Salem",
        fullName: "Kishore",
        line1: "12 Market Street",
        phone: "9876543210",
        pincode: "6361",
        state: "Tamil Nadu",
      }),
    ).toThrow("valid 6-digit pincode");
  });

  it("calculates deterministic GPS confidence scores", () => {
    expect(calculateLocationConfidenceScore(0)).toBe(100);
    expect(calculateLocationConfidenceScore(24.5)).toBe(76);
    expect(calculateLocationConfidenceScore(100)).toBe(0);
    expect(calculateLocationConfidenceScore(250)).toBe(0);
    expect(calculateLocationConfidenceScore(null)).toBe(0);
  });

  it("validates payment references and customer notes", () => {
    expect(cleanCheckoutPaymentReference(" UTR-1234/AB ", { required: true })).toBe("UTR-1234/AB");
    expect(cleanCheckoutPaymentReference("", { required: false })).toBeNull();
    expect(() => cleanCheckoutPaymentReference("", { required: true })).toThrow("reference or UTR");
    expect(() => cleanCheckoutPaymentReference("<script>", { required: false })).toThrow("valid payment reference");

    expect(cleanCheckoutCustomerNote(" Leave at reception\nCall first ")).toBe("Leave at reception\nCall first");
    expect(cleanCheckoutCustomerNote("")).toBeNull();
    expect(() => cleanCheckoutCustomerNote("<b>hello</b>")).toThrow("HTML characters");
    expect(() => cleanCheckoutCustomerNote("a".repeat(501))).toThrow("500 characters or less");
  });

  it("blocks empty, stale, or unavailable checkout carts", () => {
    const visibleCart = checkoutCart({ quantity: 1, stockQuantity: 5, unitPricePaise: 1000 });
    const latestCart = checkoutCart({ quantity: 1, stockQuantity: 5, unitPricePaise: 1000 });

    expect(() => assertCheckoutCartReady(latestCart, visibleCart)).not.toThrow();
    expect(() => assertCheckoutCartReady({ ...latestCart, items: [] })).toThrow("Cart is empty");
    expect(() => assertCheckoutCartReady(checkoutCart({ quantity: 6, stockQuantity: 5, unitPricePaise: 1000 }))).toThrow(
      "selected quantity",
    );
    expect(() => assertCheckoutCartReady(checkoutCart({ quantity: 1, stockQuantity: 5, unitPricePaise: 1200 }), visibleCart)).toThrow(
      "Cart changed",
    );
  });
});

function checkoutCart(input: { quantity: number; stockQuantity: number; unitPricePaise: number }): MobileCartSummary {
  return {
    id: "cart_1",
    status: "ACTIVE",
    items: [
      {
        id: "item_1",
        quantity: input.quantity,
        unitPricePaise: input.unitPricePaise,
        productVariant: {
          id: "variant_1",
          pricePaise: input.unitPricePaise,
          status: "ACTIVE",
          stockQuantity: input.stockQuantity,
          product: {
            id: "product_1",
            images: [],
            name: "Test Product",
            slug: "test-product",
          },
        },
      },
    ],
  };
}
