import type { Metadata } from "next";
import { brandConfig } from "@indihub/config";
import { headers } from "next/headers";
import { ConfiguredOriginRedirect } from "@/components/auth/configured-origin-redirect";
import { Providers } from "@/components/providers";
import { getSeoSettings, siteUrl } from "@/lib/seo";
import Script from "next/script";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${brandConfig.name} Marketplace`,
    template: `%s | ${brandConfig.name}`
  },
  description: brandConfig.tagline,
  applicationName: brandConfig.name,
  openGraph: {
    siteName: brandConfig.name,
    type: "website",
    url: siteUrl
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const seoSettings = await getSeoSettings();
  
  const gscId = seoSettings?.googleSearchConsoleId?.trim() || null;
  const gaRaw = seoSettings?.googleAnalyticsId?.trim() || null;
  const gtmRaw = seoSettings?.googleTagManagerId?.trim() || null;

  // Identify true GTM Container ID (must start with GTM-)
  const gtmId = gtmRaw?.startsWith("GTM-") ? gtmRaw : null;

  // Gather all gtag.js targets (G-, AW-, GT-)
  const gtagIds: string[] = [];
  if (gaRaw && /^(G-|AW-|GT-)/i.test(gaRaw)) {
    gtagIds.push(gaRaw);
  }
  if (gtmRaw && /^(G-|AW-|GT-)/i.test(gtmRaw)) {
    gtagIds.push(gtmRaw);
  }
  const uniqueGtagIds = Array.from(new Set(gtagIds));
  const primaryGtagId = uniqueGtagIds[0] || null;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        {gscId ? <meta name="google-site-verification" content={gscId} /> : null}
        {gtmId ? (
          <Script id="gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
        ) : null}
      </head>
      <body>
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <ConfiguredOriginRedirect />
        <Providers nonce={nonce}>{children}</Providers>
        {primaryGtagId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${primaryGtagId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                ${uniqueGtagIds.map(id => `gtag('config', '${id}', { page_path: window.location.pathname });`).join("\n")}
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
