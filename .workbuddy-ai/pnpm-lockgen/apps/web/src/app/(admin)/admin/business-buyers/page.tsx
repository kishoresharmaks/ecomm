import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminBusinessBuyersPageClient } from "@/components/admin/admin-operations";

export default function AdminBusinessBuyersPage() {
  return (
    <AdminPortalShell title="Business buyers" description="Manage B2B company accounts and user status.">
      <AdminBusinessBuyersPageClient />
    </AdminPortalShell>
  );
}
