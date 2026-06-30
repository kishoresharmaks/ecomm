import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkAuthService } from "./clerk-auth.service";

const clerkMocks = vi.hoisted(() => ({
  createClerkClient: vi.fn(),
  getUser: vi.fn(),
  verifySession: vi.fn(),
  verifyToken: vi.fn()
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: clerkMocks.createClerkClient,
  verifyToken: clerkMocks.verifyToken
}));

describe("ClerkAuthService", () => {
  const originalEnv = {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_JWT_KEY: process.env.CLERK_JWT_KEY,
    CLERK_AUTHORIZED_PARTIES: process.env.CLERK_AUTHORIZED_PARTIES,
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
    API_CORS_ORIGINS: process.env.API_CORS_ORIGINS,
    NODE_ENV: process.env.NODE_ENV
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.CLERK_SECRET_KEY = "sk_test_local";
    delete process.env.CLERK_JWT_KEY;
    delete process.env.CLERK_AUTHORIZED_PARTIES;
    delete process.env.NEXT_PUBLIC_WEB_URL;
    delete process.env.API_CORS_ORIGINS;
    process.env.NODE_ENV = "test";
    clerkMocks.createClerkClient.mockReturnValue({
      sessions: {
        verifySession: clerkMocks.verifySession
      },
      users: {
        getUser: clerkMocks.getUser
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv("CLERK_SECRET_KEY", originalEnv.CLERK_SECRET_KEY);
    restoreEnv("CLERK_JWT_KEY", originalEnv.CLERK_JWT_KEY);
    restoreEnv("CLERK_AUTHORIZED_PARTIES", originalEnv.CLERK_AUTHORIZED_PARTIES);
    restoreEnv("NEXT_PUBLIC_WEB_URL", originalEnv.NEXT_PUBLIC_WEB_URL);
    restoreEnv("API_CORS_ORIGINS", originalEnv.API_CORS_ORIGINS);
    restoreEnv("NODE_ENV", originalEnv.NODE_ENV);
  });

  it("accepts a Clerk session token verified by the SDK", async () => {
    clerkMocks.verifyToken.mockResolvedValue({ sub: "user_123" });

    const service = new ClerkAuthService();

    await expect(service.verifyBearerToken(tokenWithSessionId())).resolves.toBe("user_123");
    expect(clerkMocks.verifyToken).toHaveBeenCalledWith(
      tokenWithSessionId(),
      expect.objectContaining({
        authorizedParties: ["https://1handindia.com"],
        clockSkewInMs: 120_000
      })
    );
  });

  it("normalizes Clerk authorized-party origins from explicit and public web config", async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = '"https://1handindia.com", https://1handindia.com/sign-in';
    process.env.NEXT_PUBLIC_WEB_URL = "https://www.1handindia.com";
    process.env.API_CORS_ORIGINS = "https://api.1handindia.com";
    clerkMocks.verifyToken.mockResolvedValue({ sub: "user_123" });

    const service = new ClerkAuthService();

    await expect(service.verifyBearerToken(tokenWithSessionId())).resolves.toBe("user_123");
    expect(clerkMocks.verifyToken).toHaveBeenCalledWith(
      tokenWithSessionId(),
      expect.objectContaining({
        authorizedParties: ["https://1handindia.com", "https://www.1handindia.com", "https://api.1handindia.com"]
      })
    );
  });

  it("returns an actionable IP-origin error when Clerk rejects the token azp", async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = "https://1handindia.com";
    clerkMocks.verifyToken.mockRejectedValueOnce(
      Object.assign(new Error('Invalid JWT Authorized party claim (azp) "http://localhost:3000". Expected "https://1handindia.com".'), {
        reason: "token-invalid-authorized-parties"
      })
    );
    clerkMocks.verifySession.mockRejectedValueOnce(new Error("fetch failed"));

    const service = new ClerkAuthService();

    await expect(service.verifyBearerToken(tokenWithSessionId())).rejects.toThrow(
      /Open 1HandIndia at https:\/\/1handindia\.com/,
    );
  });

  it("falls back to Clerk session verification and accepts active status case-insensitively", async () => {
    clerkMocks.verifyToken.mockRejectedValueOnce(
      Object.assign(new Error("Failed to load JWKS from Clerk Backend or Frontend API."), {
        reason: "remote-jwk-failed-to-load"
      })
    );
    clerkMocks.verifySession.mockResolvedValue({
      userId: "user_from_session",
      status: "ACTIVE"
    });

    const service = new ClerkAuthService();

    await expect(service.verifyBearerToken(tokenWithSessionId("sess_123"))).resolves.toBe("user_from_session");
    expect(clerkMocks.verifySession).toHaveBeenCalledWith("sess_123", tokenWithSessionId("sess_123"));
  });

  it("returns an actionable local error when Clerk token verification cannot resolve signing keys", async () => {
    clerkMocks.verifyToken.mockRejectedValueOnce(
      Object.assign(new Error("Failed to load JWKS from Clerk Backend or Frontend API."), {
        reason: "remote-jwk-failed-to-load"
      })
    );
    clerkMocks.verifySession.mockRejectedValueOnce(new Error("fetch failed"));

    const service = new ClerkAuthService();

    await expect(service.verifyBearerToken(tokenWithSessionId())).rejects.toThrow(/CLERK_JWT_KEY/);
  });

  it("uses the fallback profile in local development if Clerk user lookup is unavailable after token verification", async () => {
    clerkMocks.verifyToken.mockResolvedValue({ sub: "clerk_user_1" });
    clerkMocks.getUser.mockRejectedValueOnce(new Error("fetch failed"));

    const service = new ClerkAuthService();

    await expect(
      service.resolveSessionProfile(`Bearer ${tokenWithSessionId()}`, {
        email: "customer@example.com",
        fullName: "Customer One"
      })
    ).resolves.toMatchObject({
      clerkUserId: "clerk_user_1",
      email: "customer@example.com",
      fullName: "Customer One"
    });
  });
});

function tokenWithSessionId(sessionId = "sess_test") {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "kid_test", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sid: sessionId })).toString("base64url");
  return `${header}.${payload}.signature`;
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
