import { SellerServicesClient } from "@/components/seller/seller-services-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

type SellerServiceBookingDetailPageProps = {
  params: Promise<{ bookingNumber: string }>;
};

export default async function SellerServiceBookingDetailPage({ params }: SellerServiceBookingDetailPageProps) {
  const { bookingNumber } = await params;

  return (
    <SellerWorkspaceShell
      title="Service booking detail"
      description="Manage customer context, schedule, technician assignment, quote, payment record, and completion actions from one operations view."
    >
      <SellerServicesClient mode="booking-detail" bookingNumber={bookingNumber} />
    </SellerWorkspaceShell>
  );
}
