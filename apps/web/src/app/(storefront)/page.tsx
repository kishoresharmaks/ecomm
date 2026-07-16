import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cache } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { StorefrontHome } from "@/components/storefront/storefront-home-sections";
import {
  browsingLocationQuery,
  parseStorefrontLocationCookie,
  storefrontLocationCookieName,
  storefrontLocationFingerprint,
} from "@/components/storefront/storefront-location-utils";
import {
  getStorefrontHome,
  primaryImage,
  type StoreLocationQuery,
} from "@/lib/storefront-api";
import { buildGenericJsonLd, metadataFromSeo, resolveSeoEntry, safeData } from "@/lib/seo";

const homeSeoFallback = {
  title: "1HandIndia Marketplace",
  description: "Shop from verified sellers, hyperlocal stores, and B2B-ready marketplace partners on 1HandIndia.",
  path: "/"
} as const;

const getHomeSeo = cache(() => resolveSeoEntry({ entityType: "HOME", routePath: "/" }));
const getHomePayload = cache((queryKey: string) =>
  safeData(() => getStorefrontHome(JSON.parse(queryKey) as StoreLocationQuery)),
);

export async function generateMetadata(): Promise<Metadata> {
  const [seo, home] = await Promise.all([getHomeSeo(), getHomePayload(homeQueryKey({ limit: 6 }))]);
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
  const cookieStore = await cookies();
  const serverLocation = parseStorefrontLocationCookie(
    cookieStore.get(storefrontLocationCookieName)?.value,
  );
  const homePromise = getHomePayload(homeQueryKey(browsingLocationQuery(serverLocation, 6)));
  const seo = await getHomeSeo();
  const title = seo?.metaTitle?.trim() || homeSeoFallback.title;
  const description = seo?.metaDescription?.trim() || homeSeoFallback.description;
  const path = seo?.canonicalUrl?.trim() || homeSeoFallback.path;

  return (
    <>
      <JsonLd data={buildGenericJsonLd(seo, { title, description, path })} />
      <StorefrontHome
        homePromise={homePromise}
        serverLocation={serverLocation}
        serverLocationFingerprint={storefrontLocationFingerprint(serverLocation)}
      />
    </>
  );
}

function homeQueryKey(query: StoreLocationQuery) {
  return JSON.stringify(query);
}

function statsSeoDescription(home: Awaited<ReturnType<typeof getHomePayload>>) {
  if (!home?.stats || (!home.stats.liveProducts && !home.stats.approvedStores)) {
    return "";
  }

  return `Shop ${home.stats.liveProducts.toLocaleString("en-IN")} live products from ${home.stats.approvedStores.toLocaleString("en-IN")} approved stores on 1HandIndia.`;
}
