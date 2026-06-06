import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { DeliveryPartnerApplicationsClient } from "@/components/admin/delivery-partner-applications-client";

export default function AdminDeliveryPartnerApplicationsPage() {
  return (
    <AdminPortalShell
      title="Delivery partner applications"
      description="Review local delivery partner applicants, approve verified accounts, and activate assignment profiles."
    >
      <DeliveryPartnerApplicationsClient />
    </AdminPortalShell>
  );
}
