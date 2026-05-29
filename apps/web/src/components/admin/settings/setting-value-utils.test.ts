import { describe, expect, it } from "vitest";
import { readBooleanSettingValue, readNumberSettingValue } from "./setting-value-utils";

describe("admin setting value utilities", () => {
  it("keeps string-stored toggles from appearing reset", () => {
    expect(readBooleanSettingValue("true", false)).toBe(true);
    expect(readBooleanSettingValue("false", true)).toBe(false);
    expect(readBooleanSettingValue("1", false)).toBe(true);
    expect(readBooleanSettingValue("0", true)).toBe(false);
  });

  it("hydrates string-stored numeric settings", () => {
    expect(readNumberSettingValue("250", 0)).toBe(250);
    expect(readNumberSettingValue("12.5", 0)).toBe(12.5);
    expect(readNumberSettingValue("bad", 100)).toBe(100);
  });
});
