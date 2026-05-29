import { ServiceUnavailableException } from "@nestjs/common";
import { RoleCode } from "@indihub/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicImageUploadPurpose } from "./dto/public-image-upload.dto";
import { assertManagedImageReference } from "./storage-image";
import { StorageService } from "./storage.service";
import type { PrismaService } from "../prisma/prisma.service";

function createStorageService(settings: Record<string, unknown> = {}) {
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
  const prisma = {
    client: {
      setting: {
        findMany: vi.fn(async () => rows),
      },
    },
  } as unknown as PrismaService;

  return new StorageService(prisma);
}

describe("StorageService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T10:00:00.000Z"));
    process.env.PUBLIC_IMAGE_PROVIDER = "IMAGEKIT";
    process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/indihub";
    process.env.IMAGEKIT_PUBLIC_KEY = "imagekit-public-key";
    process.env.IMAGEKIT_PRIVATE_KEY = "imagekit-private-key";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.PUBLIC_IMAGE_PROVIDER;
    delete process.env.IMAGEKIT_URL_ENDPOINT;
    delete process.env.IMAGEKIT_PUBLIC_KEY;
    delete process.env.IMAGEKIT_PRIVATE_KEY;
  });

  it("creates an ImageKit upload request for a seller product image folder", async () => {
    const service = createStorageService();

    const result = await service.createPublicImageUploadRequest(
      { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [RoleCode.SELLER] },
      { purpose: PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE, fileName: "Main Product.JPG", contentType: "image/jpeg" },
    );

    expect(result).toMatchObject({
      provider: "imagekit",
      urlEndpoint: "https://ik.imagekit.io/indihub",
      publicKey: "imagekit-public-key",
      folder: "indihub/sellers/user_seller/products",
      fileName: expect.stringMatching(/^Main_Product-\d+-[a-f0-9]{8}\.jpg$/),
      assetKey: expect.stringMatching(/^indihub\/sellers\/user_seller\/products\/Main_Product-\d+-[a-f0-9]{8}\.jpg$/),
    });
  });

  it("uses saved ImageKit settings before env fallbacks", async () => {
    const service = createStorageService({
      "storage.public_images.provider": "IMAGEKIT",
      "storage.public_images.base_url": "https://ik.imagekit.io/saved-indihub",
      "storage.public_images.imagekit.public_key": "saved-public",
      "storage.public_images.imagekit.private_key": "saved-private",
    });

    const result = await service.createPublicImageUploadRequest(
      { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
      { purpose: PublicImageUploadPurpose.ADMIN_BANNER, fileName: "hero.png", contentType: "image/png" },
    );

    expect(result).toMatchObject({
      provider: "imagekit",
      urlEndpoint: "https://ik.imagekit.io/saved-indihub",
      publicKey: "saved-public",
      folder: "indihub/admin/admin_1/banners",
    });
  });

  it("keeps admin image folders restricted to admin actors", async () => {
    const service = createStorageService();

    await expect(
      service.createPublicImageUploadRequest(
        { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [RoleCode.SELLER] },
        { purpose: PublicImageUploadPurpose.ADMIN_BANNER, fileName: "hero.png", contentType: "image/png" },
      ),
    ).rejects.toThrow("Admin upload permission is required");
  });

  it("requires provider credentials before generating ImageKit uploads", async () => {
    delete process.env.IMAGEKIT_PRIVATE_KEY;
    const service = createStorageService();

    await expect(
      service.createPublicImageUploadRequest(
        { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
        { purpose: PublicImageUploadPurpose.ADMIN_BANNER, fileName: "hero.png", contentType: "image/png" },
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("reports public image and private storage readiness from saved settings", async () => {
    const service = createStorageService({
      "storage.public_images.provider": "IMAGEKIT",
      "storage.public_images.base_url": "https://ik.imagekit.io/saved-indihub",
      "storage.public_images.imagekit.public_key": "saved-public",
      "storage.public_images.imagekit.private_key": "saved-private",
      "storage.private.enabled": true,
      "storage.private.endpoint": "https://s3.example.com",
      "storage.private.bucket": "indihub-private",
      "storage.private.access_key_id": "access-key",
      "storage.private.secret_access_key": "private-secret",
    });

    await expect(service.getReadiness()).resolves.toMatchObject({
      publicImages: {
        provider: "IMAGEKIT",
        configured: true,
        baseUrl: "https://ik.imagekit.io/saved-indihub",
      },
      privateStorage: {
        enabled: true,
        configured: true,
        bucket: "indihub-private",
      },
    });
  });

  it("creates an S3 public image upload request from database settings", async () => {
    const service = createStorageService({
      "storage.public_images.provider": "S3",
      "storage.public_images.s3.endpoint": "https://s3.example.com",
      "storage.public_images.s3.region": "ap-south-1",
      "storage.public_images.s3.bucket": "indihub-public",
      "storage.public_images.s3.access_key_id": "public-access",
      "storage.public_images.s3.secret_access_key": "public-secret",
    });

    const result = await service.createPublicImageUploadRequest(
      { id: "seller_1", clerkUserId: null, email: "seller@example.com", roles: [RoleCode.SELLER] },
      {
        purpose: PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE,
        fileName: "Main Product.JPG",
        contentType: "image/jpeg",
      },
    );

    expect(result.provider).toBe("s3");
    if (result.provider !== "s3") {
      throw new Error("Expected S3 upload request.");
    }

    expect(result).toMatchObject({
      provider: "s3",
      method: "PUT",
      headers: {
        "Content-Type": "image/jpeg",
      },
    });
    expect(result.assetKey).toMatch(/^indihub\/sellers\/seller_1\/products\/Main_Product-\d+-[a-f0-9]{8}\.jpg$/);
    expect(result.uploadUrl).toContain("https://s3.example.com/indihub-public/");
    expect(result.uploadUrl).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(result.uploadUrl).toContain("X-Amz-Signature=");
  });

  it("resolves portable public image keys through the configured base URL", async () => {
    const service = createStorageService({
      "storage.public_images.provider": "IMAGEKIT",
      "storage.public_images.base_url": "https://ik.imagekit.io/live-indihub",
      "storage.public_images.imagekit.public_key": "saved-public",
      "storage.public_images.imagekit.private_key": "saved-private",
    });

    await expect(service.publicImageUrl("indihub/sellers/seller_1/products/main-image.jpg")).resolves.toBe(
      "https://ik.imagekit.io/live-indihub/indihub/sellers/seller_1/products/main-image.jpg",
    );
  });

  it("validates stored image references as portable asset keys", () => {
    expect(() =>
      assertManagedImageReference("indihub/sellers/user_seller/profile/logo/store-logo.png", "Store logo", "indihub/sellers/user_seller/profile/logo"),
    ).not.toThrow();
    expect(() =>
      assertManagedImageReference("https://ik.imagekit.io/dev/indihub/sellers/user_seller/profile/logo/store-logo.png", "Store logo"),
    ).toThrow("Store logo must be a valid image storage key.");
    expect(() =>
      assertManagedImageReference(
        "indihub/sellers/other_seller/profile/logo/store-logo.png",
        "Store logo",
        "indihub/sellers/user_seller/profile/logo",
      ),
    ).toThrow("Store logo must be uploaded through the signed seller image flow.");
  });
});
