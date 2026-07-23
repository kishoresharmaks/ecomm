import { describe, expect, it } from "vitest";
import { reportPresetRange, reportQueryString } from "./report-exports-api";

describe("report export web helpers", () => {
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
});
