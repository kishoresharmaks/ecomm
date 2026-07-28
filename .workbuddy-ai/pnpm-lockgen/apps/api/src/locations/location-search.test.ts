import { describe, expect, it } from "vitest";
import { normalizeLocationAreaSearchTerms } from "./location-search";

describe("normalizeLocationAreaSearchTerms", () => {
  it("searches local-area display labels by area name and pincode", () => {
    expect(normalizeLocationAreaSearchTerms("Mettu Street (636001)")).toEqual(["Mettu Street", "636001"]);
  });

  it("keeps normal typed search unchanged", () => {
    expect(normalizeLocationAreaSearchTerms("Mettu")).toEqual(["Mettu"]);
  });
});
