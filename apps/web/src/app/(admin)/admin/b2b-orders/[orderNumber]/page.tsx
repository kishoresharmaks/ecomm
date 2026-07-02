import { AdminB2BOrderDetailPageClient } from "@/components/admin/admin-b2b-order-detail-client";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default async function AdminB2BOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <AdminPortalShell
      title={`B2B order ${orderNumber}`}
      description="Perform B2B PO, payment, fulfilment, proforma, refund, and tax-invoice operations from a dedicated admin workspace."
    >
      <AdminB2BOrderDetailPageClient orderNumber={orderNumber} />
    </AdminPortalShell>
  );
}
