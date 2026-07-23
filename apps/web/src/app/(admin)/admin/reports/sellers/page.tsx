import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminOperationalReportClient } from "@/components/admin/reports/admin-report-pages-client";

export default function AdminSellerReportPage() {
  return <AdminPortalShell title="Seller performance report" description="Review seller identity, approval, GST registration, marketplace sales, deductions and payout position."><AdminOperationalReportClient report="sellers" /></AdminPortalShell>;
}
