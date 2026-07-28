import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCmsAnnouncementsClient } from "@/components/admin/admin-cms-announcements";

export default function AdminAnnouncementsPage() {
  return (
    <AdminPortalShell
      title="Announcements"
      description="Manage storefront announcement bars and scheduled promotional messages."
    >
      <AdminCmsAnnouncementsClient />
    </AdminPortalShell>
  );
}
