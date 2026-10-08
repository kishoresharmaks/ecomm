import { describe, expect, it } from "vitest";
import {
  isSellerAnnouncementDismissed,
  buildSellerAnnouncementDismissalUpdate,
  resolveSellerAnnouncementTheme,
} from "./seller-announcement";
import type { CmsAnnouncement } from "./storefront-api";

describe("seller announcement helpers", () => {
  const sampleAnnouncement: CmsAnnouncement = {
    id: "announcement-123",
    title: "Financial Transparency: How your Net Sales are calculated",
    description: "Net Sales reflects your gross product sales after statutory compliance.",
    linkUrl: "#tax-breakdown",
    primaryCtaLabel: "View Tax & Fee Breakdown",
    secondaryLinkUrl: "/seller/finance/wallet",
    secondaryCtaLabel: "Open Finance Wallet",
    targetAudience: "SELLER_DASHBOARD",
    tone: "INFO",
    isDismissible: true,
    backgroundColor: null,
    textColor: null,
    startsAt: null,
    endsAt: null,
    status: "PUBLISHED",
    sortOrder: 1,
    createdAt: "2026-10-08T10:00:00.000Z",
    updatedAt: "2026-10-08T10:30:00.000Z",
  };

  it("identifies announcement as not dismissed when not in dismissed map", () => {
    const isDismissed = isSellerAnnouncementDismissed(sampleAnnouncement, {});
    expect(isDismissed).toBe(false);
  });

  it("identifies announcement as dismissed when map matches current updatedAt version", () => {
    const dismissedMap = {
      "announcement-123": "2026-10-08T10:30:00.000Z",
    };
    const isDismissed = isSellerAnnouncementDismissed(sampleAnnouncement, dismissedMap);
    expect(isDismissed).toBe(true);
  });

  it("re-displays announcement if admin updates it with newer updatedAt version", () => {
    const oldDismissedMap = {
      "announcement-123": "2026-10-08T10:00:00.000Z", // old version dismissed
    };
    // Admin edited it so updatedAt is newer
    const isDismissed = isSellerAnnouncementDismissed(sampleAnnouncement, oldDismissedMap);
    expect(isDismissed).toBe(false);
  });

  it("never dismisses an announcement if isDismissible is false", () => {
    const nonDismissible: CmsAnnouncement = {
      ...sampleAnnouncement,
      isDismissible: false,
    };
    const dismissedMap = {
      "announcement-123": "2026-10-08T10:30:00.000Z",
    };
    const isDismissed = isSellerAnnouncementDismissed(nonDismissible, dismissedMap);
    expect(isDismissed).toBe(false);
  });

  it("builds correct updated dismissal map upon dismiss action", () => {
    const currentMap = { "other-id": "v1" };
    const updated = buildSellerAnnouncementDismissalUpdate(sampleAnnouncement, currentMap);
    expect(updated).toEqual({
      "other-id": "v1",
      "announcement-123": "2026-10-08T10:30:00.000Z",
    });
  });

  it("resolves correct theme styling for standard tones", () => {
    const infoTheme = resolveSellerAnnouncementTheme("INFO");
    expect(infoTheme.containerClasses).toContain("border-[#E0EAFF]");
    expect(infoTheme.titleColor).toContain("text-[#1E3A8A]");

    const warningTheme = resolveSellerAnnouncementTheme("WARNING");
    expect(warningTheme.containerClasses).toContain("border-[#FDE68A]");
    expect(warningTheme.titleColor).toContain("text-[#92400E]");

    const successTheme = resolveSellerAnnouncementTheme("SUCCESS");
    expect(successTheme.containerClasses).toContain("border-[#A7F3D0]");
    expect(successTheme.titleColor).toContain("text-[#065F46]");

    const brandTheme = resolveSellerAnnouncementTheme("BRAND");
    expect(brandTheme.containerClasses).toContain("border-[#FFD5CC]");
    expect(brandTheme.titleColor).toContain("text-[#992300]");

    const customTheme = resolveSellerAnnouncementTheme("CUSTOM", "#123456", "#ABCDEF");
    expect(customTheme.customStyle.backgroundColor).toBe("#123456");
    expect(customTheme.customStyle.color).toBe("#ABCDEF");
  });
});
