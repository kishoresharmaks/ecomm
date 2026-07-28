import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSellersPageClient } from "@/components/admin/admin-operations";

export default function AdminSellersPage() {
  return (
    <AdminPortalShell
      title="Seller operations"
      description="Review seller onboarding, approvals, suspensions, and marketplace activity."
    >
      <AdminSellersPageClient />
    </AdminPortalShell>
  );
}
