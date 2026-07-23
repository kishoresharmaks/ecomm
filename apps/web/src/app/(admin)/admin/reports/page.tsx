import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminReportsOverviewClient } from "@/components/admin/reports/admin-report-pages-client";

export default function AdminReportsPage() {
  return (
    <AdminPortalShell title="Reports" description="Review platform sales, seller, product, support, and enquiry reporting.">
      <AdminReportsOverviewClient />
    </AdminPortalShell>
  );
}
