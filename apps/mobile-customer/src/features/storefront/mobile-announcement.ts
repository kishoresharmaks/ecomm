export type MobileAnnouncement = {
  id: string;
  title: string;
  linkUrl: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  status: string;
};

export type MobileAnnouncementDestination =
  | { type: "internal"; href: string }
  | { type: "external"; url: string };

export type MobileAnnouncementPalette = {
  accentColor: string;
  backgroundColor: string;
  borderColor: string;
  iconBackgroundColor: string;
};

const brandSurface = "#FFFCFB";
const fallbackTone = "#ED3500";
const fallbackText = "#111827";
const supportedExternalProtocols = new Set(["http:", "https:", "mailto:", "tel:", "onehandindia:"]);
const appHosts = new Set(["1handindia.com", "www.1handindia.com"]);

export function normalizeMobileAnnouncementsResponse(payload: unknown): MobileAnnouncement[] {
  const source = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : [];

  return source.flatMap((value) => {
    if (!isRecord(value)) {
      return [];
    }

    const id = stringValue(value.id);
    const title = stringValue(value.title);
    if (!id || !title) {
      return [];
    }

    return [{
      id,
      title,
      linkUrl: nullableString(value.linkUrl),
      backgroundColor: nullableString(value.backgroundColor),
      textColor: nullableString(value.textColor),
      status: stringValue(value.status) || "PUBLISHED",
    }];
  });
}

export function resolveMobileAnnouncementDestination(linkUrl: string | null): MobileAnnouncementDestination | null {
  const value = linkUrl?.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return { type: "internal", href: value };
  }

  try {
    const url = new URL(value);
    if (!supportedExternalProtocols.has(url.protocol)) {
      return null;
    }

    if ((url.protocol === "http:" || url.protocol === "https:") && appHosts.has(url.hostname.toLowerCase())) {
      return {
        type: "internal",
        href: `${url.pathname || "/"}${url.search}${url.hash}`,
      };
    }

    return { type: "external", url: value };
  } catch {
    return null;
  }
}

export function mobileAnnouncementPalette(
  backgroundColor: string | null,
  textColor: string | null,
): MobileAnnouncementPalette {
  const tone = parseHexColor(backgroundColor) ?? parseHexColor(fallbackTone)!;
  const surface = parseHexColor(brandSurface)!;
  const tintedSurface = blend(tone, surface, 0.1);
  const requestedText = parseHexColor(textColor);
  const darkenedTone = blend(tone, { red: 0, green: 0, blue: 0 }, 0.72);
  const fallback = parseHexColor(fallbackText)!;
  const accent = [requestedText, tone, darkenedTone, fallback]
    .find((candidate) => candidate && contrastRatio(candidate, tintedSurface) >= 4.5) ?? fallback;

  return {
    accentColor: rgbToHex(accent),
    backgroundColor: rgba(tone, 0.1),
    borderColor: rgba(tone, 0.18),
    iconBackgroundColor: rgba(tone, 0.12),
  };
}

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const normalized = stringValue(value);
  return normalized || null;
}

function parseHexColor(value: string | null): RgbColor | null {
  const normalized = value?.trim().replace(/^#/, "");
  if (!normalized || !/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) {
    return null;
  }

  const hex = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function blend(foreground: RgbColor, background: RgbColor, opacity: number): RgbColor {
  return {
    red: Math.round(foreground.red * opacity + background.red * (1 - opacity)),
    green: Math.round(foreground.green * opacity + background.green * (1 - opacity)),
    blue: Math.round(foreground.blue * opacity + background.blue * (1 - opacity)),
  };
}

function rgba(color: RgbColor, opacity: number) {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${opacity})`;
}

function rgbToHex(color: RgbColor) {
  return `#${[color.red, color.green, color.blue]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function contrastRatio(first: RgbColor, second: RgbColor) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: RgbColor) {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
