import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminRefundsClient } from "@/components/admin/admin-refunds-client";

export default function AdminRefundsPage() {
  return (
    <AdminPortalShell
      title="Refunds"
      description="Approve buyer refunds, initiate Razorpay retries, and record manual refund references with finance-safe audit context."
    >
      <AdminRefundsClient />
    </AdminPortalShell>
  );
}
