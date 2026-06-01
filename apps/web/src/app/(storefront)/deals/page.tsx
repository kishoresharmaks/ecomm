import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductListingClient } from "@/components/storefront/product-listing-client";
import { buildBreadcrumbJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "CUSTOM_ROUTE", routePath: "/deals" });
  return metadataFromSeo(seo, {
    title: "Flash Sale Deals | 1HandIndia",
    description: "Browse active flash sale products and limited-time discounts from approved sellers.",
    path: "/deals"
  });
}

export default function DealsPage() {
  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Deals", path: "/deals" }])} />
      <ProductListingClient mode="deals" />
    </>
  );
}
