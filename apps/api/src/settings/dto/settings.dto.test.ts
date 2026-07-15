import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { UpsertSeoAnalyticsSettingsDto } from "./settings.dto";

describe("UpsertSeoAnalyticsSettingsDto", () => {
  it("accepts correctly classified Google integration identifiers", async () => {
    const dto = Object.assign(new UpsertSeoAnalyticsSettingsDto(), {
      googleTagManagerId: "GTM-WFXLFC8X",
      googleAnalyticsId: "G-TEST123456",
      googleAdsId: "AW-123456789",
      googleSearchConsoleId: "verification_token-1",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects a Google Ads ID pasted into GA4 and GTM fields", async () => {
    const dto = Object.assign(new UpsertSeoAnalyticsSettingsDto(), {
      googleTagManagerId: "AW-123456789",
      googleAnalyticsId: "AW-123456789",
      googleAdsId: "",
      googleSearchConsoleId: "",
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["googleTagManagerId", "googleAnalyticsId"]),
    );
  });
});
