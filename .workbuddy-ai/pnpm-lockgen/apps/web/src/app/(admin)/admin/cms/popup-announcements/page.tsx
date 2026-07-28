import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCmsPopupAnnouncementsClient } from "@/components/admin/admin-cms-popup-announcements";

export default function AdminPopupAnnouncementsPage() {
  return (
    <AdminPortalShell
      title="Promotional Popups"
      description="Manage responsive image promotions for the customer web and mobile home screens."
    >
      <AdminCmsPopupAnnouncementsClient />
    </AdminPortalShell>
  );
}
