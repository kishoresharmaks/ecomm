"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { cn } from "@indihub/ui";
import type { CategorySummary } from "@/lib/storefront-api";
import { StorefrontImage } from "./storefront-image";

type StorefrontCategoryCardProps = {
  category: CategorySummary;
  variant?: "compact" | "directory" | "feature";
  className?: string;
};

export function StorefrontCategoryCard({
  category,
  variant = "compact",
  className,
}: StorefrontCategoryCardProps) {
  const isDirectory = variant === "directory";
  const isFeature = variant === "feature";
  const productCount = category._count?.products ?? 0;
  const productLabel = `${productCount.toLocaleString("en-IN")} ${
    productCount === 1 ? "product" : "products"
  }`;
  const childCount = category.children?.length ?? category._count?.children ?? 0;
  const description = category.description?.trim();
  const summaryText =
    description ||
    (childCount > 0
      ? `${childCount.toLocaleString("en-IN")} ${
          childCount === 1 ? "subcategory" : "subcategories"
        }`
      : productCount > 0
        ? `${productLabel} currently live`
        : "No live products yet");
  const imageUrl = category.imageUrl?.trim() || null;

  if (isFeature) {
    return (
      <Link
        href={`/categories/${category.slug}` as Route}
        className={cn(
          "group relative isolate flex min-h-[340px] overflow-hidden rounded-[28px] border border-[#D8E2EA] bg-[#163B5C] p-5 text-white shadow-[0_24px_60px_rgba(22,59,92,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(22,59,92,0.22)]",
          className,
        )}
      >
        <span className="absolute inset-0 -z-20">
          <StorefrontImage
            src={imageUrl}
            alt={category.name}
            sizes="(max-width: 1024px) 100vw, 520px"
            className="transition duration-500 group-hover:scale-105"
            fallbackLabel={category.name}
            allowExternalRemote
          />
        </span>
        <span className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,33,54,0.08),rgba(9,33,54,0.9))]" />
        <span className="flex h-full w-full flex-col justify-between">
          <span className="inline-flex w-fit rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#163B5C] shadow-sm">
            {productLabel}
          </span>
          <span className="block">
            <span className="block text-[11px] font-black uppercase tracking-[0.22em] text-[#FFD5C9]">
              Featured department
            </span>
            <span className="mt-2 block break-words text-3xl font-black leading-tight tracking-normal md:text-4xl">
              {category.name}
            </span>
            <span className="mt-3 block max-w-md text-sm font-semibold leading-6 text-white/86">
              {summaryText}
            </span>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#ED3500] transition group-hover:bg-[#FFF0EC]">
              Explore category <ArrowRight size={16} />
            </span>
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className={cn(
        "group grid overflow-hidden border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-[0_20px_44px_rgba(22,59,92,0.1)]",
        isDirectory
          ? "rounded-[22px] border-[#E8EDF2]"
          : "rounded-[24px] border-[#EEF2F6]",
        className,
      )}
    >
      <span className="relative block aspect-[5/3] overflow-hidden bg-[#EAF1F7]">
        <StorefrontImage
          src={imageUrl}
          alt={category.name}
          sizes={isDirectory ? "(max-width: 768px) 50vw, 360px" : "(max-width: 768px) 50vw, 260px"}
          className="transition duration-500 group-hover:scale-105"
          fallbackLabel={category.name}
          allowExternalRemote
        />
        <span className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,rgba(9,33,54,0),rgba(9,33,54,0.58))]" />
        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-3 py-1 text-[11px] font-black text-[#163B5C] shadow-sm">
          {productLabel}
        </span>
      </span>
      <span className={cn("grid gap-2 p-4", isDirectory ? "min-h-36" : "min-h-32")}>
        <span className="block break-words text-base font-black leading-5 text-[#1F2933] group-hover:text-[#163B5C]">
          {category.name}
        </span>
        <span className="block text-xs font-semibold leading-5 text-[#667085]">
          {summaryText}
        </span>
        <span className="mt-auto inline-flex items-center gap-2 text-sm font-black text-[#163B5C] transition group-hover:text-[#ED3500]">
          {productCount > 0 ? "Browse products" : "View category"} <ArrowRight size={15} />
        </span>
      </span>
    </Link>
  );
}
