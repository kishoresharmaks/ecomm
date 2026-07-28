export type PopupDestination =
  | { type: "internal"; href: string }
  | { type: "external"; url: string };

const supportedProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);
const appHosts = new Set(["1handindia.com", "www.1handindia.com"]);

export function resolvePopupDestination(value: string | null | undefined): PopupDestination | null {
  const link = value?.trim();
  if (!link) return null;
  if (link.startsWith("/")) return { type: "internal", href: link };

  try {
    const url = new URL(link);
    if (url.protocol === "onehandindia:") {
      const path = url.hostname ? `/${url.hostname}${url.pathname}` : url.pathname;
      return path.startsWith("/") ? { type: "internal", href: `${path}${url.search}${url.hash}` } : null;
    }
    if (!supportedProtocols.has(url.protocol)) return null;
    if ((url.protocol === "http:" || url.protocol === "https:") && appHosts.has(url.hostname.toLowerCase())) {
      return { type: "internal", href: `${url.pathname || "/"}${url.search}${url.hash}` };
    }
    return { type: "external", url: link };
  } catch {
    return null;
  }
}

export function movePopupIndex(current: number, direction: -1 | 1, count: number) {
  return count > 0 ? (current + direction + count) % count : 0;
}
