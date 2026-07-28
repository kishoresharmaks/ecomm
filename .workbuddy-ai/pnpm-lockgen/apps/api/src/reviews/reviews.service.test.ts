import { BadRequestException } from "@nestjs/common";
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  ProductReviewStatus,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductReviewModerationDecision } from "./dto/moderate-product-review.dto";
import { ReviewsService } from "./reviews.service";

const actor = {
  id: "user_customer",
  clerkUserId: null,
  email: "buyer@example.com",
  roles: [],
};

const adminActor = {
  id: "user_admin",
  clerkUserId: null,
  email: "admin@example.com",
  roles: [],
};

describe("ReviewsService", () => {
  const tx = {
    productReview: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const prisma = {
    client: {
      customer: {
        findUnique: vi.fn(),
      },
      seller: {
        findUnique: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
      },
      orderItem: {
        findUnique: vi.fn(),
      },
      productReview: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      $transaction: vi.fn((callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.client.customer.findUnique.mockResolvedValue({ id: "customer_1", userId: actor.id });
    prisma.client.seller.findUnique.mockResolvedValue({ id: "seller_1", storeName: "Indi Local", slug: "indi-local" });
    prisma.client.productReview.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { _all: 0 } });
    prisma.client.productReview.groupBy.mockResolvedValue([]);
  });

  it("requires a delivered and paid verified purchase before review submission", async () => {
    prisma.client.orderItem.findUnique.mockResolvedValue(
      orderItemWithOrder({
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.DELIVERED,
        deliveryStatus: DeliveryStatus.DELIVERED,
      }),
    );
    const service = new ReviewsService(prisma as never);

    await expect(
      service.submitCustomerReview(actor, { orderItemId: "item_1", rating: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.productReview.create).not.toHaveBeenCalled();
  });

  it("updates an existing customer-product review and resets moderation to pending", async () => {
    prisma.client.orderItem.findUnique.mockResolvedValue(orderItemWithOrder());
    tx.productReview.findUnique.mockResolvedValue(makeReview({ status: ProductReviewStatus.APPROVED }));
    tx.productReview.update.mockResolvedValue(makeReview({ status: ProductReviewStatus.PENDING, rating: 4 }));
    const service = new ReviewsService(prisma as never);

    const result = await service.submitCustomerReview(actor, {
      orderItemId: "item_1",
      rating: 4,
      title: "Updated",
      comment: "Changed after use",
    });

    expect(result).toMatchObject({ status: ProductReviewStatus.PENDING, rating: 4 });
    expect(tx.productReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProductReviewStatus.PENDING,
          publishedAt: null,
          moderatedAt: null,
          moderatedById: null,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "product_review.resubmitted",
        entityType: "product_review",
      }),
    });
  });

  it("keeps public product reviews approved-only and returns approved aggregates", async () => {
    prisma.client.productReview.findMany.mockResolvedValue([makeReview({ status: ProductReviewStatus.APPROVED })]);
    prisma.client.productReview.count.mockResolvedValue(1);
    prisma.client.productReview.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: { _all: 1 } });
    prisma.client.productReview.groupBy.mockResolvedValue([{ rating: 5, _count: { _all: 1 } }]);
    const service = new ReviewsService(prisma as never);

    const result = await service.listPublicProductReviews("product_1", {});

    expect(result.summary).toMatchObject({ averageRating: 5, reviewCount: 1 });
    expect(prisma.client.productReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: "product_1", status: ProductReviewStatus.APPROVED },
      }),
    );
  });

  it("publishes approved reviews and writes an audit log during admin moderation", async () => {
    prisma.client.productReview.findUnique.mockResolvedValue(makeReview({ status: ProductReviewStatus.PENDING }));
    tx.productReview.update.mockResolvedValue(makeReview({ status: ProductReviewStatus.APPROVED, publishedAt: new Date("2026-06-08T08:00:00.000Z") }));
    const service = new ReviewsService(prisma as never);

    const result = await service.moderateReview(adminActor, "review_1", {
      decision: ProductReviewModerationDecision.APPROVE,
      moderationNote: "Verified",
    });

    expect(result.status).toBe(ProductReviewStatus.APPROVED);
    expect(tx.productReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProductReviewStatus.APPROVED,
          moderatedById: adminActor.id,
          publishedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "product_review.approved",
        entityType: "product_review",
        entityId: "review_1",
      }),
    });
  });

  it("filters seller review listing to the authenticated seller only", async () => {
    prisma.client.productReview.findMany.mockResolvedValue([makeReview({ sellerId: "seller_1" })]);
    prisma.client.productReview.count.mockResolvedValue(1);
    const service = new ReviewsService(prisma as never);

    const result = await service.listSellerReviews(
      { ...actor, id: "user_seller" },
      { sellerId: "seller_other", status: ProductReviewStatus.APPROVED },
    );

    expect(result.total).toBe(1);
    expect(prisma.client.productReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sellerId: "seller_1",
          status: ProductReviewStatus.APPROVED,
        }),
      }),
    );
  });
});

function orderItemWithOrder({
  paymentStatus = PaymentStatus.PAID,
  orderStatus = OrderStatus.DELIVERED,
  deliveryStatus = DeliveryStatus.DELIVERED,
}: {
  paymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
  deliveryStatus?: DeliveryStatus;
} = {}) {
  return {
    id: "item_1",
    orderId: "order_1",
    sellerId: "seller_1",
    productId: "product_1",
    productNameSnapshot: "Premium Rice",
    order: {
      id: "order_1",
      customerId: "customer_1",
      orderStatus,
      paymentStatus,
      deliveryStatus,
    },
    product: {
      id: "product_1",
      name: "Premium Rice",
      slug: "premium-rice",
      images: [],
    },
    seller: {
      id: "seller_1",
      storeName: "Indi Local",
      slug: "indi-local",
    },
  };
}

function makeReview(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "review_1",
    productId: "product_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderId: "order_1",
    orderItemId: "item_1",
    rating: 5,
    title: "Good quality",
    comment: "Matched the description.",
    status: ProductReviewStatus.PENDING,
    adminNote: null,
    isVerifiedPurchase: true,
    submittedAt: new Date("2026-06-08T07:00:00.000Z"),
    publishedAt: null,
    moderatedAt: null,
    moderatedById: null,
    createdAt: new Date("2026-06-08T07:00:00.000Z"),
    updatedAt: new Date("2026-06-08T07:00:00.000Z"),
    product: {
      id: "product_1",
      name: "Premium Rice",
      slug: "premium-rice",
      images: [{ url: "asset://rice.png", altText: "Rice", isPrimary: true, sortOrder: 0 }],
    },
    seller: {
      id: "seller_1",
      storeName: "Indi Local",
      slug: "indi-local",
    },
    customer: {
      id: "customer_1",
      displayName: "Buyer",
      user: {
        fullName: "Buyer Name",
        email: "buyer@example.com",
        phone: "9999999999",
      },
    },
    order: {
      id: "order_1",
      orderNumber: "ORD-1",
      createdAt: new Date("2026-06-08T06:00:00.000Z"),
    },
    orderItem: {
      id: "item_1",
      productNameSnapshot: "Premium Rice",
      createdAt: new Date("2026-06-08T06:00:00.000Z"),
    },
    moderatedBy: null,
    ...overrides,
  };
}
