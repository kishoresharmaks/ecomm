import { describe, expect, it } from "vitest";
import { formatVariantLabel } from "./order-variant";

describe("formatVariantLabel", () => {
  it("renders order variant snapshot objects as text labels", () => {
    expect(formatVariantLabel({ sku: "RICE-5KG", variantName: "5 KG Pack" })).toBe("5 KG Pack");
  });

  it("falls back to SKU when the variant name is missing", () => {
    expect(formatVariantLabel({ sku: "RICE-1KG", variantName: null })).toBe("RICE-1KG");
  });

  it("keeps legacy string snapshots working", () => {
    expect(formatVariantLabel("  Default option  ")).toBe("Default option");
  });

  it("ignores objects without renderable variant fields", () => {
    expect(formatVariantLabel({ sku: {}, variantName: [] })).toBeNull();
  });
});
