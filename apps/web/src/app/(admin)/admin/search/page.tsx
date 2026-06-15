import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSearchClient } from "@/components/admin/admin-search-client";

export default function AdminSearchPage() {
  return (
    <AdminPortalShell
      title="Search operations"
      description="Monitor PostgreSQL search indexing jobs, queue reindexing, and verify query plans."
    >
      <AdminSearchClient />
    </AdminPortalShell>
  );
}
