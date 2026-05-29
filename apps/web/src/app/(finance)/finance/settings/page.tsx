import { AdminPaymentsPageClient } from "@/components/admin/admin-operations";
import { CheckoutFeeSettingsFromApi } from "@/components/admin/settings/checkout-fee-settings";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceSettingsPage() {
  return (
    <FinanceShell title="Payment settings" description="Manage payment methods, bank transfer details, COD availability, platform fee, and Razorpay readiness.">
      <div className="space-y-5">
        <AdminPaymentsPageClient />
        <CheckoutFeeSettingsFromApi />
      </div>
    </FinanceShell>
  );
}
