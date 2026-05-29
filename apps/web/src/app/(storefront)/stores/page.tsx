import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { StoreDirectoryClient } from "@/components/storefront/store-directory-client";
import { buildBreadcrumbJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "CUSTOM_ROUTE", routePath: "/stores" });
  return metadataFromSeo(seo, {
    title: "1HandIndia Stores",
    description: "Discover approved sellers, local shops, and nearby stores selling on the 1HandIndia marketplace.",
    path: "/stores"
  });
}

export default function StoreDirectoryPage() {
  return (
    <>
      <JsonLd data={buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Stores", path: "/stores" }])} />
      <StoreDirectoryClient />
    </>
  );
}
