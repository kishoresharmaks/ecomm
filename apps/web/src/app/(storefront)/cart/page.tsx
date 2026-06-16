import type { Metadata } from "next";
import { CartPageClient } from "@/components/storefront/cart-page-client";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function CartPage() {
  return <CartPageClient />;
}
