import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capturePostHogEvent,
  capturePostHogException,
  getPostHogHost,
  getPostHogToken,
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

  it("defaults host to https://us.i.posthog.com when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    expect(getPostHogHost()).toBe("https://us.i.posthog.com");
  });

  it("uses custom host when provided", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    expect(getPostHogHost()).toBe("https://eu.i.posthog.com");
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
