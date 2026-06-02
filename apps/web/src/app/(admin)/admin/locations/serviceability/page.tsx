import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminLocationServiceabilityClient } from "./admin-location-serviceability-client";

export default function AdminLocationServiceabilityPage() {
  return (
    <AdminPortalShell
      title="Location serviceability"
      description="Check whether a location is operationally ready for sellers, delivery partners, shipping charges, and checkout payment options."
    >
      <AdminLocationServiceabilityClient />
    </AdminPortalShell>
  );
}
