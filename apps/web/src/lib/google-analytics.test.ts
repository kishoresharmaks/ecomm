import { describe, expect, it } from "vitest";
import { googleAnalyticsLoadPlan } from "./google-analytics";

describe("googleAnalyticsLoadPlan", () => {
  it("uses GTM as the primary deployment path to prevent duplicate direct tags", () => {
    expect(
      googleAnalyticsLoadPlan({
        googleTagManagerId: "GTM-CONTAINER1",
        googleAnalyticsId: "G-ANALYTICS1",
        googleAdsId: "AW-123456789",
        googleSearchConsoleId: "",
      }),
    ).toEqual({
      mode: "gtm",
      googleTagManagerId: "GTM-CONTAINER1",
      directGoogleIds: [],
    });
  });

  it("loads GA4 and Ads directly when no GTM container is configured", () => {
    expect(
      googleAnalyticsLoadPlan({
        googleTagManagerId: "",
        googleAnalyticsId: "G-ANALYTICS1",
        googleAdsId: "AW-123456789",
        googleSearchConsoleId: "",
      }),
    ).toEqual({
      mode: "gtag",
      googleTagManagerId: "",
      directGoogleIds: ["G-ANALYTICS1", "AW-123456789"],
    });
  });
});
