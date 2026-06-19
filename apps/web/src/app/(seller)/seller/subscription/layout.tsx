import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function SellerSubscriptionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
