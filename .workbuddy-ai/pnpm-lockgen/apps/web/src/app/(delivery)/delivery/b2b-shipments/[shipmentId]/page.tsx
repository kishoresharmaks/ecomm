import { DeliveryB2BShipmentDetailClient } from "@/components/delivery/delivery-b2b-shipments-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default async function DeliveryB2BShipmentPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  return (
    <DeliveryShell title="B2B delivery task" description="Update transport progress and submit authenticated proof of delivery.">
      <DeliveryB2BShipmentDetailClient shipmentId={shipmentId} />
    </DeliveryShell>
  );
}
