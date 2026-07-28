import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ServicesMarketplaceClient } from "@/components/storefront/services-marketplace-client";
import { buildBreadcrumbJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "CUSTOM_ROUTE", routePath: "/services" });
  return metadataFromSeo(seo, {
    title: "1HandIndia Services",
    description: "Book approved local and remote service providers for repair, installation, maintenance, consultation, and quote-first work.",
    path: "/services",
  });
}

export default function ServicesPage() {
  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }])} />
      <ServicesMarketplaceClient />
    </>
  );
}
