import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function SellerB2bOrdersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
