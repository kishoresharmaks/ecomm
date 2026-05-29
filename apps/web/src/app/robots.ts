import type { MetadataRoute } from "next";
import { absoluteUrl, privateRobotsDisallow, publicRobotsAllow, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...publicRobotsAllow],
      disallow: [...privateRobotsDisallow]
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl
  };
}
