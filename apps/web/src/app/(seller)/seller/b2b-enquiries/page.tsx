import { SellerB2BEnquiriesClient } from "@/components/seller/seller-b2b-enquiries-client";
import { SellerWorkspaceShell } from "@/components/seller/seller-ui";

export default function SellerB2BEnquiriesPage() {
  return (
    <SellerWorkspaceShell title="B2B enquiries" description="Review bulk buyer requests, quote manually, and keep enquiry status visible.">
      <SellerB2BEnquiriesClient />
    </SellerWorkspaceShell>
  );
}
