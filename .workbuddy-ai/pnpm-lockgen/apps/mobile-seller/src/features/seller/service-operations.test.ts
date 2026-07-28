import { describe, expect, it } from "vitest";
import {
  availableServiceBookingActions,
  buildServicePayload,
  createServiceForm,
  manualSacCode,
  sacCodeFromMaster,
} from "./service-operations";

describe("service operations", () => {
  it("builds an approval-ready service payload from mobile form values", () => {
    const payload = buildServicePayload({
      ...createServiceForm(),
      categoryId: "cat_1",
      title: "AC repair",
      description: "Doorstep AC inspection and repair support.",
      pricingModel: "INSPECTION_FEE",
      paymentMode: "INSPECTION_FEE",
      cancellationPolicy: "STRICT",
      taxClassification: "TAXABLE",
      sacCode: "998719",
      gstRatePercent: "18",
      basePrice: "",
      inspectionFee: "299",
      advanceAmount: "",
      quoteTtlHours: "72",
      serviceDurationMinutes: "90",
      allowedVisitModes: ["CUSTOMER_LOCATION"],
      highlights: "Doorstep visit\nTest report",
      inclusions: "Inspection\nMinor adjustment",
      exclusions: "Replacement parts",
      requirements: "Share model number",
      imageUrl: "seller-products/ac-repair.jpg",
      packageName: "Standard inspection",
      packageDescription: "Inspection and test report",
      packagePrice: "299",
      packageMrp: "399",
      areaLabel: "Salem service area",
      areaPincode: "636001",
      areaRadiusKm: "12",
    });

    expect(payload).toMatchObject({
      categoryId: "cat_1",
      title: "AC repair",
      pricingModel: "INSPECTION_FEE",
      paymentMode: "INSPECTION_FEE",
      cancellationPolicy: "STRICT",
      sacCode: "998719",
      gstRatePercent: 18,
      inspectionFeePaise: 29900,
      quoteTtlHours: 72,
      serviceDurationMinutes: 90,
      allowedVisitModes: ["CUSTOMER_LOCATION"],
      highlights: ["Doorstep visit", "Test report"],
      inclusions: ["Inspection", "Minor adjustment"],
      exclusions: ["Replacement parts"],
      requirements: ["Share model number"],
    });
    expect(payload.images?.[0]).toMatchObject({ url: "seller-products/ac-repair.jpg", isPrimary: true });
    expect(payload.packages?.[0]).toMatchObject({
      name: "Standard inspection",
      description: "Inspection and test report",
      pricePaise: 29900,
      mrpPaise: 39900,
      durationMinutes: 90,
    });
    expect(payload.areas?.[0]).toMatchObject({ label: "Salem service area", pincode: "636001", radiusKm: 12 });
  });

  it("exposes only valid seller actions for service booking states", () => {
    expect(availableServiceBookingActions("REQUESTED")).toEqual(["ACCEPT", "REJECT", "CANCEL"]);
    expect(availableServiceBookingActions("QUOTE_SENT")).toEqual(["WITHDRAW_QUOTE", "FIELD_STATUS", "CANCEL", "PAYMENT"]);
    expect(availableServiceBookingActions("COMPLETED")).toEqual([]);
  });

  it("supports manual SAC entry and catalogue selection", () => {
    expect(manualSacCode("99A871923")).toBe("998719");
    expect(sacCodeFromMaster({ sacCode: "9987-19" })).toBe("998719");
  });
});
