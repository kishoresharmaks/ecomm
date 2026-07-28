import { SellerPayoutsClient } from "@/components/seller/finance/seller-payouts-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerFinancePayoutsPage() {
  return (
    <SellerWorkspaceShell title="Payouts" description="Track pending, approved, rejected, and paid seller payout records.">
      <SellerPayoutsClient />
    </SellerWorkspaceShell>
  );
}

