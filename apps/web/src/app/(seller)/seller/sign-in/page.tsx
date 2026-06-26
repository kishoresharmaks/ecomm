import { Suspense } from "react";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export default function SellerSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFFCFB]" />}>
      <AuthPageClient mode="sign-in" defaultRedirectUrl="/seller/register" audience="seller" />
    </Suspense>
  );
}
