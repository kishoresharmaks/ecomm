import type { Metadata } from "next";
import { PublicPageClient } from "@/components/cms/public-page-client";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebPageJsonLd, cmsPageSeoData, metadataFromSeo } from "@/lib/seo";

const pageConfig = {
  slug: "shipping-policy",
  fallbackTitle: "Shipping Policy",
  fallbackDescription: "Store pickup, local delivery partner, courier tracking, and shipping rules managed through CMS."
};

export async function generateMetadata(): Promise<Metadata> {
  const { page, seo } = await cmsPageSeoData(pageConfig.slug);
  return metadataFromSeo(seo, {
    title: page?.title ?? pageConfig.fallbackTitle,
    description: page?.content?.slice(0, 160) || pageConfig.fallbackDescription,
    path: `/${pageConfig.slug}`,
    type: "article"
  });
}

export default async function ShippingPolicyPage() {
  const { page } = await cmsPageSeoData(pageConfig.slug);
  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd({
          title: page?.title ?? pageConfig.fallbackTitle,
          description: page?.content?.slice(0, 180) || pageConfig.fallbackDescription,
          path: `/${pageConfig.slug}`,
          pageType: "Article"
        })}
      />
      <PublicPageClient slug={pageConfig.slug} fallbackTitle={pageConfig.fallbackTitle} fallbackDescription={pageConfig.fallbackDescription} />
    </>
  );
}
