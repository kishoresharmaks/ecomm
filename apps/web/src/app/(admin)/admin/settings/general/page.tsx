import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSettingsPageClient } from "@/components/admin/admin-operations";

export default function AdminSettingsGeneralPage() {
  return (
    <AdminPortalShell
      title="Configuration center"
      description="Manage DB-backed platform, payment, email, storage, checkout, and payout settings."
    >
      <AdminSettingsPageClient />
    </AdminPortalShell>
  );
}
