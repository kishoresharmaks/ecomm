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

  it("allows database-configured Google analytics origins", () => {
    const csp = buildContentSecurityPolicy({ nonce: "nonce-value", origin: "https://1handindia.com" });
    const scriptDirective = directive(csp, "script-src");
    const connectDirective = directive(csp, "connect-src");
    const frameDirective = directive(csp, "frame-src");

    expect(scriptDirective).toContain("https://www.googletagmanager.com");
    expect(scriptDirective).toContain("https://pagead2.googlesyndication.com");
    expect(scriptDirective).toContain("https://googleads.g.doubleclick.net");
    expect(connectDirective).toContain("https://www.google-analytics.com");
    expect(connectDirective).toContain("https://pagead2.googlesyndication.com");
    expect(connectDirective).toContain("https://googleads.g.doubleclick.net");
    expect(connectDirective).toContain("https://*.g.doubleclick.net");
    expect(connectDirective).toContain("https://ad.doubleclick.net");
    expect(frameDirective).toContain("https://www.googletagmanager.com");
  });

  it("keeps an explicitly configured local HTTP API usable in production preview", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_URL", "http://192.168.1.2:3000");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://192.168.1.2:4000");

    const csp = buildContentSecurityPolicy({
      nonce: "nonce-value",
      origin: "http://192.168.1.2:3000",
    });

    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(directive(csp, "img-src")).toContain("http://192.168.1.2:4000");
    expect(directive(csp, "connect-src")).toContain("http://192.168.1.2:4000");
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

function directive(csp: string, name: string) {
  return csp.split("; ").find((item) => item.startsWith(`${name} `)) ?? "";
}
