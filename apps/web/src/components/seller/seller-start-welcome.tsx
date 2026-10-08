"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { useState } from "react";
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@indihub/ui";

export function SellerStartWelcome({
  message = "Create one verified seller profile, then choose whether you want to sell products, offer services, or run both from the same seller center.",
}: {
  message?: string;
}) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const tracks = [
    {
      href: "/seller/choose-plan?mode=retail",
      title: "Retail Merchant",
      badge: "Products Only",
      tagline: "Physical catalogue goods",
      description:
        "Sell products to retail consumers and B2B wholesale buyers with automated courier pickup, inventory alerts, and verified payouts.",
      action: "Start as Retail Seller",
      icon: <Boxes className="h-6 w-6" aria-hidden="true" />,
      themeColor: "#ED3500",
      themeBg: "#FFF4F0",
      points: [
        "Nationwide doorstep courier pickups",
        "Automated shipping labels & tracking",
        "B2B wholesale quotation desk",
        "Transparent 1% TDS / 1% TCS statutory payouts",
      ],
    },
    {
      href: "/seller/choose-plan",
      title: "Service Professional",
      badge: "Services Only",
      tagline: "On-demand & skilled services",
      description:
        "List repair, installation, maintenance, inspection, consultation, and local or remote skilled professional services.",
      action: "Start as Service Provider",
      icon: <Wrench className="h-6 w-6" aria-hidden="true" />,
      themeColor: "#2563EB",
      themeBg: "#EFF6FF",
      points: [
        "Online booking & scheduling calendar",
        "Direct customer inquiries & custom quotes",
        "Verified customer ratings & feedback",
        "Guaranteed digital milestone payouts",
      ],
    },
    {
      href: "/seller/choose-plan",
      title: "Retail + Services",
      badge: "Recommended for Enterprises",
      tagline: "Unified merchant profile",
      description:
        "One verified business profile to sell physical goods and provide installation, support, or maintenance services together.",
      action: "Start Combined Profile",
      icon: <Sparkles className="h-6 w-6" aria-hidden="true" />,
      themeColor: "#7C3AED",
      themeBg: "#F5F3FF",
      points: [
        "Single GSTIN & PAN verification",
        "Unified wallet & payout ledger",
        "Cross-sell services with product deliveries",
        "Dual B2C retail + B2B wholesale command",
      ],
    },
  ];

  const benefits = [
    {
      icon: <Wallet className="h-6 w-6 text-[#027A48]" aria-hidden="true" />,
      title: "Transparent Economics & Zero Surprises",
      description:
        "Net sales are calculated strictly with mandatory statutory compliance (1% TDS u/s 194-O + 1% TCS under GST) and agreed commission. Buyer checkout platform fees are 100% customer-funded and never deducted from your payouts.",
    },
    {
      icon: <Truck className="h-6 w-6 text-[#2563EB]" aria-hidden="true" />,
      title: "Pan-India Doorstep Logistics",
      description:
        "Ship orders smoothly across India with automated shipping labels, doorstep pickups via verified courier networks, and real-time end-to-end tracking for your customers.",
    },
    {
      icon: <Building2 className="h-6 w-6 text-[#7C3AED]" aria-hidden="true" />,
      title: "Dual Channels: B2C Retail + B2B Bulk",
      description:
        "Don't limit your business to single-item retail carts. Receive high-ticket bulk procurement RFQs and purchase orders from verified Indian enterprises.",
    },
    {
      icon: <FileText className="h-6 w-6 text-[#ED3500]" aria-hidden="true" />,
      title: "Tax & Compliance Ready",
      description:
        "Generate compliant GST tax invoices, download outward supply registers for GSTR-1 filing, track e-way bill thresholds, and export comprehensive sales reports in one click.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Quick Registration",
      description: "Sign in with your phone or email, choose your selling track, and create your store.",
    },
    {
      number: "02",
      title: "KYC & Bank Setup",
      description: "Enter your GSTIN, PAN, business bank payout details, and registered pickup warehouse.",
    },
    {
      number: "03",
      title: "Catalogue Setup",
      description: "Upload your products with high-res photos and pricing, or list your service offerings.",
    },
    {
      number: "04",
      title: "Dispatch & Earn",
      description: "Fulfill orders with doorstep courier pickup and receive automated direct bank settlements.",
    },
  ];

  const faqs = [
    {
      question: "What documents do I need to begin selling on 1HandIndia?",
      answer:
        "To register as a seller, you need an active GSTIN (for physical goods), business PAN, a valid bank account in your business name for payouts, and an address for courier pickups.",
    },
    {
      question: "How and when do I receive my seller payouts?",
      answer:
        "Payouts are automatically settled into your registered bank account upon verified customer order delivery. You can track every transaction transparently in your Seller Hub Wallet & Settlement Ledger.",
    },
    {
      question: "Are Buyer Checkout Platform Fees deducted from my seller earnings?",
      answer:
        "No, absolutely not. The buyer checkout platform fee (e.g. ₹15) is paid directly by the customer to 1HandIndia for marketplace services. It is never deducted from your sales subtotal or payout.",
    },
    {
      question: "How does doorstep shipping and courier pickup work?",
      answer:
        "When an order is placed, you pack the items and generate the shipping label from the Seller Hub. Our integrated courier partners will arrive at your registered warehouse address for doorstep pickup.",
    },
    {
      question: "Can I sell both products and offer on-demand services?",
      answer:
        "Yes! You can choose the 'Retail + Services' combined profile. This allows you to list physical merchandise and offer installation or maintenance services under a single verified account.",
    },
  ];

  return (
    <div className="w-full bg-[#FFFCFB] text-[#0F172A]">
      {/* ── Top Seller Portal Navigation Bar ───────────────────────────────── */}
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

          {/* Anchor Navigation Links (Desktop) */}
          <nav className="hidden items-center gap-8 text-sm font-bold text-[#64748B] md:flex">
            <a href="#tracks" className="transition hover:text-[#ED3500]">
              Seller Tracks
            </a>
            <a href="#benefits" className="transition hover:text-[#ED3500]">
              Why 1HandIndia
            </a>
            <a href="#how-it-works" className="transition hover:text-[#ED3500]">
              How It Works
            </a>
            <a href="#faqs" className="transition hover:text-[#ED3500]">
              FAQs
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            <Button asChild variant="outline" size="sm" className="border-[#CBD5E1] font-bold text-[#334155] hover:bg-[#F8FAFC]">
              <Link href="/seller/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="bg-[#ED3500] font-bold text-white shadow-sm hover:bg-[#D42F00]">
              <Link href="/seller/choose-plan?mode=retail">
                Start Selling
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#F1E5E0] bg-gradient-to-b from-[#FFFDFD] via-[#FFF9F7] to-[#FFF4F0] pt-14 pb-20 sm:pt-20 sm:pb-28">
        <div className="absolute -top-40 -right-40 h-[450px] w-[450px] rounded-full bg-[#ED3500]/6 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 h-[450px] w-[450px] rounded-full bg-[#ED3500]/6 blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ED3500]/20 bg-[#FFF0EC] px-4 py-1.5 text-xs font-bold text-[#ED3500] shadow-xs">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Verified Indian Merchant Marketplace
          </div>

          <h1 className="mt-6 text-4xl font-black tracking-tight text-[#0F172A] sm:text-6xl lg:text-7xl">
            Empower Your Business. <br className="hidden sm:inline" />
            Sell to Millions on <span className="text-[#ED3500]">1HandIndia</span>.
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-[#475467] sm:text-lg sm:leading-8">
            {message}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Button asChild size="lg" className="h-12 bg-[#ED3500] px-7 font-black text-white shadow-md hover:bg-[#D42F00]">
              <Link href="/seller/choose-plan?mode=retail">
                Create Seller Account
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-[#CBD5E1] bg-white px-7 font-bold text-[#0F172A] shadow-xs hover:bg-[#F8FAFC]">
              <Link href="/seller/sign-in">Sign In to Seller Hub</Link>
            </Button>
          </div>

          {/* Trust Reassurance Badges */}
          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs sm:text-sm font-bold text-[#334155]">
            {[
              "Digital KYC & Verification",
              "Direct Bank Payouts",
              "Doorstep Courier Pickup",
              "Zero Buyer-Fee Deduction",
            ].map((badge) => (
              <span
                key={badge}
                className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#027A48]" aria-hidden="true" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 Selling Tracks Section (#tracks) ───────────────────────────────── */}
      <section id="tracks" className="border-b border-[#F1E5E0] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-wider text-[#ED3500]">
              Commercial Models
            </span>
            <h2 className="mt-2 text-3xl font-black text-[#0F172A] sm:text-4xl">
              Choose Your Selling Track
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-[#64748B] sm:text-base">
              Select the setup that best suits your enterprise. You can expand your catalogue capabilities anytime.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {tracks.map((track) => (
              <div
                key={track.title}
                className="group relative flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[#ED3500] hover:shadow-xl"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="grid h-14 w-14 place-items-center rounded-2xl shadow-xs transition group-hover:scale-105"
                      style={{ backgroundColor: track.themeBg, color: track.themeColor }}
                    >
                      {track.icon}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-black ${
                        track.title === "Retail + Services"
                          ? "border-[#FFD5CC] bg-[#FFF4F0] text-[#ED3500]"
                          : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"
                      }`}
                    >
                      {track.badge}
                    </span>
                  </div>

                  <h3 className="mt-6 text-2xl font-black text-[#0F172A]">
                    {track.title}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-[#64748B]">
                    {track.tagline}
                  </p>

                  <p className="mt-4 text-sm leading-relaxed text-[#475467]">
                    {track.description}
                  </p>

                  <div className="mt-6 space-y-2.5 border-t border-[#F1F5F9] pt-6">
                    {track.points.map((pt) => (
                      <div key={pt} className="flex items-center gap-2.5 text-xs font-semibold text-[#334155]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#027A48]" aria-hidden="true" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 border-t border-[#F1F5F9] pt-6">
                  <Button
                    asChild
                    size="lg"
                    className="w-full h-12 rounded-xl bg-[#ED3500] font-black text-white shadow-sm transition-all duration-200 hover:bg-[#D42F00] hover:shadow-md active:scale-[0.99] [&_svg]:text-white"
                  >
                    <Link href={track.href as Route} className="flex items-center justify-center gap-2">
                      <span className="text-white font-black">{track.action}</span>
                      <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Benefits / Why Sell with Us (#benefits) ───────────────── */}
      <section id="benefits" className="border-b border-[#F1E5E0] bg-[#FFFCFB] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-wider text-[#ED3500]">
              Platform Advantage
            </span>
            <h2 className="mt-2 text-3xl font-black text-[#0F172A] sm:text-4xl">
              Built for Transparent, Profitable Merchant Growth
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-[#64748B] sm:text-base">
              Everything you need to run your ecommerce operations efficiently without arbitrary deductions or friction.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  {b.icon}
                </div>
                <h3 className="mt-5 text-base font-black text-[#0F172A]">{b.title}</h3>
                <p className="mt-2 text-xs font-medium leading-relaxed text-[#64748B]">
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4-Step Onboarding Roadmap (#how-it-works) ───────────────────────── */}
      <section id="how-it-works" className="border-b border-[#F1E5E0] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-wider text-[#ED3500]">
              Simple Roadmap
            </span>
            <h2 className="mt-2 text-3xl font-black text-[#0F172A] sm:text-4xl">
              How to Start Selling in 4 Steps
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-[#64748B] sm:text-base">
              Launch your official store profile and receive customer orders in under 24 hours.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] p-6"
              >
                <span className="text-3xl font-black text-[#ED3500]">
                  {step.number}
                </span>
                <h3 className="mt-3 text-lg font-black text-[#0F172A]">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile Companion App Preview ────────────────────────────────────── */}
      <section className="border-b border-[#F1E5E0] bg-[#FFF4F0] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 rounded-3xl border border-[#ED3500]/15 bg-white p-8 shadow-sm md:flex-row md:p-12">
            <div className="max-w-lg">
              <span className="rounded-full bg-[#FFF0EC] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#ED3500]">
                Android Companion App
              </span>
              <h3 className="mt-4 text-2xl font-black text-[#0F172A] sm:text-3xl">
                Manage Operations Anywhere
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
                The upcoming 1HandIndia Seller app provides instant push notifications for new orders, stock warning alerts, and real-time payout updates directly on your smartphone.
              </p>
              <p className="mt-4 text-xs font-bold text-[#0F172A]">
                • Full Seller Hub portal is 100% active on desktop and mobile web browsers.
              </p>
            </div>

            <div className="grid h-36 w-36 shrink-0 place-items-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-center p-4">
              <Package className="h-10 w-10 text-[#ED3500]" aria-hidden="true" />
              <span className="mt-1 text-[11px] font-black text-[#0F172A]">
                Verified App
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Merchant FAQs Accordion (#faqs) ─────────────────────────────────── */}
      <section id="faqs" className="border-b border-[#F1E5E0] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-wider text-[#ED3500]">
              Seller Support
            </span>
            <h2 className="mt-2 text-3xl font-black text-[#0F172A] sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-2 text-sm text-[#64748B]">
              Common questions from new and prospective Indian merchants.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.question}
                  className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-[#0F172A] hover:text-[#ED3500]"
                  >
                    <span>{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden="true" />
                    )}
                  </button>
                  {isOpen ? (
                    <div className="border-t border-[#E2E8F0] bg-white p-5 text-xs leading-relaxed text-[#475467]">
                      {faq.answer}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final Conversion CTA Banner ─────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Ready to expand your business across India?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium text-[#94A3B8] sm:text-base">
            Create your store profile in minutes and start receiving orders from verified retail and enterprise buyers.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Button asChild size="lg" className="h-12 bg-[#ED3500] px-8 font-black text-white hover:bg-[#D42F00]">
              <Link href="/seller/choose-plan?mode=retail">
                Start Selling Now
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-white/20 bg-white/10 px-8 font-bold text-white hover:bg-white/20">
              <Link href="/seller/sign-in">Sign In to Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function SellerOnboardingRequired({
  message = "Create a seller profile for this account before using seller center tools.",
}: {
  message?: string;
}) {
  return <SellerStartWelcome message={message} />;
}
