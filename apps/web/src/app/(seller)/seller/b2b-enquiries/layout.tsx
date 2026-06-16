import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function SellerB2bEnquiriesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
