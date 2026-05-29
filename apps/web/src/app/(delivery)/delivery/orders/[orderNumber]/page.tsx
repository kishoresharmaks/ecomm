import { DeliveryOrderDetailClient } from "@/components/delivery/delivery-order-detail-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default async function DeliveryOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  return (
    <DeliveryShell title={`Delivery ${orderNumber}`} description="Update delivery progress without changing payment state or admin-only controls.">
      <DeliveryOrderDetailClient orderNumber={orderNumber} />
    </DeliveryShell>
  );
}
