import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminOrdersPageClient } from "@/components/admin/admin-operations";

export default function AdminOrdersPage() {
  return (
    <AdminPortalShell
      title="Orders"
      description="Track platform orders, payment status, buyer currency, seller splits, and delivery progress."
    >
      <AdminOrdersPageClient />
    </AdminPortalShell>
  );
}
