import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminReturnsClient } from "@/components/admin/admin-returns-client";

export default function AdminReturnsPage() {
  return (
    <AdminPortalShell
      title="Returns"
      description="Review customer return and replacement requests, approve policy decisions, track reverse pickup, and record QC outcomes."
    >
      <AdminReturnsClient />
    </AdminPortalShell>
  );
}
