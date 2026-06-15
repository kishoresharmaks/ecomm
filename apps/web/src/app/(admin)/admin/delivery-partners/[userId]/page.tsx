import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { CourierDeliveryPartnerDetailClient } from "@/components/courier/courier-workspace-client";

export default async function AdminDeliveryPartnerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <AdminPortalShell
      title="Delivery partner / rider profile"
      description="Review workload and COD exposure, then maintain service coverage, radius, priority, availability, and operational notes for this rider."
    >
      <CourierDeliveryPartnerDetailClient
        userId={userId}
        basePath="/admin/delivery-partners"
        assignmentBoardHref="/admin/delivery"
        profileHelpText="Admin can edit operational delivery profile data. User account credentials, role assignment, and finance verification stay in their dedicated admin surfaces."
        availabilityNoteSource="admin rider profile management"
      />
    </AdminPortalShell>
  );
}
