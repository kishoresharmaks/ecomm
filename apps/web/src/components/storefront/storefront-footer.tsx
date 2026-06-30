"use client";

import Link from "next/link";
import { Mail, MapPin, Send, ShieldCheck, Store } from "lucide-react";
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
            <form
              className="mt-4 flex h-11 overflow-hidden rounded-full border border-[#FFE0D6] bg-white"
              onSubmit={(event) => event.preventDefault()}
            >
              <label htmlFor="footer-email" className="sr-only">
                Email address
              </label>
              <span className="grid w-11 place-items-center text-[#ED3500]">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </span>
              <input
                id="footer-email"
                type="email"
                placeholder="Enter your email"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-[#98A2B3]"
              />
              <button type="submit" className="grid w-11 place-items-center bg-[#ED3500] text-white" aria-label="Subscribe">
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
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
