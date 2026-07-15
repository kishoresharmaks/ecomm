import { describe, expect, it } from "vitest";
import {
  googleConsentDefaultScript,
  googleTagManagerHeadBootstrapScript,
  primaryGoogleAdsId,
  primaryGoogleAnalyticsId,
  primaryGoogleTagManagerId,
} from "./google-analytics";

describe("Google Tag Manager bootstrap", () => {
  it("loads the published GTM container after consent defaults without direct destination configs", () => {
    const consentScript = googleConsentDefaultScript();
    const gtmScript = googleTagManagerHeadBootstrapScript();

    expect(primaryGoogleTagManagerId).toBe("GTM-WFXLFC8X");
    expect(primaryGoogleAdsId).toBe("AW-18165667075");
    expect(primaryGoogleAnalyticsId).toBe("G-MR1H66G0DZ");
    expect(consentScript).toContain("gtag('consent', 'default'");
    expect(consentScript).toContain("analytics_storage: 'denied'");
    expect(gtmScript).toContain(`'${primaryGoogleTagManagerId}'`);
    expect(gtmScript).toContain("https://www.googletagmanager.com/gtm.js?id=");
    expect(gtmScript).toContain("(function(w,d,s,l,i)");
    expect(gtmScript).not.toContain("gtag('config'");
  });
});
