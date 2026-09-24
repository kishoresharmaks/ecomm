import { describe, expect, it } from "vitest";
import { customerSignInHref, resolveAuthAudience, safeRedirectPath } from "./auth-page-routing";

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

  it("builds a customer sign-in link that returns to the current page", () => {
    expect(customerSignInHref("/products/moringa-powder")).toBe("/sign-in?redirect_url=%2Fproducts%2Fmoringa-powder");
    expect(customerSignInHref("/search?q=tea")).toBe("/sign-in?redirect_url=%2Fsearch%3Fq%3Dtea");
    expect(customerSignInHref("//example.com")).toBe("/sign-in");
  });
});
