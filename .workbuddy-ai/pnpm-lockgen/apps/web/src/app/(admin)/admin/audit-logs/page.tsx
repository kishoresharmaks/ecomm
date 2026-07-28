import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminAuditLogsPageClient } from "@/components/admin/admin-operations";

export default function AdminAuditLogsPage() {
  return (
    <AdminPortalShell title="Audit logs" description="Trace sensitive platform changes and operational events.">
      <AdminAuditLogsPageClient />
    </AdminPortalShell>
  );
}
