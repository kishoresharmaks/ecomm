import { describe, expect, it } from "vitest";
import { movePopupIndex, resolvePopupDestination } from "./popup-announcement";

describe("popup announcements", () => {
  it("routes internal and first-party links inside the storefront", () => {
    expect(resolvePopupDestination("/deals")).toEqual({ type: "internal", href: "/deals" });
    expect(resolvePopupDestination("https://1handindia.com/categories?view=all")).toEqual({
      type: "internal",
      href: "/categories?view=all",
    });
    expect(resolvePopupDestination("onehandindia:///deals")).toEqual({ type: "internal", href: "/deals" });
  });

  it("rejects unsafe links and wraps carousel indexes", () => {
    expect(resolvePopupDestination("javascript:alert(1)")).toBeNull();
    expect(movePopupIndex(0, -1, 3)).toBe(2);
    expect(movePopupIndex(2, 1, 3)).toBe(0);
  });
});
