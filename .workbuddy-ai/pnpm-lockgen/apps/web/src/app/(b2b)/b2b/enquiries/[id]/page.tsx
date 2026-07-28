import { B2BEnquiryDetailClient } from "@/components/b2b/b2b-enquiry-detail-client";

export default async function B2BEnquiryDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <B2BEnquiryDetailClient enquiryId={id} />;
}
