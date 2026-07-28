import type {
  ServiceListingImage,
} from "@/lib/service-marketplace-api";

export function serviceImagesForSave(
  existingImages: ServiceListingImage[] | null | undefined,
  coverImageUrl: string | null | undefined,
  title: string,
): ServiceListingImage[] {
  const uniqueExisting = uniqueImages(existingImages ?? []);
  const currentPrimaryUrl =
    uniqueExisting.find((image) => image.isPrimary)?.url ??
    uniqueExisting[0]?.url ??
    null;
  const selectedCoverUrl = coverImageUrl?.trim() || null;

  const ordered = selectedCoverUrl
    ? [
        imageForUrl(uniqueExisting, selectedCoverUrl, title),
        ...uniqueExisting.filter((image) => image.url !== selectedCoverUrl),
      ]
    : uniqueExisting.filter((image) => image.url !== currentPrimaryUrl);

  return ordered.map((image, index) => ({
    url: image.url,
    altText: image.altText?.trim() || title,
    sortOrder: index,
    isPrimary: index === 0,
  }));
}

function uniqueImages(images: ServiceListingImage[]) {
  const seen = new Set<string>();
  return images.flatMap((image) => {
    const url = image.url.trim();
    if (!url || seen.has(url)) {
      return [];
    }
    seen.add(url);
    return [{ ...image, url }];
  });
}

function imageForUrl(
  existingImages: ServiceListingImage[],
  url: string,
  title: string,
) {
  return (
    existingImages.find((image) => image.url === url) ?? {
      url,
      altText: title,
    }
  );
}
