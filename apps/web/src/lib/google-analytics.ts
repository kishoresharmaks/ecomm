import type { SeoAnalyticsSettings } from "./seo";

export type GoogleAnalyticsLoadPlan =
  | { mode: "gtm"; googleTagManagerId: string; directGoogleIds: [] }
  | { mode: "gtag"; googleTagManagerId: ""; directGoogleIds: string[] }
  | { mode: "none"; googleTagManagerId: ""; directGoogleIds: [] };

export function googleAnalyticsLoadPlan(
  settings: SeoAnalyticsSettings,
): GoogleAnalyticsLoadPlan {
  if (settings.googleTagManagerId) {
    return {
      mode: "gtm",
      googleTagManagerId: settings.googleTagManagerId,
      directGoogleIds: [],
    };
  }

  const directGoogleIds = [
    settings.googleAnalyticsId,
    settings.googleAdsId,
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
