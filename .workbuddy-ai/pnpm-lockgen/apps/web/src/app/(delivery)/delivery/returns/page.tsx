import { DeliveryReturnsClient } from "@/components/delivery/delivery-returns-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default function DeliveryReturnsPage() {
  return (
    <DeliveryShell
      title="Return pickups"
      description="Accept assigned return pickups, collect products from customers, and hand packages back to seller stores."
    >
      <DeliveryReturnsClient />
    </DeliveryShell>
  );
}
