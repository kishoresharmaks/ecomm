import { Suspense } from "react";
import { AuthPageClient } from "@/components/auth/auth-page-client";

export default function B2BSignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFFCFB]" />}>
      <AuthPageClient mode="sign-up" defaultRedirectUrl="/b2b/register" audience="b2b" />
    </Suspense>
  );
}
