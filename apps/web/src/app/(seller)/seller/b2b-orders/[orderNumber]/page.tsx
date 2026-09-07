import { SellerB2BOrderDetailClient } from "@/components/seller/seller-b2b-orders-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { SellerB2BV2OperationsPanel } from "@/components/b2b/b2b-v2-operations-panel";
import { isB2BV2Enabled } from "@/lib/b2b-feature-flags";

export default async function SellerB2BOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  return (
    <SellerWorkspaceShell title={`B2B order ${orderNumber}`} description="Review buyer PO details and commercial order timeline.">
      <div className="grid gap-5">
        <SellerB2BOrderDetailClient orderNumber={orderNumber} />
        {isB2BV2Enabled() ? <SellerB2BV2OperationsPanel orderNumber={orderNumber} /> : null}
      </div>
    </SellerWorkspaceShell>
  );
}
