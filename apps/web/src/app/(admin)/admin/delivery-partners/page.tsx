import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { CourierDeliveryPartnersClient } from "@/components/courier/courier-workspace-client";

export default function AdminDeliveryPartnersPage() {
  return (
    <AdminPortalShell
      title="Delivery partners / riders"
      description="Manage approved delivery partner profiles, rider availability, service coverage, workload readiness, and COD exposure."
    >
      <CourierDeliveryPartnersClient
        basePath="/admin/delivery-partners"
        assignmentBoardHref="/admin/delivery"
        listHelpText="Admin can maintain operational rider profiles, service coverage, availability, and COD limits."
      />
    </AdminPortalShell>
  );
}
