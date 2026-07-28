import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSupportPageClient } from "@/components/admin/admin-operations";

export default function AdminSupportPage() {
  return (
    <AdminPortalShell title="Support desk" description="Handle customer, seller, and public support requests.">
      <AdminSupportPageClient />
    </AdminPortalShell>
  );
}
