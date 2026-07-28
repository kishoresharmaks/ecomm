import { FinanceShell } from "@/components/finance/finance-shell";
import { ServiceReceivablesClient } from "@/components/finance/service-receivables-client";

export default function FinanceServiceReceivablesPage() {
  return (
    <FinanceShell
      title="Service receivables"
      description="Track provider-collected service cash, resolve customer disputes, settle platform dues, approve controlled waivers, and choose payout offset treatment."
    >
      <ServiceReceivablesClient />
    </FinanceShell>
  );
}
