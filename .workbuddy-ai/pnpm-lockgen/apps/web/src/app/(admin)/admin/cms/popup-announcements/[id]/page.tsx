import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCmsPopupAnnouncementEditClient } from "@/components/admin/admin-cms-popup-announcements";

export default async function AdminPopupAnnouncementEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminPortalShell
      title={id === "new" ? "New Promotional Popup" : "Edit Promotional Popup"}
      description="Configure images, destinations, schedule, and carousel order."
    >
      <AdminCmsPopupAnnouncementEditClient id={id} />
    </AdminPortalShell>
  );
}
