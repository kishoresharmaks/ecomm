import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPageClient } from "@/components/storefront/checkout-page-client";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutPageClient />
    </Suspense>
  );
}

function CheckoutLoading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-6">
      <div className="h-28 rounded-lg border border-[#E5E7EB] bg-white shadow-sm" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="h-56 rounded-lg border border-[#E5E7EB] bg-white shadow-sm" />
          <div className="h-48 rounded-lg border border-[#E5E7EB] bg-white shadow-sm" />
        </div>
        <div className="h-72 rounded-lg border border-[#E5E7EB] bg-white shadow-sm" />
      </div>
    </main>
  );
}
