import { SellerServicesClient } from "@/components/seller/seller-services-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

type SellerEditServicePageProps = {
  params: Promise<{ serviceId: string }>;
};

export default async function SellerEditServicePage({ params }: SellerEditServicePageProps) {
  const { serviceId } = await params;

  return (
    <SellerWorkspaceShell
      title="Edit service"
      description="Update service details, pricing, image, visit modes, and serviceable areas. Changes go back to admin approval before going live."
    >
      <SellerServicesClient mode="edit" serviceId={serviceId} />
    </SellerWorkspaceShell>
  );
}
