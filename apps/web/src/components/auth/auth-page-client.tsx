"use client";

import Link from "next/link";
import { SignIn, SignUp } from "@clerk/nextjs";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, StatusBadge } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function AuthPageClient({
  mode,
  defaultRedirectUrl = "/account",
  audience = "customer"
}: {
  mode: "sign-in" | "sign-up";
  defaultRedirectUrl?: string;
  audience?: "customer" | "seller" | "b2b";
}) {
  const isSignIn = mode === "sign-in";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectUrl = safeRedirectPath(searchParams.get("redirect_url")) ?? defaultRedirectUrl;
  const isSellerOnboarding = audience === "seller" || redirectUrl === "/seller/register";
  const isB2B = audience === "b2b" || redirectUrl.startsWith("/b2b");
  const routeIsSeller = pathname.startsWith("/seller");
  const routeIsB2B = pathname.startsWith("/b2b");
  const signInPath = routeIsSeller ? "/seller/sign-in" : routeIsB2B ? "/b2b/sign-in" : "/sign-in";
  const signUpPath = routeIsB2B ? "/b2b/sign-up" : "/sign-up";
  const switchPath = isSignIn ? signUpPath : signInPath;
  const switchHref = `${switchPath}?redirect_url=${encodeURIComponent(redirectUrl)}`;
  const title = isSellerOnboarding
    ? isSignIn
      ? "Sign in to start selling"
      : "Create an account to start selling"
    : isB2B
      ? isSignIn
        ? "Sign in to manage B2B buying"
        : "Create your B2B buyer account"
      : isSignIn
        ? "Access your 1HandIndia account"
        : "Create your 1HandIndia account";
  const description = isSellerOnboarding
    ? "After authentication, you will return to seller onboarding to submit your store details."
    : isB2B
      ? "After authentication, you will return to the business buyer portal to manage company details and bulk enquiries."
      : isSignIn
        ? "Continue to saved addresses, wishlist, cart, checkout, orders, and support."
        : "Start a customer account for shopping, delivery tracking, wishlists, and account support.";
  const badge = isSellerOnboarding ? "Seller onboarding" : isB2B ? "B2B buyer access" : isSignIn ? "Customer sign in" : "Customer registration";
  const moduleTitle = isB2B ? "B2B buyer module" : "Customer module";
  const moduleItems = isB2B
    ? ["Company profile", "Procurement addresses", "Bulk product enquiries", "Seller/admin quotation responses"]
    : ["Profile and addresses", "Wishlist and cart", "Checkout and order history", "Order tracking and support"];

  return (
    <StorefrontFrame>
      <section className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-6">
          <div>
            <StatusBadge tone="info">{badge}</StatusBadge>
            <h1 className="mt-4 text-4xl font-black text-[#163B5C] md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">{description}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={switchHref}>
              {isSignIn ? <UserPlus size={16} /> : <LogIn size={16} />}
              {isSignIn ? "Create account" : "Sign in"}
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-6">
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          {clerkEnabled ? (
            <div className="flex min-h-[520px] items-center justify-center">
              {isSignIn ? (
                <SignIn
                  path={signInPath}
                  routing="path"
                  signUpUrl={switchHref}
                  forceRedirectUrl={redirectUrl}
                  fallbackRedirectUrl={redirectUrl}
                  signUpForceRedirectUrl={redirectUrl}
                  signUpFallbackRedirectUrl={redirectUrl}
                />
              ) : (
                <SignUp
                  path={signUpPath}
                  routing="path"
                  signInUrl={switchHref}
                  forceRedirectUrl={redirectUrl}
                  fallbackRedirectUrl={redirectUrl}
                  signInForceRedirectUrl={redirectUrl}
                  signInFallbackRedirectUrl={redirectUrl}
                />
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[#1F2933]">Account access is unavailable</h2>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    Authentication is not configured for this environment. Add the Clerk publishable key to enable sign in and account creation.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href="/">Back to storefront</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="h-fit rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#1F2933]">{moduleTitle}</h2>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085]">
            {moduleItems.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md bg-[#F8FAFC] px-3 py-3">
                <ShieldCheck size={16} className="text-[#0F8A5F]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </StorefrontFrame>
  );
}

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}
