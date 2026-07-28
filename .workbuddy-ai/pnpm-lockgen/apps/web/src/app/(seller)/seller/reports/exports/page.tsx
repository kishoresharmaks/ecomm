import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SellerReportExportsClient } from "@/components/seller/seller-report-exports-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerReportExportsPage() {
  return (
    <SellerWorkspaceShell title="Report export history" description="Download completed seller reports and retry failed or expired files.">
      <Link href="/seller/reports" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#ED3500]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Reports Hub
      </Link>
      <SellerReportExportsClient />
    </SellerWorkspaceShell>
  );
}
