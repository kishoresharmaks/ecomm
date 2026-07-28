import { CourierShell } from "@/components/courier/courier-shell";
import { CourierDeliveryPartnerDetailClient } from "@/components/courier/courier-workspace-client";

export default async function CourierDeliveryPartnerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <CourierShell
      title="Delivery partner profile"
      description="Review workload and COD exposure, then maintain service coverage, radius, priority, availability, and operational notes for this delivery partner."
    >
      <CourierDeliveryPartnerDetailClient userId={userId} />
    </CourierShell>
  );
}
