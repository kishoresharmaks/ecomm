import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { SellerApprovalsClient } from "./seller-approvals-client";

export default function SellerApprovalPage() {
  return (
    <AdminPortalShell
      title="Seller approval queue"
      description="This screen is prepared for pending seller, nearby store, and local shop approval. API endpoints are now guarded by admin RBAC."
    >
      <SellerApprovalsClient />
    </AdminPortalShell>
  );
}
