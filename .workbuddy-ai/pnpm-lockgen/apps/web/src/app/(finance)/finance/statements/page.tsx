import { AdminStatementsClient } from "@/components/admin/finance/statements-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceStatementsPage() {
  return (
    <FinanceShell title="Seller statements" description="Generate and download seller finance statements from payout and ledger records.">
      <AdminStatementsClient />
    </FinanceShell>
  );
}
