import { describe, expect, it } from "vitest";
import { mobilePopupImage, normalizeMobilePopupAnnouncements } from "./mobile-popup-announcement";

describe("mobile popup announcements", () => {
  const popup = {
    id: "popup-1",
    title: "Monsoon offers",
    desktopImageUrl: "indihub/admin/example/banners/desktop.webp",
    mobileImageUrl: null,
    imageAlt: "Monsoon marketplace offers",
    primaryLinkUrl: "/deals",
    primaryCtaLabel: "Shop offers",
    secondaryLinkUrl: null,
    secondaryCtaLabel: null,
    status: "PUBLISHED",
    sortOrder: 0,
  };

  it("normalizes the public CMS response", () => {
    expect(normalizeMobilePopupAnnouncements([popup])).toEqual([popup]);
  });

  it("falls back to the desktop image when mobile art is absent", () => {
    expect(mobilePopupImage(popup)).toBe(popup.desktopImageUrl);
  });

  it("drops records that cannot render accessibly", () => {
    expect(normalizeMobilePopupAnnouncements([{ ...popup, imageAlt: "" }])).toEqual([]);
  });
});
