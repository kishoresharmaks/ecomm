import { FinanceShell } from "@/components/finance/finance-shell";
import { PaymentReportsClient } from "@/components/finance/payment-reports-client";

export default function FinancePaymentReportsPage() {
  return (
    <FinanceShell title="Finance reports" description="Review complete payment, collection, settlement, payout, and service receivable registers with controlled CSV exports.">
      <PaymentReportsClient />
    </FinanceShell>
  );
}
