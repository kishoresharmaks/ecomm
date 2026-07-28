import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkoutSource = readFileSync(new URL("./checkout-page-client.tsx", import.meta.url), "utf8");
const cartSource = readFileSync(new URL("./cart-page-client.tsx", import.meta.url), "utf8");
const headerSource = readFileSync(new URL("./storefront-header.tsx", import.meta.url), "utf8");
const searchSource = readFileSync(new URL("./storefront-search-client.tsx", import.meta.url), "utf8");
const productCardSource = readFileSync(new URL("./product-card.tsx", import.meta.url), "utf8");

describe("customer storefront flow boundaries", () => {
  it("keeps a Razorpay order pending when client verification cannot complete", () => {
    const verificationBlock = checkoutSource.slice(
      checkoutSource.indexOf("const verification = await verifyRazorpayPayment"),
      checkoutSource.indexOf("onSuccess: (order)"),
    );

    expect(verificationBlock).toContain("catch {");
    expect(verificationBlock).toContain("return order;");
    expect(verificationBlock).not.toContain("cancelRazorpayOrder");
  });

  it("carries an applied coupon from cart into checkout", () => {
    expect(cartSource).toContain("/checkout?couponCode=");
    expect(checkoutSource).toContain('searchParams.get("couponCode")');
  });

  it("synchronizes header and search-page state with URL navigation", () => {
    expect(headerSource).toContain("setQuery(urlQuery)");
    expect(searchSource).toContain("setSubmittedSearch(initialSearch.trim())");
  });

  it("keeps cart and wishlist observers out of every product card", () => {
    expect(productCardSource).not.toContain("useStorefrontWishlist");
    expect(productCardSource).not.toContain("getCart");
    expect(productCardSource).not.toContain("useQuery(");
  });
});
