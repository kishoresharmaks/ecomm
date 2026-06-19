import { describe, expect, it } from "vitest";
import { apiBaseUrl, sanitizeAuthMessage } from "./api";

describe("seller mobile API sanitization", () => {
  it("hides auth implementation details from user-facing errors", () => {
    expect(sanitizeAuthMessage("Clerk JWT bearer token failed", 401)).toBe("Your session has expired. Please sign in again.");
    expect(sanitizeAuthMessage("Invalid session token", 400)).toBe("Your session has expired. Please sign in again.");
  });

  it("keeps normal validation messages", () => {
    expect(sanitizeAuthMessage("Store name is required.", 400)).toBe("Store name is required.");
  });
});

describe("seller mobile API base URL", () => {
  it("uses configured API URL without trailing slash", () => {
    const previous = process.env.EXPO_PUBLIC_API_URL;

    try {
      process.env.EXPO_PUBLIC_API_URL = "https://api.1handindia.com/api/";
      expect(apiBaseUrl()).toBe("https://api.1handindia.com/api");
    } finally {
      restoreEnvValue("EXPO_PUBLIC_API_URL", previous);
    }
  });

  it("requires explicit API URL outside development", () => {
    const previousUrl = process.env.EXPO_PUBLIC_API_URL;
    const previousNodeEnv = process.env.NODE_ENV;

    try {
      delete process.env.EXPO_PUBLIC_API_URL;
      process.env.NODE_ENV = "production";
      expect(() => apiBaseUrl()).toThrow("EXPO_PUBLIC_API_URL is required");
    } finally {
      restoreEnvValue("NODE_ENV", previousNodeEnv);
      restoreEnvValue("EXPO_PUBLIC_API_URL", previousUrl);
    }
  });
});

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
