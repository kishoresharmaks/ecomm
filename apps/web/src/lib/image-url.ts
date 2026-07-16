import { apiBaseUrl } from "./api";

export function resolveImageSource(src: string | null | undefined) {
  const value = src?.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("/") || isAbsoluteUrl(value)) {
    return value;
  }

  return `${apiBaseUrl.replace(/\/$/, "")}/api/storage/public-image?key=${encodeURIComponent(value)}`;
}

export function isPortableImageKey(src: string | null | undefined) {
  const value = src?.trim();
  return Boolean(value && !value.startsWith("/") && !isAbsoluteUrl(value));
}

export function isPrivateNetworkImageSource(src: string | null | undefined) {
  const value = src?.trim();
  if (!value) {
    return false;
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.")
    ) {
      return true;
    }

    const match = /^172\.(\d{1,3})\./.exec(hostname);
    return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
  } catch {
    return false;
  }
}

function isAbsoluteUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
