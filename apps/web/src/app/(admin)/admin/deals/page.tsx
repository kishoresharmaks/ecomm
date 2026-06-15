import { AdminDealsClient } from "@/components/admin/admin-deals-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminDealsPage() {
  return (
    <AdminPortalShell
      title="Deals"
      description="Create category-based seller opt-in campaigns, publish them, and track enrolled products and deal orders."
    >
      <AdminDealsClient />
    </AdminPortalShell>
  );
}
