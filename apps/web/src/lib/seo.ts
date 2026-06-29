import type { Metadata, MetadataRoute } from "next";
import { brandConfig } from "@indihub/config";
import { apiBaseUrl, apiRequestTimeoutMs, skipDefaultLocalApiOnServer } from "./api";
import { resolveImageSource } from "./image-url";
import { getCategory, getCmsPage, getProduct, getStoreProfile, listCategories, listProducts, listStores, primaryImage, primaryVariant, type CategorySummary, type CmsPage, type ProductSummary, type StoreProfile } from "./storefront-api";

export type SeoEntityType =
  | "HOME"
  | "PRODUCT"
  | "CATEGORY"
  | "STORE"
  | "CMS_PAGE"
  | "B2B_LANDING"
  | "SELLER_LANDING"
  | "POLICY"
  | "SEARCH"
  | "CUSTOM_ROUTE";

export type SeoEntry = {
  id: string;
  entityType: SeoEntityType;
  entityId?: string | null;
  routePath?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robotsDirective?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImageUrl?: string | null;
  focusKeyword?: string | null;
  structuredDataType?: string | null;
  seoScore?: number;
  status?: string;
};

export type SitemapEntry = {
  path: string;
  lastModified?: string;
  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority?: number;
  source?: string;
};

type SeoFallback = {
  title: string;
  description: string;
  path: string;
  imageUrl?: string | null | undefined;
  type?: "website" | "article";
};

export const siteUrl = (process.env.NEXT_PUBLIC_WEB_URL ?? "http://192.168.1.2:3000").replace(/\/$/, "");

export const publicRobotsAllow = ["/", "/seller/register", "/b2b/register"] as const;

export const privateRobotsDisallow = [
  "/admin",
  "/account",
  "/checkout",
  "/cart",
  "/courier",
  "/delivery",
  "/finance",
  "/api",
  "/sentry-example-page",
  "/sign-in",
  "/sign-up",
  "/track-order",
  "/checkout/success",
  "/seller/products",
  "/seller/orders",
  "/seller/profile",
  "/seller/store-profile",
  "/seller/pending-approval",
  "/seller/finance",
  "/seller/b2b-enquiries",
  "/seller/b2b-orders",
  "/seller/coupons",
  "/seller/deals",
  "/seller/reports",
  "/seller/returns",
  "/seller/reviews",
  "/seller/subscription",
  "/b2b/company-profile",
  "/b2b/enquiries",
  "/b2b/orders",
  "/b2b/sign-in",
  "/b2b/sign-up"
] as const;

export const staticPublicSitemapEntries = [
  { path: "/", changeFrequency: "daily", priority: 1, source: "homepage" },
  { path: "/categories", changeFrequency: "daily", priority: 0.8, source: "categories" },
  { path: "/deals", changeFrequency: "daily", priority: 0.75, source: "deals" },
  { path: "/stores", changeFrequency: "daily", priority: 0.8, source: "stores" },
  { path: "/about", changeFrequency: "monthly", priority: 0.45, source: "about" },
  { path: "/contact", changeFrequency: "monthly", priority: 0.55, source: "support_landing" },
  { path: "/seller/register", changeFrequency: "weekly", priority: 0.65, source: "seller_landing" },
  { path: "/b2b/register", changeFrequency: "weekly", priority: 0.65, source: "b2b_landing" },
  { path: "/privacy-policy", changeFrequency: "monthly", priority: 0.35, source: "policy" },
  { path: "/refund-return-policy", changeFrequency: "monthly", priority: 0.35, source: "policy" },
  { path: "/seller-policy", changeFrequency: "monthly", priority: 0.35, source: "policy" },
  { path: "/shipping-policy", changeFrequency: "monthly", priority: 0.35, source: "policy" },
  { path: "/terms-and-conditions", changeFrequency: "monthly", priority: 0.35, source: "policy" }
] satisfies SitemapEntry[];

