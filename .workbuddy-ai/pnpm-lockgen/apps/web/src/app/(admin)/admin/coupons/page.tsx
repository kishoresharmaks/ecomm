import { AdminCouponsClient } from "@/components/admin/admin-coupons-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminCouponsPage() {
  return (
    <AdminPortalShell
      title="Coupons"
      description="Create, approve, pause, and audit admin-managed buyer coupon campaigns."
    >
      <AdminCouponsClient />
    </AdminPortalShell>
  );
}
