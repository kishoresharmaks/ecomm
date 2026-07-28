export type MobilePopupAnnouncement = {
  id: string;
  title: string;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  imageAlt: string;
  primaryLinkUrl: string | null;
  primaryCtaLabel: string | null;
  secondaryLinkUrl: string | null;
  secondaryCtaLabel: string | null;
  status: string;
  sortOrder: number;
};

export function normalizeMobilePopupAnnouncements(payload: unknown): MobilePopupAnnouncement[] {
  const source = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : [];

  return source.flatMap((value) => {
    if (!isRecord(value)) return [];
    const id = stringValue(value.id);
    const title = stringValue(value.title);
    const desktopImageUrl = stringValue(value.desktopImageUrl);
    const imageAlt = stringValue(value.imageAlt);
    if (!id || !title || !desktopImageUrl || !imageAlt) return [];

    return [{
      id,
      title,
      desktopImageUrl,
      mobileImageUrl: nullableString(value.mobileImageUrl),
      imageAlt,
      primaryLinkUrl: nullableString(value.primaryLinkUrl),
      primaryCtaLabel: nullableString(value.primaryCtaLabel),
      secondaryLinkUrl: nullableString(value.secondaryLinkUrl),
      secondaryCtaLabel: nullableString(value.secondaryCtaLabel),
      status: stringValue(value.status) || "PUBLISHED",
      sortOrder: numberValue(value.sortOrder),
    }];
  });
}

export function mobilePopupImage(popup: MobilePopupAnnouncement) {
  return popup.mobileImageUrl || popup.desktopImageUrl;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  return stringValue(value) || null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
