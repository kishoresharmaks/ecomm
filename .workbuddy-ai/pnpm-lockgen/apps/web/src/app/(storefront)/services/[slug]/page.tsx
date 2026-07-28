import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ServicesMarketplaceClient } from "@/components/storefront/services-marketplace-client";
import { buildBreadcrumbJsonLd, metadataFromSeo } from "@/lib/seo";

type ServiceDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  return metadataFromSeo(null, {
    title: "Service Detail",
    description: "View service provider details, pricing, availability, reviews, and booking options on 1HandIndia.",
    path: `/services/${slug}`,
  });
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { slug } = await params;
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: "Service detail", path: `/services/${slug}` },
        ])}
      />
      <ServicesMarketplaceClient mode="detail" slug={slug} />
    </>
  );
}
