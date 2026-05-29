import { describe, expect, it } from "vitest";
import { buildBreadcrumbJsonLd, metadataFromSeo, privateRobotsDisallow, publicRobotsAllow, robotsFromDirective } from "./seo";

describe("seo helpers", () => {
  it("maps robots directives into Next metadata robots values", () => {
    expect(robotsFromDirective("noindex,follow")).toMatchObject({
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true
      }
    });
    expect(robotsFromDirective("index,nofollow")).toMatchObject({
      index: true,
      follow: false
    });
  });

  it("applies explicit SEO before fallback metadata", () => {
    const metadata = metadataFromSeo(
      {
        metaTitle: "Managed Product Title",
        metaDescription: "Managed product description for search previews.",
        canonicalUrl: "https://www.1handindia.com/products/managed",
        robotsDirective: "index,follow",
        ogImageUrl: "https://ik.imagekit.io/indihub/managed.jpg"
      },
      {
        title: "Fallback Product Title",
        description: "Fallback description.",
        path: "/products/fallback"
      }
    );

    expect(metadata.title).toEqual({ absolute: "Managed Product Title" });
    expect(metadata.description).toBe("Managed product description for search previews.");
    expect(metadata.alternates).toEqual({ canonical: "https://www.1handindia.com/products/managed" });
    expect(metadata.openGraph).toMatchObject({
      title: "Managed Product Title",
      url: "https://www.1handindia.com/products/managed"
    });
  });

  it("builds breadcrumb JSON-LD with absolute item URLs", () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Products", path: "/products/headset" }
    ]);

    expect(jsonLd).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        expect.objectContaining({ position: 1, name: "Home" }),
        expect.objectContaining({ position: 2, item: "http://localhost:3000/products/headset" })
      ]
    });
  });

  it("keeps public marketplace landing pages crawlable while excluding private workspaces", () => {
    expect(publicRobotsAllow).toEqual(expect.arrayContaining(["/seller/register", "/b2b/register"]));
    expect(privateRobotsDisallow).not.toContain("/seller");
    expect(privateRobotsDisallow).toEqual(expect.arrayContaining(["/seller/orders", "/b2b/enquiries"]));
  });
});
