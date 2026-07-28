import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSettlementsClient } from "@/components/admin/finance/settlements-client";

export default function AdminFinanceSettlementsPage() {
  return (
    <AdminPortalShell title="Settlement cycles" description="Generate and review seller settlement cycles before payout approval.">
      <AdminSettlementsClient />
    </AdminPortalShell>
  );
}

