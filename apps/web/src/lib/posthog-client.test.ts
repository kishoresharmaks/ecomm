import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "posthog-js";
import {
  capturePostHogEvent,
  capturePostHogException,
  dropStacklessNonErrorExceptions,
  getPostHogHost,
  getPostHogToken,
  getPostHogUiHost,
  identifyPostHogUser,
  isPostHogConfigured,
  resetPostHogUser,
} from "./posthog-client";

describe("posthog-client helper", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads token from NEXT_PUBLIC_POSTHOG_KEY", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key_123");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    expect(getPostHogToken()).toBe("phc_test_key_123");
    expect(isPostHogConfigured()).toBe(true);
  });

  it("falls back to NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN if KEY is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_legacy_token_456");
    expect(getPostHogToken()).toBe("phc_legacy_token_456");
    expect(isPostHogConfigured()).toBe(true);
  });

  it("reports unconfigured when no token is present", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    expect(getPostHogToken()).toBeFalsy();
    expect(isPostHogConfigured()).toBe(false);
  });

  it("defaults host to https://t.1handindia.com when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    expect(getPostHogHost()).toBe("https://t.1handindia.com");
  });

  it("uses custom host when provided", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    expect(getPostHogHost()).toBe("https://eu.i.posthog.com");
  });

  it("defaults ui_host to https://us.posthog.com when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", "");
    expect(getPostHogUiHost()).toBe("https://us.posthog.com");
  });

  it("uses custom ui_host when provided", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", "https://eu.posthog.com");
    expect(getPostHogUiHost()).toBe("https://eu.posthog.com");
  });

  it("safely handles capture and identify calls in non-browser environments without errors", () => {
    expect(() => {
      capturePostHogEvent("test_event", { foo: "bar" });
      capturePostHogException(new Error("test"));
      identifyPostHogUser("user_123", { role: "CUSTOMER" });
      resetPostHogUser();
    }).not.toThrow();
  });
});

function exceptionEvent(exceptionList: unknown[]): CaptureResult {
  return {
    event: "$exception",
    properties: { $exception_list: exceptionList },
  } as unknown as CaptureResult;
}

describe("dropStacklessNonErrorExceptions", () => {
  it("drops a bare DOM event captured as an exception", () => {
    const event = exceptionEvent([
      { type: "Event", value: "Event captured as exception with keys: isTrusted", mechanism: { synthetic: true } },
    ]);
    expect(dropStacklessNonErrorExceptions(event)).toBeNull();
  });

  it("keeps a genuine Error with a stack trace", () => {
    const event = exceptionEvent([
      { type: "TypeError", value: "x is not a function", stacktrace: { frames: [{ filename: "app.js" }] } },
    ]);
    expect(dropStacklessNonErrorExceptions(event)).toBe(event);
  });

  it("keeps a stackless Error-typed exception", () => {
    const event = exceptionEvent([{ type: "RangeError", value: "out of range" }]);
    expect(dropStacklessNonErrorExceptions(event)).toBe(event);
  });

  it("keeps the event when any exception in the list is debuggable", () => {
    const event = exceptionEvent([
      { type: "Event" },
      { type: "TypeError", stacktrace: { frames: [{ filename: "app.js" }] } },
    ]);
    expect(dropStacklessNonErrorExceptions(event)).toBe(event);
  });

  it("passes through non-exception events and an empty exception list", () => {
    const pageview = { event: "$pageview", properties: {} } as unknown as CaptureResult;
    expect(dropStacklessNonErrorExceptions(pageview)).toBe(pageview);

    const empty = exceptionEvent([]);
    expect(dropStacklessNonErrorExceptions(empty)).toBe(empty);

    expect(dropStacklessNonErrorExceptions(null)).toBeNull();
  });
});
