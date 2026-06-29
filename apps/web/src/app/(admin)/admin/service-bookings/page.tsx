import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminServicesClient } from "@/components/admin/admin-services-client";

export default function AdminServiceBookingsPage() {
  return (
    <AdminPortalShell
      title="Service bookings"
      description="Monitor service requests, quotes, payment records, disputes, cancellations, and settlement readiness."
    >
      <AdminServicesClient mode="bookings" />
    </AdminPortalShell>
  );
}
