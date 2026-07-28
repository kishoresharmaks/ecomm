import { AdminB2BOrdersPageClient } from "@/components/admin/admin-operations";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminB2BOrdersPage() {
  return (
    <AdminPortalShell
      title="B2B orders"
      description="Manage proforma invoices, purchase orders, and B2B fulfilment lifecycle."
    >
      <AdminB2BOrdersPageClient />
    </AdminPortalShell>
  );
}
