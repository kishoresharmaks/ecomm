export function isProductCardInStock(
  variant: Partial<{ status: string | null; stockQuantity: number | null }> | null | undefined,
): boolean {
  if (!variant) {
    return false;
  }
  const status = variant.status?.trim().toUpperCase();
  if (status === "INACTIVE" || status === "OUT_OF_STOCK" || status === "ARCHIVED") {
    return false;
  }
  if (typeof variant.stockQuantity === "number") {
    return variant.stockQuantity > 0;
  }
  return true;
}
