import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SellerSalesReportClient } from "@/components/seller/seller-sales-report-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerSalesReportPage() {
  return (
    <SellerWorkspaceShell title="Sales report" description="Review gross sales, commission, net revenue, recent order splits, B2B demand, and stock risk.">
      <div className="mb-4">
        <Link href="/seller/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#123A5A]">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports Hub
        </Link>
      </div>
      <SellerSalesReportClient />
    </SellerWorkspaceShell>
  );
}
