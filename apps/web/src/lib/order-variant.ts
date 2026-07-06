export type OrderVariantSnapshot =
  | string
  | {
      sku?: string | null;
      variantName?: string | null;
    }
  | null;

export function formatVariantLabel(value: OrderVariantSnapshot | unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "object" && value !== null) {
    const snapshot = value as { variantName?: unknown; sku?: unknown };
    const name =
      typeof snapshot.variantName === "string" && snapshot.variantName.trim()
        ? snapshot.variantName.trim()
        : null;
    const sku =
      typeof snapshot.sku === "string" && snapshot.sku.trim() ? snapshot.sku.trim() : null;

    return name ?? sku ?? null;
  }

  return null;
}
