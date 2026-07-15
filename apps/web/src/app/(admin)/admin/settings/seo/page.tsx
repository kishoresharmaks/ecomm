import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSeoSettingsClient } from "@/components/admin/settings/admin-seo-settings-client";

export default function AdminSettingsSeoPage() {
  return (
    <AdminPortalShell
      title="SEO & Analytics Configuration"
      description="Manage Google Search Console and Google Analytics integration settings."
    >
      <AdminSeoSettingsClient />
    </AdminPortalShell>
  );
}
