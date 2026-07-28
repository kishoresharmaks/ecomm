import { SellerServicesClient } from "@/components/seller/seller-services-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerServiceCalendarPage() {
  return (
    <SellerWorkspaceShell
      title="Service calendar"
      description="A focused schedule of accepted service jobs, visits, and upcoming provider work."
    >
      <SellerServicesClient mode="calendar" />
    </SellerWorkspaceShell>
  );
}
