import { describe, expect, it, vi } from "vitest";
import { RequestRateLimiter, rateLimitOptionsFromEnv } from "./request-rate-limiter";

function request({
  currentUser,
  forwardedFor,
  headers = {},
  ip = "10.0.0.10",
  method = "GET",
  url = "/api/products?search=rice",
}: {
  currentUser?: { id?: string; clerkUserId?: string | null } | null;
  forwardedFor?: string;
  headers?: Record<string, string>;
  ip?: string;
  method?: string;
  url?: string;
} = {}) {
  return {
    method,
    originalUrl: url,
    ip,
    socket: { remoteAddress: ip },
    currentUser,
    headers: {
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...headers,
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

  it("uses the authenticated search policy when an auth identity is present in verified request context", () => {
    const limiter = new RequestRateLimiter({ now: () => 1_000 });

    for (let index = 0; index < 100; index += 1) {
      const decision = limiter.check(request({ currentUser: { id: "customer-1" } }));
      expect(decision.allowed).toBe(true);
    }

    const decision = limiter.check(request({ currentUser: { id: "customer-1" } }));

    expect(decision.allowed).toBe(false);
    expect(decision.policy.name).toBe("search-authenticated");
  });

  it("ignores spoofed unverified headers and isolates by client IP to prevent user DoS", () => {
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      policies: { searchAnonymous: { max: 2 }, searchAuthenticated: { max: 10 } },
    });

    // Attacker sends spoofed headers attempting to poison victim-user's bucket from IP 198.51.100.1
    const attackReq1 = request({
      ip: "198.51.100.1",
      headers: {
        "x-indihub-user-id": "victim-user",
        "x-clerk-user-id": "victim-clerk",
        authorization: "Bearer spoofed-token",
      },
    });
    const attackReq2 = request({
      ip: "198.51.100.1",
      headers: { "x-indihub-user-id": "victim-user" },
    });
    const attackReq3 = request({
      ip: "198.51.100.1",
      headers: { "x-indihub-user-id": "victim-user" },
    });

    expect(limiter.check(attackReq1).allowed).toBe(true);
    expect(limiter.check(attackReq2).allowed).toBe(true);
    // Attacker exhausts their own IP bucket
    const attackDecision3 = limiter.check(attackReq3);
    expect(attackDecision3.allowed).toBe(false);
    expect(attackDecision3.key).toContain("ip:");

    // Legitimate victim user connects from a different IP with verified request.currentUser
    const legitimateUserReq = request({
      ip: "203.0.113.50",
      currentUser: { id: "victim-user" },
    });
    const legitimateDecision = limiter.check(legitimateUserReq);
    expect(legitimateDecision.allowed).toBe(true);
    expect(legitimateDecision.key).toContain("user:");
    expect(legitimateDecision.policy.name).toBe("search-authenticated");
    expect(legitimateDecision.remaining).toBe(9);
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

    expect(limiter.check(request({ url: "/api/search/suggestions?q=wa", currentUser: { id: "customer-1" } })).allowed).toBe(true);
    const decision = limiter.check(request({ url: "/api/search/suggestions?q=wa", currentUser: { id: "customer-1" } }));

    expect(decision.allowed).toBe(false);
    expect(decision.policy.name).toBe("search-suggestions-authenticated");
  });

  it("isolates different verified users to separate rate limit buckets", () => {
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      policies: { searchAuthenticated: { max: 1 } },
    });

    expect(limiter.check(request({ currentUser: { id: "user-1" } })).allowed).toBe(true);
    expect(limiter.check(request({ currentUser: { id: "user-2" } })).allowed).toBe(true);
    expect(limiter.check(request({ currentUser: { id: "user-1" } })).allowed).toBe(false);
  });

  it("keeps product detail reads on a higher product-detail policy", () => {
    const limiter = new RequestRateLimiter({ now: () => 1_000 });
    const decision = limiter.check(request({ url: "/api/products/premium-rice" }));

    expect(decision.allowed).toBe(true);
    expect(decision.policy.name).toBe("product-detail");
    expect(decision.policy.max).toBe(240);
  });

  it("normalizes malformed double-slash request URLs instead of throwing", () => {
    const limiter = new RequestRateLimiter({ now: () => 1_000 });
    const decision = limiter.check(request({ url: "//" }));

    expect(decision.allowed).toBe(true);
    expect(decision.policy.name).toBe("public");
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

  it("shares counters through Redis when configured", async () => {
    const redisClient = {
      eval: vi.fn().mockResolvedValueOnce([1, 60_000]).mockResolvedValueOnce([2, 59_000]),
      on: vi.fn(),
      disconnect: vi.fn(),
    };
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      redisClient: redisClient as never,
      policies: { admin: { max: 1 } },
    });

    expect((await limiter.checkDistributed(request({ url: "/api/admin/users" }))).allowed).toBe(true);
    expect((await limiter.checkDistributed(request({ url: "/api/admin/users" }))).allowed).toBe(false);
    expect(redisClient.eval).toHaveBeenCalledTimes(2);
  });

  it("falls back locally when Redis is unavailable", async () => {
    const redisClient = {
      eval: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
      on: vi.fn(),
      disconnect: vi.fn(),
    };
    const limiter = new RequestRateLimiter({
      now: () => 1_000,
      redisClient: redisClient as never,
      policies: { admin: { max: 1 } },
    });

    expect((await limiter.checkDistributed(request({ url: "/api/admin/users" }))).allowed).toBe(true);
    expect((await limiter.checkDistributed(request({ url: "/api/admin/users" }))).allowed).toBe(false);
    expect(redisClient.disconnect).toHaveBeenCalledTimes(1);
  });
});
