import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminOperationalReportClient } from "@/components/admin/reports/admin-report-pages-client";

export default function AdminEnquiriesReportPage() {
  return <AdminPortalShell title="Enquiries and support report" description="Review B2B procurement enquiries and support cases with requester, seller, product and response context."><AdminOperationalReportClient report="enquiries" /></AdminPortalShell>;
}
