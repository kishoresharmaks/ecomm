import { CourierRoutingFailuresClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default function CourierRoutingFailuresPage() {
  return (
    <CourierShell
      title="Routing failures"
      description="Retry or manually override failed seller-shipment routing with courier, local delivery, store pickup, or manual transport decisions."
    >
      <CourierRoutingFailuresClient />
    </CourierShell>
  );
}
