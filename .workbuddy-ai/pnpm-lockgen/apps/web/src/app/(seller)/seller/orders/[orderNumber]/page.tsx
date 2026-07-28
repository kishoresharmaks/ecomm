import { SellerOrderDetailClient } from "@/components/seller/seller-order-detail-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default async function SellerOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  return (
    <SellerWorkspaceShell title={`Order ${orderNumber}`} description="Review seller items, update processing state, and save delivery details.">
      <SellerOrderDetailClient orderNumber={orderNumber} />
    </SellerWorkspaceShell>
  );
}
