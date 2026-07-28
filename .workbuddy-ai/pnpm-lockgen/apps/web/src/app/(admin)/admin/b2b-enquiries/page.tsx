import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminB2BEnquiriesPageClient } from "@/components/admin/admin-operations";

export default function AdminB2BEnquiriesPage() {
  return (
    <AdminPortalShell title="B2B enquiries" description="Review business buyer requests and admin responses.">
      <AdminB2BEnquiriesPageClient />
    </AdminPortalShell>
  );
}
