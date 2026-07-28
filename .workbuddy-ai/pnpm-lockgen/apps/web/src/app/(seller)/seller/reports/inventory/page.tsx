import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { SellerInventoryReportClient } from "@/components/seller/seller-inventory-report-client";

export default async function SellerInventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  return (
    <SellerWorkspaceShell title="Inventory & Stock Report" description="Product counts, low-stock alerts, and top selling items.">
      <div className="mb-4">
        <Link href="/seller/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#123A5A]">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports Hub
        </Link>
      </div>
      <SellerInventoryReportClient initialDateFrom={params.dateFrom ?? ""} initialDateTo={params.dateTo ?? ""} />
    </SellerWorkspaceShell>
  );
}
