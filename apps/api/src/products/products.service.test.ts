import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, EmailRecipientType, ProductStatus, SellerStatus, VariantStatus } from "@indihub/database";
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
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      productImage: {
        createMany: vi.fn(),
      },
      productVariant: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      hsnMaster: {
        findFirst: vi.fn(),
      },
      setting: {
        findUnique: vi.fn(),
      },
      productReview: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.client.setting.findUnique.mockResolvedValue(null);
    prisma.client.hsnMaster.findFirst.mockResolvedValue(null);
    prisma.client.productImage.createMany.mockResolvedValue({ count: 0 });
    prisma.client.inventoryMovement.create.mockResolvedValue({});
    prisma.client.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma.client),
    );
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

  function publicProductWithStock(condition: string, stockQuantity: number) {
    return {
      id: "product_1",
      slug: "product-1",
      attributes: { ...marketplaceEssentials, condition },
      variants: [
        {
          id: "variant_1",
          status: VariantStatus.ACTIVE,
          stockQuantity,
        },
      ],
    };
  }

  function sellerSubscriptionAllowsProductCreation() {
    return {
      ensureCanCreateProduct: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("keeps new public product details visible when stock is zero", async () => {
    prisma.client.product.findFirst.mockResolvedValue(publicProductWithStock("New", 0));
    const service = new ProductsService(prisma as never, notifications as never);

    await expect(service.getPublicProduct("product-1")).resolves.toMatchObject({
      slug: "product-1",
      attributes: expect.objectContaining({ condition: "New" }),
    });
  });

  it.each(["Used", "Refurbished"])(
    "hides sold %s product details from public storefront",
    async (condition) => {
      prisma.client.product.findFirst.mockResolvedValue(publicProductWithStock(condition, 0));
      const service = new ProductsService(prisma as never, notifications as never);

      await expect(service.getPublicProduct("product-1")).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it("keeps used public product details visible when active stock remains", async () => {
    prisma.client.product.findFirst.mockResolvedValue(publicProductWithStock("Used", 1));
    const service = new ProductsService(prisma as never, notifications as never);

    await expect(service.getPublicProduct("product-1")).resolves.toMatchObject({
      slug: "product-1",
      attributes: expect.objectContaining({ condition: "Used" }),
    });
  });

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
    const service = new ProductsService(
      prisma as never,
      notifications as never,
      sellerSubscriptionAllowsProductCreation() as never,
    );

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

  it("checks seller subscription product limits before creating products", async () => {
    const sellerSubscriptions = {
      ensureCanCreateProduct: vi.fn().mockRejectedValue(
        new ForbiddenException("Your seller plan allows 25 products. Upgrade the subscription plan to add more products."),
      ),
    };
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    const service = new ProductsService(prisma as never, notifications as never, sellerSubscriptions as never);

    await expect(
      service.createSellerProduct(
        { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] },
        {
          categoryId: "category_1",
          name: "Product 26",
          description: "Should be blocked by the seller plan",
          variants: [{ pricePaise: 55000, stockQuantity: 20 }],
        },
      ),
    ).rejects.toThrow("Your seller plan allows 25 products. Upgrade the subscription plan to add more products.");

    expect(sellerSubscriptions.ensureCanCreateProduct).toHaveBeenCalledWith("seller_1");
    expect(prisma.client.category.findFirst).not.toHaveBeenCalled();
    expect(prisma.client.product.create).not.toHaveBeenCalled();
  });

  it("auto approves a valid seller product when the admin product rule is enabled", async () => {
    const createdProduct = {
      id: "product_auto",
      name: "Premium Rice",
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      sellerId: "seller_1",
      categoryId: "category_1",
      seller: {
        userId: "user_seller",
        storeName: "Indi Local",
        user: { email: "seller@example.com" },
      },
    };
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    prisma.client.category.findFirst.mockResolvedValue({
      id: "category_1",
      status: "ACTIVE",
      defaultHsnCode: null,
      defaultGstRatePercent: null,
      productTemplate: null,
    });
    prisma.client.setting.findUnique.mockResolvedValue({ value: true });
    prisma.client.product.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(createdProduct);
    prisma.client.product.create.mockResolvedValue(createdProduct);
    prisma.client.productVariant.findUnique.mockResolvedValue(null);
    prisma.client.productVariant.create.mockResolvedValue({
      id: "variant_1",
      stockQuantity: 20,
    });
    const service = new ProductsService(
      prisma as never,
      notifications as never,
      sellerSubscriptionAllowsProductCreation() as never,
    );

    const result = await service.createSellerProduct(
      { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] },
      {
        categoryId: "category_1",
        name: "Premium Rice",
        description: "High quality local rice",
        attributes: marketplaceEssentials,
        variants: [{ pricePaise: 55000, stockQuantity: 20 }],
      },
    );

    expect(result).toMatchObject({
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    expect(prisma.client.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
      }),
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "product.auto_approved",
        entityType: "product",
        entityId: "product_auto",
        newValue: expect.objectContaining({
          autoApproved: true,
          approvalStatus: ApprovalStatus.APPROVED,
        }),
      }),
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "PRODUCT_APPROVED",
      recipientType: EmailRecipientType.SELLER,
      recipient: "seller@example.com",
      userId: "user_seller",
      variables: {
        productName: "Premium Rice",
        sellerName: "Indi Local",
        note: "Auto approved by marketplace product settings.",
      },
    });
    expect(notifications.notifyAdminEvent).not.toHaveBeenCalled();
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
