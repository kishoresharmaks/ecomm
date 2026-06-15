import { DeliveryReturnDetailClient } from "@/components/delivery/delivery-returns-client";
import { DeliveryShell } from "@/components/delivery/delivery-ui";

export default async function DeliveryReturnDetailPage({
  params,
}: {
  params: Promise<{ requestNumber: string }>;
}) {
  const { requestNumber } = await params;

  return (
    <DeliveryShell
      title="Return pickup detail"
      description="Follow the return pickup steps in order and record proof for customer pickup and seller receipt."
    >
      <DeliveryReturnDetailClient requestNumber={requestNumber} />
    </DeliveryShell>
  );
}
