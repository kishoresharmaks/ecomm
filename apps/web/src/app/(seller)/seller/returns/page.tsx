import { SellerReturnsClient } from "@/components/seller/seller-returns-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerReturnsPage() {
  return (
    <SellerWorkspaceShell
      title="Returns"
      description="Approve or reject return and replacement requests for this store, then follow pickup and QC progress."
    >
      <SellerReturnsClient />
    </SellerWorkspaceShell>
  );
}
