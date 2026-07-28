import type { Metadata } from "next";
import { SellerDashboardClient } from "@/components/seller/seller-dashboard-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "SELLER_LANDING", routePath: "/seller" });
  return metadataFromSeo(seo, {
    title: "Sell on 1HandIndia | Start Your Retail or Service Business",
    description: "Join 1HandIndia as a seller. Open a store to sell products, offer services, or run a combined profile with a tailored dashboard and quality assured marketplace.",
    path: "/seller"
  });
}

export default function SellerDashboardPage() {
  return (
    <>
      <JsonLd data={buildWebPageJsonLd({ title: "Sell on 1HandIndia", description: "Start your business on 1HandIndia.", path: "/seller" })} />
      <SellerWorkspaceShell>
        <SellerDashboardClient />
      </SellerWorkspaceShell>
    </>
  );
}
