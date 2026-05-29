import type { Metadata } from "next";
import { ContactPageClient } from "@/components/cms/contact-page-client";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "CUSTOM_ROUTE", routePath: "/contact" });
  return metadataFromSeo(seo, {
    title: "Contact 1HandIndia",
    description: "Contact the 1HandIndia support team for customer, seller, B2B, order, and marketplace enquiries.",
    path: "/contact"
  });
}

export default function ContactPage() {
  return (
    <>
      <JsonLd data={buildWebPageJsonLd({ title: "Contact 1HandIndia", description: "Contact the 1HandIndia support team for marketplace support.", path: "/contact" })} />
      <ContactPageClient />
    </>
  );
}
