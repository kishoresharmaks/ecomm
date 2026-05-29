"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Building2, Mail, MapPin, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listCmsMenus, type CmsMenuItem } from "@/lib/storefront-api";

const fallbackFooterLinks = [
  { label: "Categories", href: "/categories" },
  { label: "Stores", href: "/stores" },
  { label: "Track order", href: "/track-order" },
  { label: "Contact", href: "/contact" },
  { label: "Seller Center", href: "/seller" },
  { label: "B2B enquiries", href: "/b2b" }
];

const fallbackLegalLinks = [
  { label: "Privacy policy", href: "/policies/privacy-policy" },
  { label: "Terms of service", href: "/policies/terms-of-service" },
  { label: "Refund policy", href: "/policies/refund-policy" },
  { label: "Shipping policy", href: "/policies/shipping-policy" }
];

export function StorefrontFooter() {
  const footerMenuQuery = useQuery({
    queryKey: ["cms-menus", "footer"],
    queryFn: () => listCmsMenus("footer"),
    retry: false
  });
  const legalMenuQuery = useQuery({
    queryKey: ["cms-menus", "legal"],
    queryFn: () => listCmsMenus("legal"),
    retry: false
  });

  const footerLinks = flattenMenuItems(footerMenuQuery.data).length
    ? flattenMenuItems(footerMenuQuery.data)
    : fallbackFooterLinks;
  const legalLinks = flattenMenuItems(legalMenuQuery.data).length
    ? flattenMenuItems(legalMenuQuery.data)
    : fallbackLegalLinks;

  return (
    <footer className="bg-[#FAF7F0] px-5 pb-6 pt-4 lg:px-6 lg:pb-8 lg:pt-6">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-[#D8E2EA] bg-[#163B5C] text-white shadow-[0_28px_80px_rgba(22,59,92,0.16)]">
        <div className="grid gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:px-8 lg:py-12">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#FFB296]">
              Seller to shopper
            </p>
            <h2 className="mt-3 text-3xl font-black">1HandIndia</h2>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/78">
              A serious marketplace shell for trusted sellers, local store discovery, everyday shopping,
              and B2B buying paths.
            </p>

            <div className="mt-6 grid gap-3 text-sm font-semibold text-white/80">
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB296]" aria-hidden="true" />
                <span>Browse products platform-wide, then move nearby approved stores to the front with local discovery.</span>
              </p>
              <p className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-[#FFB296]" aria-hidden="true" />
                <span>support@1handindia.example</span>
              </p>
              <p className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-[#FFB296]" aria-hidden="true" />
                <span>Marketplace support via approved seller and customer flows</span>
              </p>
            </div>
          </div>

          <FooterLinkGroup
            title="Marketplace"
            icon={<Building2 className="h-4 w-4 text-[#FFB296]" aria-hidden="true" />}
            links={footerLinks}
          />

          <FooterLinkGroup
            title="Policies"
            icon={<ArrowUpRight className="h-4 w-4 text-[#FFB296]" aria-hidden="true" />}
            links={legalLinks}
          />
        </div>

        <div className="border-t border-white/10">
          <div className="flex flex-col gap-3 px-6 py-4 text-sm font-semibold text-white/70 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <p>(c) {new Date().getFullYear()} 1HandIndia. Public storefront experience.</p>
            <p>Approved sellers, local discovery, and transactional buying flows.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({
  title,
  icon,
  links
}: {
  title: string;
  icon: ReactNode;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white/80">{title}</h3>
      </div>
      <div className="mt-4 grid gap-2">
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
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-white/78 transition hover:text-white"
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className="text-sm font-semibold text-white/78 transition hover:text-white">
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
    ...flattenMenuItems(item.children)
  ]);
}

function isExternalHref(href: string) {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}
