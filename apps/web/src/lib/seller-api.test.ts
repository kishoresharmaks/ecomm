import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flattenCategories,
  getSellerGstDocuments,
  getSellerGstReportCsvUrl,
  sellerCategoryLabel,
  sellerCategoryOptions,
} from "./seller-api";
import type { CategorySummary } from "./storefront-api";

describe("seller category helpers", () => {
  it("deduplicates categories returned both as roots and children", () => {
    const child = category("child-1", "Men", "parent-1");
    const categories = [
      {
        ...category("parent-1", "Fashion"),
        children: [child],
      },
      child,
    ];

    expect(flattenCategories(categories).map((item) => item.id)).toEqual([
      "parent-1",
      "child-1",
    ]);
  });

  it("builds readable category paths for seller product forms", () => {
    const categories = [
      {
        ...category("parent-1", "Fashion"),
        children: [category("child-1", "Men", "parent-1")],
      },
      category("parent-2", "Electronics"),
    ];

    expect(sellerCategoryOptions(categories).map((option) => option.label)).toEqual([
      "Fashion",
      "Fashion / Men",
      "Electronics",
    ]);
    expect(sellerCategoryLabel(categories, "child-1")).toBe("Fashion / Men");
  });
});

describe("seller GST report URLs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts date-only filters to stable UTC day boundaries", () => {
    const url = new URL(
      getSellerGstReportCsvUrl("gstr-1", {
        dateFrom: "2026-07-01",
        dateTo: "2026-07-20",
      }),
      "https://seller.test",
    );

    expect(url.pathname).toBe("/api/seller/reports/export/gstr-1");
    expect(url.searchParams.get("dateFrom")).toBe(
      new Date(Date.UTC(2026, 6, 1, 0, 0, 0, 0)).toISOString(),
    );
    expect(url.searchParams.get("dateTo")).toBe(
      new Date(Date.UTC(2026, 6, 20, 23, 59, 59, 999)).toISOString(),
    );
  });

  it("ignores malformed date-only filters instead of crashing URL creation", () => {
    expect(() => getSellerGstReportCsvUrl("gstr-1", { dateFrom: "not-a-date", dateTo: "2026-02-31" })).not.toThrow();

    const url = new URL(
      getSellerGstReportCsvUrl("gstr-1", { dateFrom: "not-a-date", dateTo: "2026-02-31" }),
      "https://seller.test",
    );
    expect(url.searchParams.has("dateFrom")).toBe(false);
    expect(url.searchParams.has("dateTo")).toBe(false);
  });

  it("supports advanced authenticated GST compliance export routes", () => {
    expect(getSellerGstReportCsvUrl("gstr-3b")).toBe(
      "/api/seller/reports/export/gstr-3b",
    );
    expect(getSellerGstReportCsvUrl("gstr-8")).toBe(
      "/api/seller/reports/export/gstr-8",
    );
    expect(getSellerGstReportCsvUrl("reconciliation")).toBe(
      "/api/seller/reports/export/reconciliation",
    );
    expect(getSellerGstReportCsvUrl("e-invoice")).toBe(
      "/api/seller/reports/export/e-invoice",
    );
  });

  it("serializes seller GST document pagination and filters without a seller override", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [],
          total: 0,
          page: 2,
          limit: 25,
          totalPages: 1,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await getSellerGstDocuments(
      { bearerToken: "seller-token" },
      {
        page: 2,
        limit: 25,
        dateFrom: "2026-07-01",
        dateTo: "2026-07-20",
        documentType: "TAX_INVOICE",
        search: "TI/26-27",
      },
    );

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/api/seller/reports/gst-documents");
    expect(requestUrl.searchParams.get("page")).toBe("2");
    expect(requestUrl.searchParams.get("limit")).toBe("25");
    expect(requestUrl.searchParams.get("documentType")).toBe("TAX_INVOICE");
    expect(requestUrl.searchParams.get("search")).toBe("TI/26-27");
    expect(requestUrl.searchParams.has("sellerId")).toBe(false);
    expect(requestUrl.searchParams.get("dateFrom")).toBe(
      new Date(Date.UTC(2026, 6, 1, 0, 0, 0, 0)).toISOString(),
    );
  });
});

function category(id: string, name: string, parentId: string | null = null) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    parentId,
  } as CategorySummary;
}
