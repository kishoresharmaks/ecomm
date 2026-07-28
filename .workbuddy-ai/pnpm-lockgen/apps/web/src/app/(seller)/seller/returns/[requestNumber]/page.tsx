import { SellerReturnDetailClient } from "@/components/seller/seller-return-detail-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default async function SellerReturnDetailPage({
  params,
}: {
  params: Promise<{ requestNumber: string }>;
}) {
  const { requestNumber } = await params;
  
  return (
    <SellerWorkspaceShell
      title={`Return ${decodeURIComponent(requestNumber)}`}
      description="Inspect affected items, pickup state, QC notes, refund details, and store note history."
    >
      <SellerReturnDetailClient requestNumber={decodeURIComponent(requestNumber)} />
    </SellerWorkspaceShell>
  );
}
