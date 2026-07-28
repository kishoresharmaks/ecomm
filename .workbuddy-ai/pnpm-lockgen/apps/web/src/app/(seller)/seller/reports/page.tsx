import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { SellerReportsHubClient } from "@/components/seller/seller-reports-hub-client";

export default function ReportsHubPage() {
  return (
    <SellerWorkspaceShell title="Reports Hub" description="View high-level summaries and detailed reports across sales, inventory, finance, tax, and returns.">
      <SellerReportsHubClient />
    </SellerWorkspaceShell>
  );
}
