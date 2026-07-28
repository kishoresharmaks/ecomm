import { CourierPackagesClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default function CourierPackagesPage() {
  return (
    <CourierShell
      title="Package operations"
      description="Review seller package records, delivery modes, AWB, label state, tracking state, COD flag, and booking readiness."
    >
      <CourierPackagesClient />
    </CourierShell>
  );
}
