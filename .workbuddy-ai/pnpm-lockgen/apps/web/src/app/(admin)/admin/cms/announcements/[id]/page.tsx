import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCmsAnnouncementEditClient } from "@/components/admin/admin-cms-announcements";

export default async function AdminAnnouncementEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <AdminPortalShell
      title={id === "new" ? "New Announcement" : "Edit Announcement"}
      description="Configure your announcement colors, links, and scheduled appearance."
    >
      <AdminCmsAnnouncementEditClient id={id} />
    </AdminPortalShell>
  );
}
