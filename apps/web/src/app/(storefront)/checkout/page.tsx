import type { Metadata } from "next";
import { CheckoutPageClient } from "@/components/storefront/checkout-page-client";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
