import { SellerServicesClient } from "@/components/seller/seller-services-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerNewServicePage() {
  return (
    <SellerWorkspaceShell
      title="Add service"
      description="Publish service details, pricing, coverage, visit modes, cancellation policy, and approval-ready customer content."
    >
      <SellerServicesClient mode="form" />
    </SellerWorkspaceShell>
  );
}
