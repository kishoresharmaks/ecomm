import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../../app/(storefront)/page.tsx", import.meta.url),
  "utf8",
);
const clientSource = readFileSync(
  new URL("./storefront-home-client.tsx", import.meta.url),
  "utf8",
);
const sectionsSource = readFileSync(
  new URL("./storefront-home-sections.tsx", import.meta.url),
  "utf8",
);

describe("storefront home RSC boundary", () => {
  it("keeps the full homepage payload out of client component props", () => {
    expect(pageSource).not.toContain("initialHome=");
    expect(pageSource).not.toContain("<StorefrontHomeClient");
    expect(clientSource).not.toContain("StorefrontHomePayload");
    expect(clientSource).not.toContain("getStorefrontHome");
  });

  it("renders heavy homepage sections from a server component module", () => {
    expect(sectionsSource.startsWith('"use client"')).toBe(false);
    expect(sectionsSource).not.toContain('from "@indihub/ui"');
    expect(sectionsSource).toContain('from "@indihub/ui/cn"');
    expect(sectionsSource).toContain("export function StorefrontHome");
    expect(sectionsSource).toContain("<Suspense");
  });

  it("constrains interactive rails to the mobile viewport", () => {
    expect(clientSource).toContain('cn("relative min-w-0 max-w-full", className)');
  });

  it("normalizes lightweight order products without assuming catalogue arrays", () => {
    expect(clientSource).toContain("function productFromOrderItem(");
    expect(clientSource).toContain("Array.isArray(product.images)");
    expect(clientSource).toContain("Array.isArray(product.variants)");
    expect(clientSource).not.toContain("const variant = product.variants[0]");
  });
});
