import { AdminEmailWorkspaceClient } from "@/components/admin/admin-email-workspace";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminEmailPage() {
  return (
    <AdminPortalShell
      title="Email"
      description="Manage transactional templates, themes, triggers, and delivery logs. Provider configuration lives in Settings."
    >
      <AdminEmailWorkspaceClient />
    </AdminPortalShell>
  );
}
