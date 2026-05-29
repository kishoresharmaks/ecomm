import { BadRequestException } from "@nestjs/common";

export function assertManagedImageReference(
  value: string | null | undefined,
  fieldName: string,
  requiredFolder?: string,
) {
  normalizeStorageImageReference(value, fieldName, requiredFolder);
}

export function normalizeStorageImageReference(
  value: string | null | undefined,
  fieldName: string,
  requiredFolder?: string,
) {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const key = storageImageKeyFromValue(trimmed, fieldName);
  if (requiredFolder && !key.startsWith(`${requiredFolder}/`)) {
    throw new BadRequestException(`${fieldName} must be uploaded through the signed seller image flow.`);
  }

  return key;
}

export function storageImageKeyFromValue(value: string, fieldName = "Image") {
  return assertPortableImageKey(value, fieldName);
}

export function assertManagedImageReferences(
  images: Array<{ url: string }> | undefined,
  fieldName: string,
  requiredFolder?: string,
) {
  for (const image of images ?? []) {
    assertManagedImageReference(image.url, fieldName, requiredFolder);
  }
}

export function safeStorageFolderSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function assertPortableImageKey(value: string, fieldName: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");

  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.includes("://") ||
    normalized.split("/").some((part) => !part || !/^[a-zA-Z0-9._-]+$/.test(part))
  ) {
    throw new BadRequestException(`${fieldName} must be a valid image storage key.`);
  }

  return normalized;
}
