import type { ProductSummary } from "./seller-api";

export type ProductCatalogueFilter =
  | "all"
  | "live"
  | "under-review"
  | "rejected"
  | "inactive"
  | "draft";

export type ProductCatalogueTone = "info" | "success" | "warning" | "danger";

export const PRODUCT_CATALOGUE_FILTERS: Array<{ label: string; value: ProductCatalogueFilter }> = [
  { label: "All", value: "all" },
  { label: "Live", value: "live" },
  { label: "Under review", value: "under-review" },
  { label: "Rejected", value: "rejected" },
  { label: "Inactive", value: "inactive" },
  { label: "Draft", value: "draft" },
];

export type ProductCatalogueQuery = {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "DRAFT";
  approvalStatus?: "APPROVED" | "PENDING_APPROVAL" | "REJECTED";
};

export function buildProductCatalogueQuery(
  filter: ProductCatalogueFilter,
  searchValue: string,
): ProductCatalogueQuery {
  const query: ProductCatalogueQuery = {};
  const search = searchValue.trim();

  if (search.length >= 2) {
    query.search = search;
  }

  if (filter === "live") {
    query.status = "ACTIVE";
    query.approvalStatus = "APPROVED";
  } else if (filter === "under-review") {
    query.approvalStatus = "PENDING_APPROVAL";
  } else if (filter === "rejected") {
    query.approvalStatus = "REJECTED";
  } else if (filter === "inactive") {
    query.status = "INACTIVE";
  } else if (filter === "draft") {
    query.status = "DRAFT";
  }

  return query;
}

export function productPrimaryImage(product: ProductSummary) {
  const images = [...(product.images ?? [])].sort(
    (left, right) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER),
  );

  return images.find((image) => image.isPrimary && image.url)?.url
    ?? images.find((image) => image.url)?.url
    ?? product.imageUrl
    ?? null;
}

export function summarizeProductVariants(product: ProductSummary) {
  const variants = product.variants ?? [];
  const prices = variants.map((variant) => variant.pricePaise);
  const stocks = variants.map((variant) => variant.stockQuantity ?? 0);

  return {
    variantCount: variants.length,
    totalStock: stocks.reduce((total, stock) => total + stock, 0),
    outOfStockCount: stocks.filter((stock) => stock <= 0).length,
    lowStockCount: stocks.filter((stock) => stock > 0 && stock <= 5).length,
    minPricePaise: prices.length ? Math.min(...prices) : null,
    maxPricePaise: prices.length ? Math.max(...prices) : null,
    currency: variants.find((variant) => variant.currency)?.currency ?? "INR",
  };
}

export function productCatalogueStatuses(product: ProductSummary) {
  const lifecycle = lifecycleStatuses[product.status ?? "DRAFT"] ?? {
    label: humanizeStatus(product.status ?? "DRAFT"),
    tone: "info" as const,
  };
  const approval = approvalStatuses[product.approvalStatus ?? "DRAFT"] ?? {
    label: humanizeStatus(product.approvalStatus ?? "DRAFT"),
    tone: "info" as const,
  };

  return { lifecycle, approval };
}

const lifecycleStatuses: Record<string, { label: string; tone: ProductCatalogueTone }> = {
  DRAFT: { label: "Draft", tone: "info" },
  ACTIVE: { label: "Live", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "warning" },
  ARCHIVED: { label: "Archived", tone: "danger" },
};

const approvalStatuses: Record<string, { label: string; tone: ProductCatalogueTone }> = {
  DRAFT: { label: "Not submitted", tone: "info" },
  PENDING_APPROVAL: { label: "Under review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

function humanizeStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
