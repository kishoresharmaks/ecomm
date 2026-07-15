import { describe, expect, it } from "vitest";
import {
  googleAnalyticsHeadBootstrapScript,
  googleAnalyticsLoadPlan,
  primaryGoogleAdsId,
  primaryGoogleAnalyticsId,
  primaryGoogleTagId,
} from "./google-analytics";

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

  it("does not initialize fixed Google destinations twice when the primary tag is installed in the document head", () => {
    expect(
      googleAnalyticsLoadPlan(
        {
          googleTagManagerId: "",
          googleAnalyticsId: primaryGoogleAnalyticsId,
          googleAdsId: "AW-123456789",
          googleSearchConsoleId: "",
        },
        {
          googleAnalyticsInstalledInHead: true,
          googleAdsInstalledInHead: true,
        },
      ),
    ).toEqual({
      mode: "none",
      googleTagManagerId: "",
      directGoogleIds: [],
    });
  });

  it("builds one fixed Google tag with Ads and GA4 destinations after consent defaults", () => {
    const script = googleAnalyticsHeadBootstrapScript();

    expect(primaryGoogleTagId).toBe(primaryGoogleAdsId);
    expect(script).toContain(`gtag('config', '${primaryGoogleAdsId}'`);
    expect(script).toContain(`gtag('config', '${primaryGoogleAnalyticsId}'`);
    expect(script.indexOf("gtag('consent', 'default'")).toBeLessThan(script.indexOf("gtag('config'"));
    expect(script).toContain("analytics_storage: 'denied'");
    expect(script).not.toContain("send_page_view: false");
  });
});
