import { ServiceUnavailableException } from "@nestjs/common";
import { RoleCode } from "@indihub/database";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicImageUploadPurpose } from "./dto/public-image-upload.dto";
import { assertManagedImageReference, normalizePublicImageReference } from "./storage-image";
import { StorageService } from "./storage.service";
import type { PrismaService } from "../prisma/prisma.service";

function createStorageService(settings: Record<string, unknown> = {}) {
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
  const prisma = {
    client: {
      $executeRaw: vi.fn(async () => 1),
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
      {
        id: "user_seller",
        clerkUserId: null,
        email: "seller@example.com",
        roles: [RoleCode.SELLER],
      },
      {
        purpose: PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE,
        fileName: "Main Product.JPG",
        contentType: "image/jpeg",
      },
    );

    expect(result).toMatchObject({
      provider: "imagekit",
      urlEndpoint: "https://ik.imagekit.io/indihub",
      publicKey: "imagekit-public-key",
      folder: "indihub/sellers/user_seller/products",
      fileName: expect.stringMatching(/^Main_Product-\d+-[a-f0-9]{8}\.jpg$/),
      assetKey: expect.stringMatching(
        /^indihub\/sellers\/user_seller\/products\/Main_Product-\d+-[a-f0-9]{8}\.jpg$/,
      ),
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
      {
        purpose: PublicImageUploadPurpose.ADMIN_BANNER,
        fileName: "hero.png",
        contentType: "image/png",
      },
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
        {
          id: "user_seller",
          clerkUserId: null,
          email: "seller@example.com",
          roles: [RoleCode.SELLER],
        },
        {
          purpose: PublicImageUploadPurpose.ADMIN_BANNER,
          fileName: "hero.png",
          contentType: "image/png",
        },
      ),
    ).rejects.toThrow("Admin upload permission is required");
  });

  it("rejects public image upload requests over the managed image size limit", async () => {
    const service = createStorageService();

    await expect(
      service.createPublicImageUploadRequest(
        { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
        {
          purpose: PublicImageUploadPurpose.ADMIN_BANNER,
          fileName: "large.png",
          contentType: "image/png",
          sizeBytes: 6 * 1024 * 1024,
        },
      ),
    ).rejects.toThrow("Public image file size must be 5 MB or less.");
  });

  it("requires provider credentials before generating ImageKit uploads", async () => {
    delete process.env.IMAGEKIT_PRIVATE_KEY;
    const service = createStorageService();

    await expect(
      service.createPublicImageUploadRequest(
        { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
        {
          purpose: PublicImageUploadPurpose.ADMIN_BANNER,
          fileName: "hero.png",
          contentType: "image/png",
        },
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
      "storage.private.region": "ap-south-1",
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
        activeProvider: "S3",
        s3Configured: true,
        bucket: "indihub-private",
      },
    });
  });

  it("uses local fallback for B2B PO upload requests when AUTO has no S3 settings", async () => {
    const service = createStorageService({
      "storage.private.provider": "AUTO",
      "storage.private.enabled": true,
      "storage.private.local_root": "storage/private",
    });

    const result = await service.createB2BPurchaseOrderUploadRequest(
      { businessBuyerId: "buyer_1", orderNumber: "1HI-B2B-20260615-ABC123" },
      { fileName: "Approved PO.PDF", contentType: "application/pdf", sizeBytes: 1024 },
    );

    expect(result).toMatchObject({
      provider: "local",
      method: "POST",
      uploadPath: "/api/b2b/orders/1HI-B2B-20260615-ABC123/purchase-order/upload",
      maxBytes: 10 * 1024 * 1024,
    });
  });

  it("creates timestamped S3 B2B PO upload keys with safe filenames", async () => {
    const service = createStorageService({
      "storage.private.provider": "S3",
      "storage.private.enabled": true,
      "storage.private.endpoint": "https://s3.example.com",
      "storage.private.region": "ap-south-1",
      "storage.private.bucket": "indihub-private",
      "storage.private.access_key_id": "access-key",
      "storage.private.secret_access_key": "private-secret",
    });

    const result = await service.createB2BPurchaseOrderUploadRequest(
      { businessBuyerId: "buyer_1", orderNumber: "1HI-B2B-20260615-ABC123" },
      { fileName: "../Signed PO Final!!.PDF", contentType: "application/pdf", sizeBytes: 2048 },
    );

    expect(result.provider).toBe("s3");
    if (result.provider !== "s3") {
      throw new Error("Expected S3 upload request.");
    }

    expect(result.assetKey).toBe(
      "indihub/b2b/purchase-orders/buyer_1/1HI-B2B-20260615-ABC123/20260523100000-signed-po-final.pdf",
    );
    expect(result.uploadUrl).toContain("X-Amz-Expires=900");
    expect(result.headers).toMatchObject({ "Content-Type": "application/pdf" });
  });

  it("rejects invalid B2B PO upload metadata server-side", async () => {
    const service = createStorageService({
      "storage.private.provider": "LOCAL",
      "storage.private.enabled": true,
      "storage.private.local_root": "storage/private",
    });

    await expect(
      service.createB2BPurchaseOrderUploadRequest(
        { businessBuyerId: "buyer_1", orderNumber: "1HI-B2B-20260615-ABC123" },
        { fileName: "po.exe", contentType: "application/x-msdownload", sizeBytes: 1024 },
      ),
    ).rejects.toThrow("Document must be a PDF");

    await expect(
      service.createB2BPurchaseOrderUploadRequest(
        { businessBuyerId: "buyer_1", orderNumber: "1HI-B2B-20260615-ABC123" },
        { fileName: "po.pdf", contentType: "application/pdf", sizeBytes: 11 * 1024 * 1024 },
      ),
    ).rejects.toThrow("10 MB or less");
  });

  it("rejects local B2B PO files with mismatched magic bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "indihub-private-"));
    const service = createStorageService({
      "storage.private.provider": "LOCAL",
      "storage.private.enabled": true,
      "storage.private.local_root": root,
    });

    try {
      await expect(
        service.saveLocalB2BPurchaseOrder(
          { businessBuyerId: "buyer_1", orderNumber: "1HI-B2B-20260615-ABC123" },
          {
            originalname: "Approved PO.pdf",
            mimetype: "application/pdf",
            size: 12,
            buffer: Buffer.from("not a pdf"),
          },
        ),
      ).rejects.toThrow("does not match");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses a 5 minute signed URL TTL for B2B PO downloads", async () => {
    const service = createStorageService({
      "storage.private.provider": "S3",
      "storage.private.enabled": true,
      "storage.private.endpoint": "https://s3.example.com",
      "storage.private.region": "ap-south-1",
      "storage.private.bucket": "indihub-private",
      "storage.private.access_key_id": "access-key",
      "storage.private.secret_access_key": "private-secret",
    });

    const result = await service.b2bPurchaseOrderDocumentAccess(
      "indihub/b2b/purchase-orders/buyer_1/1HI-B2B-20260615-ABC123/20260523100000-po.pdf",
    );

    expect(result.provider).toBe("s3");
    if (result.provider !== "s3") {
      throw new Error("Expected S3 access.");
    }

    expect(result.url).toContain("X-Amz-Expires=300");
    expect(result.expiresAt).toBe("2026-05-23T10:05:00.000Z");
  });

  it("uses local fallback for seller private document upload requests when AUTO has no S3 settings", async () => {
    const service = createStorageService({
      "storage.private.provider": "AUTO",
      "storage.private.enabled": true,
      "storage.private.local_root": "storage/private",
    });

    const result = await service.createPrivateDocumentUploadRequest(
      { id: "seller_1", clerkUserId: null, email: "seller@example.com", roles: [RoleCode.SELLER] },
      {
        documentType: "GST_CERTIFICATE",
        fileName: "GST Certificate.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
      },
    );

    expect(result).toMatchObject({
      provider: "local",
      method: "POST",
      uploadPath: "/api/storage/private-document/upload",
      maxBytes: 10 * 1024 * 1024,
    });
  });

  it("creates timestamped S3 seller private document upload keys with safe filenames", async () => {
    const service = createStorageService({
      "storage.private.provider": "S3",
      "storage.private.enabled": true,
      "storage.private.endpoint": "https://s3.example.com",
      "storage.private.region": "ap-south-1",
      "storage.private.bucket": "indihub-private",
      "storage.private.access_key_id": "access-key",
      "storage.private.secret_access_key": "private-secret",
    });

    const result = await service.createPrivateDocumentUploadRequest(
      { id: "seller_1", clerkUserId: null, email: "seller@example.com", roles: [RoleCode.SELLER] },
      {
        documentType: "GST_CERTIFICATE",
        fileName: "../GST Certificate!!.PDF",
        contentType: "application/pdf",
        sizeBytes: 2048,
      },
    );

    expect(result.provider).toBe("s3");
    if (result.provider !== "s3") {
      throw new Error("Expected S3 upload request.");
    }

    expect(result.assetKey).toMatch(
      /^indihub\/sellers\/seller_1\/documents\/gst_certificate-gst-certificate-20260523100000-[a-f0-9]{8}\.pdf$/,
    );
    expect(result.uploadUrl).toContain("X-Amz-Expires=900");
    expect(result.headers).toMatchObject({ "Content-Type": "application/pdf" });
    expect(result.maxBytes).toBe(10 * 1024 * 1024);
  });

  it("rejects invalid seller private document upload metadata server-side", async () => {
    const service = createStorageService({
      "storage.private.provider": "LOCAL",
      "storage.private.enabled": true,
      "storage.private.local_root": "storage/private",
    });

    await expect(
      service.createPrivateDocumentUploadRequest(
        {
          id: "seller_1",
          clerkUserId: null,
          email: "seller@example.com",
          roles: [RoleCode.SELLER],
        },
        {
          documentType: "GST_CERTIFICATE",
          fileName: "gst.exe",
          contentType: "application/x-msdownload",
          sizeBytes: 1024,
        },
      ),
    ).rejects.toThrow("Document must be a PDF");

    await expect(
      service.createPrivateDocumentUploadRequest(
        {
          id: "seller_1",
          clerkUserId: null,
          email: "seller@example.com",
          roles: [RoleCode.SELLER],
        },
        {
          documentType: "GST_CERTIFICATE",
          fileName: "gst.pdf",
          contentType: "application/pdf",
          sizeBytes: 11 * 1024 * 1024,
        },
      ),
    ).rejects.toThrow("10 MB or less");
  });

  it("saves local seller private documents only under the private upload root", async () => {
    const root = await mkdtemp(join(tmpdir(), "indihub-private-"));
    const service = createStorageService({
      "storage.private.provider": "LOCAL",
      "storage.private.enabled": true,
      "storage.private.local_root": root,
    });

    try {
      const result = await service.saveLocalPrivateDocument(
        {
          id: "seller_1",
          clerkUserId: null,
          email: "seller@example.com",
          roles: [RoleCode.SELLER],
        },
        "GST_CERTIFICATE",
        {
          originalname: "GST Certificate.pdf",
          mimetype: "application/pdf",
          size: 16,
          buffer: Buffer.from("%PDF-1.4\nbody"),
        },
      );

      expect(result.assetKey).toMatch(
        /^indihub\/sellers\/seller_1\/documents\/gst_certificate-gst-certificate-20260523100000-[a-f0-9]{8}\.pdf$/,
      );
      await expect(readFile(join(root, result.assetKey), "utf8")).resolves.toContain("%PDF-1.4");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects local seller private documents with mismatched magic bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "indihub-private-"));
    const service = createStorageService({
      "storage.private.provider": "LOCAL",
      "storage.private.enabled": true,
      "storage.private.local_root": root,
    });

    try {
      await expect(
        service.saveLocalPrivateDocument(
          {
            id: "seller_1",
            clerkUserId: null,
            email: "seller@example.com",
            roles: [RoleCode.SELLER],
          },
          "GST_CERTIFICATE",
          {
            originalname: "GST Certificate.pdf",
            mimetype: "application/pdf",
            size: 12,
            buffer: Buffer.from("not a pdf"),
          },
        ),
      ).rejects.toThrow("does not match");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("streams local seller private document access for owner and admin only", async () => {
    const root = await mkdtemp(join(tmpdir(), "indihub-private-"));
    const service = createStorageService({
      "storage.private.provider": "LOCAL",
      "storage.private.enabled": true,
      "storage.private.local_root": root,
    });

    try {
      const upload = await service.saveLocalPrivateDocument(
        {
          id: "seller_1",
          clerkUserId: null,
          email: "seller@example.com",
          roles: [RoleCode.SELLER],
        },
        "ID_PROOF",
        {
          originalname: "Identity Proof.pdf",
          mimetype: "application/pdf",
          size: 16,
          buffer: Buffer.from("%PDF-1.4\nbody"),
        },
      );

      await expect(
        service.privateDocumentAccess(
          {
            id: "seller_1",
            clerkUserId: null,
            email: "seller@example.com",
            roles: [RoleCode.SELLER],
          },
          upload.assetKey,
        ),
      ).resolves.toMatchObject({
        provider: "local",
        fileName: expect.stringContaining("identity-proof"),
        contentType: "application/pdf",
      });

      await expect(
        service.privateDocumentAccess(
          { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
          upload.assetKey,
        ),
      ).resolves.toMatchObject({ provider: "local" });

      await expect(
        service.privateDocumentAccess(
          {
            id: "seller_2",
            clerkUserId: null,
            email: "other@example.com",
            roles: [RoleCode.SELLER],
          },
          upload.assetKey,
        ),
      ).rejects.toThrow("You can only access your own seller documents");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses a 5 minute signed URL TTL for generic S3 private document downloads", async () => {
    const service = createStorageService({
      "storage.private.provider": "S3",
      "storage.private.enabled": true,
      "storage.private.endpoint": "https://s3.example.com",
      "storage.private.region": "ap-south-1",
      "storage.private.bucket": "indihub-private",
      "storage.private.access_key_id": "access-key",
      "storage.private.secret_access_key": "private-secret",
    });

    const result = await service.privateDocumentAccess(
      { id: "seller_1", clerkUserId: null, email: "seller@example.com", roles: [RoleCode.SELLER] },
      "indihub/sellers/seller_1/documents/id_proof-proof-20260523100000-abcdef12.pdf",
    );

    expect(result.provider).toBe("s3");
    if (result.provider !== "s3") {
      throw new Error("Expected S3 access.");
    }

    expect(result.url).toContain("X-Amz-Expires=300");
    expect(result.expiresAt).toBe("2026-05-23T10:05:00.000Z");
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
    expect(result.assetKey).toMatch(
      /^indihub\/sellers\/seller_1\/products\/Main_Product-\d+-[a-f0-9]{8}\.jpg$/,
    );
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

    await expect(
      service.publicImageUrl("indihub/sellers/seller_1/products/main-image.jpg"),
    ).resolves.toBe(
      "https://ik.imagekit.io/live-indihub/indihub/sellers/seller_1/products/main-image.jpg",
    );
  });

  it("validates stored image references as portable asset keys", () => {
    expect(() =>
      assertManagedImageReference(
        "indihub/sellers/user_seller/profile/logo/store-logo.png",
        "Store logo",
        "indihub/sellers/user_seller/profile/logo",
      ),
    ).not.toThrow();
    expect(() =>
      assertManagedImageReference(
        "https://ik.imagekit.io/dev/indihub/sellers/user_seller/profile/logo/store-logo.png",
        "Store logo",
      ),
    ).toThrow("Store logo must be a valid image storage key.");
    expect(() =>
      assertManagedImageReference(
        "indihub/sellers/other_seller/profile/logo/store-logo.png",
        "Store logo",
        "indihub/sellers/user_seller/profile/logo",
      ),
    ).toThrow("Store logo must be uploaded through the signed seller image flow.");
  });

  it("allows admin-managed public images to use storage keys or secure external urls", () => {
    expect(
      normalizePublicImageReference("indihub/categories/stationery.jpg", "Category image"),
    ).toBe("indihub/categories/stationery.jpg");
    expect(
      normalizePublicImageReference(
        "https://img.magnific.com/free-photo/modern-stationary-collection-arrangement_23-2149309649.jpg?semt=ais_hybrid&w=740&q=80",
        "Category image",
      ),
    ).toBe(
      "https://img.magnific.com/free-photo/modern-stationary-collection-arrangement_23-2149309649.jpg?semt=ais_hybrid&w=740&q=80",
    );
    expect(() =>
      normalizePublicImageReference("http://img.magnific.com/category.jpg", "Category image"),
    ).toThrow("Category image must be a secure HTTPS image URL or valid image storage key.");
  });
});
