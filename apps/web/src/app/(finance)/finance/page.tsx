import { FinanceDashboardClient } from "@/components/finance/finance-dashboard-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceDashboardPage() {
  return (
    <FinanceShell title="Finance dashboard" description="Track COD, bank transfer, online payments, settlement due, and payout movement.">
      <FinanceDashboardClient />
    </FinanceShell>
  );
}
