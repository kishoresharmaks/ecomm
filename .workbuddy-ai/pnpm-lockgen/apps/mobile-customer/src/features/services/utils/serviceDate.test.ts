import { describe, expect, it } from "vitest";
import {
  earliestServiceDate,
  parseServiceDate,
  serviceDateKey,
  serviceDatePickerValue,
} from "./serviceDate";

describe("service date helpers", () => {
  it("round-trips a local calendar date without a UTC day shift", () => {
    const parsed = parseServiceDate("2026-08-05");
    expect(parsed).not.toBeNull();
    expect(serviceDateKey(parsed!)).toBe("2026-08-05");
  });

  it("rejects calendar dates that JavaScript would otherwise normalize", () => {
    expect(parseServiceDate("2026-02-31")).toBeNull();
    expect(parseServiceDate("05-08-2026")).toBeNull();
  });

  it("uses today as the earliest and default selectable date", () => {
    const now = new Date(2026, 6, 17, 18, 45);
    expect(serviceDateKey(earliestServiceDate(now))).toBe("2026-07-17");
    expect(serviceDateKey(serviceDatePickerValue(null, now))).toBe("2026-07-17");
  });
});
