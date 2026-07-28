import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminPayoutsClient } from "@/components/admin/finance/payouts-client";

export default function AdminFinancePayoutsPage() {
  return (
    <AdminPortalShell title="Payout approvals" description="Approve seller payouts and record manual settlement references.">
      <AdminPayoutsClient />
    </AdminPortalShell>
  );
}

