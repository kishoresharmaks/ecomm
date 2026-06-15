import { describe, expect, it } from "vitest";
import { sanitizeMobileEventProperties } from "./mobile-telemetry-sanitize";

describe("mobile telemetry sanitization", () => {
  it("redacts free-text and PII-like event fields", () => {
    expect(
      sanitizeMobileEventProperties({
        email: "buyer@example.com",
        itemCount: 2,
        note: "Private note",
        reason: "Damaged product",
        status: 0,
      }),
    ).toEqual({
      itemCount: 2,
      status: 0,
    });
  });
});
