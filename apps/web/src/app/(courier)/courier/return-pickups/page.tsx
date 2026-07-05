import { CourierReturnPickupsClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default function CourierReturnPickupsPage() {
  return (
    <CourierShell
      title="Return pickup monitor"
      description="Monitor return and replacement pickups, partner assignment state, pickup proof references, reverse transit, and seller/store receipt proof references."
    >
      <CourierReturnPickupsClient />
    </CourierShell>
  );
}
