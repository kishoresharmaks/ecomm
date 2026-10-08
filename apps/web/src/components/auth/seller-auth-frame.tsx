"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRight, Headphones, Store } from "lucide-react";
import { Button } from "@indihub/ui";

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
              href="/contact"
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

      {/* ── Seller Hub Clean Footer ──────────────────────────────────────── */}
      <footer className="border-t border-[#E2E8F0] bg-white py-8 text-center text-xs text-[#64748B]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-6 font-bold text-[#475467]">
            <Link href="/seller" className="hover:text-[#ED3500]">Seller Home</Link>
            <Link href="/seller/choose-plan" className="hover:text-[#ED3500]">Selling Plans</Link>
            <Link href="https://1handindia.com/seller-policy" target="_blank" rel="noopener noreferrer" className="hover:text-[#ED3500]">Seller Policy</Link>
            <Link href="https://1handindia.com/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-[#ED3500]">Terms of Service</Link>
            <Link href="https://1handindia.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-[#ED3500]">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-[#ED3500]">Merchant Help Desk</Link>
          </div>
          <p className="mt-4 text-[#94A3B8]">
            &copy; {new Date().getFullYear()} BEES HUB FARMLAND PRIVATE LIMITED. 1HandIndia Seller Hub &mdash; Verified Indian Merchant Portal.
          </p>
        </div>
      </footer>
    </div>
  );
}
