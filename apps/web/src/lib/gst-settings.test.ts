import { describe, expect, it } from "vitest";
import {
  gstSettingsValidationError,
  paiseToRupeesInput,
  rupeesToPaise,
  type GstSettings,
} from "./gst-settings";

const settings: GstSettings = {
  platform: {
    legalName: "1HandIndia Private Limited",
    gstin: "33ABCDE1234F1Z5",
    stateCode: "33",
    address: {
      line1: "12 Marketplace Avenue",
      line2: "",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600001",
      country: "India",
    },
  },
  eInvoice: { enabled: true, provider: "MANUAL" },
  eWayBill: { enabled: true, provider: "MANUAL", thresholdPaise: 5_000_000 },
};

describe("GST settings presentation", () => {
  it("converts the administrator INR input to stored paise", () => {
    expect(paiseToRupeesInput(5_000_000)).toBe("50000");
    expect(rupeesToPaise("50000.25")).toBe(5_000_025);
    expect(rupeesToPaise("-1")).toBeNull();
  });

  it("validates the GSTIN state prefix and registered address", () => {
    expect(gstSettingsValidationError(settings)).toBeNull();
    expect(
      gstSettingsValidationError({
        ...settings,
        platform: { ...settings.platform, stateCode: "29" },
      }),
    ).toBe("The GSTIN state prefix must match the GST state code.");
  });
});
