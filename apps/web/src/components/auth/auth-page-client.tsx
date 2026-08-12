"use client";

import Image from "next/image";
import Link from "next/link";
import { SignIn, SignUp } from "@clerk/nextjs";
import {
  BadgeIndianRupee,
  Building2,
  FileCheck2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Store,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@indihub/ui";
import { StorefrontFrame } from "@/components/storefront/storefront-frame";
import { resolveAuthAudience, safeRedirectPath, type AuthAudience } from "./auth-page-routing";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

type AuthBenefit = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type AuthPresentation = {
  identity: string;
  eyebrow: string;
  headline: string;
  description: string;
  benefits: AuthBenefit[];
};

const authPresentations: Record<AuthAudience, AuthPresentation> = {
  customer: {
    identity: "1HandIndia",
    eyebrow: "Your marketplace account",
    headline: "Everything you need, from sellers you can trust.",
    description: "Shop confidently, save favourites, and follow every order from checkout to delivery.",
    benefits: [
      { icon: ShieldCheck, title: "Secure shopping", description: "Protected account and checkout experiences." },
      { icon: ShoppingBag, title: "One place for every order", description: "Cart, wishlist, support, and order history." },
      { icon: MapPin, title: "Delivery made clearer", description: "Saved addresses and simple order tracking." },
    ],
  },
  seller: {
    identity: "1HandIndia Seller Hub",
    eyebrow: "Seller partner access",
    headline: "Build your storefront. Run your business with confidence.",
    description: "Join the marketplace and manage products, orders, enquiries, and seller finance from one workspace.",
    benefits: [
      { icon: Store, title: "Your marketplace presence", description: "Create a professional store and catalogue." },
      { icon: PackageCheck, title: "Operational control", description: "Manage orders and fulfilment in one place." },
      { icon: BadgeIndianRupee, title: "Transparent seller finance", description: "Track settlements, payouts, and statements." },
    ],
  },
  b2b: {
    identity: "1HandIndia Business",
    eyebrow: "Business buyer access",
    headline: "A simpler way to source for your business.",
    description: "Connect with marketplace sellers, request quotations, and manage bulk buying conversations clearly.",
    benefits: [
      { icon: Building2, title: "Business-ready profile", description: "Keep company and procurement details together." },
      { icon: FileCheck2, title: "Structured enquiries", description: "Create, compare, and confirm seller quotations." },
      { icon: ShieldCheck, title: "Managed procurement", description: "Follow each enquiry through approval and completion." },
    ],
  },
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#ED3500",
    colorText: "#1F2933",
    colorTextSecondary: "#667085",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#1F2933",
    borderRadius: "0.875rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full gap-5 rounded-none bg-transparent p-0 shadow-none",
    header: "gap-2 text-left",
    headerTitle: "text-left text-2xl font-black tracking-tight text-[#1F2933]",
    headerSubtitle: "text-left text-sm leading-6 text-[#667085]",
    socialButtonsBlockButton:
      "h-12 rounded-xl border border-[#DDE3E8] bg-white font-bold text-[#344054] shadow-none transition hover:border-[#ED3500] hover:bg-[#FFF8F5]",
    socialButtonsBlockButtonText: "font-bold",
    dividerLine: "bg-[#E5E7EB]",
    dividerText: "text-xs font-bold uppercase tracking-[0.16em] text-[#98A2B3]",
    formFieldLabel: "text-sm font-bold text-[#344054]",
    formFieldInput:
      "h-12 rounded-xl border border-[#D8E2EA] bg-white text-[#1F2933] shadow-none outline-none transition focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10",
    formButtonPrimary:
      "h-12 rounded-xl bg-[#ED3500] text-sm font-black shadow-none transition hover:bg-[#C72D00] focus-visible:ring-4 focus-visible:ring-[#ED3500]/20",
    footerAction: "justify-center text-sm",
    footerActionText: "font-semibold text-[#667085]",
    footerActionLink: "font-black text-[#ED3500] hover:text-[#C72D00]",
    identityPreview: "rounded-xl border border-[#E5E7EB] bg-[#FFFCFB]",
    formFieldAction: "font-bold text-[#ED3500] hover:text-[#C72D00]",
    alert: "rounded-xl border border-[#FFC7B8] bg-[#FFF0EC] text-[#9F2600]",
  },
} as const;

