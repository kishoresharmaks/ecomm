import type { SeoAnalyticsSettings } from "./seo";

export const primaryGoogleAnalyticsId = "G-MR1H66G0DZ";
export const primaryGoogleAdsId = "AW-18165667075";
export const primaryGoogleTagId = primaryGoogleAdsId;

export type GoogleAnalyticsLoadPlan =
  | { mode: "gtm"; googleTagManagerId: string; directGoogleIds: [] }
  | { mode: "gtag"; googleTagManagerId: ""; directGoogleIds: string[] }
  | { mode: "none"; googleTagManagerId: ""; directGoogleIds: [] };

export function googleAnalyticsLoadPlan(
  settings: SeoAnalyticsSettings,
  options: {
    googleAnalyticsInstalledInHead?: boolean;
    googleAdsInstalledInHead?: boolean;
  } = {},
): GoogleAnalyticsLoadPlan {
  if (settings.googleTagManagerId) {
    return {
      mode: "gtm",
      googleTagManagerId: settings.googleTagManagerId,
      directGoogleIds: [],
    };
  }

  const directGoogleIds = [
    ...(options.googleAnalyticsInstalledInHead ? [] : [settings.googleAnalyticsId]),
    ...(options.googleAdsInstalledInHead ? [] : [settings.googleAdsId]),
  ].filter(Boolean);

  if (directGoogleIds.length) {
    return {
      mode: "gtag",
      googleTagManagerId: "",
      directGoogleIds,
    };
  }

  return {
    mode: "none",
    googleTagManagerId: "",
    directGoogleIds: [],
  };
}

export function googleAnalyticsHeadBootstrapScript() {
  return `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
    gtag('js', new Date());
    gtag('config', '${primaryGoogleAdsId}');
    gtag('config', '${primaryGoogleAnalyticsId}', { anonymize_ip: true });
  `;
}
