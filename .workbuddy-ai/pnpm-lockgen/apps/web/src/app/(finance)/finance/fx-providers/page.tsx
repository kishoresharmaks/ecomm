import { FinanceShell } from "@/components/finance/finance-shell";
import { FxProviderManagementClient } from "@/components/finance/fx-provider-management-client";

export default function FinanceFxProvidersPage() {
  return (
    <FinanceShell
      title="FX providers"
      description="Configure currency-rate providers, control primary and fallback routing, and compare live quotes before they are used for new checkout snapshots."
    >
      <FxProviderManagementClient />
    </FinanceShell>
  );
}
