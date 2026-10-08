"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRight, Headphones, Store } from "lucide-react";
import { Button } from "@indihub/ui";

import { StorefrontFooter } from "@/components/storefront/storefront-footer";

export function SellerAuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#1F2933]">
      {/* ── Seller Hub Top Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/seller" className="flex items-center gap-3 group">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-[0_8px_20px_rgba(237,53,0,0.14)] ring-1 ring-[#F1E5E0] transition-transform group-hover:scale-105">
              <Image
                src="/brand/1handindia_logo.webp"
                alt="1HandIndia Logo"
                width={40}
                height={40}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <div>
              <span className="block text-base font-black leading-tight text-[#0F172A]">
                1HandIndia
              </span>
              <span className="block text-xs font-bold text-[#ED3500]">
                Seller Hub
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-xs font-bold text-[#64748B] transition hover:text-[#ED3500] sm:inline-flex"
            >
              <Store className="h-3.5 w-3.5" aria-hidden="true" />
              Visit Storefront
            </Link>
            <Link
              href="/contact?topic=seller"
              className="hidden items-center gap-1.5 text-xs font-bold text-[#64748B] transition hover:text-[#ED3500] sm:inline-flex"
            >
              <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
              Seller Help Desk
            </Link>
            <Button asChild size="sm" className="bg-[#ED3500] font-bold text-white shadow-sm hover:bg-[#D42F00]">
              <Link href="/seller/choose-plan?mode=retail">
                Explore Plans
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Auth Content ────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>

      {/* ── Website Footer ──────────────────────────────────────────────── */}
      <StorefrontFooter />
    </div>
  );
}
