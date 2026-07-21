import { AdminB2BExceptionsClient } from "@/components/admin/admin-b2b-exceptions-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminB2BExceptionsPage() {
  return (
    <AdminPortalShell
      title="B2B exception queue"
      description="Review orders needing operational, payment, delivery, migration, or GST attention."
    >
      <AdminB2BExceptionsClient />
    </AdminPortalShell>
  );
}
