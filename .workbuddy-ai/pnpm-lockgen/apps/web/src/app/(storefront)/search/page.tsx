import type { Metadata } from "next";
import { StorefrontSearchClient } from "@/components/storefront/storefront-search-client";
import { metadataFromSeo } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q?.trim();
  return metadataFromSeo(
    { robotsDirective: "noindex,follow" },
    {
      title: query ? `Search results for ${query}` : "Product Search",
      description: "Search marketplace products on 1HandIndia.",
      path: query ? `/search?q=${encodeURIComponent(query)}` : "/search"
    }
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;

  return <StorefrontSearchClient initialSearch={params.q ?? ""} />;
}
