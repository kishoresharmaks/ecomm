import { CourierDashboardClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default function CourierDashboardPage() {
  return (
    <CourierShell
      title="Courier dashboard"
      description="Control package booking, courier labels, routing failures, local delivery assignment, provider setup, and courier COD handoff."
    >
      <CourierDashboardClient />
    </CourierShell>
  );
}
