import { AdminCommissionRulesClient } from "@/components/admin/finance/commission-rules-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceCommissionRulesPage() {
  return (
    <FinanceShell title="Commission rules" description="Manage commission, GST, TDS, TCS, and platform fee rules for seller settlements.">
      <AdminCommissionRulesClient />
    </FinanceShell>
  );
}
