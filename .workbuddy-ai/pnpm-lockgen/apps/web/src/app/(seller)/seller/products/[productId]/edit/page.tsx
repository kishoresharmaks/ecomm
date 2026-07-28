import { SellerProductsClient } from "@/components/seller/seller-products-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default async function SellerEditProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;

  return (
    <SellerWorkspaceShell title="Edit product" description="Update catalogue, image, price, stock, tax, and variant details before resubmitting for approval.">
      <SellerProductsClient mode="form" productId={productId} />
    </SellerWorkspaceShell>
  );
}
