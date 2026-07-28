import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminOperationalReportClient } from "@/components/admin/reports/admin-report-pages-client";

export default function AdminProductReportPage() {
  return <AdminPortalShell title="Product and inventory report" description="Review product variants, HSN, tax treatment, price, stock, sales and return performance."><AdminOperationalReportClient report="products" /></AdminPortalShell>;
}
