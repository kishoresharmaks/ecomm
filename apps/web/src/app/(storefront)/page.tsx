import type { Metadata } from "next";
import { cache } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { StorefrontHomeClient } from "@/components/storefront/storefront-home-client";
import { getStorefrontHome, primaryImage } from "@/lib/storefront-api";
import { buildOrganizationJsonLd, buildWebsiteJsonLd, buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry, safeData } from "@/lib/seo";

const homeSeoFallback = {
  title: "1HandIndia Marketplace",
  description: "Shop from verified sellers, nearby stores, and B2B-ready marketplace partners on 1HandIndia.",
  path: "/"
} as const;

const getHomeSeo = cache(() => resolveSeoEntry({ entityType: "HOME", routePath: "/" }));
const getHomePayload = cache(() => safeData(() => getStorefrontHome({ limit: 6 })));

export async function generateMetadata(): Promise<Metadata> {
  const [seo, home] = await Promise.all([getHomeSeo(), getHomePayload()]);
  const bannerImage = home?.banners[0]?.imageUrl ?? home?.banners[0]?.mobileImageUrl;
  const productImage = home?.productRails.featured[0]
    ? primaryImage(home.productRails.featured[0])
    : home?.productRails.latest[0]
      ? primaryImage(home.productRails.latest[0])
      : null;

  return metadataFromSeo(seo, {
    ...homeSeoFallback,
    description: statsSeoDescription(home) || homeSeoFallback.description,
    imageUrl: bannerImage || productImage
  });
}

export default async function StorefrontHomePage() {
  const [seo, home] = await Promise.all([getHomeSeo(), getHomePayload()]);
  const title = seo?.metaTitle?.trim() || homeSeoFallback.title;
  const description = seo?.metaDescription?.trim() || statsSeoDescription(home) || homeSeoFallback.description;
  const path = seo?.canonicalUrl?.trim() || homeSeoFallback.path;

  return (
    <>
      <JsonLd data={[buildOrganizationJsonLd(), buildWebsiteJsonLd(), buildWebPageJsonLd({ title, description, path })]} />
      <StorefrontHomeClient />
    </>
  );
}

function statsSeoDescription(home: Awaited<ReturnType<typeof getHomePayload>>) {
  if (!home?.stats || (!home.stats.liveProducts && !home.stats.approvedStores)) {
    return "";
  }

  return `Shop ${home.stats.liveProducts.toLocaleString("en-IN")} live products from ${home.stats.approvedStores.toLocaleString("en-IN")} approved stores on 1HandIndia.`;
}
