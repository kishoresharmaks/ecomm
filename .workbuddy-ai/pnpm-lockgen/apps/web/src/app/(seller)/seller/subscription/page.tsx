import { SellerSubscriptionClient } from "@/components/seller/seller-subscription-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerSubscriptionPage() {
  return (
    <SellerWorkspaceShell
      title="Seller subscription"
      description="Review the current seller plan, onboarding assignment, and operational capacity."
    >
      <SellerSubscriptionClient />
    </SellerWorkspaceShell>
  );
}
