import { primaryImage, primaryVariant, type ProductSummary } from "./storefront-api";

export type RecentProductSnapshot = {
  categoryId?: string | null;
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  sellerSlug?: string | null;
  pricePaise: number | null;
  mrpPaise: number | null;
  viewedAt: string;
};

const recentProductsStorageKey = "indihub:customer:recent-products";
const recentProductsLimit = 12;

export function readRecentProducts() {
  if (typeof window === "undefined") {
    return [] satisfies RecentProductSnapshot[];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentProductsStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRecentProductSnapshot).slice(0, recentProductsLimit);
  } catch {
    return [];
  }
}

export function rememberRecentProduct(product: ProductSummary) {
  if (typeof window === "undefined") {
    return;
  }

  const snapshot = productToRecentSnapshot(product);
  const next = [
    snapshot,
    ...readRecentProducts().filter((item) => item.id !== snapshot.id && item.slug !== snapshot.slug),
  ].slice(0, recentProductsLimit);

  window.localStorage.setItem(recentProductsStorageKey, JSON.stringify(next));
}

function productToRecentSnapshot(product: ProductSummary): RecentProductSnapshot {
  const variant = primaryVariant(product);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: primaryImage(product),
    categoryId: product.categoryId ?? product.category?.id ?? null,
    categoryName: product.category?.name ?? "Marketplace",
    categorySlug: product.category?.slug ?? null,
    sellerId: product.sellerId ?? product.seller?.id ?? null,
    sellerName: product.seller?.storeName ?? "1HandIndia seller",
    sellerSlug: product.seller?.slug ?? null,
    pricePaise: variant?.pricePaise ?? null,
    mrpPaise: variant?.mrpPaise ?? null,
    viewedAt: new Date().toISOString(),
  };
}

function isRecentProductSnapshot(value: unknown): value is RecentProductSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<RecentProductSnapshot>;
  return Boolean(
    item.id &&
      item.name &&
      item.slug &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.slug === "string",
  );
}
