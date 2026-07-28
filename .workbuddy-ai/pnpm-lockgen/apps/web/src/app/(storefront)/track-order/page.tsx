import type { Metadata } from "next";
import { TrackOrderClient } from "@/components/storefront/track-order-client";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata;

export default function TrackOrderPage() {
  return <TrackOrderClient />;
}
