import { RoleCode } from "@indihub/database";
import { describe, expect, it } from "vitest";
import { ROLES_KEY } from "../auth/auth.constants";
import { CourierProvidersController } from "./checkout-delivery.controller";

describe("CourierProvidersController roles", () => {
  it("allows courier managers to read providers but only admins to mutate provider settings", () => {
    expect(Reflect.getMetadata(ROLES_KEY, CourierProvidersController)).toEqual([
      RoleCode.ADMIN,
      RoleCode.COURIER_MANAGER,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, CourierProvidersController.prototype.upsertProvider)).toEqual([
      RoleCode.ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, CourierProvidersController.prototype.patchProvider)).toEqual([
      RoleCode.ADMIN,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, CourierProvidersController.prototype.updateProviderActive)).toEqual([
      RoleCode.ADMIN,
    ]);
  });
});