export function AuthPageClient({
  mode,
  defaultRedirectUrl = "/account",
  audience = "customer",
}: {
  mode: "sign-in" | "sign-up";
  defaultRedirectUrl?: string;
  audience?: AuthAudience;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectUrl = safeRedirectPath(searchParams.get("redirect_url")) ?? defaultRedirectUrl;
  const resolvedAudience = resolveAuthAudience(audience, redirectUrl);
  const presentation = authPresentations[resolvedAudience];
  const routeIsSeller = pathname.startsWith("/seller");
  const routeIsB2B = pathname.startsWith("/b2b");
  const signInPath = routeIsSeller ? "/seller/sign-in" : routeIsB2B ? "/b2b/sign-in" : "/sign-in";
  const signUpPath = routeIsB2B ? "/b2b/sign-up" : "/sign-up";
  const switchPath = mode === "sign-in" ? signUpPath : signInPath;
  const switchHref = `${switchPath}?redirect_url=${encodeURIComponent(redirectUrl)}`;
  const clerkProps = {
    appearance: clerkAppearance,
    forceRedirectUrl: redirectUrl,
    fallbackRedirectUrl: redirectUrl,
  } as const;

  return (
    <StorefrontFrame>
      <section className="bg-[#FFFCFB] px-4 py-6 sm:px-6 sm:py-10 lg:py-14">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-[#F0E4DF] bg-white shadow-[0_24px_80px_rgba(80,37,20,0.10)] lg:min-h-[690px] lg:grid-cols-[1.08fr_0.92fr]">
          <AuthStory presentation={presentation} />

          <div className="flex items-center bg-white px-5 py-8 sm:px-10 sm:py-12 lg:px-12">
            <div className="mx-auto w-full max-w-[430px]">
              <div className="mb-7 flex items-center justify-between gap-4 border-b border-[#EEF0F2] pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ED3500]">{presentation.eyebrow}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">Protected account access</p>
                </div>
                <Image src="/brand/1handindia_logo.png" alt="1HandIndia" width={48} height={48} className="h-12 w-12 rounded-xl object-contain" />
              </div>

              {clerkEnabled ? (
                mode === "sign-in" ? (
                  <SignIn
                    {...clerkProps}
                    path={signInPath}
                    routing="path"
                    signUpUrl={switchHref}
                    signUpForceRedirectUrl={redirectUrl}
                    signUpFallbackRedirectUrl={redirectUrl}
                  />
                ) : (
                  <SignUp
                    {...clerkProps}
                    path={signUpPath}
                    routing="path"
                    signInUrl={switchHref}
                    signInForceRedirectUrl={redirectUrl}
                    signInFallbackRedirectUrl={redirectUrl}
                  />
                )
              ) : (
                <AuthUnavailable />
              )}

              <AuthLegalLinks audience={resolvedAudience} />
            </div>
          </div>
        </div>
      </section>
    </StorefrontFrame>
  );
}

function AuthStory({ presentation }: { presentation: AuthPresentation }) {
  return (
    <div className="relative isolate overflow-hidden bg-[#ED3500] px-6 py-9 text-white sm:px-10 sm:py-12 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14">
      <div className="absolute -right-20 bottom-[-12rem] z-[-1] hidden w-[520px] opacity-20 lg:block">
        <Image src="/brand/1handindia_hero_mark.png" alt="" width={669} height={744} className="h-auto w-full object-contain" aria-hidden="true" priority loading="eager" />
      </div>
      <div className="absolute -left-16 -top-16 z-[-1] h-44 w-44 rounded-full border-[32px] border-white/10" aria-hidden="true" />

      <div>
        <Link href="/" className="inline-flex items-center gap-3 rounded-full bg-white/12 px-4 py-2 text-sm font-black tracking-tight backdrop-blur-sm transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-black text-[#ED3500]">1</span>
          {presentation.identity}
        </Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-white/75">{presentation.eyebrow}</p>
        <h1 className="mt-3 max-w-xl text-3xl font-black leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-[3.25rem]">
          {presentation.headline}
        </h1>
        <p className="mt-5 max-w-lg text-sm font-semibold leading-6 text-white/82 sm:text-base sm:leading-7">{presentation.description}</p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-12 lg:grid-cols-1">
        {presentation.benefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <div key={benefit.title} className="flex gap-3 border-t border-white/20 pt-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#ED3500] shadow-sm">
                <Icon size={19} strokeWidth={2.3} />
              </span>
              <div>
                <p className="text-sm font-black">{benefit.title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/72">{benefit.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuthUnavailable() {
  return (
    <div className="rounded-2xl border border-[#FFC7B8] bg-[#FFF8F5] p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0EC] text-[#ED3500]">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">Account access is unavailable</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Account access is unavailable right now. Please try again shortly.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="mt-5 w-full justify-center rounded-xl">
        <Link href="/">Return to storefront</Link>
      </Button>
    </div>
  );
}

function AuthLegalLinks({ audience }: { audience: AuthAudience }) {
  return (
    <p className="mt-7 border-t border-[#EEF0F2] pt-5 text-center text-xs font-semibold leading-5 text-[#667085]">
      By continuing, you agree to 1HandIndia&apos;s{" "}
      <LegalLink href="https://1handindia.com/terms-and-conditions">Terms</LegalLink>,{" "}
      <LegalLink href="https://1handindia.com/privacy-policy">Privacy Policy</LegalLink>
      {audience === "seller" ? (
        <>
          {", and "}
          <LegalLink href="https://1handindia.com/seller-policy">Seller Policy</LegalLink>
        </>
      ) : null}
      .
    </p>
  );
}

function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className="font-bold text-[#344054] underline-offset-4 transition hover:text-[#ED3500] hover:underline">
      {children}
    </Link>
  );
}
