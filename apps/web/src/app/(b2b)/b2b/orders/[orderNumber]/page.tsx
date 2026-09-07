import { B2BOrderDetailClient } from "@/components/b2b/b2b-orders-client";
import { BuyerB2BV2OperationsPanel } from "@/components/b2b/b2b-v2-operations-panel";
import { isB2BV2Enabled } from "@/lib/b2b-feature-flags";

export default async function B2BOrderDetailPage({
  params
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return (
    <div className="grid gap-5">
      <B2BOrderDetailClient orderNumber={orderNumber} />
      {isB2BV2Enabled() ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <BuyerB2BV2OperationsPanel orderNumber={orderNumber} />
        </div>
      ) : null}
    </div>
  );
}
