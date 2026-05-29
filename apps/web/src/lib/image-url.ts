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

function isAbsoluteUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
