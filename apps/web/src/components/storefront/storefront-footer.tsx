"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail, MapPin, Send, ShieldCheck, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listCmsMenus, type CmsMenuItem } from "@/lib/storefront-api";

const brandLogoSrc = "/brand/1handindia_logo.png";
const staticStorefrontDataStaleMs = 5 * 60 * 1000;

const fallbackMarketplaceLinks = [
  { label: "All Categories", href: "/categories" },
  { label: "Stores Near You", href: "/stores" },
  { label: "Live Deals", href: "/deals" },
  { label: "Track Order", href: "/track-order" },
];

const fallbackSupportLinks = [
  { label: "Help Center", href: "/contact" },
  { label: "Become a Seller", href: "/seller/register" },
  { label: "B2B Buying", href: "/b2b/register" },
];

const fallbackPolicyLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-and-conditions" },
  { label: "Return Policy", href: "/refund-return-policy" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Seller Policy", href: "/seller-policy" },
  { label: "Account Deletion", href: "/account-deletion" },
];

export function StorefrontFooter({
  initialFooterMenu,
  initialLegalMenu,
}: {
  initialFooterMenu?: CmsMenuItem[] | undefined;
  initialLegalMenu?: CmsMenuItem[] | undefined;
}) {
  const footerMenuQuery = useQuery({
    queryKey: ["cms-menus", "footer"],
    queryFn: () => listCmsMenus("footer"),
    initialData: initialFooterMenu,
    staleTime: staticStorefrontDataStaleMs,
    retry: false,
  });
  const legalMenuQuery = useQuery({
    queryKey: ["cms-menus", "legal"],
    queryFn: () => listCmsMenus("legal"),
    initialData: initialLegalMenu,
    staleTime: staticStorefrontDataStaleMs,
    retry: false,
  });

  const footerLinks = flattenMenuItems(footerMenuQuery.data);
  const legalLinks = flattenMenuItems(legalMenuQuery.data);

  return (
    <footer className="border-t border-[#F1D7CF] bg-[#FFFCFB] px-4 pb-8 pt-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1360px]">
        <div className="grid gap-8 py-8 lg:grid-cols-[1.2fr_0.85fr_0.85fr_0.85fr_1.1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2" aria-label="1HandIndia home">
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white shadow-[0_10px_22px_rgba(237,53,0,0.14)]">
                <img src={brandLogoSrc} alt="1HandIndia logo" title="1HandIndia logo" className="h-full w-full object-cover" loading="lazy" />
              </span>
              <span className="text-2xl font-black tracking-normal text-[#111827]">
                Hand<span className="text-[#ED3500]">India</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-[#667085]">
              A modern marketplace for local shopping, verified sellers, best prices, and secure customer flows.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <SocialButton label="Facebook" text="f" />
              <SocialButton label="Instagram" text="ig" />
              <SocialButton label="X" text="x" />
              <SocialButton label="YouTube" text="yt" />
            </div>
          </div>

          <FooterGroup title="Marketplace" links={footerLinks.length ? footerLinks : fallbackMarketplaceLinks} />
          <FooterGroup title="Help & Support" links={fallbackSupportLinks} />
          <FooterGroup title="Policies" links={legalLinks.length ? legalLinks : fallbackPolicyLinks} />

          <div>
            <h3 className="text-sm font-black text-[#111827]">Newsletter</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
              Get the best deals and marketplace updates.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="grid gap-3 border-t border-[#F1D7CF] pt-5 text-xs font-semibold text-[#667085] md:grid-cols-[1fr_auto] md:items-center">
          <p>(c) {new Date().getFullYear()} 1HandIndia. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
              Verified sellers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Store className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
              Local stores
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
              Location-aware browsing
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <h3 className="text-sm font-black text-[#111827]">{title}</h3>
      <div className="mt-3 grid gap-2">
        {links.map((item) => (
          <FooterLink key={`${item.href}-${item.label}`} href={item.href} label={item.label} />
        ))}
      </div>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#667085] transition hover:text-[#ED3500]">
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className="text-sm font-semibold text-[#667085] transition hover:text-[#ED3500]">
      {label}
    </Link>
  );
}

function SocialButton({ label, text }: { label: string; text: string }) {
  return (
    <span
      className="grid h-9 w-9 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[11px] font-black uppercase text-[#667085]"
      title={label}
    >
      {text}
    </span>
  );
}

function flattenMenuItems(items?: CmsMenuItem[]): Array<{ label: string; href: string }> {
  if (!items?.length) {
    return [];
  }

  return items.flatMap((item) => [
    { label: item.label, href: item.href },
    ...flattenMenuItems(item.children),
  ]);
}

function isExternalHref(href: string) {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

const NEWSLETTER_COOLDOWN_MS = 10_000;

function NewsletterForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const lastSubmitRef = useRef(0);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    // Honeypot check — bots fill hidden fields
    if (formData.get("website")) return;

    // Cooldown check — prevent rapid resubmission
    if (Date.now() - lastSubmitRef.current < NEWSLETTER_COOLDOWN_MS) {
      setStatus("error");
      setMessage("Please wait before subscribing again.");
      return;
    }

    const email = (formData.get("email") as string)?.trim();
    if (!email) return;

    setStatus("submitting");
    lastSubmitRef.current = Date.now();

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus("success");
        setMessage("Subscribed! Check your inbox.");
        form.reset();
      } else {
        setStatus("error");
        setMessage("Could not subscribe. Try again later.");
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please retry.");
    }
  }, []);

  return (
    <>
      <form
        className="mt-4 flex h-11 overflow-hidden rounded-full border border-[#FFE0D6] bg-white"
        onSubmit={handleSubmit}
      >
        <label htmlFor="footer-email" className="sr-only">
          Email address
        </label>
        {/* Honeypot — hidden from real users, visible to bots */}
        <input
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", opacity: 0 }}
        />
        <span className="grid w-11 place-items-center text-[#ED3500]">
          <Mail className="h-4 w-4" aria-hidden="true" />
        </span>
        <input
          id="footer-email"
          name="email"
          type="email"
          required
          placeholder="Enter your email"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3]"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="grid w-11 place-items-center bg-[#ED3500] text-white disabled:opacity-60"
          aria-label="Subscribe"
        >
          {status === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : status === "success" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
      {message ? (
        <p className={`mt-2 text-xs font-semibold ${status === "success" ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {message}
        </p>
      ) : null}
    </>
  );
}
