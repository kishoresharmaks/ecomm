import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createClerkClient, verifyToken } from "@clerk/backend";
import type { RoleCode } from "@indihub/database";
import type { SyncAuthUserDto } from "./dto/sync-auth-user.dto";

type SyncFallbackProfile = {
  email?: string;
  phone?: string;
  fullName?: string;
  defaultRole?: RoleCode;
};

type ClerkBackendUser = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  primaryEmailAddressId?: string | null;
  primaryPhoneNumberId?: string | null;
  emailAddresses?: Array<{
    id: string;
    emailAddress: string;
  }>;
  phoneNumbers?: Array<{
    id: string;
    phoneNumber: string;
  }>;
};

type ClerkErrorDetails = {
  name?: string;
  message?: string;
  reason?: string;
  action?: string;
  code?: string;
  status?: number;
};

const DEFAULT_DEV_WEB_ORIGIN = "http://192.168.1.2:3000";

@Injectable()
export class ClerkAuthService {
  async verifyAuthorizationHeader(authorizationHeader?: string | string[]) {
    const token = this.readBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException("A Clerk bearer token is required.");
    }

    return this.verifyBearerToken(token);
  }

  async verifyBearerToken(token: string) {
    const secretKey = this.envValue("CLERK_SECRET_KEY");
    const jwtKey = this.envValue("CLERK_JWT_KEY");

    if (!secretKey && !jwtKey) {
      throw new UnauthorizedException("Clerk JWT verification is not configured.");
    }

    try {
      const authorizedParties = this.clerkAuthorizedParties();
      const payload = await verifyToken(token, {
        ...(secretKey ? { secretKey } : {}),
        ...(jwtKey ? { jwtKey } : {}),
        clockSkewInMs: this.clerkClockSkewInMs(),
        ...(this.envValue("CLERK_JWT_AUDIENCE") ? { audience: this.envValue("CLERK_JWT_AUDIENCE") } : {}),
        ...(authorizedParties.length ? { authorizedParties } : {})
      });

      if (!payload.sub || typeof payload.sub !== "string") {
        throw new UnauthorizedException("Clerk token does not include a valid user subject.");
      }

      return payload.sub;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (secretKey) {
        try {
          return await this.verifyTokenThroughSessionApi(token, secretKey);
        } catch (fallbackError) {
          this.logClerkVerificationFailure(error, fallbackError);
          throw new UnauthorizedException(this.clerkAuthFailureMessage(error, fallbackError));
        }
      }

      this.logClerkVerificationFailure(error);
      throw new UnauthorizedException(this.clerkAuthFailureMessage(error));
    }
  }

  async resolveSessionProfile(authorizationHeader: string | string[] | undefined, fallback: SyncFallbackProfile = {}): Promise<SyncAuthUserDto> {
    const clerkUserId = await this.verifyAuthorizationHeader(authorizationHeader);
    const clerkUser = await this.safeFetchClerkUser(clerkUserId);

    if (clerkUser) {
      const email = this.primaryEmail(clerkUser);
      if (!email) {
        throw new BadRequestException("Clerk user does not have a primary email address.");
      }

      const phone = this.primaryPhone(clerkUser);
      const fullName = this.fullName(clerkUser);

      return {
        clerkUserId,
        email,
        ...(phone ? { phone } : {}),
        ...(fullName ? { fullName } : {}),
        ...(fallback.defaultRole ? { defaultRole: fallback.defaultRole } : {})
      };
    }

    if (!fallback.email) {
      throw new BadRequestException("Customer email is required when Clerk backend user lookup is unavailable.");
    }

    return {
      clerkUserId,
      email: fallback.email,
      ...(fallback.phone ? { phone: fallback.phone } : {}),
      ...(fallback.fullName ? { fullName: fallback.fullName } : {}),
      ...(fallback.defaultRole ? { defaultRole: fallback.defaultRole } : {})
    };
  }

  private readBearerToken(authorizationHeader?: string | string[]) {
    const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
    const [scheme, token] = header?.trim().split(/\s+/) ?? [];

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return null;
    }

    return token;
  }

  private async fetchClerkUser(clerkUserId: string): Promise<ClerkBackendUser | null> {
    const secretKey = this.envValue("CLERK_SECRET_KEY");
    if (!secretKey) {
      return null;
    }

    const clerk = createClerkClient({ secretKey });
    return clerk.users.getUser(clerkUserId) as Promise<ClerkBackendUser>;
  }

  private async safeFetchClerkUser(clerkUserId: string) {
    try {
      return await this.fetchClerkUser(clerkUserId);
    } catch (error) {
      if (this.isProduction()) {
        throw error;
      }

      console.warn("[auth] Clerk user lookup failed; using verified-session fallback profile.", this.clerkErrorDetails(error));
      return null;
    }
  }

  private async verifyTokenThroughSessionApi(token: string, secretKey: string) {
    const sessionId = this.decodeSessionId(token);
    if (!sessionId) {
      throw new UnauthorizedException("Valid Clerk session token is required.");
    }

    try {
      const clerk = createClerkClient({ secretKey });
      const session = await clerk.sessions.verifySession(sessionId, token);

      if (!session.userId) {
        throw new UnauthorizedException("Clerk session does not include a valid user.");
      }

      const status = session.status?.toLowerCase();
      if (status && status !== "active") {
        throw new UnauthorizedException("Clerk session is not active.");
      }

      return session.userId;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Valid Clerk session token is required.");
    }
  }

  private decodeSessionId(token: string) {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sid?: unknown };
      return typeof decoded.sid === "string" && decoded.sid.trim() ? decoded.sid : null;
    } catch {
      return null;
    }
  }

  private envValue(name: string) {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
  }

  private clerkAuthFailureMessage(primaryError: unknown, fallbackError?: unknown) {
    if (this.isProduction()) {
      return "Valid Clerk session token is required.";
    }

    const details = [primaryError, fallbackError].filter(Boolean).map((error) => this.clerkErrorDetails(error));
    const text = details
      .flatMap((detail) => [detail.reason, detail.message, detail.code, detail.action])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (text.includes("invalid-secret-key") || text.includes("invalid secret key")) {
      return "Clerk secret key is invalid. Use the secret key from the same Clerk application as the publishable key.";
    }

    if (text.includes("jwk-kid-mismatch") || text.includes("invalid-signature") || text.includes("invalid signature")) {
      return "Clerk frontend and backend keys do not match this signed-in session. Use matching Clerk keys, then sign out and sign in again.";
    }

    if (text.includes("authorized party") || text.includes("authorized-parties") || text.includes("azp")) {
      const expectedOrigin = this.clerkAuthorizedParties()[0] ?? DEFAULT_DEV_WEB_ORIGIN;
      return `Clerk session was issued for a different web origin. Open 1HandIndia at ${expectedOrigin}, then sign out and sign in again.`;
    }

    if (text.includes("jwk") || text.includes("fetch failed") || text.includes("network") || text.includes("enotfound")) {
      return "Clerk token verification failed in the API. Add CLERK_JWT_KEY for local verification or ensure the API can reach Clerk.";
    }

    if (text.includes("not-active-yet") || text.includes("iat-in-the-future") || text.includes("not before") || text.includes("issued at date claim")) {
      return "Clerk session token time is ahead of the API clock. Sync Windows time or increase CLERK_JWT_CLOCK_SKEW_MS.";
    }

    if (text.includes("expired")) {
      return "Clerk session token is expired. Sign out and sign in again.";
    }

    return "Valid Clerk session token is required. Check the API log for the exact Clerk verification reason.";
  }

  private logClerkVerificationFailure(primaryError: unknown, fallbackError?: unknown) {
    if (this.isProduction()) {
      return;
    }

    console.warn("[auth] Clerk token verification failed", {
      primary: this.clerkErrorDetails(primaryError),
      ...(fallbackError ? { fallback: this.clerkErrorDetails(fallbackError) } : {})
    });
  }

  private clerkErrorDetails(error: unknown): ClerkErrorDetails {
    const details: ClerkErrorDetails = {};

    if (error instanceof UnauthorizedException) {
      this.assignResponseMessage(details, error.getResponse());
    }

    if (!error || typeof error !== "object") {
      return {
        ...details,
        message: details.message ?? String(error)
      };
    }

    const record = error as Record<string, unknown>;
    this.assignString(details, "name", record.name);
    this.assignString(details, "message", record.message);
    this.assignString(details, "reason", record.reason);
    this.assignString(details, "action", record.action);
    this.assignString(details, "code", record.code);
    this.assignNumber(details, "status", record.status);

    if (Array.isArray(record.errors)) {
      const firstError = record.errors.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
      if (firstError) {
        this.assignString(details, "message", firstError.message);
        this.assignString(details, "code", firstError.code);
      }
    }

    return details;
  }

  private assignResponseMessage(details: ClerkErrorDetails, response: string | object) {
    if (typeof response === "string") {
      details.message = response;
      return;
    }

    if ("message" in response) {
      const message = response.message;
      if (Array.isArray(message)) {
        details.message = message.join(", ");
      } else if (typeof message === "string") {
        details.message = message;
      }
    }
  }

  private assignString<T extends keyof ClerkErrorDetails>(details: ClerkErrorDetails, key: T, value: unknown) {
    if (!details[key] && typeof value === "string" && value.trim()) {
      details[key] = value.trim() as ClerkErrorDetails[T];
    }
  }

  private assignNumber<T extends keyof ClerkErrorDetails>(details: ClerkErrorDetails, key: T, value: unknown) {
    if (!details[key] && typeof value === "number") {
      details[key] = value as ClerkErrorDetails[T];
    }
  }

  private isProduction() {
    return process.env.NODE_ENV === "production";
  }

  private clerkClockSkewInMs() {
    const configured = Number(this.envValue("CLERK_JWT_CLOCK_SKEW_MS"));
    if (Number.isFinite(configured) && configured >= 0) {
      return configured;
    }

    return this.isProduction() ? 10_000 : 120_000;
  }

  private clerkAuthorizedParties() {
    const configured = [
      ...this.envList("CLERK_AUTHORIZED_PARTIES"),
      this.envValue("NEXT_PUBLIC_WEB_URL"),
      ...this.envList("API_CORS_ORIGINS")
    ];
    const origins = configured.map((origin) => this.normalizeOrigin(origin)).filter((origin): origin is string => Boolean(origin));

    if (!origins.length && !this.isProduction()) {
      origins.push(DEFAULT_DEV_WEB_ORIGIN);
    }

    return [...new Set(origins)];
  }

  private envList(name: string) {
    return (
      this.envValue(name)
        ?.split(",")
        .map((value) => value.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean) ?? []
    );
  }

  private normalizeOrigin(value?: string) {
    const trimmed = value?.trim().replace(/^["']|["']$/g, "");
    if (!trimmed || trimmed === "*") {
      return null;
    }

    try {
      return new URL(trimmed).origin;
    } catch {
      return null;
    }
  }

  private primaryEmail(user: ClerkBackendUser) {
    const primary = user.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId) ?? user.emailAddresses?.[0];
    return primary?.emailAddress;
  }

  private primaryPhone(user: ClerkBackendUser) {
    const primary = user.phoneNumbers?.find((phone) => phone.id === user.primaryPhoneNumberId) ?? user.phoneNumbers?.[0];
    return primary?.phoneNumber;
  }

  private fullName(user: ClerkBackendUser) {
    const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return user.fullName?.trim() || fromParts || undefined;
  }
}
