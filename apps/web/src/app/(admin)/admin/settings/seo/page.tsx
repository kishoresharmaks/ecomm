import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSeoSettingsClient } from "@/components/admin/settings/admin-seo-settings-client";

export default function AdminSettingsSeoPage() {
  return (
    <AdminPortalShell
      title="SEO & Analytics Configuration"
      description="Manage Google Tag Manager, Analytics 4, Ads, and Search Console integration settings."
    >
      <AdminSeoSettingsClient />
    </AdminPortalShell>
  );
}
