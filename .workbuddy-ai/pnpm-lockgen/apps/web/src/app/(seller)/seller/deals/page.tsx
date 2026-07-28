import { SellerDealsClient } from "@/components/seller/seller-deals-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerDealsPage() {
  return (
    <SellerWorkspaceShell
      title="Deals"
      description="Accept marketplace deal campaigns and enroll eligible products before the join deadline."
    >
      <SellerDealsClient />
    </SellerWorkspaceShell>
  );
}
