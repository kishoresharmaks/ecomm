import { SellerProductsClient } from "@/components/seller/seller-products-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerProductsPage() {
  return (
    <SellerWorkspaceShell title="Products" description="View catalogue items first, then add, edit, archive, or review approval state from one list.">
      <SellerProductsClient mode="list" />
    </SellerWorkspaceShell>
  );
}
