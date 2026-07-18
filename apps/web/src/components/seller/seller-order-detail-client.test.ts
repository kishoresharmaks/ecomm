import { describe, expect, it } from "vitest";
import { mergePackageDrafts } from "./seller-package-drafts";

describe("mergePackageDrafts", () => {
  it("preserves dirty drafts while refreshing clean package values", () => {
    const current = {
      "package-1": {
        weightGrams: "999",
        lengthCm: "25",
        breadthCm: "20",
        heightCm: "10",
      },
      "package-2": {
        weightGrams: "100",
        lengthCm: "10",
        breadthCm: "8",
        heightCm: "4",
      },
    };

    const result = mergePackageDrafts(
      current,
      [
        {
          id: "package-1",
          weightGrams: 500,
          lengthCm: 15,
          breadthCm: 12,
          heightCm: 6,
        },
        {
          id: "package-2",
          weightGrams: 250,
          lengthCm: 20,
          breadthCm: 14,
          heightCm: 7,
        },
      ],
      new Set(["package-1"]),
    );

    expect(result["package-1"]).toEqual(current["package-1"]);
    expect(result["package-2"]).toEqual({
      weightGrams: "250",
      lengthCm: "20",
      breadthCm: "14",
      heightCm: "7",
    });
  });
});
