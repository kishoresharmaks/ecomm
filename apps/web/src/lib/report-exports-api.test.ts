import { afterEach, describe, expect, it, vi } from "vitest";
import { adminCookieSessionMarker } from "./api";
import {
  createReportExport,
  downloadReportExport,
  gstr1ReviewMonthRange,
  gstr1ReviewQuarterRange,
  reportPresetRange,
  reportQueryString,
} from "./report-exports-api";

describe("report export web helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds inclusive report period presets", () => {
    expect(
      reportPresetRange("LAST_7_DAYS", new Date(2026, 6, 22, 12, 0, 0)),
    ).toEqual({
      dateFrom: "2026-07-16",
      dateTo: "2026-07-22",
    });
    expect(reportPresetRange("ALL_TIME")).toEqual({
      dateFrom: "",
      dateTo: "",
    });
  });

  it("serializes local date inputs as inclusive ISO boundaries", () => {
    const query = new URLSearchParams(
      reportQueryString({
        dateFrom: "2026-07-01",
        dateTo: "2026-07-22",
        search: "ORD-100",
        status: "",
      }),
    );
    const from = new Date(query.get("dateFrom") ?? "");
    const to = new Date(query.get("dateTo") ?? "");

    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(6);
    expect(from.getDate()).toBe(1);
    expect(from.getHours()).toBe(0);
    expect(to.getDate()).toBe(22);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
    expect(query.get("search")).toBe("ORD-100");
    expect(query.get("status")).toBeNull();
  });

  it("builds complete GSTR-1 month and quarter ranges", () => {
    expect(gstr1ReviewMonthRange("2024-02")).toEqual({
      dateFrom: "2024-02-01",
      dateTo: "2024-02-29",
    });
    expect(gstr1ReviewQuarterRange(2026, 2)).toEqual({
      dateFrom: "2026-04-01",
      dateTo: "2026-06-30",
    });
  });

  it("posts inclusive date boundaries for queued report exports", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "export_1", status: "PENDING" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await createReportExport(
      { bearerToken: "seller-token" },
      "seller",
      "SELLER_RETURNS",
      {
        dateFrom: "2026-07-01",
        dateTo: "2026-07-22",
        page: 2,
        limit: 20,
      },
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      exportType: "SELLER_RETURNS",
      dateFrom: new Date(2026, 6, 1, 0, 0, 0, 0).toISOString(),
      dateTo: new Date(2026, 6, 22, 23, 59, 59, 999).toISOString(),
    });
    expect(body.page).toBeUndefined();
    expect(body.limit).toBeUndefined();
  });

  it("preserves date-only periods required by GSTR-1 review exports", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "export_2", status: "PENDING" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await createReportExport(
      { bearerToken: "seller-token" },
      "seller",
      "GSTR1_REVIEW_SELLER_XLSX",
      { dateFrom: "2026-07-01", dateTo: "2026-07-31" },
    );

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      exportType: "GSTR1_REVIEW_SELLER_XLSX",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
    });
  });

  it("downloads finance report exports with credentials: include for back-office sessions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(new Blob(["payment_id,order_number,amount\npay_1,ord_1,500"]), {
        status: 200,
        headers: {
          "content-disposition": 'attachment; filename="1handindia-finance-payments.csv"',
          "content-type": "text/csv",
        },
      }),
    );
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const anchor = { href: "", download: "", click, remove };
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue(anchor),
      body: { appendChild },
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:finance-export");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    try {
      await downloadReportExport(
        { bearerToken: adminCookieSessionMarker },
        "finance",
        { id: "export-job-789", fileName: "1handindia-finance-payments.csv" },
      );

      expect(fetchMock).toHaveBeenCalledOnce();
      const callUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(callUrl).toContain("/api/admin/finance/report-exports/export-job-789/download");

      const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(requestInit.credentials).toBe("include");
      expect(new Headers(requestInit.headers).get("authorization")).toBeNull();
      expect(anchor.download).toBe("1handindia-finance-payments.csv");
      expect(anchor.href).toBe("blob:finance-export");
      expect(click).toHaveBeenCalledOnce();
      expect(remove).toHaveBeenCalledOnce();
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:finance-export");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
