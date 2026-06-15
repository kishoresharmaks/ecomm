import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DeliveryStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductReviewStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  ModerateProductReviewDto,
  ProductReviewModerationDecision,
} from "./dto/moderate-product-review.dto";
import { PublicProductReviewQueryDto, ReviewListQueryDto } from "./dto/review-query.dto";
import { SubmitProductReviewDto } from "./dto/submit-product-review.dto";

const reviewProductSelect = {
  id: true,
  name: true,
  slug: true,
  images: {
    select: {
      url: true,
      altText: true,
      isPrimary: true,
      sortOrder: true,
    },
    orderBy: [
      { isPrimary: "desc" as const },
      { sortOrder: "asc" as const },
      { createdAt: "asc" as const },
    ],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const reviewInclude = {
  product: {
    select: reviewProductSelect,
  },
  seller: {
    select: {
      id: true,
      storeName: true,
      slug: true,
    },
  },
  customer: {
    select: {
      id: true,
      displayName: true,
      user: {
        select: {
          fullName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
    },
  },
  orderItem: {
    select: {
      id: true,
      productNameSnapshot: true,
      createdAt: true,
    },
  },
  moderatedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
} satisfies Prisma.ProductReviewInclude;

type ReviewRecord = Prisma.ProductReviewGetPayload<{ include: typeof reviewInclude }>;

type ReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublicProductReviews(productId: string, query: PublicProductReviewQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 10, maxLimit: 50 });
    const where: Prisma.ProductReviewWhereInput = {
      productId,
      status: ProductReviewStatus.APPROVED,
    };

    const [items, total, summary] = await Promise.all([
      this.prisma.client.productReview.findMany({
        where,
        include: reviewInclude,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.productReview.count({ where }),
      this.getApprovedReviewSummary({ productId }),
    ]);

    return {
      items: items.map((review) => this.toPublicReview(review)),
      summary,
      total,
      page,
      limit: take,
    };
  }

  async getPublicProductReviewSummary(productId: string) {
    return this.getApprovedReviewSummary({ productId });
  }

  async getCustomerOrderReviewOptions(actor: RequestUser, orderNumber: string) {
    const customer = await this.getCustomerOrThrow(actor);
    const order = await this.prisma.client.order.findFirst({
      where: {
        orderNumber,
        customerId: customer.id,
      },
      include: {
        items: {
          include: {
            product: {
              select: reviewProductSelect,
            },
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    const productIds = [...new Set(order.items.map((item) => item.productId))];
    const existingReviews = productIds.length
      ? await this.prisma.client.productReview.findMany({
          where: {
            customerId: customer.id,
            productId: { in: productIds },
          },
          include: reviewInclude,
        })
      : [];
    const reviewByProductId = new Map(existingReviews.map((review) => [review.productId, review]));
    const eligible = this.isOrderReviewEligible(order);
    const reason = eligible ? null : this.reviewEligibilityReason(order);

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      eligible,
      reason,
      items: order.items.map((item) => {
        const existingReview = reviewByProductId.get(item.productId);
        return {
          orderItemId: item.id,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                imageUrl: item.product.images[0]?.url ?? null,
              }
            : null,
          seller: item.seller
            ? {
                id: item.seller.id,
                storeName: item.seller.storeName,
                slug: item.seller.slug,
              }
            : null,
          eligible,
          reason,
          existingReview: existingReview ? this.toCustomerReview(existingReview) : null,
        };
      }),
    };
  }

  async submitCustomerReview(actor: RequestUser, dto: SubmitProductReviewDto) {
    const customer = await this.getCustomerOrThrow(actor);
    const orderItem = await this.prisma.client.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: {
        order: true,
        product: {
          select: reviewProductSelect,
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
          },
        },
      },
    });

    if (!orderItem || orderItem.order.customerId !== customer.id) {
      throw new NotFoundException("Order item not found.");
    }

    if (!this.isOrderReviewEligible(orderItem.order)) {
      throw new BadRequestException(this.reviewEligibilityReason(orderItem.order));
    }

    const title = this.cleanText(dto.title);
    const comment = this.cleanText(dto.comment);
    const now = new Date();

    const review = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.productReview.findUnique({
        where: {
          customerId_productId: {
            customerId: customer.id,
            productId: orderItem.productId,
          },
        },
      });

      const savedReview = existing
        ? await tx.productReview.update({
            where: { id: existing.id },
            data: {
              orderId: orderItem.orderId,
              orderItemId: orderItem.id,
              sellerId: orderItem.sellerId,
              rating: dto.rating,
              title,
              comment,
              status: ProductReviewStatus.PENDING,
              adminNote: null,
              submittedAt: now,
              publishedAt: null,
              moderatedAt: null,
              moderatedById: null,
              isVerifiedPurchase: true,
            },
            include: reviewInclude,
          })
        : await tx.productReview.create({
            data: {
              productId: orderItem.productId,
              sellerId: orderItem.sellerId,
              customerId: customer.id,
              orderId: orderItem.orderId,
              orderItemId: orderItem.id,
              rating: dto.rating,
              title,
              comment,
              status: ProductReviewStatus.PENDING,
              isVerifiedPurchase: true,
              submittedAt: now,
            },
            include: reviewInclude,
          });

      const auditData: Prisma.AuditLogUncheckedCreateInput = {
        actorUserId: actor.id,
        action: existing ? "product_review.resubmitted" : "product_review.submitted",
        entityType: "product_review",
        entityId: savedReview.id,
        newValue: {
          status: savedReview.status,
          rating: savedReview.rating,
          title: savedReview.title,
          productId: savedReview.productId,
          sellerId: savedReview.sellerId,
          orderId: savedReview.orderId,
          orderItemId: savedReview.orderItemId,
        },
      };
      if (existing) {
        auditData.oldValue = {
          status: existing.status,
          rating: existing.rating,
          title: existing.title,
        };
      }

      await tx.auditLog.create({ data: auditData });

      return savedReview;
    });

    return this.toCustomerReview(review);
  }

  async listAdminReviews(query: ReviewListQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const where = this.reviewListWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.client.productReview.findMany({
        where,
        include: reviewInclude,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.productReview.count({ where }),
    ]);

    return {
      items: items.map((review) => this.toAdminReview(review)),
      total,
      page,
      limit: take,
    };
  }

  async moderateReview(actor: RequestUser, reviewId: string, dto: ModerateProductReviewDto) {
    const existing = await this.prisma.client.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!existing) {
      throw new NotFoundException("Review not found.");
    }

    const status = this.statusFromModerationDecision(dto.decision);
    const now = new Date();
    const adminNote = this.cleanText(dto.moderationNote);

    const review = await this.prisma.client.$transaction(async (tx) => {
      const savedReview = await tx.productReview.update({
        where: { id: reviewId },
        data: {
          status,
          adminNote,
          moderatedAt: now,
          moderatedById: actor.id,
          publishedAt: status === ProductReviewStatus.APPROVED ? now : null,
        },
        include: reviewInclude,
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: `product_review.${status.toLowerCase()}`,
          entityType: "product_review",
          entityId: savedReview.id,
          oldValue: {
            status: existing.status,
            adminNote: existing.adminNote,
            publishedAt: existing.publishedAt,
          },
          newValue: {
            status: savedReview.status,
            adminNote: savedReview.adminNote,
            publishedAt: savedReview.publishedAt,
          },
        },
      });

      return savedReview;
    });

    return this.toAdminReview(review);
  }

  async listSellerReviews(actor: RequestUser, query: ReviewListQueryDto) {
    const seller = await this.getSellerOrThrow(actor);
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const where = this.reviewListWhere({ ...query, sellerId: seller.id });
    const [items, total] = await Promise.all([
      this.prisma.client.productReview.findMany({
        where,
        include: reviewInclude,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.productReview.count({ where }),
    ]);

    return {
      items: items.map((review) => this.toSellerReview(review)),
      total,
      page,
      limit: take,
    };
  }

  async getSellerReviewSummary(actor: RequestUser) {
    const seller = await this.getSellerOrThrow(actor);
    const [summary, statusCounts] = await Promise.all([
      this.getApprovedReviewSummary({ sellerId: seller.id }),
      this.prisma.client.productReview.groupBy({
        by: ["status"],
        where: { sellerId: seller.id },
        _count: { _all: true },
      }),
    ]);

    return {
      seller: {
        id: seller.id,
        storeName: seller.storeName,
        slug: seller.slug,
      },
      summary,
      statusCounts: statusCounts.reduce(
        (counts, row) => ({
          ...counts,
          [row.status]: row._count._all,
        }),
        {
          PENDING: 0,
          APPROVED: 0,
          REJECTED: 0,
          HIDDEN: 0,
        } satisfies Record<ProductReviewStatus, number>,
      ),
    };
  }

  private async getApprovedReviewSummary(where: Omit<Prisma.ProductReviewWhereInput, "status">) {
    const approvedWhere: Prisma.ProductReviewWhereInput = {
      ...where,
      status: ProductReviewStatus.APPROVED,
    };
    const [aggregate, distributionRows] = await Promise.all([
      this.prisma.client.productReview.aggregate({
        where: approvedWhere,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.client.productReview.groupBy({
        by: ["rating"],
        where: approvedWhere,
        _count: { _all: true },
      }),
    ]);

    const summary = this.emptySummary();
    summary.reviewCount = aggregate._count._all;
    summary.averageRating =
      aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10;
    for (const row of distributionRows) {
      if (row.rating >= 1 && row.rating <= 5) {
        summary.distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
      }
    }

    return summary;
  }

  private reviewListWhere(query: ReviewListQueryDto): Prisma.ProductReviewWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { comment: { contains: search, mode: "insensitive" } },
              { product: { name: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
              { customer: { displayName: { contains: search, mode: "insensitive" } } },
              { order: { orderNumber: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private async getCustomerOrThrow(actor: RequestUser) {
    const customer = await this.prisma.client.customer.findUnique({
      where: { userId: actor.id },
    });

    if (!customer) {
      throw new ForbiddenException("Customer account is required.");
    }

    return customer;
  }

  private async getSellerOrThrow(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        storeName: true,
        slug: true,
      },
    });

    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }

    return seller;
  }

  private isOrderReviewEligible(order: {
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    deliveryStatus: DeliveryStatus;
  }) {
    return (
      order.paymentStatus === PaymentStatus.PAID &&
      (order.orderStatus === OrderStatus.DELIVERED || order.deliveryStatus === DeliveryStatus.DELIVERED)
    );
  }

  private reviewEligibilityReason(order: {
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    deliveryStatus: DeliveryStatus;
  }) {
    if (order.paymentStatus !== PaymentStatus.PAID) {
      return "Reviews are available only after the order payment is marked paid.";
    }
    if (order.orderStatus !== OrderStatus.DELIVERED && order.deliveryStatus !== DeliveryStatus.DELIVERED) {
      return "Reviews are available only after the order is delivered.";
    }
    return "This order is not eligible for review.";
  }

  private statusFromModerationDecision(decision: ProductReviewModerationDecision) {
    if (decision === ProductReviewModerationDecision.APPROVE) {
      return ProductReviewStatus.APPROVED;
    }
    if (decision === ProductReviewModerationDecision.REJECT) {
      return ProductReviewStatus.REJECTED;
    }
    return ProductReviewStatus.HIDDEN;
  }

  private cleanText(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private emptySummary(): ReviewSummary {
    return {
      averageRating: null,
      reviewCount: 0,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };
  }

  private safeCustomerName(review: ReviewRecord) {
    return review.customer.displayName || review.customer.user.fullName || "Verified buyer";
  }

  private productImageUrl(review: ReviewRecord) {
    return review.product.images[0]?.url ?? null;
  }

  private toPublicReview(review: ReviewRecord) {
    return {
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      isVerifiedPurchase: review.isVerifiedPurchase,
      publishedAt: review.publishedAt,
      createdAt: review.createdAt,
      customer: {
        displayName: this.safeCustomerName(review),
      },
    };
  }

  private toCustomerReview(review: ReviewRecord) {
    return {
      id: review.id,
      productId: review.productId,
      sellerId: review.sellerId,
      orderId: review.orderId,
      orderItemId: review.orderItemId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      adminNote: review.adminNote,
      isVerifiedPurchase: review.isVerifiedPurchase,
      submittedAt: review.submittedAt,
      publishedAt: review.publishedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      product: {
        id: review.product.id,
        name: review.product.name,
        slug: review.product.slug,
        imageUrl: this.productImageUrl(review),
      },
      seller: {
        id: review.seller.id,
        storeName: review.seller.storeName,
        slug: review.seller.slug,
      },
    };
  }

  private toAdminReview(review: ReviewRecord) {
    return {
      ...this.toCustomerReview(review),
      customer: {
        id: review.customer.id,
        displayName: this.safeCustomerName(review),
        email: review.customer.user.email,
        phone: review.customer.user.phone,
      },
      order: {
        id: review.order.id,
        orderNumber: review.order.orderNumber,
        createdAt: review.order.createdAt,
      },
      orderItem: {
        id: review.orderItem.id,
        productNameSnapshot: review.orderItem.productNameSnapshot,
      },
      moderatedAt: review.moderatedAt,
      moderatedBy: review.moderatedBy
        ? {
            id: review.moderatedBy.id,
            fullName: review.moderatedBy.fullName,
            email: review.moderatedBy.email,
          }
        : null,
    };
  }

  private toSellerReview(review: ReviewRecord) {
    return {
      id: review.id,
      productId: review.productId,
      orderItemId: review.orderItemId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      isVerifiedPurchase: review.isVerifiedPurchase,
      submittedAt: review.submittedAt,
      publishedAt: review.publishedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      product: {
        id: review.product.id,
        name: review.product.name,
        slug: review.product.slug,
        imageUrl: this.productImageUrl(review),
      },
      customer: {
        displayName: this.safeCustomerName(review),
      },
      order: {
        orderNumber: review.order.orderNumber,
        createdAt: review.order.createdAt,
      },
      orderItem: {
        id: review.orderItem.id,
        productNameSnapshot: review.orderItem.productNameSnapshot,
      },
    };
  }
}
