import { describe, expect, it, vi } from "vitest";
import {
  defaultReturnPolicySettings,
  normalizeReturnPolicySettings,
  readReturnPolicySettings,
  returnDeadline,
  returnPolicySettingKeys,
  returnWindowDaysForResolution,
} from "./return-policy-settings";

describe("return policy settings", () => {
  it("uses defaults and normalizes configured day windows", async () => {
    const client = {
      setting: {
        findMany: vi.fn(async () => [
          { key: returnPolicySettingKeys.returnWindowDays, value: "14" },
          { key: returnPolicySettingKeys.replacementWindowDays, value: 30.4 },
        ]),
      },
    };

    await expect(readReturnPolicySettings(client)).resolves.toEqual({
      returnWindowDays: 14,
      replacementWindowDays: 30,
    });
    expect(normalizeReturnPolicySettings({ returnWindowDays: -2, replacementWindowDays: 500 })).toEqual({
      returnWindowDays: 0,
      replacementWindowDays: 365,
    });
    expect(normalizeReturnPolicySettings({})).toEqual(defaultReturnPolicySettings);
  });

  it("derives the selected resolution window and exact deadline", () => {
    const settings = { returnWindowDays: 7, replacementWindowDays: 10 };
    expect(returnWindowDaysForResolution(settings, "REFUND")).toBe(7);
    expect(returnWindowDaysForResolution(settings, "REPLACEMENT")).toBe(10);
    expect(returnDeadline(new Date("2026-07-10T10:00:00.000Z"), 7).toISOString()).toBe(
      "2026-07-17T10:00:00.000Z",
    );
  });
});
