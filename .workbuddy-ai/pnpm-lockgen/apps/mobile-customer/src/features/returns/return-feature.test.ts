import { describe, expect, it } from "vitest";
import { isMobileReturnsEnabled, parseRolloutPercent, stablePercentBucket } from "./return-feature";

describe("mobile returns feature gate", () => {
  it("defaults to enabled and clamps rollout percentages", () => {
    expect(parseRolloutPercent(undefined)).toBe(100);
    expect(parseRolloutPercent("101")).toBe(100);
    expect(parseRolloutPercent("-5")).toBe(0);
    expect(parseRolloutPercent("bad")).toBe(100);
  });

  it("supports explicit disable and stable percentage rollout", () => {
    const previousEnabled = process.env.EXPO_PUBLIC_ENABLE_RETURNS;
    const previousPercent = process.env.EXPO_PUBLIC_RETURNS_ROLLOUT_PERCENT;
    process.env.EXPO_PUBLIC_ENABLE_RETURNS = "false";
    expect(isMobileReturnsEnabled("customer-a")).toBe(false);

    process.env.EXPO_PUBLIC_ENABLE_RETURNS = "true";
    process.env.EXPO_PUBLIC_RETURNS_ROLLOUT_PERCENT = "1";
    const key = "customer-a";
    expect(isMobileReturnsEnabled(key)).toBe(stablePercentBucket(key) < 1);

    process.env.EXPO_PUBLIC_ENABLE_RETURNS = previousEnabled;
    process.env.EXPO_PUBLIC_RETURNS_ROLLOUT_PERCENT = previousPercent;
  });
});
