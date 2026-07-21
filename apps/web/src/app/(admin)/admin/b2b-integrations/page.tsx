import { AdminB2BIntegrationsClient } from "@/components/admin/admin-b2b-integrations-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminB2BIntegrationsPage() {
  return (
    <AdminPortalShell
      title="B2B ERP integrations"
      description="Configure encrypted generic REST webhooks, signed lifecycle events, acknowledgements, retries, and dead-letter recovery."
    >
      <AdminB2BIntegrationsClient />
    </AdminPortalShell>
  );
}
