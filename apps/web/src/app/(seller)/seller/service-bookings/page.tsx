import { SellerServicesClient } from "@/components/seller/seller-services-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerServiceBookingsPage() {
  return (
    <SellerWorkspaceShell
      title="Service bookings"
      description="Accept requests, schedule jobs, send quotes, record pay-at-visit payments, and submit completion proof."
    >
      <SellerServicesClient mode="bookings" />
    </SellerWorkspaceShell>
  );
}
