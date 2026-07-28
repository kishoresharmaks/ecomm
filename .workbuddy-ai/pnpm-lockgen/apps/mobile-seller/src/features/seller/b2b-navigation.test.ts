import { afterEach, describe, expect, it } from "vitest";
import {
  sellerPortalB2BEnquiriesUrl,
  sellerPortalB2BEnquiryUrl,
  sellerPortalB2BOrderUrl,
  sellerPortalB2BOrdersUrl,
} from "./b2b-navigation";

const originalPortalUrl = process.env.EXPO_PUBLIC_SELLER_PORTAL_URL;

afterEach(() => {
  if (originalPortalUrl === undefined) delete process.env.EXPO_PUBLIC_SELLER_PORTAL_URL;
  else process.env.EXPO_PUBLIC_SELLER_PORTAL_URL = originalPortalUrl;
});

describe("seller B2B portal navigation", () => {
  it("builds direct B2B list and detail links", () => {
    process.env.EXPO_PUBLIC_SELLER_PORTAL_URL = "https://seller.example.com/";

    expect(sellerPortalB2BEnquiriesUrl()).toBe("https://seller.example.com/seller/b2b-enquiries");
    expect(sellerPortalB2BOrdersUrl()).toBe("https://seller.example.com/seller/b2b-orders");
    expect(sellerPortalB2BEnquiryUrl("enquiry/1")).toBe("https://seller.example.com/seller/b2b-enquiries/enquiry%2F1");
    expect(sellerPortalB2BOrderUrl("B2B 1001")).toBe("https://seller.example.com/seller/b2b-orders/B2B%201001");
  });
});
