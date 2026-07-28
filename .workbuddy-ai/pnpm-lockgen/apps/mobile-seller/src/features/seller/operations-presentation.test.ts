import { describe, expect, it } from "vitest";
import {
  addDaysToDateInput,
  dateInputFromIso,
  formatServiceCalendarDateTime,
  humanizeStatus,
  localDateTimeToIso,
  matchesSellerOrderFilter,
  operationStatus,
  primaryServiceImage,
  serviceListingQuery,
  timeInputFromIso,
  timeValueToMinute,
} from "./operations-presentation";
import type { SellerOrder, SellerServiceListing } from "./seller-api";

describe("seller operations presentation", () => {
  it("presents operational statuses with readable labels and tones", () => {
    expect(humanizeStatus("PENDING_REVIEW")).toBe("Pending Review");
    expect(operationStatus("DELIVERED")).toEqual({ label: "Delivered", tone: "success" });
    expect(operationStatus("REJECTED")).toEqual({ label: "Rejected", tone: "danger" });
  });

  it("filters seller orders by the seller-specific fulfilment stage", () => {
    const pending = orderWith("PENDING");
    const processing = orderWith("PROCESSING");
    const delivered = orderWith("DELIVERED");
    expect(matchesSellerOrderFilter(pending, "needs-action")).toBe(true);
    expect(matchesSellerOrderFilter(processing, "processing")).toBe(true);
    expect(matchesSellerOrderFilter(delivered, "delivered")).toBe(true);
    expect(matchesSellerOrderFilter(delivered, "needs-action")).toBe(false);
  });

  it("uses primary and ordered service-image fallbacks", () => {
    const service = {
      ...serviceWith(),
      images: [
        { url: "second.jpg", sortOrder: 2 },
        { url: "primary.jpg", sortOrder: 3, isPrimary: true },
        { url: "first.jpg", sortOrder: 1 },
      ],
    };
    expect(primaryServiceImage(service)).toBe("primary.jpg");
    expect(primaryServiceImage({ ...service, images: service.images.filter((image) => !image.isPrimary) })).toBe("first.jpg");
    expect(primaryServiceImage({ ...service, images: [] })).toBeNull();
  });

  it("maps service catalogue filters and trimmed search to API queries", () => {
    expect(serviceListingQuery("all", "  repair  ")).toEqual({ search: "repair" });
    expect(serviceListingQuery("live", "")).toEqual({
      status: "ACTIVE",
      approvalStatus: "APPROVED",
    });
    expect(serviceListingQuery("under-review", "")).toEqual({
      approvalStatus: "PENDING_APPROVAL",
    });
    expect(serviceListingQuery("rejected", "")).toEqual({
      approvalStatus: "REJECTED",
    });
  });

  it("converts readable local schedule inputs without exposing ISO strings", () => {
    const iso = localDateTimeToIso("2026-07-27", "10:30");
    expect(iso).toBe("2026-07-27T05:00:00.000Z");
    expect(dateInputFromIso(iso)).toBe("2026-07-27");
    expect(timeInputFromIso(iso)).toBe("10:30");
    expect(formatServiceCalendarDateTime(iso)).toContain("27 Jul 2026");
    expect(addDaysToDateInput("2026-07-31", 1)).toBe("2026-08-01");
    expect(timeValueToMinute("10:30")).toBe(630);
    expect(timeValueToMinute("24:00")).toBe(1440);
    expect(timeValueToMinute("25:00")).toBeNull();
    expect(() => localDateTimeToIso("27-07-2026", "10:30")).toThrow();
    expect(() => localDateTimeToIso("2026-02-30", "10:30")).toThrow();
  });
});

function orderWith(sellerStatus: string): SellerOrder {
  return {
    id: `order-${sellerStatus}`,
    orderNumber: `ORDER-${sellerStatus}`,
    sellerSplits: [{ id: "split-1", sellerStatus }],
  };
}

function serviceWith(): SellerServiceListing {
  return {
    id: "service-1",
    sellerId: "seller-1",
    categoryId: "category-1",
    title: "AC repair",
    slug: "ac-repair",
    description: "Doorstep repair",
    status: "ACTIVE",
    approvalStatus: "APPROVED",
    pricingModel: "FIXED_PRICE",
    paymentMode: "FULL_PAYMENT",
    cancellationPolicy: "FLEXIBLE",
    taxClassification: "TAXABLE",
    currency: "INR",
    allowedVisitModes: ["CUSTOMER_LOCATION"],
  };
}
