import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, impersonationHandoffRedirect } from "./proxy";

describe("web proxy matcher", () => {
  it("runs for RSC and prefetch requests so Clerk auth has middleware context", () => {
    expect(config.matcher).toHaveLength(1);
    expect(config.matcher[0]).not.toHaveProperty("missing");
  });
});

describe("impersonationHandoffRedirect", () => {
  it("moves the impersonation token from the seller URL into the cookie", () => {
    const response = impersonationHandoffRedirect(
      new NextRequest("https://1handindia.com/seller?ih_impersonate=ih_impersonate_abc.sig&tab=orders"),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://1handindia.com/seller?tab=orders");
    const cookie = response?.cookies.get("indihub_seller_impersonation");
    expect(cookie?.value).toBe("ih_impersonate_abc.sig");
    expect(cookie).toMatchObject({ path: "/", maxAge: 1800, sameSite: "lax", secure: true });
  });

  it("removes an invalid token from the URL without setting the cookie", () => {
    const response = impersonationHandoffRedirect(
      new NextRequest("https://1handindia.com/seller?ih_impersonate=forged"),
    );

    expect(response?.headers.get("location")).toBe("https://1handindia.com/seller");
    expect(response?.cookies.get("indihub_seller_impersonation")).toBeUndefined();
  });

  it("ignores requests without the parameter or outside Seller Center", () => {
    expect(impersonationHandoffRedirect(new NextRequest("https://1handindia.com/seller/orders"))).toBeNull();
    expect(
      impersonationHandoffRedirect(new NextRequest("https://1handindia.com/search?ih_impersonate=ih_impersonate_abc")),
    ).toBeNull();
  });
});
