import { SellerB2BOrdersClient } from "@/components/seller/seller-b2b-orders-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerB2BOrdersPage() {
  return (
    <SellerWorkspaceShell title="B2B orders" description="Review proforma invoices, purchase orders, and B2B fulfilment state.">
      <SellerB2BOrdersClient />
    </SellerWorkspaceShell>
  );
}
