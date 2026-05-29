import { Suspense } from "react";
import { B2BEnquiryFormClient } from "@/components/b2b/b2b-enquiry-form-client";

export default function NewB2BEnquiryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFFCFB]" />}>
      <B2BEnquiryFormClient />
    </Suspense>
  );
}
