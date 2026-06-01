export const resaleProductConditions = ["Used", "Refurbished"] as const;

export type ResaleProductCondition = (typeof resaleProductConditions)[number];

type ProductVariantStockState = {
  stockQuantity?: number | null;
  status?: string | null;
};

type ProductLifecycleInput = {
  attributes?: unknown;
  variants?: ProductVariantStockState[] | null;
};

const resaleConditionSet = new Set(resaleProductConditions.map((condition) => condition.toLowerCase()));

export function productConditionValue(attributes: unknown) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }

  const condition = (attributes as Record<string, unknown>).condition;
  return typeof condition === "string" ? condition.trim() : null;
}

export function isResaleProductCondition(value: unknown) {
  return typeof value === "string" && resaleConditionSet.has(value.trim().toLowerCase());
}

export function hasActiveProductVariantStock(variants: ProductVariantStockState[] | null | undefined) {
  return Boolean(
    variants?.some((variant) => {
      const isActive = !variant.status || variant.status === "ACTIVE";
      return isActive && typeof variant.stockQuantity === "number" && variant.stockQuantity > 0;
    }),
  );
}

export function isSoldResaleProduct(product: ProductLifecycleInput) {
  return (
    isResaleProductCondition(productConditionValue(product.attributes)) &&
    !hasActiveProductVariantStock(product.variants)
  );
}
