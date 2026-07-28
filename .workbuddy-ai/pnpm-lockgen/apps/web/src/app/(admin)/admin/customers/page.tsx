import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCustomersPageClient } from "@/components/admin/admin-operations";

export default function AdminCustomersPage() {
  return (
    <AdminPortalShell
      title="Customer accounts"
      description="Manage customer profiles, order readiness, addresses, and account access."
    >
      <AdminCustomersPageClient />
    </AdminPortalShell>
  );
}
