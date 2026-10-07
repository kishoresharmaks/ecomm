import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { RoleCode, UserStatus } from "@indihub/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminImpersonationService,
  getImpersonationSecret,
} from "./admin-impersonation.service";
import type { RequestUser } from "./types/indihub-request";

describe("AdminImpersonationService", () => {
  const originalImpersonationSecret = process.env.ADMIN_IMPERSONATION_SECRET;
  const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalClerkKey = process.env.CLERK_SECRET_KEY;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  const prisma = {
    client: {
      seller: {
        findFirst: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };

  const adminUser: RequestUser = {
    id: "admin_1",
    clerkUserId: null,
    email: "admin@1handindia.com",
    roles: [RoleCode.ADMIN],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_IMPERSONATION_SECRET = "test-only-admin-impersonation-secret-32-chars";
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalImpersonationSecret !== undefined) {
      process.env.ADMIN_IMPERSONATION_SECRET = originalImpersonationSecret;
    } else {
      delete process.env.ADMIN_IMPERSONATION_SECRET;
    }
    if (originalSessionSecret !== undefined) {
      process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
    } else {
      delete process.env.ADMIN_SESSION_SECRET;
    }
    if (originalClerkKey !== undefined) {
      process.env.CLERK_SECRET_KEY = originalClerkKey;
    } else {
      delete process.env.CLERK_SECRET_KEY;
    }
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("creates an impersonation session and records start audit log", async () => {
    prisma.client.seller.findFirst.mockResolvedValue({
      id: "seller_1",
      storeName: "Test Store",
      userId: "user_seller_1",
      user: {
        id: "user_seller_1",
        status: UserStatus.ACTIVE,
      },
    });
    prisma.client.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const service = new AdminImpersonationService(prisma as never);
    const session = await service.createImpersonationSession("seller_1", adminUser, {
      reason: "Customer support investigation",
      ipAddress: "127.0.0.1",
    });

    expect(session.token).toMatch(/^ih_impersonate_/);
    expect(session.sellerId).toBe("seller_1");
    expect(session.sellerStoreName).toBe("Test Store");
    expect(session.impersonatorEmail).toBe(adminUser.email);
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "admin.seller.impersonate.start",
          actorUserId: adminUser.id,
          entityId: "seller_1",
        }),
      }),
    );
  });

  it("fails to impersonate if seller does not exist", async () => {
    prisma.client.seller.findFirst.mockResolvedValue(null);
    const service = new AdminImpersonationService(prisma as never);

    await expect(
      service.createImpersonationSession("non_existent", adminUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("fails to impersonate if seller user is disabled", async () => {
    prisma.client.seller.findFirst.mockResolvedValue({
      id: "seller_1",
      storeName: "Disabled Store",
      userId: "user_seller_1",
      user: {
        id: "user_seller_1",
        status: UserStatus.DISABLED,
      },
    });
    const service = new AdminImpersonationService(prisma as never);

    await expect(
      service.createImpersonationSession("seller_1", adminUser),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("resolves a valid signed token to the target seller user with impersonatedBy metadata", async () => {
    prisma.client.seller.findFirst.mockResolvedValue({
      id: "seller_1",
      storeName: "Test Store",
      userId: "user_seller_1",
      user: {
        id: "user_seller_1",
        status: UserStatus.ACTIVE,
      },
    });
    prisma.client.auditLog.create.mockResolvedValue({ id: "audit_1" });

    const service = new AdminImpersonationService(prisma as never);
    const session = await service.createImpersonationSession("seller_1", adminUser);

    prisma.client.user.findFirst.mockResolvedValue({
      id: "user_seller_1",
      clerkUserId: "clerk_seller_1",
      email: "seller@test.com",
      status: UserStatus.ACTIVE,
      userRoles: [
        {
          role: {
            code: RoleCode.SELLER,
            rolePermissions: [],
          },
        },
      ],
    });

    const resolved = await service.resolveToken(session.token);
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe("user_seller_1");
    expect(resolved?.email).toBe("seller@test.com");
    expect(resolved?.impersonatedBy).toEqual({
      id: adminUser.id,
      email: adminUser.email,
    });
  });

  it("rejects a tampered impersonation token", async () => {
    const service = new AdminImpersonationService(prisma as never);
    const tampered = "ih_impersonate_tamperedPayload.invalidSignature";
    const resolved = await service.resolveToken(tampered);
    expect(resolved).toBeNull();
  });

  it("records an exit impersonation audit log", async () => {
    prisma.client.auditLog.create.mockResolvedValue({ id: "audit_2" });
    const service = new AdminImpersonationService(prisma as never);

    const result = await service.exitImpersonation(adminUser, "seller_1", { ipAddress: "127.0.0.1" });
    expect(result.success).toBe(true);
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "admin.seller.impersonate.end",
          actorUserId: adminUser.id,
        }),
      }),
    );
  });

  describe("Security Invariants & Secret Validation", () => {
    it("fails session creation when impersonation secret is not configured", async () => {
      delete process.env.ADMIN_IMPERSONATION_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;

      prisma.client.seller.findFirst.mockResolvedValue({
        id: "seller_1",
        storeName: "Test Store",
        userId: "user_seller_1",
        user: { id: "user_seller_1", status: UserStatus.ACTIVE },
      });

      const service = new AdminImpersonationService(prisma as never);
      await expect(
        service.createImpersonationSession("seller_1", adminUser),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it("rejects token resolution when impersonation secret is not configured", async () => {
      delete process.env.ADMIN_IMPERSONATION_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;

      const service = new AdminImpersonationService(prisma as never);
      const resolved = await service.resolveToken("ih_impersonate_anyPayload.anySignature");
      expect(resolved).toBeNull();
    });

    it("strictly rejects tokens forged with the legacy static fallback secret string", async () => {
      // Craft a token signed with the old hardcoded fallback string
      const payload = {
        sellerId: "seller_1",
        targetUserId: "user_seller_1",
        impersonatorAdminId: "admin_1",
        impersonatorEmail: "admin@test.com",
        sellerStoreName: "Test Store",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const dataString = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const legacyHmac = createHmac("sha256", "indihub_impersonation_secret_fallback_key_2026")
        .update(dataString)
        .digest("base64url");
      const legacyToken = `ih_impersonate_${dataString}.${legacyHmac}`;

      // Configured with genuine dedicated secret
      process.env.ADMIN_IMPERSONATION_SECRET = "high-entropy-dedicated-secret-key-32chars";
      const service = new AdminImpersonationService(prisma as never);

      const resolved = await service.resolveToken(legacyToken);
      expect(resolved).toBeNull();
    });

    it("does not fall back to CLERK_SECRET_KEY or DATABASE_URL (cross-context key reuse blocked)", () => {
      delete process.env.ADMIN_IMPERSONATION_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;
      process.env.CLERK_SECRET_KEY = "sk_test_some_clerk_secret_key";
      process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";

      expect(() => getImpersonationSecret()).toThrow(ServiceUnavailableException);
    });

    it("allows ADMIN_SESSION_SECRET as fallback if ADMIN_IMPERSONATION_SECRET is unset", () => {
      delete process.env.ADMIN_IMPERSONATION_SECRET;
      process.env.ADMIN_SESSION_SECRET = "fallback-admin-session-secret-at-least-32-chars";

      expect(getImpersonationSecret()).toBe("fallback-admin-session-secret-at-least-32-chars");
    });

    it("enforces minimum 32 characters in production environment", () => {
      process.env.NODE_ENV = "production";
      process.env.ADMIN_IMPERSONATION_SECRET = "short-secret-key";

      expect(() => getImpersonationSecret()).toThrow(ServiceUnavailableException);

      process.env.ADMIN_IMPERSONATION_SECRET = "valid-length-production-secret-with-at-least-32-characters";
      expect(getImpersonationSecret()).toBe(
        "valid-length-production-secret-with-at-least-32-characters",
      );
    });
  });
});
