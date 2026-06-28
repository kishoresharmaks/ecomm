import { AdminB2BAnalyticsPageClient } from "@/components/admin/admin-b2b-analytics-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminB2BAnalyticsPage() {
  return (
    <AdminPortalShell
      title="B2B analytics"
      description="Track negotiation conversion, commission, order value, and off-platform risk across business buyer enquiries."
    >
      <AdminB2BAnalyticsPageClient />
    </AdminPortalShell>
  );
}
