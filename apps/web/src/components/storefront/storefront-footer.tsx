"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Loader2, Mail, MapPin, Send, ShieldCheck, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listCmsMenus, type CmsMenuItem } from "@/lib/storefront-api";
import { subscribeToNewsletter } from "@/lib/newsletter-api";

const brandLogoSrc = "/brand/1handindia_logo.webp";
const staticStorefrontDataStaleMs = 5 * 60 * 1000;

const socialIcons: Record<string, ReactNode> = {
  Facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  X: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  YouTube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
};

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

const socialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/1handindia" },
  { label: "Instagram", href: "https://www.instagram.com/1handindia/" },
  { label: "X", href: "https://x.com/1handindia" },
  { label: "YouTube", href: "https://www.youtube.com/channel/UCK1w6LlYqW666P5E_ZrPeoA" },
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
              <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white shadow-[0_10px_22px_rgba(237,53,0,0.14)]">
                <Image
                  src={brandLogoSrc}
                  alt="1HandIndia logo"
                  title="1HandIndia logo"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </span>
              <span className="text-2xl font-black tracking-normal text-[#111827]">
                Hand<span className="text-[#ED3500]">India</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-[#667085]">
              A modern marketplace for local shopping, verified sellers, best prices, and secure customer flows.
            </p>
            <div className="mt-4 max-w-xs text-xs font-semibold leading-5 text-[#475467]">
              <p className="font-bold text-[#111827]">BEES HUB FARMLAND PRIVATE LIMITED</p>
              <p className="mt-0.5 text-[#667085]">2/26-1, Muhilanvilai, Monikettipottal</p>
              <p className="text-[#667085]">Kanyakumari District, Tamil Nadu - 629501</p>
            </div>
            <div className="mt-5 flex items-center gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#FFE0D6] bg-white text-[#667085] transition hover:border-[#ED3500] hover:text-[#ED3500] hover:shadow-[0_6px_16px_rgba(237,53,0,0.12)]"
                  title={link.label}
                  aria-label={`Follow us on ${link.label}`}
                >
                  {socialIcons[link.label]}
                </a>
              ))}
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
      await subscribeToNewsletter(email);

      setStatus("success");
      setMessage("Subscribed! Check your inbox.");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not subscribe. Try again later.");
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
          className="absolute -left-[9999px] opacity-0"
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
        <p role="status" className={`mt-2 text-xs font-semibold ${status === "success" ? "text-[#059669]" : "text-[#DC2626]"}`}>
          {message}
        </p>
      ) : null}
    </>
  );
}
