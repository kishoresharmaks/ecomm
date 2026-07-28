import { apiBaseUrl } from "./api";

export function resolveImageUrl(value?: string | null) {
  const image = value?.trim();
  if (!image) {
    return null;
  }

  const apiUrl = apiBaseUrl();

  if (/^https?:\/\//i.test(image)) {
    if (isCmsPublicPathUrl(image)) {
      return publicStorageImageUrl(apiUrl, cmsPublicPathToStorageKey(new URL(image).pathname));
    }

    return image;
  }

  const origin = apiUrl.replace(/\/api$/, "");

  if (image.startsWith("/")) {
    if (image.startsWith("/api/")) {
      return `${origin}${image}`;
    }

    if (image.startsWith("/storage/")) {
      return `${origin}${image}`;
    }

    if (image.startsWith("/cms/")) {
      return publicStorageImageUrl(apiUrl, cmsPublicPathToStorageKey(image));
    }

    if (isStorageImageKey(image.slice(1))) {
      return publicStorageImageUrl(apiUrl, image.slice(1));
    }

    return `${origin}${image}`;
  }

  if (image.startsWith("cms/")) {
    return publicStorageImageUrl(apiUrl, cmsPublicPathToStorageKey(image));
  }

  return publicStorageImageUrl(apiUrl, image);
}

function isStorageImageKey(value: string) {
  return /^(1handindia|indihub|categories|products|sellers|stores|banners|homepage|cms)\//i.test(value);
}

function publicStorageImageUrl(apiUrl: string, key: string) {
  return `${apiUrl}/storage/public-image?key=${encodeURIComponent(key)}`;
}

function cmsPublicPathToStorageKey(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  return /^(1handindia|indihub)\//i.test(normalized) ? normalized : `1handindia/${normalized}`;
}

function isCmsPublicPathUrl(value: string) {
  try {
    return new URL(value).pathname.startsWith("/cms/");
  } catch {
    return false;
  }
}
