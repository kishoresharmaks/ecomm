export const primaryGoogleAnalyticsId = "G-MR1H66G0DZ";
export const primaryGoogleAdsId = "AW-18165667075";
export const primaryGoogleTagManagerId = "GTM-WFXLFC8X";

export function googleConsentDefaultScript() {
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
  `;
}

export function googleTagManagerHeadBootstrapScript() {
  return `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${primaryGoogleTagManagerId}');
  `;
}
