import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminReportExportsClient } from "@/components/admin/reports/admin-report-pages-client";

export default function AdminReportExportsPage() {
  return <AdminPortalShell title="Report export history" description="Download completed marketplace reports, monitor large exports, and retry failed or expired files."><AdminReportExportsClient /></AdminPortalShell>;
}
