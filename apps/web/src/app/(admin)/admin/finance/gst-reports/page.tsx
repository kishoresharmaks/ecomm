import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminGstReportsClient } from "@/components/admin/finance/gst-reports-client";

export default function AdminFinanceGstReportsPage() {
  return (
    <AdminPortalShell
      title="GST reports"
      description="Review marketplace GST documents, liabilities, reconciliation, TCS, filing status, and provider readiness."
    >
      <AdminGstReportsClient />
    </AdminPortalShell>
  );
}
