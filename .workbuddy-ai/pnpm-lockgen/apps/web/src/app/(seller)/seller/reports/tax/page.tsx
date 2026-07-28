import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";
import { SellerTaxReportClient } from "@/components/seller/seller-tax-report-client";

export default async function SellerTaxReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  return (
    <SellerWorkspaceShell
      title="Tax & Financial Reports"
      description="Country-aware tax records, marketplace deductions, settlement data, and filing exports."
    >
      <div className="mb-4">
        <Link href="/seller/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#ED3500]">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports Hub
        </Link>
      </div>
      <SellerTaxReportClient initialDateFrom={params.dateFrom ?? ""} initialDateTo={params.dateTo ?? ""} />
    </SellerWorkspaceShell>
  );
}
