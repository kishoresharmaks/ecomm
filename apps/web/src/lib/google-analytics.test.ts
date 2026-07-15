import { describe, expect, it } from "vitest";
import {
  googleAnalyticsHeadBootstrapScript,
  googleAnalyticsLoadPlan,
  primaryGoogleAnalyticsId,
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

  it("does not initialize GA4 twice when the primary tag is installed in the document head", () => {
    expect(
      googleAnalyticsLoadPlan(
        {
          googleTagManagerId: "",
          googleAnalyticsId: primaryGoogleAnalyticsId,
          googleAdsId: "AW-123456789",
          googleSearchConsoleId: "",
        },
        { googleAnalyticsInstalledInHead: true },
      ),
    ).toEqual({
      mode: "gtag",
      googleTagManagerId: "",
      directGoogleIds: ["AW-123456789"],
    });
  });

  it("builds the fixed head bootstrap with consent denied before configuration", () => {
    const script = googleAnalyticsHeadBootstrapScript();

    expect(script).toContain(`gtag('config', '${primaryGoogleAnalyticsId}'`);
    expect(script.indexOf("gtag('consent', 'default'")).toBeLessThan(script.indexOf("gtag('config'"));
    expect(script).toContain("analytics_storage: 'denied'");
    expect(script).toContain("send_page_view: false");
  });
});
