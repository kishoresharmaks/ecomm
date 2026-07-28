import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import { JsonLd } from "@/components/seo/json-ld";
import {
  buildWebPageJsonLd,
  metadataFromSeo,
  resolveSeoEntry,
} from "@/lib/seo";

const title = "Account Deletion";
const description =
  "Request deletion of a 1HandIndia customer, seller, business buyer, or delivery account and review data-retention details.";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await resolveSeoEntry({
    entityType: "POLICY",
    routePath: "/account-deletion",
  });
  return metadataFromSeo(seo, {
    title,
    description,
    path: "/account-deletion",
    type: "article",
  });
}

export default function AccountDeletionPage() {
  return (
    <StorefrontFrame>
      <JsonLd
        data={buildWebPageJsonLd({
          title,
          description,
          path: "/account-deletion",
          pageType: "Article",
        })}
      />
      <div className="min-h-[calc(100svh-69px)] bg-[#FFFCFB]">
        <section className="border-b border-[#F0E4DF] bg-white">
          <div className="mx-auto max-w-4xl px-5 py-10 lg:px-6">
            <p className="text-sm font-black uppercase text-[#ED3500]">Privacy request</p>
            <h1 className="mt-3 text-4xl font-black text-[#1F2933]">{title}</h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-[#667085]">
              Signed-in seller-app users can submit a deletion request from More, Account &
              privacy. Anyone who cannot access the app can use the request form below.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-4xl gap-8 px-5 py-10 lg:px-6">
          <div>
            <h2 className="text-xl font-black text-[#1F2933]">How deletion works</h2>
            <ol className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-[#667085]">
              <li>1. Submit the request using the email address connected to the account.</li>
              <li>2. 1HandIndia verifies account ownership and checks open orders, payouts, disputes, or obligations.</li>
              <li>3. Eligible personal data and account access are deleted or anonymized after verification.</li>
              <li>4. Tax, payout, transaction, fraud-prevention, legal-hold, and audit records may be retained for the period required by law or marketplace obligations.</li>
            </ol>
          </div>

          <div className="border-t border-[#F0E4DF] pt-8">
            <h2 className="text-xl font-black text-[#1F2933]">Submit a request</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
              Use the account email, select the correct requester type, and describe the account
              you want deleted. Support will respond through the selected contact channel.
            </p>
            <Button asChild className="mt-5">
              <Link href="/contact?topic=SELLER&request=account-deletion">
                Request account deletion
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </StorefrontFrame>
  );
}
