import { SellerPendingApprovalClient } from "@/components/seller/seller-pending-approval-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerPendingApprovalPage() {
  return (
    <SellerWorkspaceShell
      title="Seller approval status"
      description="Track onboarding review, approval state, and the next actions needed before seller operations unlock."
    >
      <SellerPendingApprovalClient />
    </SellerWorkspaceShell>
  );
}
