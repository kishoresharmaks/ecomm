import { describe, expect, it, vi } from "vitest";
import {
  gstSettingKeys,
  isConfiguredPlatformGst,
  normalizeGstSettings,
  readGstSettings,
} from "./gst-settings";

describe("GST settings", () => {
  it("coerces legacy values and applies safe manual defaults", async () => {
    const client = {
      setting: {
        findMany: vi.fn(async () => [
          { key: gstSettingKeys.eInvoiceEnabled, value: "true" },
          { key: gstSettingKeys.eWayBillEnabled, value: 1 },
          { key: gstSettingKeys.eWayBillThresholdPaise, value: "7500000" },
        ]),
      },
    };

    await expect(readGstSettings(client)).resolves.toMatchObject({
      eInvoice: { enabled: true, provider: "MANUAL" },
      eWayBill: {
        enabled: true,
        provider: "MANUAL",
        thresholdPaise: 7_500_000,
      },
    });
  });

  it("normalizes platform values and detects complete configuration", () => {
    const settings = normalizeGstSettings({
      platform: {
        legalName: "  1HandIndia   Private Limited ",
        gstin: "33abcde1234f1z5",
        stateCode: "33",
        address: {
          line1: " 12  Marketplace Avenue ",
          line2: "",
          city: " Chennai ",
          state: " Tamil Nadu ",
          postalCode: "600001",
          country: "India",
        },
      },
      eInvoice: { enabled: true, provider: "MANUAL" },
      eWayBill: { enabled: true, provider: "MANUAL", thresholdPaise: 5_000_000 },
    });

    expect(settings.platform).toMatchObject({
      legalName: "1HandIndia Private Limited",
      gstin: "33ABCDE1234F1Z5",
      stateCode: "33",
      address: {
        line1: "12 Marketplace Avenue",
        city: "Chennai",
        state: "Tamil Nadu",
      },
    });
    expect(isConfiguredPlatformGst(settings)).toBe(true);
    expect(
      isConfiguredPlatformGst({
        ...settings,
        platform: { ...settings.platform, stateCode: "29" },
      }),
    ).toBe(false);
  });
});
