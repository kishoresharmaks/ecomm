import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminCategoriesPageClient } from "@/components/admin/admin-operations";

export default function AdminCategoriesPage() {
  return (
    <AdminPortalShell title="Categories" description="Manage storefront category hierarchy and archive empty categories.">
      <AdminCategoriesPageClient />
    </AdminPortalShell>
  );
}
