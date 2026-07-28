import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminOrderDetailPageClient } from "@/components/admin/admin-operations";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  return (
    <AdminPortalShell
      title={`Order ${orderNumber}`}
      description="Update order, payment, and delivery state from the protected admin console."
    >
      <AdminOrderDetailPageClient orderNumber={orderNumber} />
    </AdminPortalShell>
  );
}
