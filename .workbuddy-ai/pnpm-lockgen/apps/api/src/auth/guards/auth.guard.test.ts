import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLES_KEY } from "../auth.constants";
import { AuthGuard } from "./auth.guard";

describe("AuthGuard", () => {
  const reflector = {
    getAllAndOverride: vi.fn()
  };
  const prisma = {
    client: {
      user: {
        findFirst: vi.fn()
      },
      userRole: {
        findMany: vi.fn()
      }
    }
  };
  const clerkAuthService = {
    verifyAuthorizationHeader: vi.fn()
  };
  const adminAuthService = {
    resolveAuthorizationHeader: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    adminAuthService.resolveAuthorizationHeader.mockResolvedValue(null);
  });

  it("allows public routes without reading auth headers", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const request = { headers: {} };
    const guard = new AuthGuard(reflector as unknown as Reflector, prisma as never, adminAuthService as never, clerkAuthService as never);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.client.user.findFirst).not.toHaveBeenCalled();
  });

  it("rejects protected routes without a Clerk or platform user header", async () => {
    const guard = new AuthGuard(reflector as unknown as Reflector, prisma as never, adminAuthService as never, clerkAuthService as never);

    await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("maps an active platform user and roles onto the request", async () => {
    const request = {
      headers: {
        "x-indihub-user-id": "user_1"
      }
    };
    prisma.client.user.findFirst.mockResolvedValue({
      id: "user_1",
      clerkUserId: "clerk_1",
      email: "admin@example.com",
      status: UserStatus.ACTIVE
    });
    prisma.client.userRole.findMany.mockResolvedValue([
      { role: { code: RoleCode.ADMIN, rolePermissions: [{ permission: { code: "notifications.manage" } }] } },
      { role: { code: RoleCode.SELLER, rolePermissions: [{ permission: { code: "seller.product.manage" } }] } }
    ]);
    const guard = new AuthGuard(reflector as unknown as Reflector, prisma as never, adminAuthService as never, clerkAuthService as never);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.client.user.findFirst).toHaveBeenCalledWith({
      where: { id: "user_1" }
    });
    expect(request).toMatchObject({
      currentUser: {
        id: "user_1",
        clerkUserId: "clerk_1",
        email: "admin@example.com",
        roles: [RoleCode.ADMIN, RoleCode.SELLER],
        permissions: ["notifications.manage", "seller.product.manage"]
      }
    });
  });

  it("verifies a Clerk bearer token before mapping the user", async () => {
    const request = {
      headers: {
        authorization: "Bearer session-token"
      }
    };
    clerkAuthService.verifyAuthorizationHeader.mockResolvedValue("clerk_bearer");
    prisma.client.user.findFirst.mockResolvedValue({
      id: "user_bearer",
      clerkUserId: "clerk_bearer",
      email: "customer@example.com",
      status: UserStatus.ACTIVE
    });
    prisma.client.userRole.findMany.mockResolvedValue([{ role: { code: RoleCode.CUSTOMER, rolePermissions: [] } }]);
    const guard = new AuthGuard(reflector as unknown as Reflector, prisma as never, adminAuthService as never, clerkAuthService as never);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(clerkAuthService.verifyAuthorizationHeader).toHaveBeenCalledWith("Bearer session-token");
    expect(prisma.client.user.findFirst).toHaveBeenCalledWith({
      where: { clerkUserId: "clerk_bearer" }
    });
  });

  it("blocks disabled users after identity mapping", async () => {
    prisma.client.user.findFirst.mockResolvedValue({
      id: "user_disabled",
      email: "disabled@example.com",
      status: UserStatus.DISABLED
    });
    const guard = new AuthGuard(reflector as unknown as Reflector, prisma as never, adminAuthService as never, clerkAuthService as never);

    await expect(
      guard.canActivate(
        createContext({
          headers: {
            "x-clerk-user-id": "clerk_disabled"
          }
        })
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires a standalone back-office session for admin and finance-only routes", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [RoleCode.ADMIN, RoleCode.FINANCE] : false));
    const guard = new AuthGuard(reflector as unknown as Reflector, prisma as never, adminAuthService as never, clerkAuthService as never);

    await expect(
      guard.canActivate(
        createContext({
          headers: {
            authorization: "Bearer clerk-token"
          }
        })
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(clerkAuthService.verifyAuthorizationHeader).not.toHaveBeenCalled();
  });
});

function createContext(request: Record<string, unknown>) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}
