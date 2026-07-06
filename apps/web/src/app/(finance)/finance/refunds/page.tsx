import { AdminRefundsClient } from "@/components/admin/admin-refunds-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceRefundsPage() {
  return (
    <FinanceShell
      title="Refunds"
      description="Review buyer refunds, adjust payable amounts within approved caps, and record UPI or bank transfer references."
    >
      <AdminRefundsClient />
    </FinanceShell>
  );
}
