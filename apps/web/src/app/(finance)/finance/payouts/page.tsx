import { AdminPayoutsClient } from "@/components/admin/finance/payouts-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinancePayoutsPage() {
  return (
    <FinanceShell title="Payouts" description="Review seller payout requests, approve or reject them, and record manual payment references.">
      <AdminPayoutsClient />
    </FinanceShell>
  );
}
