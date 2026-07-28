import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { SellerCashReceivablesClient } from "@/components/finance/seller-cash-receivables-client";

export default function AdminSellerCashReceivablesPage() {
  return (
    <AdminPortalShell
      title="Seller COD dues"
      description="Review store pickup and manual transport COD collected by sellers, then settle or waive platform-due balances."
    >
      <SellerCashReceivablesClient />
    </AdminPortalShell>
  );
}
