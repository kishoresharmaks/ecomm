import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { SellerApprovalsClient } from "./seller-approvals-client";

export default function SellerApprovalPage() {
  return (
    <AdminPortalShell
      title="Seller verification"
      description="Verify pending seller, store, and local shop applications. Every action is logged for traceability."
    >
      <SellerApprovalsClient />
    </AdminPortalShell>
  );
}
