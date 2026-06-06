import { describe, expect, it } from "vitest";
import {
  roleRemovalHasBlockers,
  roleRemovalNoteError,
  visibleRoleRemovalCounts,
  type RoleRemovalImpact,
} from "./admin-role-removal-utils";

describe("admin role removal utilities", () => {
  it("treats blockers as non-removable even when canRemove is false or blockers exist", () => {
    expect(roleRemovalHasBlockers(impact({ canRemove: false }))).toBe(true);
    expect(roleRemovalHasBlockers(impact({ blockers: ["Resolve active orders."] }))).toBe(true);
    expect(roleRemovalHasBlockers(impact())).toBe(false);
  });

  it("requires an admin note only when the impact says associated data exists", () => {
    expect(roleRemovalNoteError(impact({ noteRequired: true }), "")).toMatch(/admin note/i);
    expect(roleRemovalNoteError(impact({ noteRequired: true }), "Reviewed by admin")).toBe("");
    expect(roleRemovalNoteError(impact({ noteRequired: false }), "")).toBe("");
  });

  it("shows only non-zero associated record counts", () => {
    expect(
      visibleRoleRemovalCounts(
        impact({
          associatedCounts: {
            products: 2,
            activeSellerOrders: 0,
            openSellerPayouts: 1,
          },
        }),
      ),
    ).toEqual([
      { key: "products", label: "Products", value: 2 },
      { key: "openSellerPayouts", label: "Open Seller Payouts", value: 1 },
    ]);
  });
});

function impact(overrides: Partial<RoleRemovalImpact> = {}): RoleRemovalImpact {
  return {
    userId: "user_1",
    roleCode: "SELLER",
    canRemove: true,
    noteRequired: false,
    affectedProfile: "SELLER",
    blockers: [],
    warnings: [],
    cleanupActions: [],
    associatedCounts: {},
    ...overrides,
  };
}
