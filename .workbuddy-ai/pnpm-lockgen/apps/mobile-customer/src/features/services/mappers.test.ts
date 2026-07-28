import { describe, expect, it } from "vitest";
import {
  mapBookingStatus,
  mapServicePayment,
  mapServiceQuote,
  mapPricingModel,
  mapVisitMode,
  ServiceMappingError,
  toBackendVisitMode,
} from "./mappers";

describe("service mappers", () => {
  it("maps pricing models", () => {
    expect(mapPricingModel("FIXED_PRICE")).toBe("fixed_price");
    expect(mapPricingModel("QUOTE_FIRST")).toBe("quote_first");
    expect(mapPricingModel("INSPECTION_FEE")).toBe("inspection_fee");
  });

  it("maps visit modes both ways", () => {
    expect(mapVisitMode("CUSTOMER_LOCATION")).toBe("customer_location");
    expect(mapVisitMode("PROVIDER_LOCATION")).toBe("provider_location");
    expect(mapVisitMode("REMOTE")).toBe("remote");
    expect(toBackendVisitMode("customer_location")).toBe("CUSTOMER_LOCATION");
    expect(toBackendVisitMode("provider_location")).toBe("PROVIDER_LOCATION");
    expect(toBackendVisitMode("remote")).toBe("REMOTE");
  });

  it("maps all booking statuses", () => {
    expect(mapBookingStatus("REQUESTED")).toBe("requested");
    expect(mapBookingStatus("ACCEPTED")).toBe("accepted");
    expect(mapBookingStatus("QUOTE_SENT")).toBe("quote_sent");
    expect(mapBookingStatus("QUOTE_ACCEPTED")).toBe("quote_accepted");
    expect(mapBookingStatus("QUOTE_EXPIRED")).toBe("quote_expired");
    expect(mapBookingStatus("QUOTE_REJECTED")).toBe("quote_rejected");
    expect(mapBookingStatus("CLOSED_AFTER_INSPECTION")).toBe("closed_after_inspection");
    expect(mapBookingStatus("REJECTED")).toBe("rejected");
    expect(mapBookingStatus("CANCELLED")).toBe("cancelled");
    expect(mapBookingStatus("SCHEDULED")).toBe("scheduled");
    expect(mapBookingStatus("IN_PROGRESS")).toBe("in_progress");
    expect(mapBookingStatus("COMPLETION_SUBMITTED")).toBe("completion_submitted");
    expect(mapBookingStatus("COMPLETION_DISPUTED")).toBe("completion_disputed");
    expect(mapBookingStatus("COMPLETED")).toBe("completed");
    expect(mapBookingStatus("CANCELLED_AFTER_DISPUTE")).toBe("cancelled_after_dispute");
  });

  it("throws a typed error for unknown raw values", () => {
    expect(() => mapPricingModel("NEW_MODEL" as never)).toThrow(ServiceMappingError);
  });

  it("does not reuse payment reference numbers as descriptions", () => {
    expect(
      mapServicePayment({
        id: "payment-1",
        amountPaise: 50000,
        currency: "INR",
        status: "PENDING",
        referenceNumber: "UTR123",
      }).description,
    ).toBeNull();

    expect(
      mapServicePayment({
        id: "payment-2",
        amountPaise: 50000,
        currency: "INR",
        status: "PAID",
        referenceNumber: "UTR123",
        description: "Inspection fee",
      }).description,
    ).toBe("Inspection fee");
  });

  it("hydrates mixed quote tax lines", () => {
    const quote = mapServiceQuote({
      id: "quote-1",
      quoteNumber: "SQ-1001",
      revisionNumber: 2,
      status: "SENT",
      subtotalPaise: 236000,
      totalPaise: 236000,
      currency: "INR",
      lineItems: [
        {
          id: "line-service",
          lineType: "SERVICE",
          description: "Repair labour",
          quantity: 1,
          unitPaise: 118000,
          totalPaise: 118000,
          hsnSacCode: "998719",
          taxClassification: "TAXABLE",
          gstRatePercent: "18",
          taxableValuePaise: 100000,
          taxTotalPaise: 18000,
        },
        {
          id: "line-product",
          lineType: "PRODUCT",
          description: "Replacement part",
          quantity: 1,
          unitPaise: 118000,
          totalPaise: 118000,
          hsnSacCode: "8504",
          taxClassification: "TAXABLE",
          gstRatePercent: 18,
          taxableValuePaise: 100000,
          taxTotalPaise: 18000,
        },
      ],
    });

    expect(quote.quoteNumber).toBe("SQ-1001");
    expect(quote.revisionNumber).toBe(2);
    expect(quote.lines.map((line) => [line.lineType, line.hsnSacCode, line.taxTotalPaise])).toEqual([
      ["service", "998719", 18000],
      ["product", "8504", 18000],
    ]);
  });
});
