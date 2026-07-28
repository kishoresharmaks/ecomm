import { FinanceShell } from "@/components/finance/finance-shell";
import { PaymentCollectionsClient } from "@/components/finance/payment-collections-client";

export default function FinanceCodCollectionsPage() {
  return (
    <FinanceShell title="COD collections" description="Verify delivery-partner collected COD before marking customer payments as paid.">
      <PaymentCollectionsClient mode="COD" />
    </FinanceShell>
  );
}
