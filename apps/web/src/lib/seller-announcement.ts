import type { CSSProperties } from "react";
import type { CmsAnnouncement } from "./storefront-api";

export type SellerAnnouncementTheme = {
  containerClasses: string;
  iconClasses: string;
  titleColor: string;
  bodyColor: string;
  linkColor: string;
  customStyle: CSSProperties;
};

export function isSellerAnnouncementDismissed(
  announcement: Pick<CmsAnnouncement, "id" | "isDismissible" | "updatedAt" | "createdAt">,
  dismissedMap: Record<string, string>,
): boolean {
  if (announcement.isDismissible === false) {
    return false;
  }
  const version = announcement.updatedAt || announcement.createdAt || "v1";
  return dismissedMap[announcement.id] === version;
}

export function buildSellerAnnouncementDismissalUpdate(
  announcement: Pick<CmsAnnouncement, "id" | "updatedAt" | "createdAt">,
  currentDismissedMap: Record<string, string>,
): Record<string, string> {
  const version = announcement.updatedAt || announcement.createdAt || "v1";
  return {
    ...currentDismissedMap,
    [announcement.id]: version,
  };
}

export function resolveSellerAnnouncementTheme(
  tone?: string,
  customBg?: string | null,
  customFg?: string | null,
): SellerAnnouncementTheme {
  if (tone === "WARNING") {
    return {
      containerClasses: "border-[#FDE68A] bg-gradient-to-r from-[#FFFBEB] via-[#FEF3C7]/40 to-[#FFFBEB]",
      iconClasses: "bg-[#FEF3C7] text-[#D97706]",
      titleColor: "text-[#92400E]",
      bodyColor: "text-[#B45309]",
      linkColor: "text-[#D97706]",
      customStyle: {},
    };
  }
  if (tone === "SUCCESS") {
    return {
      containerClasses: "border-[#A7F3D0] bg-gradient-to-r from-[#ECFDF5] via-[#D1FAE5]/40 to-[#ECFDF5]",
      iconClasses: "bg-[#D1FAE5] text-[#059669]",
      titleColor: "text-[#065F46]",
      bodyColor: "text-[#047857]",
      linkColor: "text-[#059669]",
      customStyle: {},
    };
  }
  if (tone === "BRAND") {
    return {
      containerClasses: "border-[#FFD5CC] bg-gradient-to-r from-[#FFF4F0] via-[#FFEBE5]/60 to-[#FFF4F0]",
      iconClasses: "bg-[#FFE6E0] text-[#ED3500]",
      titleColor: "text-[#992300]",
      bodyColor: "text-[#C22C00]",
      linkColor: "text-[#ED3500]",
      customStyle: {},
    };
  }
  if (tone === "CUSTOM" && customBg) {
    return {
      containerClasses: "border-black/10",
      iconClasses: "bg-black/10 text-current",
      titleColor: "text-current font-black",
      bodyColor: "text-current opacity-90",
      linkColor: "text-current underline",
      customStyle: { backgroundColor: customBg, color: customFg || "#FFFFFF" },
    };
  }
  return {
    containerClasses: "border-[#E0EAFF] bg-gradient-to-r from-[#EFF4FF] via-[#F5F8FF] to-[#EFF8FF]",
    iconClasses: "bg-[#DBEAFE] text-[#1D4ED8]",
    titleColor: "text-[#1E3A8A]",
    bodyColor: "text-[#1E40AF]",
    linkColor: "text-[#1D4ED8]",
    customStyle: {},
  };
}
