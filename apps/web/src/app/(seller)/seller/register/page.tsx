import type { Metadata } from "next";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";
import { SellerRegistrationForm } from "./seller-registration-form";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "SELLER_LANDING", routePath: "/seller/register" });
  return metadataFromSeo(seo, {
    title: "Sell on 1HandIndia",
    description: "Register as a vendor, nearby store, or local shop seller on the 1HandIndia marketplace.",
    path: "/seller/register"
  });
}

export default function SellerRegisterPage() {
  return (
    <>
      <JsonLd data={buildWebPageJsonLd({ title: "Sell on 1HandIndia", description: "Register as a seller on the 1HandIndia marketplace.", path: "/seller/register" })} />
      <SellerWorkspaceShell title="Seller onboarding" description="Submit store and pickup details for review. After approval, product and order operations unlock.">
        <SellerRegistrationForm />
      </SellerWorkspaceShell>
    </>
  );
}
