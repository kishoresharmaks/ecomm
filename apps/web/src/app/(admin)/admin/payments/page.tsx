import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminPaymentsPageClient } from "@/components/admin/admin-operations";

export default function AdminPaymentsPage() {
  return (
    <AdminPortalShell title="Payment readiness" description="Verify checkout payment providers and webhook setup.">
      <AdminPaymentsPageClient />
    </AdminPortalShell>
  );
}
