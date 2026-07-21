import { DeliveryB2BShipmentsClient } from "@/components/delivery/delivery-b2b-shipments-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default function DeliveryB2BShipmentsPage() {
  return (
    <DeliveryShell title="B2B shipments" description="Handle assigned business deliveries, transport events, receiver confirmation, and private POD evidence.">
      <DeliveryB2BShipmentsClient />
    </DeliveryShell>
  );
}
