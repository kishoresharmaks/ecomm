import { FinanceShell } from "@/components/finance/finance-shell";
import { FinanceReportExportsClient } from "@/components/finance/finance-report-exports-client";

export default function FinanceReportExportsPage() {
  return <FinanceShell title="Finance report exports" description="Monitor generated finance files, download completed reports, and retry failed or expired exports."><FinanceReportExportsClient /></FinanceShell>;
}
