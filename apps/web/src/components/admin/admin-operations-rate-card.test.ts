import { describe, expect, it } from "vitest";

// Exact types copied from apps/web/src/components/admin/admin-operations.tsx
type RateFormState = {
  name: string;
  deliveryMode: string;
  isActive: boolean;
  countryCode: string;
  stateCode: string;
  cityCode: string;
  pincode: string;
  localAreaCode: string;
  minSubtotalRupees: string;
  maxSubtotalRupees: string;
  maxWeightKg: string;
  pricingType: string;
  shippingRupees: string;
  includedDistanceKm: string;
  perKmRupees: string;
  freeAboveRupees: string;
  codFlatRupees: string;
  priority: string;
};

// Helper functions copied exactly from apps/web/src/components/admin/admin-operations.tsx
function defaultRateForm(): RateFormState {
  return {
    name: "Default local delivery",
    deliveryMode: "LOCAL_DELIVERY_PARTNER",
    isActive: true,
    countryCode: "IN",
    stateCode: "",
    cityCode: "",
    pincode: "",
    localAreaCode: "",
    minSubtotalRupees: "",
    maxSubtotalRupees: "",
    maxWeightKg: "",
    pricingType: "FLAT",
    shippingRupees: "49",
    includedDistanceKm: "3",
    perKmRupees: "8",
    freeAboveRupees: "",
    codFlatRupees: "",
    priority: "100",
  };
}

function rupeesInputToPaise(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function optionalRupeesInputToPaise(value: string) {
  return value.trim() ? rupeesInputToPaise(value) : undefined;
}

function emptyToUndefined(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function rateCardPayloadFromForm(form: RateFormState) {
  return {
    name: form.name.trim(),
    deliveryMode: form.deliveryMode,
    countryCode: emptyToUndefined(form.countryCode.toUpperCase()),
    stateCode: emptyToUndefined(form.stateCode.toUpperCase()),
    cityCode: emptyToUndefined(form.cityCode.toUpperCase()),
    pincode: emptyToUndefined(form.pincode),
    localAreaCode: emptyToUndefined(form.localAreaCode.toUpperCase()),
    minSubtotalPaise: optionalRupeesInputToPaise(form.minSubtotalRupees),
    maxSubtotalPaise: optionalRupeesInputToPaise(form.maxSubtotalRupees),
    maxWeightKg: form.maxWeightKg ? Number(form.maxWeightKg) : undefined,
    pricingType: form.pricingType || "FLAT",
    baseChargePaise: rupeesInputToPaise(form.shippingRupees),
    pricingConfig: form.pricingType === "DISTANCE"
      ? {
          includedDistanceKm: Number(form.includedDistanceKm) || 3,
          perKmPaise: rupeesInputToPaise(form.perKmRupees),
        }
      : undefined,
    freeAbovePaise: optionalRupeesInputToPaise(form.freeAboveRupees),
    codSurchargeType: form.codFlatRupees.trim() ? "FLAT" : "NONE",
    codSurchargeFlatPaise: optionalRupeesInputToPaise(form.codFlatRupees) ?? 0,
    priority: Number(form.priority) || 100,
    isActive: form.isActive,
  };
}

function paiseToRupeesInput(value?: number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  return Number.isInteger(value / 100) ? String(value / 100) : (value / 100).toFixed(2);
}

describe("Admin Operations Rate Card logic verification", () => {
  describe("Toggling FLAT and DISTANCE", () => {
    it("excludes pricingConfig entirely when pricingType is FLAT", () => {
      const form = defaultRateForm();
      form.pricingType = "FLAT";
      form.includedDistanceKm = "10";
      form.perKmRupees = "15";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingType).toBe("FLAT");
      expect(payload.pricingConfig).toBeUndefined();
    });

    it("includes pricingConfig when pricingType is DISTANCE", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.includedDistanceKm = "5";
      form.perKmRupees = "12";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingType).toBe("DISTANCE");
      expect(payload.pricingConfig).toEqual({
        includedDistanceKm: 5,
        perKmPaise: 1200,
      });
    });
  });

  describe("Validation of Included Distance", () => {
    it("coerces empty includedDistanceKm to default 3", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.includedDistanceKm = "";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.includedDistanceKm).toBe(3);
    });

    it("coerces invalid string includedDistanceKm to default 3", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.includedDistanceKm = "invalid";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.includedDistanceKm).toBe(3);
    });

    it("coerces 0 includedDistanceKm to default 3 due to logical OR check", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.includedDistanceKm = "0";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.includedDistanceKm).toBe(3);
    });

    it("accepts a positive decimal includedDistanceKm", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.includedDistanceKm = "2.5";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.includedDistanceKm).toBe(2.5);
    });

    it("sends negative includedDistanceKm directly to the backend", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.includedDistanceKm = "-5";

      const payload = rateCardPayloadFromForm(form);
      // Wait, Number("-5") is -5, which is truthy, so -5 || 3 evaluates to -5.
      expect(payload.pricingConfig?.includedDistanceKm).toBe(-5);
    });
  });

  describe("Validation of Per extra km fee", () => {
    it("coerces empty perKmRupees to 0 paise", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.perKmRupees = "";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.perKmPaise).toBe(0);
    });

    it("coerces invalid string perKmRupees to 0 paise", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.perKmRupees = "abc";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.perKmPaise).toBe(0);
    });

    it("coerces negative perKmRupees to 0 paise", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.perKmRupees = "-15";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.perKmPaise).toBe(0);
    });

    it("parses valid perKmRupees correctly to paise", () => {
      const form = defaultRateForm();
      form.pricingType = "DISTANCE";
      form.perKmRupees = "12.5";

      const payload = rateCardPayloadFromForm(form);
      expect(payload.pricingConfig?.perKmPaise).toBe(1250);
    });
  });

  describe("Default values creation vs edit mode", () => {
    it("creation mode sets correct defaults", () => {
      const form = defaultRateForm();
      expect(form.includedDistanceKm).toBe("3");
      expect(form.perKmRupees).toBe("8");
    });

    it("edit mode loads defaults when pricingConfig is missing or null (e.g. from FLAT rate card)", () => {
      // In edit mode (beginEditRateCard):
      // includedDistanceKm: String((card.pricingConfig as Record<string, unknown> | null)?.includedDistanceKm ?? 3)
      // perKmRupees: paiseToRupeesInput(((card.pricingConfig as Record<string, unknown> | null)?.perKmPaise as number | undefined) ?? 0) || "8"
      
      const pricingConfigNull = null as Record<string, unknown> | null;
      
      const loadedDistance = String((pricingConfigNull as any)?.includedDistanceKm ?? 3);
      const loadedPerKmRupeesRaw = paiseToRupeesInput((pricingConfigNull as any)?.perKmPaise ?? 0);
      const loadedPerKmRupees = loadedPerKmRupeesRaw || "8";

      expect(loadedDistance).toBe("3");
      // Wait, pricingConfigNull?.perKmPaise ?? 0 evaluates to 0.
      // paiseToRupeesInput(0) returns "0".
      // "0" || "8" evaluates to "0".
      expect(loadedPerKmRupeesRaw).toBe("0");
      expect(loadedPerKmRupees).toBe("0"); // loadedPerKmRupees will be "0", not "8"!
    });
  });
});
