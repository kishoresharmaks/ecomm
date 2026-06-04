import { CourierLocalDeliveryClient } from "@/components/courier/courier-workspace-client";
import { CourierShell } from "@/components/courier/courier-shell";

export default function CourierLocalDeliveryPage() {
  return (
    <CourierShell
      title="Local delivery assignment"
      description="Monitor local-delivery seller shipments, assign eligible delivery partners, and keep assignment events aligned with order delivery timelines."
    >
      <CourierLocalDeliveryClient />
    </CourierShell>
  );
}
