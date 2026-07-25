import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminGstSettingsClient } from "@/components/admin/settings/gst-settings";

export default function AdminTaxGstSettingsPage() {
  return (
    <AdminPortalShell
      title="Tax & GST settings"
      description="Configure the platform GST identity and audited manual e-invoice and e-way bill workflows."
    >
      <AdminGstSettingsClient />
    </AdminPortalShell>
  );
}
