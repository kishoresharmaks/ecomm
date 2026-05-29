import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IS_PUBLIC_KEY, ROLES_KEY } from "../auth.constants";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const reflector = {
    getAllAndOverride: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows public routes without checking role metadata", () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => key === IS_PUBLIC_KEY);
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(createContext({ headers: {} }))).toBe(true);
  });

  it("allows routes without explicit role requirements", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(createContext({ currentUser: { roles: [] } }))).toBe(true);
  });

  it("allows users with at least one required role", () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === ROLES_KEY ? [RoleCode.ADMIN, RoleCode.SELLER] : false
    );
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(createContext({ currentUser: { roles: [RoleCode.SELLER] } }))).toBe(true);
  });

  it("allows back-office roles only from a standalone back-office session", () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [RoleCode.ADMIN, RoleCode.FINANCE] : false));
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(
      guard.canActivate(createContext({ currentUser: { roles: [RoleCode.FINANCE], authProvider: "ADMIN_SESSION" } }))
    ).toBe(true);
  });

  it("blocks Clerk or dev-auth users from using back-office-only roles", () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [RoleCode.FINANCE] : false));
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(createContext({ currentUser: { roles: [RoleCode.FINANCE], authProvider: "CLERK" } }))).toThrow(
      ForbiddenException
    );
  });

  it("blocks users that do not have the required role", () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => (key === ROLES_KEY ? [RoleCode.ADMIN] : false));
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(createContext({ currentUser: { roles: [RoleCode.CUSTOMER] } }))).toThrow(
      ForbiddenException
    );
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
