import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RoleCode, UserStatus } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminImpersonationService } from "./admin-impersonation.service";
import type { RequestUser } from "./types/indihub-request";

describe("AdminImpersonationService", () => {
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
});
