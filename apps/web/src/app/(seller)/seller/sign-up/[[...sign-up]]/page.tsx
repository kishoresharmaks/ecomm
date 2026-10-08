import { Suspense } from "react";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export default function SellerSignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFFCFB]" />}>
      <AuthPageClient mode="sign-up" defaultRedirectUrl="/seller/register" audience="seller" />
    </Suspense>
  );
}
