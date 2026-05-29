import { DeliveryProfileClient } from "@/components/delivery/delivery-profile-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default function DeliveryProfilePage() {
  return (
    <DeliveryShell
      title="Delivery profile"
      description="Manage contact, vehicle, availability, and service area details for delivery operations."
    >
      <DeliveryProfileClient />
    </DeliveryShell>
  );
}
