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
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/brand/apple-touch-icon.png", type: "image/png" }
    ],
    shortcut: "/icon.svg",
    apple: "/brand/apple-touch-icon.png"
  },
  openGraph: {
    siteName: brandConfig.name,
    type: "website",
    url: siteUrl
  },
  alternates: {
    canonical: "/"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const seoSettings = await getSeoSettings();
  const gscId = seoSettings.googleSearchConsoleId || null;

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: brandConfig.name,
    url: `${siteUrl}/`,
    logo: `${siteUrl}/brand/1handindia_logo.webp`,
    description: brandConfig.tagline,
    sameAs: [
      "https://www.facebook.com/1handindia",
      "https://www.instagram.com/1handindia/",
      "https://www.youtube.com/channel/UCK1w6LlYqW666P5E_ZrPeoA"
    ] as const,
    address: {
      "@type": "PostalAddress",
      streetAddress: "2/26-1, Muhilanvilai, Monikettipottal",
      addressLocality: "Kanyakumari District",
      addressRegion: "Tamil Nadu",
      postalCode: "629501",
      addressCountry: "IN"
    },
    legalName: "BEES HUB FARMLAND PRIVATE LIMITED"
  };

  const socialProfileJsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    url: `${siteUrl}/`,
    headline: brandConfig.name,
    about: brandConfig.tagline,
    sameAs: [
      "https://www.facebook.com/1handindia",
      "https://www.instagram.com/1handindia/",
      "https://www.youtube.com/channel/UCK1w6LlYqW666P5E_ZrPeoA"
    ]
  };

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="canonical" href={siteUrl} />
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
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(socialProfileJsonLd) }}
        />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[9999] focus:rounded-lg focus:bg-[#ED3500] focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-white focus:shadow-lg">
          Skip to content
        </a>
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
