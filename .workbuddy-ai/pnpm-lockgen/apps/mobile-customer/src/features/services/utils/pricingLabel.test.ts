import { describe, expect, it } from "vitest";
import { getPricingLabel } from "./pricingLabel";
import type { MobileServiceListing } from "../types";

const baseService: MobileServiceListing = {
  id: "service-1",
  slug: "tv-repair",
  name: "TV repair",
  description: "Repair",
  categoryName: "Electronics",
  sellerName: "Provider",
  pricingModel: "fixed_price",
  paymentMode: "FULL_PAYMENT",
  basePricePaise: 149900,
  inspectionFeePaise: null,
  advanceAmountPaise: null,
  currency: "INR",
  coverImageUrl: null,
  isActive: true,
  visitModes: ["customer_location"],
  serviceRating: null,
  serviceReviewCount: 0,
  serviceability: null,
};

describe("getPricingLabel", () => {
  it("formats fixed price", () => {
    expect(getPricingLabel(baseService)).toContain("1,499");
  });

  it("uses selected package price over base price", () => {
    expect(
      getPricingLabel(baseService, {
        id: "pkg",
        name: "Premium",
        description: null,
        pricePaise: 249900,
        currency: "INR",
        durationMinutes: null,
      }),
    ).toContain("2,499");
  });

  it("shows quote-first label", () => {
    expect(getPricingLabel({ ...baseService, pricingModel: "quote_first", basePricePaise: null })).toBe("Price on quote");
  });

  it("shows inspection fee label", () => {
    expect(getPricingLabel({ ...baseService, pricingModel: "inspection_fee", inspectionFeePaise: 29900 })).toContain("Inspection:");
  });

  it("shows unavailable fallback for null fixed price", () => {
    expect(getPricingLabel({ ...baseService, basePricePaise: null })).toBe("Price unavailable");
  });
});
