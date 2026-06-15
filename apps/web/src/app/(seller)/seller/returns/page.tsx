import { SellerReturnsClient } from "@/components/seller/seller-returns-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerReturnsPage() {
  return (
    <SellerWorkspaceShell
      title="Returns"
      description="Review return requests for this store, follow the pickup and QC steps, and add seller notes for admin and finance."
    >
      <SellerReturnsClient />
    </SellerWorkspaceShell>
  );
}
