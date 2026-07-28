import { DeliveryDashboardClient } from "@/components/delivery/delivery-dashboard-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default function DeliveryDashboardPage() {
  return (
    <DeliveryShell title="Delivery dashboard" description="Review assigned delivery work, COD visibility, and orders that need progress updates.">
      <DeliveryDashboardClient />
    </DeliveryShell>
  );
}
