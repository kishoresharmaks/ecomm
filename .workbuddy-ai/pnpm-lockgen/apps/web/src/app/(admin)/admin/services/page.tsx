import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminServicesClient } from "@/components/admin/admin-services-client";

export default function AdminServicesPage() {
  return (
    <AdminPortalShell
      title="Service approvals"
      description="Review provider service listings, pricing, visit modes, service areas, and storefront visibility."
    >
      <AdminServicesClient mode="services" />
    </AdminPortalShell>
  );
}
