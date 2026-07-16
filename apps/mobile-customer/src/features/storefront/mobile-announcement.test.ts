import { describe, expect, it } from "vitest";
import {
  mobileAnnouncementPalette,
  normalizeMobileAnnouncementsResponse,
  resolveMobileAnnouncementDestination,
} from "./mobile-announcement";

describe("mobile announcements", () => {
  const announcement = {
    id: "announcement-1",
    title: "We are going live soon",
    linkUrl: "/deals",
    backgroundColor: "#ED3500",
    textColor: "#fffaf7",
    status: "PUBLISHED",
  };

  it("accepts the public CMS array response used by the API", () => {
    expect(normalizeMobileAnnouncementsResponse([announcement])).toEqual([announcement]);
  });

  it("also accepts the legacy items envelope during rollout", () => {
    expect(normalizeMobileAnnouncementsResponse({ items: [announcement] })).toEqual([announcement]);
  });

  it("drops malformed records instead of breaking the home screen", () => {
    expect(normalizeMobileAnnouncementsResponse([null, {}, { id: "missing-title" }])).toEqual([]);
  });

  it("keeps 1HandIndia web links inside the app", () => {
    expect(resolveMobileAnnouncementDestination("https://1handindia.com/products/example?ref=announcement")).toEqual({
      type: "internal",
      href: "/products/example?ref=announcement",
    });
  });

  it("rejects unsafe link protocols", () => {
    expect(resolveMobileAnnouncementDestination("javascript:alert(1)")).toBeNull();
  });

  it("replaces unreadable configured text with a contrasting brand tone", () => {
    const palette = mobileAnnouncementPalette("#ED3500", "#fffaf7");

    expect(palette.backgroundColor).toBe("rgba(237, 53, 0, 0.1)");
    expect(palette.accentColor).not.toBe("#FFFAF7");
  });
});
