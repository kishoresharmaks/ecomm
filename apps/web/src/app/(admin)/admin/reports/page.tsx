import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminReportsPageClient } from "@/components/admin/admin-operations";

export default function AdminReportsPage() {
  return (
    <AdminPortalShell title="Reports" description="Review platform sales, seller, product, support, and enquiry reporting.">
      <AdminReportsPageClient />
    </AdminPortalShell>
  );
}
