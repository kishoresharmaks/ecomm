import { afterEach, describe, expect, it, vi } from "vitest";
import { buildContentSecurityPolicy, buildReportToHeader } from "./security-headers";

describe("security header helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a nonce-based CSP without unsafe script fallbacks", () => {
    const csp = buildContentSecurityPolicy({ nonce: "nonce-value", origin: "https://1handindia.com" });

    expect(csp).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("report-to indihub-csp");
  });

  it("only allows analytics origins when analytics is configured", () => {
    expect(buildContentSecurityPolicy({ nonce: "nonce-value", origin: "https://1handindia.com" })).not.toContain(
      "www.googletagmanager.com",
    );

    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");

    expect(buildContentSecurityPolicy({ nonce: "nonce-value", origin: "https://1handindia.com" })).toContain(
      "https://www.googletagmanager.com",
    );
  });

  it("emits a report-to endpoint for the production web origin", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "https://www.1handindia.com");

    expect(JSON.parse(buildReportToHeader("https://1handindia.com"))).toMatchObject({
      group: "indihub-csp",
      endpoints: [{ url: "https://www.1handindia.com/security/csp-report" }],
      include_subdomains: true,
    });
  });
});
