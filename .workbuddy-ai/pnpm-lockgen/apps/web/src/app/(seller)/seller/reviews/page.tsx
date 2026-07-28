import { SellerReviewsClient } from "@/components/seller/seller-reviews-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerReviewsPage() {
  return (
    <SellerWorkspaceShell
      title="Ratings and reviews"
      description="View customer ratings and reviews for your products. Moderation is controlled by 1HandIndia admin."
    >
      <SellerReviewsClient />
    </SellerWorkspaceShell>
  );
}
