import { FinanceShell } from "@/components/finance/finance-shell";
import { PaymentReportsClient } from "@/components/finance/payment-reports-client";

export default function FinancePaymentReportsPage() {
  return (
    <FinanceShell title="Payment reports" description="Summarise payment methods, payment statuses, COD collection states, settlements, and payout movement.">
      <PaymentReportsClient />
    </FinanceShell>
  );
}
