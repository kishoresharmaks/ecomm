import { SellerB2BOrderDetailClient } from "@/components/seller/seller-b2b-orders-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default async function SellerB2BOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <SellerWorkspaceShell title={`B2B order ${orderNumber}`} description="Review buyer PO details and commercial order timeline.">
      <SellerB2BOrderDetailClient orderNumber={orderNumber} />
    </SellerWorkspaceShell>
  );
}
