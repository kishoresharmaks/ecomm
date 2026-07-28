import { describe, expect, it } from "vitest";
import { formatLocalAreaLabel, normalizeLocalAreaSearchValue } from "./location-utils";

describe("location area utilities", () => {
  it("keeps local-area display labels searchable after selection", () => {
    expect(formatLocalAreaLabel({ name: "Mettu Street", postalCode: "636001" })).toBe("Mettu Street (636001)");
    expect(normalizeLocalAreaSearchValue("Mettu Street (636001)")).toBe("Mettu Street");
  });

  it("falls back to pincode search when the display label has no area text", () => {
    expect(normalizeLocalAreaSearchValue("(636001)")).toBe("636001");
  });
});
