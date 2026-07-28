import { describe, expect, it } from "vitest";
import { resolveAuthAudience, safeRedirectPath } from "./auth-page-routing";

describe("auth page routing presentation", () => {
  it("selects the portal identity from explicit audience and redirect context", () => {
    expect(resolveAuthAudience("customer", "/account")).toBe("customer");
    expect(resolveAuthAudience("customer", "/seller/register")).toBe("seller");
    expect(resolveAuthAudience("customer", "/b2b/register")).toBe("b2b");
    expect(resolveAuthAudience("seller", "/account")).toBe("seller");
  });

  it("accepts local redirects and rejects external redirect forms", () => {
    expect(safeRedirectPath("/orders/123")).toBe("/orders/123");
    expect(safeRedirectPath("//example.com/account")).toBeNull();
    expect(safeRedirectPath("https://example.com/account")).toBeNull();
    expect(safeRedirectPath(null)).toBeNull();
  });
});
