import type { Metadata } from "next";
import { brandConfig } from "@indihub/config";
import { ConfiguredOriginRedirect } from "@/components/auth/configured-origin-redirect";
import { Providers } from "@/components/providers";
import { siteUrl } from "@/lib/seo";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ConfiguredOriginRedirect />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
