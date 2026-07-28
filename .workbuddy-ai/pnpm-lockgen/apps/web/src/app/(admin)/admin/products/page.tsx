import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminProductsPageClient } from "@/components/admin/admin-operations";

export default function AdminProductsPage() {
  return (
    <AdminPortalShell
      title="Product catalogue"
      description="Review seller products, approval status, pricing, stock, images, and storefront visibility."
    >
      <AdminProductsPageClient />
    </AdminPortalShell>
  );
}
