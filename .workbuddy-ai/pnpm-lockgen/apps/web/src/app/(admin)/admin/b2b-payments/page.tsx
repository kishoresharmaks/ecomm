import { AdminB2BPaymentsPageClient } from "@/components/admin/admin-b2b-payments-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminB2BPaymentsPage() {
  return (
    <AdminPortalShell
      title="B2B payment verification"
      description="Review buyer bank-transfer proofs, verify receipts, reject mismatches, and watch overpayment flags."
    >
      <AdminB2BPaymentsPageClient />
    </AdminPortalShell>
  );
}
