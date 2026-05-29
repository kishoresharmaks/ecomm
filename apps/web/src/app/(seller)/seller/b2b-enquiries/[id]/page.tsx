import { SellerB2BEnquiryDetailClient } from "@/components/seller/seller-b2b-enquiries-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default async function SellerB2BEnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <SellerWorkspaceShell title="B2B enquiry detail" description="Review buyer request details, responses, and seller reply controls.">
      <SellerB2BEnquiryDetailClient enquiryId={id} />
    </SellerWorkspaceShell>
  );
}
