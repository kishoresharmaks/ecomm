import { describe, expect, it } from "vitest";
import { clerkFrontendApiUrl, parseClerkAuthCapabilities } from "./clerk-auth-capabilities";

describe("Clerk mobile auth capabilities", () => {
  it("enables phone operations only when Clerk enables phone as a first factor", () => {
    expect(parseClerkAuthCapabilities({
      auth_config: { phone_number: "on" },
      user_settings: {
        attributes: {
          phone_number: {
            enabled: true,
            used_for_first_factor: true,
          },
        },
      },
    })).toEqual({ phoneEnabled: true });

    expect(parseClerkAuthCapabilities({
      auth_config: { phone_number: "off" },
      user_settings: {
        attributes: {
          phone_number: {
            enabled: false,
            used_for_first_factor: false,
          },
        },
      },
    })).toEqual({ phoneEnabled: false });
  });

  it("derives the Clerk frontend API from a publishable key", () => {
    expect(clerkFrontendApiUrl(undefined, "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k")).toBe("https://clerk.example.com");
  });

  it("prefers an explicitly configured Clerk frontend API", () => {
    expect(clerkFrontendApiUrl("https://auth.example.com/", "pk_live_invalid")).toBe("https://auth.example.com");
  });
});
