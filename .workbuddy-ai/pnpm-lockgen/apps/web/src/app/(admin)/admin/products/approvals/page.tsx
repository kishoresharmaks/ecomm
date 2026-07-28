import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminProductsPageClient } from "@/components/admin/admin-operations";

export default function AdminProductApprovalsPage() {
  return (
    <AdminPortalShell
      title="Product approval queue"
      description="Review seller-submitted products, approval state, pricing, stock, images, and storefront visibility."
    >
      <AdminProductsPageClient mode="approvals" />
    </AdminPortalShell>
  );
}
