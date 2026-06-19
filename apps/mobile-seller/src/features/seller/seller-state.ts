import type { SellerProfile } from "./seller-api";

export type SellerWorkspaceState = "needs-onboarding" | "pending-approval" | "approved" | "blocked";

export function sellerWorkspaceState(profile: SellerProfile | null | undefined, statusCode?: number): SellerWorkspaceState {
  if (!profile || statusCode === 403 || statusCode === 404) {
    return "needs-onboarding";
  }

  if (profile.status === "SUSPENDED" || profile.status === "REJECTED" || profile.approvalStatus === "REJECTED") {
    return "blocked";
  }

  if (profile.status === "APPROVED" && profile.approvalStatus === "APPROVED") {
    return "approved";
  }

  return "pending-approval";
}
