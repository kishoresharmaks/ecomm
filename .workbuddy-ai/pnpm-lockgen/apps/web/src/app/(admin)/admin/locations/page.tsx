import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminLocationsClient } from "./admin-locations-client";

export default function AdminLocationsPage() {
  return (
    <AdminPortalShell
      title="Location data"
      description="Manage enabled market countries, address coverage, and controlled location imports for storefront, seller, checkout, and B2B address forms."
    >
      <AdminLocationsClient />
    </AdminPortalShell>
  );
}
