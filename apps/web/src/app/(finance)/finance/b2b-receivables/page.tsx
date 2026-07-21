import { FinanceB2BReceivablesClient } from "@/components/finance/b2b-receivables-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceB2BReceivablesPage() {
  return (
    <FinanceShell
      title="B2B receivables"
      description="Manage buyer credit, payment schedules, ageing, collections, allocations, and receipt clearance for B2B invoices."
    >
      <FinanceB2BReceivablesClient />
    </FinanceShell>
  );
}
