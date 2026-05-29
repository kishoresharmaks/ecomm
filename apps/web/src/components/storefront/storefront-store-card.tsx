"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import { StatusBadge, cn } from "@indihub/ui";
import type { StoreProfile } from "@/lib/storefront-api";
import { locationMatchLabel, sellerLocationLabel } from "./storefront-location-utils";
import { StorefrontImage } from "./storefront-image";

type StorefrontStoreCardProps = {
  store: StoreProfile;
  variant?: "directory" | "compact";
  emphasize?: boolean;
  className?: string;
};

export function StorefrontStoreCard({
  store,
  variant = "directory",
  emphasize = false,
  className,
}: StorefrontStoreCardProps) {
  const isCompact = variant === "compact";
  const logoSize = isCompact ? 56 : 64;

  return (
    <Link
      href={`/stores/${store.slug}` as Route}
      className={cn(
        "group min-w-0 overflow-hidden border bg-[#FCFDFE] shadow-sm transition hover:-translate-y-0.5 hover:border-[#ED3500]",
        isCompact
          ? "rounded-lg hover:shadow-[0_24px_50px_rgba(22,59,92,0.08)] sm:rounded-[28px]"
          : "rounded-lg hover:shadow-[0_28px_55px_rgba(22,59,92,0.08)] sm:rounded-[30px]",
        emphasize ? "border-[#F3D0C3]" : "border-[#E5E7EB]",
        className,
      )}
    >
      <div className={cn("relative bg-[#163B5C]", isCompact ? "h-28 sm:h-36" : "h-32 sm:h-40")}>
        <StorefrontImage
          src={store.profile?.bannerUrl ?? null}
          alt={`${store.storeName} banner`}
          sizes={isCompact ? "(max-width: 768px) 50vw, 320px" : "(max-width: 768px) 50vw, 420px"}
          fallbackLabel={store.storeName}
        />
        <div className={cn("absolute inset-0", isCompact ? "bg-[#102F49]/56" : "bg-[#102F49]/60")} />
        <span className="absolute left-2.5 top-2.5 sm:left-4 sm:top-4">
          <StatusBadge className="border-white/20 bg-white/12 px-2 py-0.5 text-[10px] text-white sm:px-2.5 sm:text-xs">
            {locationMatchLabel(store.locationMatchLevel)}
          </StatusBadge>
        </span>
        <span
          className={cn(
            "absolute bottom-4 left-4 grid place-items-center overflow-hidden rounded-2xl border border-white/30 bg-white/15 font-black text-white",
            isCompact ? "h-11 w-11 text-sm sm:h-14 sm:w-14 sm:text-lg" : "h-12 w-12 text-base sm:h-16 sm:w-16 sm:text-xl",
          )}
        >
          <StorefrontImage
            src={store.profile?.logoUrl ?? null}
            alt={`${store.storeName} logo`}
            sizes={`${logoSize}px`}
            fallbackLabel={store.storeName.slice(0, 2).toUpperCase()}
          />
        </span>
      </div>

      <div className={isCompact ? "space-y-2.5 p-3 sm:space-y-3 sm:p-4" : "p-3 sm:p-5"}>
        <div className={cn(!isCompact && "flex items-start justify-between gap-3")}>
          <div className="min-w-0">
            <h2 className={cn("font-black text-[#1F2933] group-hover:text-[#163B5C]", isCompact ? "line-clamp-1 text-sm sm:text-lg" : "truncate text-sm sm:text-xl")}>
              {store.storeName}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-5 text-[#667085] sm:mt-2 sm:text-sm sm:leading-6">
              {store.profile?.description ?? "Approved 1HandIndia seller with a public storefront."}
            </p>
          </div>
          {!isCompact ? <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[#ED3500]" aria-hidden="true" /> : null}
        </div>

        {isCompact ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#667085] sm:gap-2 sm:text-xs">
            <span className="rounded-full bg-[#EAF1F7] px-2 py-1 text-[#163B5C] sm:px-3">
              {store._count?.products ?? 0} live products
            </span>
            <span className="rounded-full bg-[#E9F7F1] px-2 py-1 text-[#0F8A5F] sm:px-3">Verified</span>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge tone="success" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Approved
            </StatusBadge>
            <StatusBadge tone="info">{store._count?.products ?? 0} products</StatusBadge>
          </div>
        )}

        <p className={cn("flex items-center gap-1.5 text-xs font-semibold text-[#667085] sm:gap-2 sm:text-sm", isCompact ? "" : "mt-4")}>
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#163B5C] sm:h-4 sm:w-4" aria-hidden="true" />
          <span className="truncate">{sellerLocationLabel(store.addresses[0])}</span>
        </p>
      </div>
    </Link>
  );
}
