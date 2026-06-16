import {
  AdminB2BEnquiryDetailPageClient,
} from "@/components/admin/admin-operations";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";

export default async function AdminB2BEnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AdminPortalShell
      title="B2B enquiry detail"
      description="Review buyer request details, responses, quoted prices, and linked proforma workflow."
    >
      <AdminB2BEnquiryDetailPageClient enquiryId={id} />
    </AdminPortalShell>
  );
}
