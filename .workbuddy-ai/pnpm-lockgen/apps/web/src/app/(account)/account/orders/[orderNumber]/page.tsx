import { OrderDetailClient } from "@/components/account/order-detail-client";

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  return <OrderDetailClient orderNumber={orderNumber} />;
}
