import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminSellerSubscriptionsClient } from "@/components/admin/seller-subscriptions-client";

export default function AdminSellerSubscriptionsPage() {
  return (
    <AdminPortalShell
      title="Seller subscriptions"
      description="Manage seller plans, default onboarding plan, and manual seller plan assignments."
    >
      <AdminSellerSubscriptionsClient />
    </AdminPortalShell>
  );
}
