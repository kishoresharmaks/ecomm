import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCommissionRulesClient } from "@/components/admin/finance/commission-rules-client";

export default function AdminCommissionRulesPage() {
  return (
    <AdminPortalShell title="Commission rules" description="Configure seller commission, GST, TDS, TCS, and seller settlement fee rules.">
      <AdminCommissionRulesClient />
    </AdminPortalShell>
  );
}
