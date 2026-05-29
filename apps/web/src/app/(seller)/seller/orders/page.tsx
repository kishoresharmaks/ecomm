import { SellerOrdersClient } from "@/components/seller/seller-orders-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerOrdersPage() {
  return (
    <SellerWorkspaceShell title="Orders" description="Search seller orders, inspect payment and delivery state, and open fulfilment tasks.">
      <SellerOrdersClient />
    </SellerWorkspaceShell>
  );
}
