"use client";

import { marketplaceProductCardFields } from "@indihub/shared-types";
import { cn } from "@indihub/ui";
import type { ProductSummary } from "@/lib/storefront-api";

type StorefrontProductAttributeChipsProps = {
  product: ProductSummary;
  limit?: number;
  variant?: "chips" | "inline";
  className?: string;
};

export function StorefrontProductAttributeChips({
  product,
  limit = 3,
  variant = "chips",
  className,
}: StorefrontProductAttributeChipsProps) {
  const chips = productAttributeChips(product, limit);

  if (!chips.length) {
    return null;
  }

  if (variant === "inline") {
    return <p className={cn("mt-1 text-xs font-semibold text-[#98A2B3]", className)}>{chips.join(" | ")}</p>;
  }

  return (
    <div className={cn("mt-2 flex flex-wrap gap-2", className)}>
      {chips.map((chip) => (
        <span key={chip} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-1 text-xs font-bold text-[#667085]">
          {chip}
        </span>
      ))}
    </div>
  );
}

export function productAttributeChips(product: ProductSummary, limit = 3) {
  return marketplaceProductCardFields
    .map((field) => {
      const value = displayStorefrontAttributeValue(product.attributes?.[field.key]);
      return value ? `${field.label}: ${value}` : null;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, limit);
}

export function displayStorefrontAttributeValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  return "";
}
