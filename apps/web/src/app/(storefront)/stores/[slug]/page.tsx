import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { StoreProfileClient } from "@/components/storefront/store-profile-client";
import { buildBreadcrumbJsonLd, buildStoreJsonLd, metadataFromSeo, storeSeoData } from "@/lib/seo";

type StoreProfilePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: StoreProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { store, seo } = await storeSeoData(slug);
  const address = store?.addresses?.[0];
  const location = [address?.area, address?.city, address?.state].filter(Boolean).join(", ");
  const productCount = store?._count?.products ?? 0;
  const reviewCount = store?.reviewSummary?.reviewCount ?? 0;
  const fallbackDescription = store
    ? [
        store.profile?.description?.trim(),
        productCount ? `Shop ${productCount.toLocaleString("en-IN")} live products from ${store.storeName}.` : `Explore products and services from ${store.storeName}.`,
        location ? `Based in ${location}.` : null,
        reviewCount ? `${reviewCount.toLocaleString("en-IN")} customer reviews on 1HandIndia.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : "View seller profile, store details, available products, and services on 1HandIndia.";

  return metadataFromSeo(seo, {
    title: store ? `${store.storeName} | 1HandIndia Store` : "Store Profile | 1HandIndia",
    description: fallbackDescription,
    path: `/stores/${slug}`,
    imageUrl: store?.profile?.bannerUrl ?? store?.profile?.logoUrl
  });
}

export default async function StoreProfilePage({ params }: StoreProfilePageProps) {
  const { slug } = await params;
  const { store } = await storeSeoData(slug);

  return (
    <>
      {store ? (
        <JsonLd
          data={[
            buildStoreJsonLd(store),
            buildBreadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Stores", path: "/stores" },
              { name: store.storeName, path: `/stores/${store.slug}` }
            ])
          ]}
        />
      ) : null}
      <StoreProfileClient slug={slug} />
    </>
  );
}
