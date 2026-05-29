import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, EmailRecipientType, ProductStatus, SellerStatus } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductApprovalDecision } from "./dto/product-approval.dto";
import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  const notifications = {
    notifyEvent: vi.fn(),
    notifyAdminEvent: vi.fn(),
  };
  const prisma = {
    client: {
      seller: {
        findUnique: vi.fn(),
      },
      category: {
        findFirst: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const marketplaceEssentials = {
    brand: "1HandIndia",
    condition: "New",
    unitOfMeasure: "Pack",
    gstRatePercent: 5,
    hsnCode: "100630",
    returnEligibility: "Returnable",
    packageWeightGrams: 500,
  };

  it("blocks seller product creation until seller approval is complete", async () => {
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      status: SellerStatus.PENDING_APPROVAL,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
    });
    const service = new ProductsService(prisma as never, notifications as never);

    await expect(
      service.createSellerProduct(
        { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] },
        {
          categoryId: "category_1",
          name: "Premium Rice",
          description: "High quality local rice",
          variants: [{ pricePaise: 55000, stockQuantity: 20 }],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.client.category.findFirst).not.toHaveBeenCalled();
  });

  it("rejects seller product images that are not portable asset keys", async () => {
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    const service = new ProductsService(prisma as never, notifications as never);

    await expect(
      service.createSellerProduct(
        { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] },
        {
          categoryId: "category_1",
          name: "Premium Rice",
          description: "High quality local rice",
          images: [{ url: "https://example.com/rice.jpg" }],
          variants: [{ pricePaise: 55000, stockQuantity: 20 }],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.client.category.findFirst).not.toHaveBeenCalled();
  });

  it("approves a submitted product, activates it, audits the decision, and notifies the seller", async () => {
    prisma.client.product.findFirst.mockResolvedValue({
      id: "product_1",
      name: "Premium Rice",
      status: ProductStatus.INACTIVE,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      attributes: marketplaceEssentials,
      seller: {
        userId: "user_seller",
        storeName: "Indi Local",
        user: { email: "seller@example.com" },
      },
    });
    prisma.client.product.update.mockResolvedValue({
      id: "product_1",
      name: "Premium Rice",
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      seller: {
        userId: "user_seller",
        storeName: "Indi Local",
        user: { email: "seller@example.com" },
      },
    });
    prisma.client.product.findUnique.mockResolvedValue({
      id: "product_1",
      name: "Premium Rice",
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      seller: {
        userId: "user_seller",
        storeName: "Indi Local",
        user: { email: "seller@example.com" },
      },
    });
    const service = new ProductsService(prisma as never, notifications as never);

    const result = await service.updateProductApproval(
      "product_1",
      { decision: ProductApprovalDecision.APPROVE, note: "Looks good" },
      { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [] },
    );

    expect(result).toMatchObject({
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: {
        actor: { connect: { id: "admin_1" } },
        action: "product.approved",
        entityType: "product",
        entityId: "product_1",
        oldValue: {
          status: ProductStatus.INACTIVE,
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        },
        newValue: {
          status: ProductStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
          note: "Looks good",
        },
      },
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "PRODUCT_APPROVED",
      recipientType: EmailRecipientType.SELLER,
      recipient: "seller@example.com",
      userId: "user_seller",
      variables: {
        productName: "Premium Rice",
        sellerName: "Indi Local",
        note: "Looks good",
      },
    });
  });

  it("blocks product approval until required marketplace essentials are present", async () => {
    prisma.client.product.findFirst.mockResolvedValue({
      id: "product_1",
      name: "Premium Rice",
      status: ProductStatus.INACTIVE,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      attributes: { brand: "Indi Local" },
      seller: {
        userId: "user_seller",
        storeName: "Indi Local",
        user: { email: "seller@example.com" },
      },
    });
    const service = new ProductsService(prisma as never, notifications as never);

    await expect(
      service.updateProductApproval(
        "product_1",
        { decision: ProductApprovalDecision.APPROVE, note: "Looks good" },
        { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.client.product.update).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("throws when product approval targets a deleted or missing product", async () => {
    prisma.client.product.findFirst.mockResolvedValue(null);
    const service = new ProductsService(prisma as never, notifications as never);

    await expect(
      service.updateProductApproval(
        "missing_product",
        { decision: ProductApprovalDecision.REJECT },
        { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [] },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.client.product.update).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("archives products from the admin catalogue with audit history", async () => {
    prisma.client.product.findFirst.mockResolvedValue({
      id: "product_1",
      name: "Premium Rice",
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      deletedAt: null,
    });
    prisma.client.product.update.mockResolvedValue({
      id: "product_1",
      status: ProductStatus.ARCHIVED,
      approvalStatus: ApprovalStatus.APPROVED,
      deletedAt: new Date("2026-05-24T00:00:00.000Z"),
    });
    prisma.client.product.findUnique.mockResolvedValue({
      id: "product_1",
      name: "Premium Rice",
      status: ProductStatus.ARCHIVED,
      approvalStatus: ApprovalStatus.APPROVED,
      deletedAt: new Date("2026-05-24T00:00:00.000Z"),
    });
    const service = new ProductsService(prisma as never, notifications as never);

    const result = await service.archiveAdminProduct(
      { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [] },
      "product_1",
    );

    expect(result).toMatchObject({ status: ProductStatus.ARCHIVED });
    expect(prisma.client.product.update).toHaveBeenCalledWith({
      where: { id: "product_1" },
      data: expect.objectContaining({
        status: ProductStatus.ARCHIVED,
        deletedAt: expect.any(Date),
      }),
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actor: { connect: { id: "admin_1" } },
        action: "admin.product.archived",
        entityType: "product",
        entityId: "product_1",
      }),
    });
  });
});
