import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminStoragePageClient } from "@/components/admin/admin-operations";

export default function AdminStoragePage() {
  return (
    <AdminPortalShell title="Storage readiness" description="Verify public image and private storage provider readiness.">
      <AdminStoragePageClient />
    </AdminPortalShell>
  );
}
