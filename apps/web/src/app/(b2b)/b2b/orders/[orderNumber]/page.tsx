import { B2BOrderDetailClient } from "@/components/b2b/b2b-orders-client";

export default async function B2BOrderDetailPage({
  params
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return <B2BOrderDetailClient orderNumber={orderNumber} />;
}
