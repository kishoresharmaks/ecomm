import { SellerWalletClient } from "@/components/seller/finance/seller-wallet-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerWalletPage() {
  return (
    <SellerWorkspaceShell title="Wallet and ledger" description="Review seller earnings, deductions, payout debits, and audited adjustments.">
      <SellerWalletClient />
    </SellerWorkspaceShell>
  );
}

