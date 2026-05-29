import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminStatementsClient } from "@/components/admin/finance/statements-client";

export default function AdminFinanceStatementsPage() {
  return (
    <AdminPortalShell title="Seller statements" description="Download seller payout statements and invoices as CSV or PDF.">
      <AdminStatementsClient />
    </AdminPortalShell>
  );
}

