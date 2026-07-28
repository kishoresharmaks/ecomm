import { describe, expect, it } from "vitest";
import { rupeesToPaise } from "./money";

describe("seller mobile money helpers", () => {
  it("converts rupee form input to paise", () => {
    expect(rupeesToPaise("199.50")).toBe(19950);
    expect(rupeesToPaise("1,250")).toBe(125000);
  });

  it("returns zero for invalid or negative input", () => {
    expect(rupeesToPaise("bad")).toBe(0);
    expect(rupeesToPaise("-1")).toBe(0);
  });
});
