import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

type RateLimitRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers: IncomingHttpHeaders;
  socket?: {
    remoteAddress?: string;
  };
};

type RateLimitResponse = {
  setHeader(name: string, value: string | number): void;
  status(code: number): RateLimitResponse;
  json(body: unknown): void;
};

type NextFunction = () => void;

type RateLimitPolicy = {
  name: string;
  max: number;
  windowMs: number;
  message: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitDecision = {
  allowed: boolean;
  key: string;
  policy: RateLimitPolicy;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RequestRateLimiterOptions = {
  enabled?: boolean;
  trustProxyHeaders?: boolean;
  now?: () => number;
  policies?: Partial<Record<PolicyName, Partial<RateLimitPolicy>>>;
};

type PolicyName =
  | "auth"
  | "admin"
  | "checkout"
  | "productDetail"
  | "searchAnonymous"
  | "searchAuthenticated"
  | "searchSuggestionsAnonymous"
  | "searchSuggestionsAuthenticated"
  | "public";

const oneMinute = 60_000;

const defaultPolicies: Record<PolicyName, RateLimitPolicy> = {
  auth: {
    name: "auth",
    max: 20,
    windowMs: oneMinute,
    message: "Too many sign-in attempts. Please wait a minute and try again.",
  },
  admin: {
    name: "admin",
    max: 120,
    windowMs: oneMinute,
    message: "Too many back-office requests. Please wait a minute and try again.",
  },
  checkout: {
    name: "checkout",
    max: 60,
    windowMs: oneMinute,
    message: "Too many cart or checkout requests. Please wait a minute and try again.",
  },
  productDetail: {
    name: "product-detail",
    max: 240,
    windowMs: oneMinute,
    message: "Too many product requests. Please wait a minute and try again.",
  },
  searchAnonymous: {
    name: "search-anonymous",
    max: 30,
    windowMs: oneMinute,
    message: "Too many searches. Please wait a minute and try again.",
  },
  searchAuthenticated: {
    name: "search-authenticated",
    max: 100,
    windowMs: oneMinute,
    message: "Too many searches. Please wait a minute and try again.",
  },
  searchSuggestionsAnonymous: {
    name: "search-suggestions-anonymous",
    max: 20,
    windowMs: oneMinute,
    message: "Too many search suggestions. Please wait a minute and try again.",
  },
  searchSuggestionsAuthenticated: {
    name: "search-suggestions-authenticated",
    max: 60,
    windowMs: oneMinute,
    message: "Too many search suggestions. Please wait a minute and try again.",
  },
  public: {
    name: "public",
    max: 300,
    windowMs: oneMinute,
    message: "Too many requests. Please wait a minute and try again.",
  },
};

export class RequestRateLimiter {
  private readonly buckets = new Map<string, RateLimitEntry>();
  private readonly enabled: boolean;
  private readonly trustProxyHeaders: boolean;
  private readonly now: () => number;
  private readonly policies: Record<PolicyName, RateLimitPolicy>;
  private requestCount = 0;

  constructor(options: RequestRateLimiterOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.trustProxyHeaders = options.trustProxyHeaders ?? false;
    this.now = options.now ?? Date.now;
    this.policies = mergePolicies(options.policies);
  }

  check(request: RateLimitRequest): RateLimitDecision {
    const route = this.routeInfo(request);
    const policyKey = this.policyNameForRoute(route, this.authenticatedPrincipal(request));
    const policy = this.policies[policyKey];
    const now = this.now();
    const key = `${policy.name}:${route.method}:${this.identityKey(request)}`;

    if (!this.enabled) {
      return {
        allowed: true,
        key,
        policy,
        remaining: policy.max,
        resetAt: now + policy.windowMs,
        retryAfterSeconds: 0,
      };
    }

    this.pruneIfNeeded(now);

    const existing = this.buckets.get(key);
    const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + policy.windowMs } : existing;
    entry.count += 1;
    this.buckets.set(key, entry);

    const remaining = Math.max(0, policy.max - entry.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    return {
      allowed: entry.count <= policy.max,
      key,
      policy,
      remaining,
      resetAt: entry.resetAt,
      retryAfterSeconds,
    };
  }

  private routeInfo(request: RateLimitRequest) {
    const url = this.requestUrl(request);
    const pathname = normalizeApiPath(url.pathname);

    return {
      method: (request.method ?? "GET").toUpperCase(),
      pathname,
      hasSearchQuery: url.searchParams.has("search"),
    };
  }

  private policyNameForRoute(
    route: { method: string; pathname: string; hasSearchQuery: boolean },
    authenticatedPrincipal: string | null,
  ): PolicyName {
    if (route.pathname === "/search/suggestions" && route.method === "GET") {
      return authenticatedPrincipal ? "searchSuggestionsAuthenticated" : "searchSuggestionsAnonymous";
    }

    if (
      (route.pathname === "/search" && route.method === "GET") ||
      (route.pathname === "/products" && route.method === "GET" && route.hasSearchQuery)
    ) {
      return authenticatedPrincipal ? "searchAuthenticated" : "searchAnonymous";
    }

    if (route.pathname.startsWith("/admin/auth") || route.pathname.startsWith("/auth")) {
      return "auth";
    }

    if (route.pathname.startsWith("/checkout") || route.pathname.startsWith("/cart") || route.pathname.startsWith("/account/orders")) {
      return "checkout";
    }

    if (route.pathname.startsWith("/admin") || route.pathname.startsWith("/finance")) {
      return "admin";
    }

    if (route.pathname.startsWith("/products/") && route.method === "GET") {
      return "productDetail";
    }

    return "public";
  }

  private identityKey(request: RateLimitRequest) {
    const principal = this.authenticatedPrincipal(request);
    if (principal) {
      return principal;
    }

    return `ip:${hashValue(this.clientIp(request))}`;
  }

  private authenticatedPrincipal(request: RateLimitRequest) {
    const platformUserId = readHeader(request.headers, "x-indihub-user-id");
    if (platformUserId) {
      return `user:${hashValue(platformUserId)}`;
    }

    const clerkUserId = readHeader(request.headers, "x-clerk-user-id") ?? readHeader(request.headers, "x-indihub-dev-clerk-id");
    if (clerkUserId) {
      return `clerk:${hashValue(clerkUserId)}`;
    }

    const authorization = readHeader(request.headers, "authorization");
    if (authorization) {
      return `auth:${hashValue(authorization)}`;
    }

    return null;
  }

  private clientIp(request: RateLimitRequest) {
    if (this.trustProxyHeaders) {
      const forwardedFor = readHeader(request.headers, "x-forwarded-for");
      if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || "unknown";
      }

      const realIp = readHeader(request.headers, "x-real-ip");
      if (realIp) {
        return realIp.trim();
      }
    }

    return request.ip ?? request.socket?.remoteAddress ?? "unknown";
  }

  private requestUrl(request: RateLimitRequest) {
    return new URL(request.originalUrl ?? request.url ?? "/", "http://indihub.local");
  }

  private pruneIfNeeded(now: number) {
    this.requestCount += 1;
    if (this.requestCount % 500 !== 0) {
      return;
    }

    for (const [key, entry] of this.buckets.entries()) {
      if (entry.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

export function createRateLimitMiddleware(options: RequestRateLimiterOptions = {}) {
  const limiter = new RequestRateLimiter(options);

  return (request: RateLimitRequest, response: RateLimitResponse, next: NextFunction) => {
    const decision = limiter.check(request);
    response.setHeader("X-RateLimit-Limit", decision.policy.max);
    response.setHeader("X-RateLimit-Remaining", decision.remaining);
    response.setHeader("X-RateLimit-Reset", Math.ceil(decision.resetAt / 1000));

    if (decision.allowed) {
      next();
      return;
    }

    response.setHeader("Retry-After", decision.retryAfterSeconds);
    response.status(429).json({
      statusCode: 429,
      message: decision.policy.message,
      error: "Too Many Requests",
    });
  };
}

export function rateLimitOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): RequestRateLimiterOptions {
  return {
    enabled: env.INDIHUB_API_RATE_LIMIT_ENABLED !== "false",
    trustProxyHeaders: env.INDIHUB_TRUST_PROXY_HEADERS === "true",
    policies: {
      auth: maxOverride(env.INDIHUB_RATE_LIMIT_AUTH_PER_MINUTE),
      admin: maxOverride(env.INDIHUB_RATE_LIMIT_ADMIN_PER_MINUTE),
      checkout: maxOverride(env.INDIHUB_RATE_LIMIT_CHECKOUT_PER_MINUTE),
      productDetail: maxOverride(env.INDIHUB_RATE_LIMIT_PRODUCT_DETAIL_PER_MINUTE),
      searchAnonymous: maxOverride(env.INDIHUB_RATE_LIMIT_SEARCH_ANON_PER_MINUTE),
      searchAuthenticated: maxOverride(env.INDIHUB_RATE_LIMIT_SEARCH_AUTH_PER_MINUTE),
      searchSuggestionsAnonymous: maxOverride(env.INDIHUB_RATE_LIMIT_SEARCH_SUGGESTIONS_ANON_PER_MINUTE),
      searchSuggestionsAuthenticated: maxOverride(env.INDIHUB_RATE_LIMIT_SEARCH_SUGGESTIONS_AUTH_PER_MINUTE),
      public: maxOverride(env.INDIHUB_RATE_LIMIT_PUBLIC_PER_MINUTE),
    },
  };
}

function mergePolicies(overrides: RequestRateLimiterOptions["policies"] = {}) {
  const merged = { ...defaultPolicies };
  for (const [key, value] of Object.entries(overrides) as Array<[PolicyName, Partial<RateLimitPolicy> | undefined]>) {
    if (!value) {
      continue;
    }

    merged[key] = {
      ...merged[key],
      ...Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)),
    };
  }

  return merged;
}

function normalizeApiPath(pathname: string) {
  const withoutApiPrefix = pathname.startsWith("/api/") ? pathname.slice(4) : pathname === "/api" ? "/" : pathname;
  if (withoutApiPrefix.length > 1 && withoutApiPrefix.endsWith("/")) {
    return withoutApiPrefix.slice(0, -1);
  }

  return withoutApiPrefix || "/";
}

function readHeader(headers: IncomingHttpHeaders, name: string) {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function positiveInt(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function maxOverride(value: string | undefined) {
  const max = positiveInt(value);

  return max ? { max } : {};
}
