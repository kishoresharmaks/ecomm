import type { Metadata } from "next";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";
import { ChoosePlanClient } from "./choose-plan-client";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "SELLER_LANDING", routePath: "/seller/choose-plan" });
  return metadataFromSeo(seo, {
    title: "Choose Seller Plan | 1HandIndia",
    description: "Choose a subscription plan to start selling or offering services on 1HandIndia.",
    path: "/seller/choose-plan"
  });
}

export default async function ChoosePlanPage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <JsonLd data={buildWebPageJsonLd({ title: "Choose Seller Plan | 1HandIndia", description: "Choose a subscription plan.", path: "/seller/choose-plan" })} />
      <SellerWorkspaceShell title="Choose your plan" description="Select the subscription tier that best fits your business needs.">
        <ChoosePlanClient initialMode={params.mode ?? null} />
      </SellerWorkspaceShell>
    </>
  );
}