export function absoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) {
    return siteUrl;
  }
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${path}`;
}

export async function resolveSeoEntry(query: { entityType?: SeoEntityType; entityId?: string | null | undefined; routePath?: string | null | undefined }) {
  const params = new URLSearchParams();
  if (query.entityType) {
    params.set("entityType", query.entityType);
  }
  if (query.entityId) {
    params.set("entityId", query.entityId);
  }
  if (query.routePath) {
    params.set("routePath", query.routePath);
  }
  if (!params.size) {
    return null;
  }

  return safePublicFetch<SeoEntry | null>(`/api/cms/seo/resolve?${params.toString()}`);
}

export async function fetchSitemapEntries() {
  const entries = await safePublicFetch<SitemapEntry[]>("/api/cms/sitemap");
  if (entries?.length) {
    return normalizeSitemapEntries(entries);
  }

  return normalizeSitemapEntries(await fallbackSitemapEntries());
}

export function metadataFromSeo(seo: Partial<SeoEntry> | null | undefined, fallback: SeoFallback): Metadata {
  const title = seo?.metaTitle?.trim() || fallback.title;
  const description = seo?.metaDescription?.trim() || fallback.description;
  const canonical = seo?.canonicalUrl?.trim() || absoluteUrl(fallback.path);
  const ogTitle = seo?.ogTitle?.trim() || title;
  const ogDescription = seo?.ogDescription?.trim() || description;
  const ogImage = resolveManagedImage(seo?.ogImageUrl?.trim() || fallback.imageUrl || undefined);
  const twitterImage = resolveManagedImage(seo?.twitterImageUrl?.trim()) ?? ogImage;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical
    },
    robots: robotsFromDirective(seo?.robotsDirective),
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: brandConfig.name,
      type: fallback.type ?? "website",
      ...(ogImage ? { images: [{ url: ogImage, alt: ogTitle }] } : {})
    },
    twitter: {
      card: twitterImage ? "summary_large_image" : "summary",
      title: seo?.twitterTitle?.trim() || ogTitle,
      description: seo?.twitterDescription?.trim() || ogDescription,
      ...(twitterImage ? { images: [twitterImage] } : {})
    }
  };
}

export function robotsFromDirective(directive?: string | null): Metadata["robots"] {
  const normalized = directive?.toLowerCase().replace(/\s/g, "") || "index,follow";
  return {
    index: !normalized.includes("noindex"),
    follow: !normalized.includes("nofollow"),
    googleBot: {
      index: !normalized.includes("noindex"),
      follow: !normalized.includes("nofollow"),
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  };
}

export const privatePageMetadata: Metadata = {
  robots: robotsFromDirective("noindex,nofollow")
};

export function isPrivatePath(pathOrUrl: string) {
  const path = pathOrUrl.startsWith("http") ? new URL(pathOrUrl).pathname : pathOrUrl;
  return privateRobotsDisallow.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function normalizeSitemapEntries(entries: SitemapEntry[]) {
  const seen = new Set<string>();
  const normalized: SitemapEntry[] = [];

  for (const entry of entries) {
    const path = entry.path.startsWith("http") ? new URL(entry.path).pathname : entry.path;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (isPrivatePath(normalizedPath) || seen.has(normalizedPath)) {
      continue;
    }
    seen.add(normalizedPath);
    normalized.push({ ...entry, path: normalizedPath });
  }

  return normalized;
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brandConfig.name,
    url: siteUrl,
    logo: absoluteUrl("/icon.svg")
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brandConfig.name,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

export function buildProductJsonLd(product: ProductSummary) {
  const image = primaryImage(product);
  const resolvedImage = resolveManagedImage(image);
  const variant = primaryVariant(product) ?? product.variants[0];
  const brandName = productAttributeString(product, "brand") ?? product.seller.storeName;
  const gtin = productAttributeString(product, "gtin");
  const condition = productAttributeString(product, "condition");
  const reviewSummary = product.reviewSummary;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: resolvedImage ? [resolvedImage] : undefined,
    sku: variant?.sku,
    brand: {
      "@type": "Brand",
      name: brandName
    },
    gtin,
    itemCondition: condition ? productConditionSchemaUrl(condition) : undefined,
    category: product.category.name,
    offers: variant
      ? {
          "@type": "Offer",
          priceCurrency: variant.currency,
          price: (variant.pricePaise / 100).toFixed(2),
          availability: variant.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: absoluteUrl(`/products/${product.slug}`),
          seller: {
            "@type": "Organization",
            name: product.seller.storeName
          }
        }
      : undefined,
    aggregateRating:
      reviewSummary?.reviewCount && reviewSummary.averageRating
        ? {
            "@type": "AggregateRating",
            ratingValue: reviewSummary.averageRating,
            reviewCount: reviewSummary.reviewCount,
            bestRating: 5,
            worstRating: 1
          }
        : undefined
  };
}

export function productSeoFallbackTitle(product: ProductSummary) {
  return productAttributeString(product, "seoTitle") ?? `${product.name} Online`;
}

export function productSeoFallbackDescription(product: ProductSummary) {
  return productAttributeString(product, "seoDescription") ?? product.description;
}

function productAttributeString(product: ProductSummary, key: string) {
  const value = product.attributes?.[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function productConditionSchemaUrl(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("refurb")) {
    return "https://schema.org/RefurbishedCondition";
  }
  if (normalized.includes("used")) {
    return "https://schema.org/UsedCondition";
  }

  return "https://schema.org/NewCondition";
}

function resolveManagedImage(value?: string | null) {
  const resolved = resolveImageSource(value);
  return resolved ? absoluteUrl(resolved) : undefined;
}

export function buildStoreJsonLd(store: StoreProfile) {
  const address = store.addresses?.[0];
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: store.storeName,
    url: absoluteUrl(`/stores/${store.slug}`),
    image: store.profile?.logoUrl ? absoluteUrl(store.profile.logoUrl) : undefined,
    description: store.profile?.description ?? undefined,
    address: address
      ? {
          "@type": "PostalAddress",
          addressLocality: address.city,
          addressRegion: address.state,
          addressCountry: address.countryCode ?? "IN"
        }
      : undefined
  };
}

export function buildWebPageJsonLd(input: { title: string; description: string; path: string; pageType?: "WebPage" | "Article" }) {
  return {
    "@context": "https://schema.org",
    "@type": input.pageType ?? "WebPage",
    name: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    publisher: {
      "@type": "Organization",
      name: brandConfig.name,
      url: siteUrl
    }
  };
}

export async function productSeoData(slug: string) {
  const product = await safeData(() => getProduct(slug));
  const seo = await resolveSeoEntry({ entityType: "PRODUCT", entityId: product?.id, routePath: `/products/${slug}` });
  return { product, seo };
}

export async function categorySeoData(slug: string) {
  const category = await safeData(() => getCategory(slug));
  const seo = await resolveSeoEntry({ entityType: "CATEGORY", entityId: category?.id, routePath: `/categories/${slug}` });
  return { category, seo };
}

export async function storeSeoData(slug: string) {
  const store = await safeData(() => getStoreProfile(slug));
  const seo = await resolveSeoEntry({ entityType: "STORE", entityId: store?.id, routePath: `/stores/${slug}` });
  return { store, seo };
}

export async function cmsPageSeoData(slug: string) {
  const page = await safeData(() => getCmsPage(slug));
  const seo = await resolveSeoEntry({ entityType: "CMS_PAGE", entityId: page?.id, routePath: `/${slug}` });
  return { page, seo };
}

export async function safeData<T>(loader: () => Promise<T>) {
  try {
    return await loader();
  } catch {
    return null;
  }
}

async function safePublicFetch<T>(path: string) {
  if (skipDefaultLocalApiOnServer) {
    return null;
  }

  const controller =
    !Number.isFinite(apiRequestTimeoutMs) || apiRequestTimeoutMs <= 0
      ? null
      : new AbortController();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), apiRequestTimeoutMs)
    : null;

  try {
    const requestInit: RequestInit = {
      next: { revalidate: 300 },
      ...(controller?.signal ? { signal: controller.signal } : {}),
    };
    const response = await fetch(`${apiBaseUrl}${path}`, requestInit);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fallbackSitemapEntries(): Promise<SitemapEntry[]> {
  const [categories, products, stores, pages] = await Promise.all([
    safeData(() => listCategories()),
    safeData(() => listProducts({ limit: 100 })),
    safeData(() => listStores()),
    safePublicFetch<CmsPage[]>("/api/cms/pages")
  ]);

  return [
    ...staticPublicSitemapEntries,
    ...(categories ?? []).map((category: CategorySummary) => ({ path: `/categories/${category.slug}`, changeFrequency: "daily" as const, priority: 0.75, source: "category" })),
    ...(products?.items ?? []).map((product: ProductSummary) => ({ path: `/products/${product.slug}`, changeFrequency: "daily" as const, priority: 0.7, source: "product" })),
    ...(stores ?? []).map((store: StoreProfile) => ({ path: `/stores/${store.slug}`, changeFrequency: "weekly" as const, priority: 0.65, source: "store" })),
    ...(pages ?? []).map((page: CmsPage) => ({ path: `/${page.slug}`, changeFrequency: "monthly" as const, priority: 0.45, source: "cms_page" }))
  ];
}
