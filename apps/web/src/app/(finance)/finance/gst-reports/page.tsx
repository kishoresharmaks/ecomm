import { AdminGstReportsClient } from "@/components/admin/finance/gst-reports-client";
import { FinanceShell } from "@/components/finance/finance-shell";

export default function FinanceGstReportsPage() {
  return (
    <FinanceShell
      title="GST reports"
      description="Review GST documents and record manual e-invoice results."
    >
      <AdminGstReportsClient />
    </FinanceShell>
  );
}
