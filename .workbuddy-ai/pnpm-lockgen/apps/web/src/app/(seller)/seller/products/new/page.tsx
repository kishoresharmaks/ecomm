import { SellerProductsClient } from "@/components/seller/seller-products-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerNewProductPage() {
  return (
    <SellerWorkspaceShell title="Add product" description="A compact form for catalogue basics, product images, price, stock, tax, and approval-ready details.">
      <SellerProductsClient mode="form" />
    </SellerWorkspaceShell>
  );
}
