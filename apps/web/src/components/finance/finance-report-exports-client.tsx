"use client";

import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { ReportExportCenter } from "@/components/reporting/report-export-center";
import { financeExportTypes } from "./payment-reports-client";

export function FinanceReportExportsClient() {
  const auth = useAdminAuth();
  return <ReportExportCenter auth={auth.authHeaders} audience="finance" reportTypes={financeExportTypes} />;
}
