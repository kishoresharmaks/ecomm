import { describe, expect, it } from "vitest";
import { sellerWorkspaceState } from "./seller-state";
import type { SellerProfile } from "./seller-api";

const baseProfile: SellerProfile = {
  id: "seller_1",
  storeName: "Seller",
  status: "PENDING_APPROVAL",
  approvalStatus: "PENDING_APPROVAL",
};

describe("seller mobile workspace state", () => {
  it("routes missing or forbidden profile to onboarding", () => {
    expect(sellerWorkspaceState(null)).toBe("needs-onboarding");
    expect(sellerWorkspaceState(undefined, 403)).toBe("needs-onboarding");
  });

  it("routes approved sellers to the workspace", () => {
    expect(sellerWorkspaceState({ ...baseProfile, status: "APPROVED", approvalStatus: "APPROVED" })).toBe("approved");
  });

  it("routes rejected or suspended sellers to blocked state", () => {
    expect(sellerWorkspaceState({ ...baseProfile, status: "SUSPENDED" })).toBe("blocked");
    expect(sellerWorkspaceState({ ...baseProfile, approvalStatus: "REJECTED" })).toBe("blocked");
  });
});
