"use client";

import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  HelpCircle,
  IndianRupee,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  UserRound,
  Wallet,
  Wrench,
  Smartphone,
  Check,
} from "lucide-react";

export function SellerStartWelcome({
  message = "Start selling products, services, or both through one trusted merchant platform.",
}: {
  message?: string;
}) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [appNotified, setAppNotified] = useState(false);

  const tracks = [
    {
      href: "/seller/choose-plan?mode=retail",
      title: "Retail Merchant",
      badge: "Products Only",
      tagline: "Physical catalogue goods",
      description: "Sell physical products to retail consumers and B2B buyers across India.",
      action: "Choose Retail",
      isRecommended: false,
      icon: (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF4F0] text-[#ED3500]">
          <Package className="h-6 w-6" />
        </div>
      ),
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
      description: "Offer repair, installation, maintenance, consultation and skilled services.",
      action: "Choose Services",
      isRecommended: false,
      icon: (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
          <Wrench className="h-6 w-6" />
        </div>
      ),
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
      badge: "Products + Services",
      tagline: "Unified merchant profile",
      description: "Combine ecommerce products and professional services under one verified business.",
      action: "Choose Retail + Services",
      isRecommended: true,
      icon: (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF4F0] text-[#ED3500]">
          <Store className="h-6 w-6" />
        </div>
      ),
      points: [
        "Single GSTIN & PAN verification",
        "Unified wallet & payout ledger",
        "Cross-sell services with product deliveries",
        "Dual B2C retail + B2B wholesale command",
      ],
    },
  ];

  const advantages = [
    {
      icon: <IndianRupee className="h-5 w-5 text-[#ED3500]" />,
      number: "01",
      title: "Transparent Economics",
      description: "Clear commissions and statutory deductions without hidden surprises.",
    },
    {
      icon: <Truck className="h-5 w-5 text-[#ED3500]" />,
      number: "02",
      title: "Pan-India Logistics",
      description: "Doorstep pickup, automated shipping labels and real-time tracking.",
    },
    {
      icon: <TrendingUp className="h-5 w-5 text-[#ED3500]" />,
      number: "03",
      title: "B2C + B2B Growth",
      description: "Reach retail customers and verified bulk buyers from one platform.",
    },
    {
      icon: <FileText className="h-5 w-5 text-[#ED3500]" />,
      number: "04",
      title: "Tax & Compliance Ready",
      description: "GST invoices, supply reports and compliance-ready operations.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Register",
      description: "Create your seller account.",
      icon: <UserRound className="h-5 w-5" />,
    },
    {
      number: "02",
      title: "Verify",
      description: "Complete GSTIN, PAN and bank verification.",
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      number: "03",
      title: "List",
      description: "Upload products or service offerings.",
      icon: <Boxes className="h-5 w-5" />,
    },
    {
      number: "04",
      title: "Sell",
      description: "Receive orders, ship and get paid.",
      icon: <Wallet className="h-5 w-5" />,
    },
  ];

  const faqs = [
    {
      question: "What documents do I need to begin selling on 1HandIndia?",
      answer:
        "To register as a seller, you need an active GSTIN (for physical goods), business PAN, a valid bank account in your business name for direct payouts, and a registered address for doorstep courier pickups.",
    },
    {
      question: "How and when do I receive my seller payouts?",
      answer:
        "Payouts are automatically settled into your registered bank account upon verified customer order delivery. You can track every transaction transparently in your Seller Hub Wallet & Settlement Ledger with zero hidden charges.",
    },
    {
      question: "Are Buyer Checkout Platform Fees deducted from my seller earnings?",
      answer:
        "No, absolutely not. The buyer checkout platform fee is paid directly by the customer to 1HandIndia for marketplace services. It is 100% customer-funded and never deducted from your sales subtotal or earnings.",
    },
    {
      question: "How does doorstep shipping and courier pickup work?",
      answer:
        "When an order is placed, you pack the items and generate the shipping label with one click from the Seller Hub. Our integrated courier partners arrive directly at your registered warehouse address for doorstep pickup.",
    },
    {
      question: "Can I sell both products and offer on-demand services?",
      answer:
        "Yes! You can choose the 'Retail + Services' combined profile. This allows you to list physical merchandise and offer installation, repair, or maintenance services under a single verified merchant business account.",
    },
  ];

  return (
    <div className="w-full bg-[#FAFAF8] text-[#101828] font-sans antialiased">
      {/* ── 1. PREMIUM HEADER ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-[#F2F4F7] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Logo + Seller Hub */}
          <Link href="/seller" className="group flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-[#F1E5E0] transition-transform group-hover:scale-105">
              <Image
                src="/brand/1handindia_logo.webp"
                alt="1HandIndia Logo"
                width={36}
                height={36}
                priority
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-[#101828] leading-tight">
                1HandIndia
              </span>
              <span className="text-[11px] font-bold tracking-wider text-[#ED3500] leading-none">
                Seller Hub
              </span>
            </div>
          </Link>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link
              href="/support"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#475467] transition-colors hover:text-[#101828] sm:text-sm"
            >
              <HelpCircle className="h-4 w-4 text-[#667085]" />
              <span>Help Desk</span>
            </Link>

            <span className="hidden text-[#D0D5DD] sm:inline">|</span>

            <span className="hidden text-xs text-[#475467] md:inline sm:text-sm">
              Already have an account?
            </span>

            <Link
              href="/seller/sign-in"
              className="inline-flex items-center justify-center rounded-full border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-bold text-[#344054] whitespace-nowrap transition-colors hover:border-[#98A2B3] hover:bg-[#F9FAFB] sm:px-4 sm:text-sm"
            >
              Sign In
            </Link>

            <Link
              href="/seller/choose-plan?mode=retail"
              className="inline-flex items-center justify-center rounded-full bg-[#ED3500] px-3.5 py-1.5 text-xs font-bold text-white whitespace-nowrap shadow-xs transition-colors hover:bg-[#D42F00] sm:px-4 sm:text-sm"
            >
              Start Selling
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. TWO-COLUMN HERO SECTION ─────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#F2F4F7] bg-gradient-to-b from-[#FFFDFC] via-[#FFF9F7] to-[#FAFAF8] pt-8 pb-14 sm:pt-16 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-8">
            {/* Left Column: Headlines & CTAs */}
            <div className="space-y-5 sm:space-y-6 lg:col-span-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FFDDD2] bg-[#FFF4F0] px-3.5 py-1.5 text-xs font-bold text-[#ED3500]">
                <ShieldCheck className="h-4 w-4 text-[#ED3500] shrink-0" />
                <span className="uppercase tracking-wide text-[10px] sm:text-[11px] font-black">
                  Verified Indian Merchant Marketplace
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl font-black tracking-tight text-[#101828] sm:text-5xl lg:text-[56px] leading-[1.15]">
                Empower your business. <br />
                Sell <span className="text-[#ED3500]">across India.</span>
              </h1>

              {/* Supporting text */}
              <p className="max-w-xl text-sm font-medium leading-relaxed text-[#475467] sm:text-lg">
                {message}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link
                  href="/seller/choose-plan?mode=retail"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#ED3500] px-7 text-sm font-black text-white shadow-md shadow-[#ED3500]/25 transition-all hover:bg-[#D42F00] hover:shadow-lg active:scale-[0.98]"
                >
                  <span>Start Selling</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/seller/sign-in"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-7 text-sm font-bold text-[#344054] shadow-xs transition-all hover:border-[#98A2B3] hover:bg-[#F9FAFB] active:scale-[0.98]"
                >
                  Sign In
                </Link>
              </div>

              {/* Compact Trust Row */}
              <div className="grid grid-cols-2 gap-3 pt-4 sm:pt-6 sm:grid-cols-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#344054]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                  <span>Digital KYC</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#344054]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                  <span>Direct Bank Payouts</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#344054]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                  <span>Doorstep Pickup</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Illustration Asset */}
            <div className="flex justify-center lg:col-span-6 lg:justify-end">
              <div className="relative aspect-[4/3] w-full max-w-[420px] overflow-hidden rounded-3xl transition-transform duration-300 hover:scale-[1.02] sm:max-w-[500px] lg:max-w-[560px]">
                <Image
                  src="/seller/assets/seller-hero-ecosystem.jpg"
                  alt="1HandIndia Seller Ecosystem Mockup"
                  fill
                  priority
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. SELLING TRACKS SECTION ──────────────────────────────────────── */}
      <section id="tracks" className="border-b border-[#F2F4F7] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-[#101828] sm:text-4xl">
              How do you want to sell?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-[#667085] sm:text-base">
              Choose the model that fits your business. You can expand your catalogue capabilities later.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
            {tracks.map((track) => (
              <div
                key={track.title}
                className={`relative flex h-full flex-col justify-between rounded-[24px] bg-white p-7 sm:p-8 transition-all duration-200 hover:-translate-y-1 ${track.isRecommended
                    ? "border-2 border-[#ED3500] shadow-xl shadow-[#ED3500]/10 ring-4 ring-[#ED3500]/5"
                    : "border border-[#E4E7EC] shadow-xs hover:border-[#CBD5E1] hover:shadow-md"
                  }`}
              >
                {/* Recommended Badge */}
                {track.isRecommended && (
                  <div className="absolute -top-3.5 right-6 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ED3500] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                      <Sparkles className="h-3 w-3" />
                      RECOMMENDED
                    </span>
                  </div>
                )}

                <div>
                  {/* Top: Icon & Category Badge */}
                  <div className="flex items-center justify-between gap-4">
                    {track.icon}
                    <span className="rounded-full border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-1 text-xs font-bold text-[#475467]">
                      {track.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="mt-6 text-2xl font-black tracking-tight text-[#101828]">
                    {track.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-[#667085]">
                    {track.description}
                  </p>

                  {/* Divider */}
                  <div className="my-6 border-t border-[#F2F4F7]" />

                  {/* Feature Checklist */}
                  <ul className="space-y-3.5 text-xs font-medium text-[#344054]">
                    {track.points.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom CTA Button */}
                <div className="mt-8 pt-4">
                  <Link
                    href={track.href as Route}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-all duration-150 active:scale-[0.98] ${track.isRecommended
                        ? "bg-[#ED3500] hover:bg-[#D42F00] text-white shadow-md shadow-[#ED3500]/25 !text-white"
                        : "border-2 border-[#ED3500] bg-white text-[#ED3500] hover:bg-[#ED3500] hover:text-white"
                      }`}
                    style={track.isRecommended ? { color: "#ffffff" } : undefined}
                  >
                    <span>{track.action}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. PLATFORM ADVANTAGES ─────────────────────────────────────────── */}
      <section id="benefits" className="border-b border-[#F2F4F7] bg-[#FAFAF8] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-[#101828] sm:text-4xl">
              Everything you need to grow your business
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-[#667085] sm:text-base">
              Built for Indian merchants. Focus on your products and services, we handle the operational complexity.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((adv) => (
              <div
                key={adv.number}
                className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-xs transition-all hover:border-[#CBD5E1] hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#FFF4F0]">
                    {adv.icon}
                  </div>
                  <span className="text-xs font-black text-[#98A2B3]">{adv.number}</span>
                </div>
                <h3 className="mt-5 text-base font-black text-[#101828]">{adv.title}</h3>
                <p className="mt-2 text-xs font-medium leading-relaxed text-[#667085]">
                  {adv.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. FOUR-STEP ROADMAP ───────────────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-[#F2F4F7] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-[#101828] sm:text-4xl">
              Start selling in four simple steps
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium text-[#667085] sm:text-base">
              Get your store live and start receiving orders from customers across India.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, idx) => (
              <div
                key={step.number}
                className="relative flex flex-col justify-between rounded-2xl border border-[#E4E7EC] bg-[#FAFAFA] p-6 transition-all hover:bg-white hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ED3500] text-xs font-black text-white">
                      {step.number}
                    </span>
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#FFF4F0] text-[#ED3500]">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-black text-[#101828]">{step.title}</h3>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-[#667085]">
                    {step.description}
                  </p>
                </div>
                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="h-5 w-5 text-[#CBD5E1]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. SELLER APP & FAQ SPLIT SECTION ──────────────────────────────── */}
      <section className="border-b border-[#F2F4F7] bg-[#FAFAF8] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Left Column: Mobile App Showcase */}
            <div className="space-y-6 lg:col-span-6">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-[#101828] sm:text-4xl">
                  Your business. In your pocket.
                </h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[#667085] sm:text-base">
                  Manage orders, inventory, alerts and payouts wherever you are with instant push notifications.
                </p>
              </div>

              {/* 4 Feature Pills */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-xs font-bold text-[#344054] shadow-2xs">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  <span>Real-time order alerts</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-xs font-bold text-[#344054] shadow-2xs">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  <span>Inventory management</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-xs font-bold text-[#344054] shadow-2xs">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  <span>Payout tracking</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-xs font-bold text-[#344054] shadow-2xs">
                  <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                  <span>Business analytics</span>
                </div>
              </div>

              {/* Phone Mockup Asset + Notification Card */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
                <div className="relative aspect-[235/334] w-[220px] shrink-0 overflow-hidden rounded-2xl drop-shadow-md">
                  <Image
                    src="/seller/assets/09-seller-mobile-app.png"
                    alt="1HandIndia Seller Mobile App"
                    fill
                    className="object-contain"
                  />
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#FFDDD2] bg-[#FFF8F5] p-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#ED3500]">
                      <Smartphone className="h-4 w-4" />
                      <span>Upcoming Android App</span>
                    </div>
                    <h4 className="mt-2 text-sm font-black text-[#101828]">
                      1HandIndia Seller App
                    </h4>
                    <p className="mt-1 text-xs text-[#667085]">
                      Android Companion App coming soon to Google Play.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAppNotified(true)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#ED3500] px-4 py-2 text-xs font-black text-white shadow-xs transition hover:bg-[#D42F00]"
                    >
                      {appNotified ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>We&apos;ll notify you!</span>
                        </>
                      ) : (
                        <span>Notify Me</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: FAQ Accordion */}
            <div id="faqs" className="space-y-6 lg:col-span-6">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-[#101828] sm:text-4xl">
                  Questions before you start?
                </h2>
                <p className="mt-2 text-sm font-medium text-[#667085]">
                  Find answers to common questions from verified Indian merchants.
                </p>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={faq.question}
                      className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white transition-all duration-200"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between p-5 text-left text-sm font-black text-[#101828] hover:text-[#ED3500]"
                      >
                        <span className="pr-4">{faq.question}</span>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-[#ED3500]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-[#667085]" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-[#F2F4F7] bg-[#FAFAFA] p-5 text-xs font-medium leading-relaxed text-[#475467]">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FINAL CONVERSION CTA BANNER ─────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-20 border-b border-[#F2F4F7]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 rounded-3xl border border-[#FFDDD2] bg-gradient-to-r from-[#FFF5F1] via-[#FFF9F7] to-[#FFF5F1] p-8 sm:p-12 shadow-sm lg:flex-row">
            {/* Left: Growth Icon & Copy */}
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="relative aspect-[296/334] h-20 w-20 shrink-0 overflow-hidden sm:h-24 sm:w-24">
                <Image
                  src="/seller/assets/10-growth-decorations.png"
                  alt="Merchant Growth"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="text-2xl font-black text-[#101828] sm:text-3xl">
                  Ready to grow your business across India?
                </h3>
                <p className="mt-2 max-w-xl text-sm font-medium text-[#667085]">
                  Create your store profile and start reaching verified retail and enterprise buyers.
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 shrink-0 w-full lg:w-auto">
              <Link
                href="/seller/choose-plan?mode=retail"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#ED3500] px-7 text-sm font-black text-white shadow-md shadow-[#ED3500]/25 transition-all hover:bg-[#D42F00] active:scale-[0.98]"
              >
                <span>Start Selling</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/seller/sign-in"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-7 text-sm font-bold text-[#344054] shadow-xs transition-all hover:border-[#98A2B3] hover:bg-[#F9FAFB] active:scale-[0.98]"
              >
                Sign In to Seller Hub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. PROFESSIONAL 5-COLUMN FOOTER ─────────────────────────────────── */}
      <footer className="bg-white py-12 sm:py-16 text-[#667085] text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {/* Col 1: Brand */}
            <div className="space-y-4 lg:col-span-2">
              <Link href="/seller" className="flex items-center gap-2.5">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-[#F1E5E0]">
                  <Image
                    src="/brand/1handindia_logo.webp"
                    alt="1HandIndia Logo"
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="text-base font-black text-[#101828]">1HandIndia</span>
                <span className="text-xs font-bold text-[#ED3500]">Seller Hub</span>
              </Link>
              <p className="max-w-sm text-xs leading-relaxed text-[#667085]">
                Empowering Indian merchants with a trusted, transparent marketplace for products,
                services, and B2B wholesale procurement.
              </p>
              <div className="flex items-center gap-4 text-[#98A2B3] pt-2">
                <span className="font-bold text-[#475467]">𝕏</span>
                <span className="font-bold text-[#475467]">Facebook</span>
                <span className="font-bold text-[#475467]">Instagram</span>
                <span className="font-bold text-[#475467]">LinkedIn</span>
              </div>
            </div>

            {/* Col 2: 1HandIndia */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#101828]">1HandIndia</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/seller" className="hover:text-[#ED3500] transition-colors">
                    Seller Hub
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-[#ED3500] transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-[#ED3500] transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Sell on 1HandIndia */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#101828]">Sell on 1HandIndia</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/seller/choose-plan?mode=retail" className="hover:text-[#ED3500] transition-colors">
                    Retail Merchant
                  </Link>
                </li>
                <li>
                  <Link href="/seller/choose-plan" className="hover:text-[#ED3500] transition-colors">
                    Service Professional
                  </Link>
                </li>
                <li>
                  <Link href="/seller/choose-plan" className="hover:text-[#ED3500] transition-colors">
                    Retail + Services
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Seller Resources & Legal */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#101828]">Seller Resources</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/support" className="hover:text-[#ED3500] transition-colors">
                    Help Desk
                  </Link>
                </li>
                <li>
                  <Link href="/seller-policy" className="hover:text-[#ED3500] transition-colors">
                    Seller Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-and-conditions" className="hover:text-[#ED3500] transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="hover:text-[#ED3500] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-[#EAECF0] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#98A2B3]">
            <p>© {new Date().getFullYear()} 1HandIndia Seller Hub. All rights reserved.</p>
            <p>Made with pride for Indian merchants.</p>
          </div>
        </div>
      </footer>
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
