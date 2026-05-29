import { AdminSellerLedgerClient } from "@/components/admin/finance/ledger-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceLedgerPage() {
  return (
    <FinanceShell title="Seller ledger" description="Review wallet ledger entries and record controlled manual finance adjustments.">
      <AdminSellerLedgerClient />
    </FinanceShell>
  );
}
