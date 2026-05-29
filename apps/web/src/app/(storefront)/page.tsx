import type { Metadata } from "next";
import { cache } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { StorefrontHomeClient } from "@/components/storefront/storefront-home-client";
import { buildOrganizationJsonLd, buildWebsiteJsonLd, buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

const homeSeoFallback = {
  title: "1HandIndia Marketplace",
  description: "Shop from verified sellers, nearby stores, and B2B-ready marketplace partners on 1HandIndia.",
  path: "/"
} as const;

const getHomeSeo = cache(() => resolveSeoEntry({ entityType: "HOME", routePath: "/" }));

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getHomeSeo();
  return metadataFromSeo(seo, homeSeoFallback);
}

export default async function StorefrontHomePage() {
  const seo = await getHomeSeo();
  const title = seo?.metaTitle?.trim() || homeSeoFallback.title;
  const description = seo?.metaDescription?.trim() || homeSeoFallback.description;
  const path = seo?.canonicalUrl?.trim() || homeSeoFallback.path;

  return (
    <>
      <JsonLd data={[buildOrganizationJsonLd(), buildWebsiteJsonLd(), buildWebPageJsonLd({ title, description, path })]} />
      <StorefrontHomeClient />
    </>
  );
}
