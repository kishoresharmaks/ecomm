import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCmsPageClient } from "@/components/admin/admin-operations";

export default function AdminCmsPage() {
  return (
    <AdminPortalShell title="Content management" description="Manage CMS pages, banners, and homepage sections.">
      <AdminCmsPageClient />
    </AdminPortalShell>
  );
}
