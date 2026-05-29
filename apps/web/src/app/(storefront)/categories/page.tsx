import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductListingClient } from "@/components/storefront/product-listing-client";
import { buildBreadcrumbJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "CUSTOM_ROUTE", routePath: "/categories" });
  return metadataFromSeo(seo, {
    title: "Shop Categories | 1HandIndia",
    description: "Browse marketplace categories and discover products from verified sellers and nearby stores.",
    path: "/categories"
  });
}

export default function CategoriesPage() {
  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Categories", path: "/categories" }])} />
      <ProductListingClient mode="categories" />
    </>
  );
}
