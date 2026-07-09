import { SellerReturnDetailClient } from "@/components/seller/seller-return-detail-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerReturnDetailPage({
  params,
}: {
  params: { requestNumber: string };
}) {
  return (
    <SellerWorkspaceShell
      title={`Return ${decodeURIComponent(params.requestNumber)}`}
      description="Inspect affected items, pickup state, QC notes, refund details, and store note history."
    >
      <SellerReturnDetailClient requestNumber={decodeURIComponent(params.requestNumber)} />
    </SellerWorkspaceShell>
  );
}
