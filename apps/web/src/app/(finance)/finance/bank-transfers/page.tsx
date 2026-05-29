import { FinanceShell } from "@/components/finance/finance-shell";
import { PaymentCollectionsClient } from "@/components/finance/payment-collections-client";

export default function FinanceBankTransfersPage() {
  return (
    <FinanceShell title="Bank transfer verification" description="Review customer UTR/reference details and verify manual bank or UPI receipts.">
      <PaymentCollectionsClient mode="BANK_TRANSFER" />
    </FinanceShell>
  );
}
