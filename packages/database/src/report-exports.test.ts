import { describe, expect, it } from "vitest";
import { gstr1ReviewPeriod, reportExportDate } from "./report-exports";

describe("GSTR-1 review periods", () => {
  it("accepts a complete leap-year February using India timezone boundaries", () => {
    const period = gstr1ReviewPeriod({
      dateFrom: "2024-02-01",
      dateTo: "2024-02-29",
    });

    expect(period.kind).toBe("MONTH");
    expect(period.from.toISOString()).toBe("2024-01-31T18:30:00.000Z");
    expect(period.toExclusive.toISOString()).toBe("2024-02-29T18:30:00.000Z");
  });

  it("accepts a standard GST quarter", () => {
    expect(
      gstr1ReviewPeriod({
        dateFrom: "2026-04-01",
        dateTo: "2026-06-30",
      }),
    ).toMatchObject({
      kind: "QUARTER",
      label: "2026-04-01_to_2026-06-30",
    });
  });

  it("rejects partial and invalid periods", () => {
    expect(() =>
      gstr1ReviewPeriod({
        dateFrom: "2026-06-02",
        dateTo: "2026-06-30",
      }),
    ).toThrow("complete calendar month");
    expect(() =>
      gstr1ReviewPeriod({
        dateFrom: "2026-02-01",
        dateTo: "2026-02-30",
      }),
    ).toThrow("valid GSTR-1 review period");
  });
});

describe("queued report date boundaries", () => {
  it("treats date-only end filters as the full UTC calendar day", () => {
    expect(reportExportDate("2026-07-22", false).toISOString()).toBe(
      "2026-07-22T00:00:00.000Z",
    );
    expect(reportExportDate("2026-07-22", true).toISOString()).toBe(
      "2026-07-22T23:59:59.999Z",
    );
    expect(
      reportExportDate("2026-07-22T15:30:00.000Z", true).toISOString(),
    ).toBe("2026-07-22T15:30:00.000Z");
  });
});
