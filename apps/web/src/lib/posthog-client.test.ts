import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capturePostHogEvent,
  capturePostHogException,
  getPostHogHost,
  getPostHogToken,
  getPostHogUiHost,
  identifyPostHogUser,
  isPostHogConfigured,
  isUserFacingAuthOrValidationError,
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

  it("filters out expected user-facing auth and validation errors from exception tracking", () => {
    expect(isUserFacingAuthOrValidationError(new Error("Sign in before using cart actions."))).toBe(true);
    expect(isUserFacingAuthOrValidationError(new Error("Sign in before using wishlist actions."))).toBe(true);
    expect(isUserFacingAuthOrValidationError(new Error("Sign in before managing addresses."))).toBe(true);
    expect(isUserFacingAuthOrValidationError(new Error("Sign in before booking a service."))).toBe(true);
    expect(isUserFacingAuthOrValidationError(new Error("Your sign-in session expired. Please refresh your session or sign in again."))).toBe(true);

    expect(isUserFacingAuthOrValidationError(new Error("TypeError: Cannot read properties of undefined"))).toBe(false);
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
