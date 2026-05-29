import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminDeliveryOperationsPageClient } from "@/components/admin/admin-operations";

export default function AdminDeliveryOperationsPage() {
  return (
    <AdminPortalShell
      title="Delivery operations"
      description="Assignment queue, partner workload, and COD handover controls."
    >
      <AdminDeliveryOperationsPageClient />
    </AdminPortalShell>
  );
}
