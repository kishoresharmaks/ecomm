import type { MetadataRoute } from "next";
import { absoluteUrl, fetchSitemapEntries } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await fetchSitemapEntries();

  return entries.map((entry) => ({
    url: absoluteUrl(entry.path),
    lastModified: entry.lastModified ? new Date(entry.lastModified) : new Date(),
    changeFrequency: entry.changeFrequency ?? "weekly",
    priority: entry.priority ?? 0.5
  }));
}

