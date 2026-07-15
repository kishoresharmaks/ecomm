import type { Metadata } from "next";
import { brandConfig } from "@indihub/config";
import { headers } from "next/headers";
import { ConfiguredOriginRedirect } from "@/components/auth/configured-origin-redirect";
import { Providers } from "@/components/providers";
import {
  googleAnalyticsHeadBootstrapScript,
  primaryGoogleTagId,
} from "@/lib/google-analytics";
import { getSeoSettings, siteUrl } from "@/lib/seo";
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
  const gscId = seoSettings.googleSearchConsoleId || null;

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <script
          async
          nonce={nonce}
          src={`https://www.googletagmanager.com/gtag/js?id=${primaryGoogleTagId}`}
        />
        <script
          id="indihub-google-analytics-bootstrap"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: googleAnalyticsHeadBootstrapScript() }}
        />
        {gscId ? <meta name="google-site-verification" content={gscId} /> : null}
      </head>
      <body>
        <ConfiguredOriginRedirect />
        <Providers nonce={nonce} seoAnalyticsSettings={seoSettings}>{children}</Providers>
      </body>
    </html>
  );
}
