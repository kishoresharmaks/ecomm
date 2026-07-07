import { SellerServicesClient } from "@/components/seller/seller-services-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerServiceReviewsPage() {
  return (
    <SellerWorkspaceShell
      title="Service reviews"
      description="Reply to customer service feedback and manage visible, hidden, unreplied, or low-rating service reviews."
    >
      <SellerServicesClient mode="reviews" />
    </SellerWorkspaceShell>
  );
}
