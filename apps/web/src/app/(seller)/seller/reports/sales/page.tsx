import { SellerSalesReportClient } from "@/components/seller/seller-sales-report-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerSalesReportPage() {
  return (
    <SellerWorkspaceShell title="Sales report" description="Review gross sales, commission, net revenue, recent order splits, B2B demand, and stock risk.">
      <SellerSalesReportClient />
    </SellerWorkspaceShell>
  );
}
