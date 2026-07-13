import { FinanceShell } from "@/components/finance/finance-shell";
import { SellerCashReceivablesClient } from "@/components/finance/seller-cash-receivables-client";

export default function SellerCashReceivablesPage() {
  return (
    <FinanceShell
      title="Seller COD dues"
      description="Review store pickup and manual transport COD cash collected by sellers, then settle or waive platform-due balances."
    >
      <SellerCashReceivablesClient />
    </FinanceShell>
  );
}
