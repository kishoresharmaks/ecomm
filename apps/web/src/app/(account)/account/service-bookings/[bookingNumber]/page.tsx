import { ServiceBookingDetailClient } from "@/components/account/service-bookings-client";

export default async function AccountServiceBookingDetailPage({
  params
}: {
  params: Promise<{ bookingNumber: string }>;
}) {
  const { bookingNumber } = await params;

  return <ServiceBookingDetailClient bookingNumber={bookingNumber} />;
}
