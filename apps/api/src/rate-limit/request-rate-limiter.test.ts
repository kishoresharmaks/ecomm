import { describe, expect, it } from "vitest";
import { RequestRateLimiter, rateLimitOptionsFromEnv } from "./request-rate-limiter";

function request({
  authorization,
  forwardedFor,
  platformUserId,
  method = "GET",
  url = "/api/products?search=rice",
}: {
  authorization?: string;
  forwardedFor?: string;
  platformUserId?: string;
  method?: string;
  url?: string;
} = {}) {
  return {
    method,
    originalUrl: url,
    ip: "10.0.0.10",
    socket: { remoteAddress: "10.0.0.10" },
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...(platformUserId ? { "x-indihub-user-id": platformUserId } : {}),
    },
  };
}

describe("RequestRateLimiter", () => {
  it("limits anonymous product search to the anonymous search policy", () => {
    const limiter = new RequestRateLimiter({ now: () => 1_000 });

    for (let index = 0; index < 30; index += 1) {
      const decision = limiter.check(request());
      expect(decision.allowed).toBe(true);
    }

    const decision = limiter.check(request());

    expect(decision.allowed).toBe(false);
    expect(decision.policy.name).toBe("search-anonymous");
    expect(decision.retryAfterSeconds).toBe(60);
  });

  it("uses the authenticated search policy when an auth identity is present", () => {
    const limiter = new RequestRateLimiter({ now: () => 1_000 });

    for (let index = 0; index < 100; index += 1) {
      const decision = limiter.check(request({ authorization: "Bearer customer-token" }));
      expect(decision.allowed).toBe(true);
    }

    const decision = limiter.check(request({ authorization: "Bearer customer-token" }));

    expect(decision.allowed).toBe(false);
    expect(decision.policy.name).toBe("search-authenticated");
  });

  it("uses the same search budget for the dedicated advanced search endpoint", () => {
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      policies: { searchAnonymous: { max: 1 } },
    });

    expect(limiter.check(request({ url: "/api/search?q=watch" })).allowed).toBe(true);
    const decision = limiter.check(request({ url: "/api/search?q=watch" }));

    expect(decision.allowed).toBe(false);
    expect(decision.policy.name).toBe("search-anonymous");
  });

  it("uses a stricter suggestions budget for anonymous typeahead traffic", () => {
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      policies: { searchSuggestionsAnonymous: { max: 1 } },
    });

    expect(limiter.check(request({ url: "/api/search/suggestions?q=wa" })).allowed).toBe(true);
    const decision = limiter.check(request({ url: "/api/search/suggestions?q=wa" }));

    expect(decision.allowed).toBe(false);
    expect(decision.policy.name).toBe("search-suggestions-anonymous");
  });

  it("uses the authenticated suggestions budget when a user identity is present", () => {
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      policies: { searchSuggestionsAuthenticated: { max: 1 } },
    });

    expect(limiter.check(request({ url: "/api/search/suggestions?q=wa", platformUserId: "customer-1" })).allowed).toBe(true);
    const decision = limiter.check(request({ url: "/api/search/suggestions?q=wa", platformUserId: "customer-1" }));

    expect(decision.allowed).toBe(false);
    expect(decision.policy.name).toBe("search-suggestions-authenticated");
  });

  it("prefers a stable platform user id over a bearer token for user-based limits", () => {
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      policies: { searchAuthenticated: { max: 1 } },
    });

    expect(limiter.check(request({ authorization: "Bearer token-a", platformUserId: "user-1" })).allowed).toBe(true);
    expect(limiter.check(request({ authorization: "Bearer token-b", platformUserId: "user-1" })).allowed).toBe(false);
  });

  it("keeps product detail reads on a higher product-detail policy", () => {
    const limiter = new RequestRateLimiter({ now: () => 1_000 });
    const decision = limiter.check(request({ url: "/api/products/premium-rice" }));

    expect(decision.allowed).toBe(true);
    expect(decision.policy.name).toBe("product-detail");
    expect(decision.policy.max).toBe(240);
  });

  it("can trust proxy headers when the VPS API port is protected behind Nginx", () => {
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      trustProxyHeaders: true,
      policies: { searchAnonymous: { max: 1 } },
    });

    expect(limiter.check(request({ forwardedFor: "203.0.113.10, 10.0.0.1" })).allowed).toBe(true);
    expect(limiter.check(request({ forwardedFor: "203.0.113.11, 10.0.0.1" })).allowed).toBe(true);
    expect(limiter.check(request({ forwardedFor: "203.0.113.10, 10.0.0.1" })).allowed).toBe(false);
  });

  it("reads environment overrides for production tuning", () => {
    const options = rateLimitOptionsFromEnv({
      INDIHUB_API_RATE_LIMIT_ENABLED: "true",
      INDIHUB_TRUST_PROXY_HEADERS: "true",
      INDIHUB_RATE_LIMIT_SEARCH_ANON_PER_MINUTE: "7",
      INDIHUB_RATE_LIMIT_SEARCH_SUGGESTIONS_ANON_PER_MINUTE: "3",
    });
    const limiter = new RequestRateLimiter({ ...options, now: () => 1_000 });
    const decision = limiter.check(request());
    const suggestionsDecision = limiter.check(request({ url: "/api/search/suggestions?q=wa" }));

    expect(decision.policy.max).toBe(7);
    expect(suggestionsDecision.policy.max).toBe(3);
  });
});
