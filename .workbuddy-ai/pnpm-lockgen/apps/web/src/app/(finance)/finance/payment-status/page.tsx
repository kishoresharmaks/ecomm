import { FinanceShell } from "@/components/finance/finance-shell";
import { PaymentCollectionsClient } from "@/components/finance/payment-collections-client";

export default function FinancePaymentStatusPage() {
  return (
    <FinanceShell title="Payment status control" description="Review all payment records and manually verify eligible COD, bank transfer, and manual payments.">
      <PaymentCollectionsClient mode="ALL" />
    </FinanceShell>
  );
}
