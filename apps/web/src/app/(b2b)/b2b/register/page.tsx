import type { Metadata } from "next";
import { B2BProfileClient } from "@/components/b2b/b2b-profile-client";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "B2B_LANDING", routePath: "/b2b/register" });
  return metadataFromSeo(seo, {
    title: "1HandIndia B2B Buyer Registration",
    description: "Register a business buyer profile to submit bulk product enquiries and manage marketplace quotations.",
    path: "/b2b/register"
  });
}

export default function B2BRegisterPage() {
  return (
    <>
      <JsonLd data={buildWebPageJsonLd({ title: "1HandIndia B2B Buyer Registration", description: "Register a business buyer profile on 1HandIndia.", path: "/b2b/register" })} />
      <B2BProfileClient onboarding />
    </>
  );
}
