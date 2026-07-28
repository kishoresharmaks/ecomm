import type { Metadata } from "next";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebPageJsonLd, metadataFromSeo, resolveSeoEntry } from "@/lib/seo";
import { SellerRegistrationForm } from "./seller-registration-form";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({ entityType: "SELLER_LANDING", routePath: "/seller/register" });
  return metadataFromSeo(seo, {
    title: "Sell on 1HandIndia",
    description: "Register as a marketplace seller, hyperlocal store, or wholesale distributor on the 1HandIndia marketplace.",
    path: "/seller/register"
  });
}

export default async function SellerRegisterPage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string; plan?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <JsonLd data={buildWebPageJsonLd({ title: "Sell on 1HandIndia", description: "Register as a seller on the 1HandIndia marketplace.", path: "/seller/register" })} />
      <SellerWorkspaceShell
        title="1HandIndia Seller Hub onboarding"
        description="Complete your business profile and verification documents in one secure application. Every submission is reviewed before marketplace access is activated."
      >
        <SellerRegistrationForm initialMode={params.mode ?? null} initialPlanId={params.plan ?? null} />
      </SellerWorkspaceShell>
    </>
  );
}
