import { describe, expect, it } from "vitest";
import {
  gstinPattern,
  normalizeGstin,
  validateGstInvoiceDetails,
} from "./gst-invoice";

describe("GST invoice validation", () => {
  it("normalizes spaces and casing in GSTIN values", () => {
    expect(normalizeGstin("29 abcde 1234 f1z5")).toBe("29ABCDE1234F1Z5");
    expect(gstinPattern.test("29ABCDE1234F1Z5")).toBe(true);
  });

  it("returns normalized invoice details for a valid business buyer", () => {
    expect(
      validateGstInvoiceDetails(
        "29 abcde 1234 f1z5",
        "  Buyer   Registered Private Limited  ",
      ),
    ).toEqual({
      details: {
        buyerGstin: "29ABCDE1234F1Z5",
        buyerLegalName: "Buyer Registered Private Limited",
      },
    });
  });

  it("rejects an invalid GSTIN", () => {
    expect(validateGstInvoiceDetails("invalid", "Buyer Limited")).toEqual({
      error: "Enter a valid 15-character GSTIN.",
    });
  });

  it("requires the registered legal name", () => {
    expect(validateGstInvoiceDetails("29ABCDE1234F1Z5", " ")).toEqual({
      error: "Enter the registered legal name for the GST invoice.",
    });
  });
});
