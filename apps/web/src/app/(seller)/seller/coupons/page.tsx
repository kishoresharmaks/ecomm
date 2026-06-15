import { SellerCouponsClient } from "@/components/seller/seller-coupons-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerCouponsPage() {
  return (
    <SellerWorkspaceShell
      title="Coupons"
      description="Review seller-funded coupon requests and track accepted coupon deductions."
    >
      <SellerCouponsClient />
    </SellerWorkspaceShell>
  );
}
