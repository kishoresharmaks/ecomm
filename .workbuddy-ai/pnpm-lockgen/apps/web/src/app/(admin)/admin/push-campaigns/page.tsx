import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminPushCampaignsClient } from "@/components/admin/admin-push-campaigns-client";

export default function AdminPushCampaignsPage() {
  return (
    <AdminPortalShell
      title="Push campaigns"
      description="Create and monitor customer mobile push campaigns with worker-backed delivery counts."
    >
      <AdminPushCampaignsClient />
    </AdminPortalShell>
  );
}
