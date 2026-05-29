import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminUsersPageClient } from "@/components/admin/admin-operations";

export default function AdminUsersPage() {
  return (
    <AdminPortalShell title="Users and roles" description="Control platform users, roles, and account status.">
      <AdminUsersPageClient />
    </AdminPortalShell>
  );
}
