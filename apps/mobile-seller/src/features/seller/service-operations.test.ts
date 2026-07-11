import { describe, expect, it } from "vitest";
import { availableServiceBookingActions, buildServicePayload, createServiceForm } from "./service-operations";

describe("service operations", () => {
  it("builds an approval-ready service payload from mobile form values", () => {
    const payload = buildServicePayload({
      ...createServiceForm(),
      categoryId: "cat_1",
      title: "AC repair",
      description: "Doorstep AC inspection and repair support.",
      pricingModel: "INSPECTION_FEE",
      paymentMode: "INSPECTION_FEE",
      basePrice: "",
      inspectionFee: "299",
      advanceAmount: "",
      allowedVisitModes: ["CUSTOMER_LOCATION"],
      imageUrl: "seller-products/ac-repair.jpg",
      packageName: "Standard inspection",
      packagePrice: "299",
      areaLabel: "Salem service area",
      areaPincode: "636001",
      areaRadiusKm: "12",
    });

    expect(payload).toMatchObject({
      categoryId: "cat_1",
      title: "AC repair",
      pricingModel: "INSPECTION_FEE",
      paymentMode: "INSPECTION_FEE",
      inspectionFeePaise: 29900,
      allowedVisitModes: ["CUSTOMER_LOCATION"],
    });
    expect(payload.images?.[0]).toMatchObject({ url: "seller-products/ac-repair.jpg", isPrimary: true });
    expect(payload.packages?.[0]).toMatchObject({ name: "Standard inspection", pricePaise: 29900 });
    expect(payload.areas?.[0]).toMatchObject({ label: "Salem service area", pincode: "636001", radiusKm: 12 });
  });

  it("exposes only valid seller actions for service booking states", () => {
    expect(availableServiceBookingActions("REQUESTED")).toEqual(["ACCEPT", "REJECT", "CANCEL"]);
    expect(availableServiceBookingActions("QUOTE_SENT")).toEqual(["WITHDRAW_QUOTE", "FIELD_STATUS", "CANCEL", "PAYMENT"]);
    expect(availableServiceBookingActions("COMPLETED")).toEqual([]);
  });
});
