import { RoleCode } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { AuthSyncController } from "./auth-sync.controller";

describe("AuthSyncController", () => {
  it("forces public current-user sync into the customer role", async () => {
    const profile = {
      clerkUserId: "clerk_1",
      email: "customer@example.com",
      defaultRole: RoleCode.CUSTOMER
    };
    const authUsersService = {
      syncAuthUser: vi.fn().mockResolvedValue(profile)
    };
    const clerkAuthService = {
      resolveSessionProfile: vi.fn().mockResolvedValue(profile)
    };

    const controller = new AuthSyncController(authUsersService as never, clerkAuthService as never);

    await controller.syncCurrentUser("Bearer token", {
      email: "customer@example.com",
      defaultRole: RoleCode.ADMIN
    });

    expect(clerkAuthService.resolveSessionProfile).toHaveBeenCalledWith("Bearer token", {
      email: "customer@example.com",
      defaultRole: RoleCode.CUSTOMER
    });
  });
});
