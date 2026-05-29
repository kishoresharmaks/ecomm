import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { StoreProfileClient } from "@/components/storefront/store-profile-client";
import { buildBreadcrumbJsonLd, buildStoreJsonLd, metadataFromSeo, storeSeoData } from "@/lib/seo";

type StoreProfilePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: StoreProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { store, seo } = await storeSeoData(slug);
  return metadataFromSeo(seo, {
    title: store ? `${store.storeName} Store` : "Store Profile",
    description: store?.profile?.description ?? "View seller profile, store details, and available marketplace products on 1HandIndia.",
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
