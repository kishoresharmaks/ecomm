import { CourierShell } from "@/components/courier/courier-shell";
import { CourierDeliveryPartnersClient } from "@/components/courier/courier-workspace-client";

export default function CourierDeliveryPartnersPage() {
  return (
    <CourierShell
      title="Delivery partner management"
      description="Manage local delivery partner availability, service coverage, COD exposure readiness, and operational profile data without full admin user access."
    >
      <CourierDeliveryPartnersClient />
    </CourierShell>
  );
}
