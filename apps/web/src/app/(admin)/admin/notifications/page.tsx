import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminEmailLogsPageClient } from "@/components/admin/admin-email-workspace";

export default function AdminNotificationsPage() {
  return (
    <AdminPortalShell
      title="Email logs"
      description="Review transactional emails and retry failed delivery logs."
    >
      <AdminEmailLogsPageClient />
    </AdminPortalShell>
  );
}
