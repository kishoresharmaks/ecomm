import { Suspense } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminOrderTaxRegisterClient } from "@/components/admin/reports/order-tax-register-client";

export default function AdminOrderTaxRegisterPage() {
  return (
    <AdminPortalShell
      title="Order tax register"
      description="Investigate product and service tax lines, issued documents, payments, settlements, and GST reconciliation exceptions."
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-white" />}>
        <AdminOrderTaxRegisterClient />
      </Suspense>
    </AdminPortalShell>
  );
}
