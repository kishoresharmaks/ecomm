import { SellerProfileClient } from "@/components/seller/seller-profile-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerProfilePage() {
  return (
    <SellerWorkspaceShell title="Store profile" description="Maintain public store identity, contact details, pickup address, logo, and banner.">
      <SellerProfileClient />
    </SellerWorkspaceShell>
  );
}
