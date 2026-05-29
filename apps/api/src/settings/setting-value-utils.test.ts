import { SettingValueType } from "@indihub/database";
import { describe, expect, it } from "vitest";
import { normalizeTypedSettingValue, readBooleanSetting, readNumberSetting } from "./setting-value-utils";

describe("setting value utilities", () => {
  it("reads legacy string booleans without falling back", () => {
    expect(readBooleanSetting("true", false)).toBe(true);
    expect(readBooleanSetting("false", true)).toBe(false);
    expect(readBooleanSetting("enabled", false)).toBe(true);
    expect(readBooleanSetting("off", true)).toBe(false);
  });

  it("reads legacy string numbers without falling back", () => {
    expect(readNumberSetting("250", 0)).toBe(250);
    expect(readNumberSetting("12.5", 0)).toBe(12.5);
    expect(readNumberSetting("not-a-number", 99)).toBe(99);
  });

  it("normalizes typed setting values for admin settings responses", () => {
    expect(normalizeTypedSettingValue(SettingValueType.BOOLEAN, "true")).toBe(true);
    expect(normalizeTypedSettingValue(SettingValueType.NUMBER, "500")).toBe(500);
    expect(normalizeTypedSettingValue(SettingValueType.STRING, "500")).toBe("500");
  });
});
