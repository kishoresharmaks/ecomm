import { afterEach, describe, expect, it } from "vitest";
import { apiBaseUrl } from "./api";

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalNodeEnv = process.env.NODE_ENV;

describe("mobile customer API base URL", () => {
  afterEach(() => {
    restoreEnv("EXPO_PUBLIC_API_URL", originalApiUrl);
    restoreEnv("NODE_ENV", originalNodeEnv);
  });

  it("normalizes configured API URLs", () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.1handindia.com/api/";

    expect(apiBaseUrl()).toBe("https://api.1handindia.com/api");
  });

  it("requires an explicit API URL outside development", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    process.env.NODE_ENV = "production";

    expect(() => apiBaseUrl()).toThrow("EXPO_PUBLIC_API_URL is required for customer mobile builds.");
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
