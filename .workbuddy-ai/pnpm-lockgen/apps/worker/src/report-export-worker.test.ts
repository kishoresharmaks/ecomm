import { describe, expect, it } from "vitest";
import {
  reportExportFilters,
  reportExportRetryDelayMs,
} from "./report-export-worker";

describe("report export worker helpers", () => {
  it("uses capped exponential retry delays", () => {
    expect(reportExportRetryDelayMs(1)).toBe(30_000);
    expect(reportExportRetryDelayMs(2)).toBe(60_000);
    expect(reportExportRetryDelayMs(10)).toBe(15 * 60_000);
  });

  it("accepts only supported non-empty string filters", () => {
    expect(
      reportExportFilters({
        dateFrom: "2026-07-01T00:00:00.000Z",
        search: "order-100",
        status: "",
        page: 2,
        unsafe: "ignored",
      }),
    ).toEqual({
      dateFrom: "2026-07-01T00:00:00.000Z",
      search: "order-100",
    });
  });
});
