import { DeliveryOrdersClient } from "@/components/delivery/delivery-orders-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default function DeliveryOrdersPage() {
  return (
    <DeliveryShell title="Assigned orders" description="Search delivery tasks assigned by admin and open each order for status updates.">
      <DeliveryOrdersClient />
    </DeliveryShell>
  );
}
