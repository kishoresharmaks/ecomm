import type { Metadata } from "next";
import { brandConfig } from "@indihub/config";
import { headers } from "next/headers";
import { ConfiguredOriginRedirect } from "@/components/auth/configured-origin-redirect";
import { Providers } from "@/components/providers";
import {
  googleConsentDefaultScript,
  googleTagManagerHeadBootstrapScript,
  primaryGoogleTagManagerId,
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
          id="indihub-google-consent-default"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: googleConsentDefaultScript() }}
        />
        <script
          id="indihub-google-tag-manager"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: googleTagManagerHeadBootstrapScript() }}
        />
        {gscId ? <meta name="google-site-verification" content={gscId} /> : null}
      </head>
      <body>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${primaryGoogleTagManagerId}`}
            height="0"
            width="0"
            title="Google Tag Manager"
            aria-hidden="true"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <ConfiguredOriginRedirect />
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
