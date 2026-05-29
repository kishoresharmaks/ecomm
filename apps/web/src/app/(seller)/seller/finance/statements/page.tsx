import { SellerStatementsClient } from "@/components/seller/finance/seller-statements-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerFinanceStatementsPage() {
  return (
    <SellerWorkspaceShell title="Statements" description="Download seller payout statements and invoices in CSV or PDF format.">
      <SellerStatementsClient />
    </SellerWorkspaceShell>
  );
}

