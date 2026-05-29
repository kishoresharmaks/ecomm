import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSellerLedgerClient } from "@/components/admin/finance/ledger-client";

export default function AdminSellerLedgerPage() {
  return (
    <AdminPortalShell title="Seller ledger" description="Review seller wallet movements, payout entries, and manual finance adjustments.">
      <AdminSellerLedgerClient />
    </AdminPortalShell>
  );
}

