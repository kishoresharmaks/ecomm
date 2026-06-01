import { describe, expect, it } from "vitest";
import { flattenCategories, sellerCategoryLabel, sellerCategoryOptions } from "./seller-api";
import type { CategorySummary } from "./storefront-api";

describe("seller category helpers", () => {
  it("deduplicates categories returned both as roots and children", () => {
    const child = category("child-1", "Men", "parent-1");
    const categories = [
      {
        ...category("parent-1", "Fashion"),
        children: [child],
      },
      child,
    ];

    expect(flattenCategories(categories).map((item) => item.id)).toEqual([
      "parent-1",
      "child-1",
    ]);
  });

  it("builds readable category paths for seller product forms", () => {
    const categories = [
      {
        ...category("parent-1", "Fashion"),
        children: [category("child-1", "Men", "parent-1")],
      },
      category("parent-2", "Electronics"),
    ];

    expect(sellerCategoryOptions(categories).map((option) => option.label)).toEqual([
      "Fashion",
      "Fashion / Men",
      "Electronics",
    ]);
    expect(sellerCategoryLabel(categories, "child-1")).toBe("Fashion / Men");
  });
});

function category(id: string, name: string, parentId: string | null = null) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    parentId,
  } as CategorySummary;
}
