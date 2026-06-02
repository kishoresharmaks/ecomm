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
      syncAuthUser: vi.fn().mockResolvedValue({ synced: true })
    };
    const clerkAuthService = {
      resolveSessionProfile: vi.fn().mockResolvedValue(profile)
    };

    const controller = new AuthSyncController(authUsersService as never, clerkAuthService as never);

    const result = await controller.syncCurrentUser("Bearer token", {
      email: "customer@example.com",
      defaultRole: RoleCode.ADMIN
    });

    expect(result).toMatchObject({
      encrypted: true,
      alg: "A256GCM"
    });
    expect(JSON.stringify(result)).not.toContain("customer@example.com");

    expect(clerkAuthService.resolveSessionProfile).toHaveBeenCalledWith("Bearer token", {
      email: "customer@example.com",
      defaultRole: RoleCode.CUSTOMER
    });
  });
});
