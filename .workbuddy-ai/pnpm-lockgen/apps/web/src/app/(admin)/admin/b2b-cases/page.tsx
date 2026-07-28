import { AdminB2BCasesClient } from "@/components/admin/admin-b2b-cases-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default function AdminB2BCasesPage() {
  return (
    <AdminPortalShell
      title="B2B after-sales cases"
      description="Manage order-linked shortages, damage, warranty, return, replacement, and billing disputes."
    >
      <AdminB2BCasesClient />
    </AdminPortalShell>
  );
}
