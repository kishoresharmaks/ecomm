import { describe, expect, it, vi } from "vitest";
import { normalizeTraceIdentifier, requestContextMiddleware } from "./request-context";
import { redactSensitive, redactText } from "./redaction";

describe("request context", () => {
  it("accepts bounded trace identifiers and rejects unsafe values", () => {
    expect(normalizeTraceIdentifier("req-123:child")).toBe("req-123:child");
    expect(normalizeTraceIdentifier("bad value with spaces")).toBeUndefined();
    expect(normalizeTraceIdentifier("x".repeat(129))).toBeUndefined();
  });

  it("propagates request and correlation identifiers to response headers", () => {
    const headers = new Map<string, string>();
    const req = { header: (name: string) => ({ "x-request-id": "req-1", "x-correlation-id": "corr-1" })[name] };
    const res = { setHeader: (name: string, value: string) => headers.set(name, value) };
    const next = vi.fn();
    requestContextMiddleware(req as never, res as never, next);
    expect(headers.get("x-request-id")).toBe("req-1");
    expect(headers.get("x-correlation-id")).toBe("corr-1");
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("log redaction", () => {
  it("redacts nested credentials and bearer tokens", () => {
    expect(
      redactSensitive({ authorization: "Bearer abc.def", nested: { password: "secret", safe: "ok" } }),
    ).toEqual({ authorization: "[REDACTED]", nested: { password: "[REDACTED]", safe: "ok" } });
    expect(redactText("Authorization Bearer abc.def token=hello")).toBe(
      "Authorization Bearer [REDACTED] token=[REDACTED]",
    );
  });
});
