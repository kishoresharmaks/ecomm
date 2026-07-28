import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminOperationalReportClient } from "@/components/admin/reports/admin-report-pages-client";

export default function AdminSalesReportPage() {
  return <AdminPortalShell title="Sales and order report" description="Investigate every product order line with payment, invoice, HSN, GST, seller and settlement context."><AdminOperationalReportClient report="sales" /></AdminPortalShell>;
}
