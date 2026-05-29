import { AdminSettlementsClient } from "@/components/admin/finance/settlements-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceSettlementsPage() {
  return (
    <FinanceShell title="Settlements" description="Create and submit seller settlement drafts from verified and eligible order splits.">
      <AdminSettlementsClient />
    </FinanceShell>
  );
}
