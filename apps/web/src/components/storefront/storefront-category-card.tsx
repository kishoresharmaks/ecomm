"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, PackageSearch } from "lucide-react";
import { cn } from "@indihub/ui";
import type { CategorySummary } from "@/lib/storefront-api";
import { StorefrontImage } from "./storefront-image";

type StorefrontCategoryCardProps = {
  category: CategorySummary;
  variant?: "compact" | "directory";
  className?: string;
};

export function StorefrontCategoryCard({
  category,
  variant = "compact",
  className,
}: StorefrontCategoryCardProps) {
  const isDirectory = variant === "directory";

  return (
    <Link
      href={`/categories/${category.slug}` as Route}
      className={cn(
        "group border bg-[#FCFDFE] p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500] sm:p-5 sm:text-left",
        isDirectory
          ? "rounded-lg border-[#E8EDF2] sm:rounded-[24px]"
          : "rounded-lg border-[#EEF2F6] hover:shadow-[0_20px_40px_rgba(22,59,92,0.08)] sm:rounded-[24px]",
        className,
      )}
    >
      <span className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-[#EAF1F7] text-[#163B5C] sm:h-12 sm:w-12 sm:rounded-2xl sm:bg-[#FFF0EC] sm:text-[#ED3500]">
          {category.imageUrl ? (
            <StorefrontImage
              src={category.imageUrl}
              alt={category.name}
              sizes="(max-width: 640px) 56px, 48px"
              className="object-cover"
            />
          ) : (
            <PackageSearch size={20} />
          )}
        </span>
        <span className="text-[10px] font-black leading-4 text-[#667085] sm:rounded-full sm:bg-[#F4F7FB] sm:px-3 sm:py-1 sm:text-xs sm:text-[#163B5C]">
          {category._count?.products ?? 0} products
        </span>
      </span>
      <span className={cn("block text-xs font-black leading-4 text-[#1F2933] group-hover:text-[#163B5C] sm:text-base sm:leading-5", isDirectory ? "mt-3 sm:mt-4" : "mt-3 sm:mt-8")}>
        {category.name}
      </span>
      {!isDirectory ? (
        <span className="mt-2 hidden items-center gap-2 text-sm font-black text-[#163B5C] transition group-hover:text-[#ED3500] sm:inline-flex">
          Browse category <ArrowRight size={15} />
        </span>
      ) : null}
    </Link>
  );
}
