import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminLocationImportClient } from "./admin-location-import-client";

export default function AdminLocationImportPage() {
  return (
    <AdminPortalShell
      title="Location import"
      description="Run India local-area and pincode import operations from official bulk sources, then verify individual PIN codes through the admin-only PostalPin lookup helper."
    >
      <AdminLocationImportClient />
    </AdminPortalShell>
  );
}
