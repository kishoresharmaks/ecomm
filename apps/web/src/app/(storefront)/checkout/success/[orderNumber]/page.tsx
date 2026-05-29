import { OrderSuccessClient } from "@/components/storefront/order-success-client";

export default async function OrderSuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;

  return <OrderSuccessClient orderNumber={orderNumber} />;
}
