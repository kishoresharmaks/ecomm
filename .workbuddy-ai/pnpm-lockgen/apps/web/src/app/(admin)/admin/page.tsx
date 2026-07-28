import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminDashboardClient } from "./admin-dashboard-client";

export default function AdminDashboardPage() {
  return (
    <AdminPortalShell
      title="Admin dashboard"
      description="Operational summary for sellers, products, orders, B2B enquiries, reports, settings, and audit controls."
    >
      <AdminDashboardClient />
    </AdminPortalShell>
  );
}
