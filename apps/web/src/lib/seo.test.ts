import { describe, expect, it } from "vitest";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  metadataFromSeo,
  normalizeSitemapEntries,
  privateRobotsDisallow,
  publicRobotsAllow,
  robotsFromDirective,
  staticPublicSitemapEntries,
} from "./seo";

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

  it("uses real-data fallback images when CMS SEO image fields are empty", () => {
    const metadata = metadataFromSeo(null, {
      title: "Local marketplace homepage",
      description: "Dynamic homepage generated from live catalogue counts.",
      path: "/",
      imageUrl: "indihub/cms/homepage-hero.jpg"
    });

    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          url: "http://192.168.1.3:4000/api/storage/public-image?key=indihub%2Fcms%2Fhomepage-hero.jpg",
          alt: "Local marketplace homepage"
        }
      ]
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [
        "http://192.168.1.3:4000/api/storage/public-image?key=indihub%2Fcms%2Fhomepage-hero.jpg"
      ]
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
        expect.objectContaining({ position: 2, item: "http://192.168.1.2:3000/products/headset" })
      ]
    });
  });

  it("adds product aggregateRating only when approved review summary exists", () => {
    const product = {
      id: "product_1",
      sellerId: "seller_1",
      categoryId: "category_1",
      name: "Premium Rice",
      slug: "premium-rice",
      description: "High quality rice.",
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      category: { id: "category_1", name: "Groceries", slug: "groceries" },
      seller: { id: "seller_1", storeName: "Indi Local", slug: "indi-local" },
      images: [],
      variants: [
        {
          id: "variant_1",
          sku: "RICE-1",
          pricePaise: 45000,
          currency: "INR",
          stockQuantity: 12,
          status: "ACTIVE",
        },
      ],
      reviewSummary: {
        averageRating: null,
        reviewCount: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    };

    expect(buildProductJsonLd(product).aggregateRating).toBeUndefined();

    expect(
      buildProductJsonLd({
        ...product,
        reviewSummary: {
          averageRating: 4.5,
          reviewCount: 8,
          distribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 4 },
        },
      }),
    ).toMatchObject({
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: 4.5,
        reviewCount: 8,
      },
    });
  });

  it("keeps public marketplace landing pages crawlable while excluding private workspaces", () => {
    expect(publicRobotsAllow).toEqual(expect.arrayContaining(["/seller/register", "/b2b/register"]));
    expect(privateRobotsDisallow).not.toContain("/seller");
    expect(privateRobotsDisallow).toEqual(
      expect.arrayContaining(["/seller/orders", "/b2b/enquiries", "/courier", "/track-order", "/sentry-example-page"]),
    );
  });

  it("keeps sitemap fallbacks focused on public discovery routes", () => {
    expect(staticPublicSitemapEntries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["/", "/deals", "/stores", "/privacy-policy", "/seller/register", "/b2b/register"]),
    );
    expect(staticPublicSitemapEntries.map((entry) => entry.path)).not.toEqual(
      expect.arrayContaining(["/cart", "/checkout", "/track-order"]),
    );
  });

  it("deduplicates sitemap entries and drops private routes even when API data includes them", () => {
    expect(
      normalizeSitemapEntries([
        { path: "/", source: "home" },
        { path: "/", source: "duplicate" },
        { path: "/products/public-product", source: "product" },
        { path: "/cart", source: "cart" },
        { path: "/admin/orders", source: "admin" },
        { path: "https://www.1handindia.com/seller/orders/ORD-1", source: "seller" },
      ]),
    ).toEqual([
      { path: "/", source: "home" },
      { path: "/products/public-product", source: "product" },
    ]);
  });
});
