import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminReviewsClient } from "@/components/admin/admin-reviews-client";

export default function AdminReviewsPage() {
  return (
    <AdminPortalShell
      title="Ratings and reviews"
      description="Moderate verified-purchase product reviews before they appear on public product and store pages."
    >
      <AdminReviewsClient />
    </AdminPortalShell>
  );
}
