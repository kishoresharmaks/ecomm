import { afterEach, describe, expect, it } from "vitest";
import { sellerPortalReportUrl, sellerReportDateQuery } from "./report-navigation";

const originalPortalUrl = process.env.EXPO_PUBLIC_SELLER_PORTAL_URL;

afterEach(() => {
  if (originalPortalUrl === undefined) delete process.env.EXPO_PUBLIC_SELLER_PORTAL_URL;
  else process.env.EXPO_PUBLIC_SELLER_PORTAL_URL = originalPortalUrl;
});

describe("seller report navigation", () => {
  const now = new Date(2026, 6, 22, 12);

  it("converts report period presets to inclusive local-day timestamps", () => {
    const end = new Date(2026, 6, 22, 23, 59, 59, 999).toISOString();
    expect(sellerReportDateQuery("today", now)).toEqual({
      dateFrom: new Date(2026, 6, 22).toISOString(),
      dateTo: end,
    });
    expect(sellerReportDateQuery("month", now)).toEqual({
      dateFrom: new Date(2026, 6, 1).toISOString(),
      dateTo: end,
    });
    expect(sellerReportDateQuery("7d", now)).toEqual({
      dateFrom: new Date(2026, 6, 16).toISOString(),
      dateTo: end,
    });
    expect(sellerReportDateQuery("all", now)).toEqual({});
  });

  it("uses the production portal fallback and environment override", () => {
    delete process.env.EXPO_PUBLIC_SELLER_PORTAL_URL;
    expect(sellerPortalReportUrl("tax")).toBe("https://1handindia.com/seller/reports/tax");

    process.env.EXPO_PUBLIC_SELLER_PORTAL_URL = "https://seller.example.com/";
    expect(sellerPortalReportUrl("inventory")).toBe("https://seller.example.com/seller/reports/inventory");
  });
});
