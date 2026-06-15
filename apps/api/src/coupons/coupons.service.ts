import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalStatus,
  CouponAdjustmentReason,
  CouponDiscountType,
  CouponFundingSource,
  CouponRedemptionStatus,
  CouponSellerParticipationStatus,
  CouponStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductListingMode,
  ProductStatus,
  SellerStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { CouponQueryDto, CreateCouponDto, SellerCouponQueryDto, UpdateCouponDto } from "./dto/coupon.dto";

type CouponClient = Prisma.TransactionClient | PrismaService["client"];

const couponInclude = {
  sellerEligibilities: {
    include: {
      seller: {
        include: {
          user: true,
          profile: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  productEligibilities: {
    include: {
      product: {
        include: {
          seller: true,
          category: true,
          images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  categoryEligibilities: {
    include: {
      category: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  customerEligibilities: {
    include: {
      customer: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  sellerParticipations: {
    include: {
      seller: {
        include: {
          user: true,
          profile: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" as const },
  },
  usageCounter: true,
  _count: {
    select: {
      redemptions: true,
      orders: true,
    },
  },
} satisfies Prisma.CouponInclude;

type CouponRecord = Prisma.CouponGetPayload<{ include: typeof couponInclude }>;
type CouponUsageCounterRecord = {
  couponId: string;
  usedCount: number;
  discountPaise: number;
  platformFundedDiscountPaise: number;
  sellerFundedDiscountPaise: number;
  version: number;
  updatedAt: Date;
};
type CouponCacheEntry = { coupon: CouponRecord; expiresAt: number };

type CouponNormalizeInput = {
  code: string;
  title: string;
  description?: string | null | undefined;
  discountType: CouponDiscountType;
  fundingSource: CouponFundingSource;
  discountValueBps?: number | null | undefined;
  discountAmountPaise?: number | null | undefined;
  maxDiscountPaise?: number | null | undefined;
  minSubtotalPaise?: number | null | undefined;
  maxSubtotalPaise?: number | null | undefined;
  totalUsageLimit?: number | null | undefined;
  perCustomerLimit?: number | null | undefined;
  firstOrderOnly?: boolean | undefined;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
  internalNote?: string | null | undefined;
  sellerIds?: string[] | undefined;
  productIds?: string[] | undefined;
  categoryIds?: string[] | undefined;
  customerIds?: string[] | undefined;
};

export type CouponCheckoutItem = {
  key: string;
  sellerId: string;
  productId: string;
  categoryId: string;
  quantity: number;
  lineTotalPaise: number;
  productName?: string | null;
};

export type CouponCheckoutInput = {
  couponCode?: string | null;
  customerId: string;
  items: CouponCheckoutItem[];
  subtotalPaise: number;
  shippingPaise: number;
  shippingSnapshot?: Prisma.InputJsonValue | null;
  currency: string;
};

export type CouponItemAllocation = {
  key: string;
  sellerId: string;
  productId: string;
  categoryId: string;
  lineTotalPaise: number;
  discountPaise: number;
  platformFundedDiscountPaise: number;
  sellerFundedDiscountPaise: number;
};

export type CouponSellerAllocation = {
  sellerId: string;
  merchandiseDiscountPaise: number;
  shippingDiscountPaise: number;
  discountPaise: number;
  platformFundedDiscountPaise: number;
  sellerFundedDiscountPaise: number;
};

export type CouponEvaluationResult = {
  couponId: string;
  code: string;
  title: string;
  description: string | null;
  discountType: CouponDiscountType;
  fundingSource: CouponFundingSource;
  merchandiseBasisPaise: number;
  shippingBasisPaise: number;
  merchandiseDiscountPaise: number;
  shippingDiscountPaise: number;
  discountPaise: number;
  platformFundedDiscountPaise: number;
  sellerFundedDiscountPaise: number;
  itemAllocations: CouponItemAllocation[];
  sellerAllocations: CouponSellerAllocation[];
  snapshot: Prisma.InputJsonObject;
};

@Injectable()
export class CouponsService {
  private readonly validationBuckets = new Map<string, { count: number; resetAt: number }>();
  private readonly couponMetadataCache = new Map<string, CouponCacheEntry>();
  private readonly couponMetadataCacheTtlMs = 30_000;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAdminCoupons(query: CouponQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const search = query.search?.trim();
    const where: Prisma.CouponWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.fundingSource ? { fundingSource: query.fundingSource } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: this.normalizeCodeLoose(search), mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total, statusGroups, usageRows] = await Promise.all([
      this.prisma.client.coupon.findMany({
        where,
        include: couponInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.coupon.count({ where }),
      this.prisma.client.coupon.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.client.coupon.findMany({
        select: {
          redeemedCount: true,
          usageCounter: {
            select: { usedCount: true },
          },
        },
      }),
    ]);
    const statusCounts = new Map(
      statusGroups.map((item) => [item.status, item._count._all]),
    );
    const stats = {
      total: statusGroups.reduce((sum, item) => sum + item._count._all, 0),
      active: statusCounts.get(CouponStatus.ACTIVE) ?? 0,
      scheduled: statusCounts.get(CouponStatus.DRAFT) ?? 0,
      paused: statusCounts.get(CouponStatus.PAUSED) ?? 0,
      archived: statusCounts.get(CouponStatus.ARCHIVED) ?? 0,
      redeemed: usageRows.reduce(
        (sum, coupon) => sum + (coupon.usageCounter?.usedCount ?? coupon.redeemedCount),
        0,
      ),
    };

    return {
      items: items.map((coupon) => this.withUsageCounterReadback(coupon)),
      total,
      page,
      limit: take,
      stats,
    };
  }

  async createCoupon(actor: RequestUser, dto: CreateCouponDto) {
    const normalized = await this.normalizeCouponData(dto, this.prisma.client);
    try {
      const coupon = await this.prisma.client.$transaction(async (tx) => {
        const created = await tx.coupon.create({
          data: {
            code: normalized.code,
            title: normalized.title,
            description: normalized.description,
            discountType: normalized.discountType,
            fundingSource: normalized.fundingSource,
            discountValueBps: normalized.discountValueBps,
            discountAmountPaise: normalized.discountAmountPaise,
            maxDiscountPaise: normalized.maxDiscountPaise,
            minSubtotalPaise: normalized.minSubtotalPaise,
            maxSubtotalPaise: normalized.maxSubtotalPaise,
            totalUsageLimit: normalized.totalUsageLimit,
            perCustomerLimit: normalized.perCustomerLimit,
            isMarketplaceWide: normalized.isMarketplaceWide,
            firstOrderOnly: normalized.firstOrderOnly,
            startsAt: normalized.startsAt,
            endsAt: normalized.endsAt,
            internalNote: normalized.internalNote,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });

        await this.replaceEligibility(tx, created.id, normalized);
        await this.ensureSellerParticipations(tx, created.id, normalized);
        await tx.couponUsageCounter.create({
          data: { couponId: created.id },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: "coupon.created",
            entityType: "coupon",
            entityId: created.id,
            newValue: this.auditValue(created, normalized),
          },
        });

        return created;
      });

      this.clearCouponCache(coupon.code);
      return this.getAdminCoupon(coupon.id);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("Coupon code already exists.");
      }
      throw error;
    }
  }

  async getAdminCoupon(couponId: string) {
    const coupon = await this.prisma.client.coupon.findUnique({
      where: { id: couponId },
      include: couponInclude,
    });
    if (!coupon) {
      throw new NotFoundException("Coupon not found.");
    }
    return this.withUsageCounterReadback(coupon);
  }

  async updateCoupon(actor: RequestUser, couponId: string, dto: UpdateCouponDto) {
    const existing = await this.getAdminCoupon(couponId);
    this.assertUpdateAllowed(existing, dto);
    const merged = await this.normalizeCouponData(
      {
        code: dto.code ?? existing.code,
        title: dto.title ?? existing.title,
        description: dto.description ?? existing.description ?? undefined,
        discountType: dto.discountType ?? existing.discountType,
        fundingSource: dto.fundingSource ?? existing.fundingSource,
        discountValueBps: dto.discountValueBps ?? existing.discountValueBps ?? undefined,
        discountAmountPaise: dto.discountAmountPaise ?? existing.discountAmountPaise ?? undefined,
        maxDiscountPaise:
          dto.maxDiscountPaise ?? existing.maxDiscountPaise ?? undefined,
        minSubtotalPaise:
          dto.minSubtotalPaise ?? existing.minSubtotalPaise ?? undefined,
        maxSubtotalPaise:
          dto.maxSubtotalPaise ?? existing.maxSubtotalPaise ?? undefined,
        totalUsageLimit:
          dto.totalUsageLimit ?? existing.totalUsageLimit ?? undefined,
        perCustomerLimit:
          dto.perCustomerLimit ?? existing.perCustomerLimit ?? undefined,
        firstOrderOnly: dto.firstOrderOnly ?? existing.firstOrderOnly,
        startsAt: dto.startsAt ?? existing.startsAt?.toISOString(),
        endsAt: dto.endsAt ?? existing.endsAt?.toISOString(),
        internalNote: dto.internalNote ?? existing.internalNote ?? undefined,
        sellerIds:
          dto.sellerIds ??
          existing.sellerEligibilities.map((eligibility) => eligibility.sellerId),
        productIds:
          dto.productIds ??
          existing.productEligibilities.map((eligibility) => eligibility.productId),
        categoryIds:
          dto.categoryIds ??
          existing.categoryEligibilities.map((eligibility) => eligibility.categoryId),
        customerIds:
          dto.customerIds ??
          existing.customerEligibilities.map((eligibility) => eligibility.customerId),
      },
      this.prisma.client,
    );

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const updated = await tx.coupon.update({
          where: { id: couponId },
          data: {
            code: merged.code,
            title: merged.title,
            description: merged.description,
            discountType: merged.discountType,
            fundingSource: merged.fundingSource,
            discountValueBps: merged.discountValueBps,
            discountAmountPaise: merged.discountAmountPaise,
            maxDiscountPaise: merged.maxDiscountPaise,
            minSubtotalPaise: merged.minSubtotalPaise,
            maxSubtotalPaise: merged.maxSubtotalPaise,
            totalUsageLimit: merged.totalUsageLimit,
            perCustomerLimit: merged.perCustomerLimit,
            isMarketplaceWide: merged.isMarketplaceWide,
            firstOrderOnly: merged.firstOrderOnly,
            startsAt: merged.startsAt,
            endsAt: merged.endsAt,
            internalNote: merged.internalNote,
            updatedById: actor.id,
          },
        });

        await this.replaceEligibility(tx, updated.id, merged);
        await this.ensureSellerParticipations(tx, updated.id, merged);
        await tx.couponUsageCounter.upsert({
          where: { couponId: updated.id },
          create: { couponId: updated.id },
          update: {},
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: "coupon.updated",
            entityType: "coupon",
            entityId: updated.id,
            oldValue: this.compactCouponAudit(existing),
            newValue: this.auditValue(updated, merged),
          },
        });
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException("Coupon code already exists.");
      }
      throw error;
    }

    this.clearCouponCache(existing.code);
    if (dto.code && this.normalizeCodeLoose(dto.code) !== existing.code) {
      this.clearCouponCache(dto.code);
    }
    return this.getAdminCoupon(couponId);
  }

  async activateCoupon(actor: RequestUser, couponId: string) {
    return this.lifecycle(actor, couponId, CouponStatus.ACTIVE, "coupon.activated", {
      activatedAt: new Date(),
      pausedAt: null,
    });
  }

  async pauseCoupon(actor: RequestUser, couponId: string) {
    return this.lifecycle(actor, couponId, CouponStatus.PAUSED, "coupon.paused", {
      pausedAt: new Date(),
    });
  }

  async archiveCoupon(actor: RequestUser, couponId: string) {
    return this.lifecycle(actor, couponId, CouponStatus.ARCHIVED, "coupon.archived", {
      archivedAt: new Date(),
    });
  }

  async listRedemptions(couponId: string, query: CouponQueryDto) {
    await this.getCouponOrThrow(couponId);
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const cursor = query.cursor?.trim();
    const [items, total] = await Promise.all([
      this.prisma.client.couponRedemption.findMany({
        where: { couponId },
        include: {
          order: true,
          customer: { include: { user: true } },
          adjustments: { orderBy: { createdAt: "desc" } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip }),
        take,
      }),
      this.prisma.client.couponRedemption.count({ where: { couponId } }),
    ]);

    return {
      items,
      total,
      page,
      limit: take,
      nextCursor: items.length === take ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async listSellerCoupons(actor: RequestUser, query: SellerCouponQueryDto) {
    const seller = await this.resolveSeller(actor);
    const where: Prisma.CouponSellerParticipationWhereInput = {
      sellerId: seller.id,
      ...(query.participationStatus ? { status: query.participationStatus } : {}),
    };
    const participations = await this.prisma.client.couponSellerParticipation.findMany({
      where,
      include: {
        coupon: {
          include: {
            sellerEligibilities: true,
            productEligibilities: true,
            categoryEligibilities: true,
            redemptions: {
              where: {
                order: {
                  sellerSplits: {
                    some: { sellerId: seller.id },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 25,
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    return { items: participations };
  }

  async acceptSellerCoupon(actor: RequestUser, couponId: string) {
    const seller = await this.resolveApprovedSeller(actor);
    return this.sellerDecision(actor, seller.id, couponId, CouponSellerParticipationStatus.ACCEPTED);
  }

  async declineSellerCoupon(actor: RequestUser, couponId: string) {
    const seller = await this.resolveSeller(actor);
    return this.sellerDecision(actor, seller.id, couponId, CouponSellerParticipationStatus.DECLINED);
  }

  async previewCoupon(actor: RequestUser, input: CouponCheckoutInput) {
    if (!input.couponCode?.trim()) {
      return null;
    }
    this.assertPreviewRateLimit(actor, input.couponCode);
    try {
      return await this.evaluateCoupon(input, this.prisma.client, { lockRows: false });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw new BadRequestException("Coupon cannot be applied to this order.");
      }
      throw error;
    }
  }

  async reserveCouponForOrder(input: CouponCheckoutInput, tx: Prisma.TransactionClient) {
    if (!input.couponCode?.trim()) {
      return null;
    }
    return this.evaluateCoupon(input, tx, { lockRows: true });
  }

  async recordRedemption(
    tx: Prisma.TransactionClient,
    orderId: string,
    customerId: string,
    currency: string,
    result: CouponEvaluationResult | null,
  ) {
    if (!result) {
      return null;
    }

    await this.incrementUsageCounter(tx, result);

    await tx.couponSellerParticipation.updateMany({
      where: {
        couponId: result.couponId,
        sellerId: { in: result.sellerAllocations.map((item) => item.sellerId) },
        status: CouponSellerParticipationStatus.ACCEPTED,
        lockedAt: null,
      },
      data: { lockedAt: new Date() },
    });

    return tx.couponRedemption.create({
      data: {
        couponId: result.couponId,
        orderId,
        customerId,
        codeSnapshot: result.code,
        titleSnapshot: result.title,
        discountTypeSnapshot: result.discountType,
        fundingSourceSnapshot: result.fundingSource,
        merchandiseBasisPaise: result.merchandiseBasisPaise,
        shippingBasisPaise: result.shippingBasisPaise,
        merchandiseDiscountPaise: result.merchandiseDiscountPaise,
        shippingDiscountPaise: result.shippingDiscountPaise,
        discountPaise: result.discountPaise,
        platformFundedDiscountPaise: result.platformFundedDiscountPaise,
        sellerFundedDiscountPaise: result.sellerFundedDiscountPaise,
        currency,
        snapshot: result.snapshot,
      },
    });
  }

  async recordOrderCancellationAdjustment(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      paymentStatus: PaymentStatus;
      deliveryStatus: string;
      couponDiscountPaise: number;
      couponMerchandiseDiscountPaise: number;
      couponShippingDiscountPaise: number;
      couponSellerFundedDiscountPaise: number;
      couponPlatformFundedDiscountPaise: number;
    },
    actor: RequestUser,
    note?: string | null,
  ) {
    if (order.couponDiscountPaise <= 0) {
      return;
    }
    const redemption = await tx.couponRedemption.findUnique({
      where: { orderId: order.id },
    });
    if (!redemption || redemption.status === CouponRedemptionStatus.FULLY_REVERSED) {
      return;
    }

    const fullPrePaymentReversal = order.paymentStatus === PaymentStatus.PENDING;
    const status = fullPrePaymentReversal
      ? CouponRedemptionStatus.FULLY_REVERSED
      : CouponRedemptionStatus.PARTIALLY_ADJUSTED;
    await tx.couponRedemptionAdjustment.create({
      data: {
        couponRedemptionId: redemption.id,
        orderId: order.id,
        reason: CouponAdjustmentReason.ORDER_CANCELLED,
        discountReversedPaise: order.couponDiscountPaise,
        merchandiseDiscountReversedPaise: order.couponMerchandiseDiscountPaise,
        shippingDiscountReversedPaise: order.couponShippingDiscountPaise,
        note:
          note ??
          (fullPrePaymentReversal
            ? "Unpaid order cancelled before fulfilment. Coupon usage released."
            : "Paid order cancelled. Coupon reversal recorded for refund workflow."),
        createdById: actor.id,
      },
    });

    await tx.couponRedemption.update({
      where: { id: redemption.id },
      data: {
        status,
        adjustmentPaise: {
          increment: order.couponDiscountPaise,
        },
        ...(fullPrePaymentReversal ? { reversedAt: new Date() } : {}),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        couponAdjustmentPaise: {
          increment: order.couponDiscountPaise,
        },
      },
    });

    if (fullPrePaymentReversal) {
      await this.decrementUsageCounter(tx, redemption.couponId, {
        discountPaise: order.couponDiscountPaise,
        platformFundedDiscountPaise: order.couponPlatformFundedDiscountPaise,
        sellerFundedDiscountPaise: order.couponSellerFundedDiscountPaise,
      });
    }
  }

  publicReadback(result: CouponEvaluationResult | null) {
    if (!result) {
      return null;
    }

    return {
      couponId: result.couponId,
      code: result.code,
      title: result.title,
      description: result.description,
      discountType: result.discountType,
      fundingSource: result.fundingSource,
      merchandiseBasisPaise: result.merchandiseBasisPaise,
      shippingBasisPaise: result.shippingBasisPaise,
      merchandiseDiscountPaise: result.merchandiseDiscountPaise,
      shippingDiscountPaise: result.shippingDiscountPaise,
      discountPaise: result.discountPaise,
      platformFundedDiscountPaise: result.platformFundedDiscountPaise,
      sellerFundedDiscountPaise: result.sellerFundedDiscountPaise,
    };
  }

  itemAllocation(result: CouponEvaluationResult | null, key: string) {
    return result?.itemAllocations.find((item) => item.key === key) ?? null;
  }

  sellerAllocation(result: CouponEvaluationResult | null, sellerId: string) {
    return result?.sellerAllocations.find((item) => item.sellerId === sellerId) ?? null;
  }

  private async lifecycle(
    actor: RequestUser,
    couponId: string,
    status: CouponStatus,
    action: string,
    extra: Prisma.CouponUncheckedUpdateInput,
  ) {
    const existing = await this.getAdminCoupon(couponId);
    if (existing.status === CouponStatus.ARCHIVED && status !== CouponStatus.ARCHIVED) {
      throw new BadRequestException("Archived coupons cannot be reactivated.");
    }
    if (status === CouponStatus.ACTIVE) {
      this.assertCouponCanActivate(existing);
    }
    const coupon = await this.prisma.client.coupon.update({
      where: { id: couponId },
      data: {
        status,
        updatedById: actor.id,
        ...extra,
      },
      include: couponInclude,
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action,
        entityType: "coupon",
        entityId: coupon.id,
        oldValue: { status: existing.status },
        newValue: { status: coupon.status },
      },
    });

    this.clearCouponCache(existing.code);
    return this.withUsageCounterReadback(coupon);
  }

  private async evaluateCoupon(
    input: CouponCheckoutInput,
    client: CouponClient,
    options: { lockRows: boolean },
  ): Promise<CouponEvaluationResult> {
    const code = this.normalizeCode(input.couponCode ?? "");
    const coupon = await this.getCouponForEvaluation(code, client, !options.lockRows);
    if (!coupon) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }
    this.assertCouponCurrentlyValid(coupon);

    let usageCounter: CouponUsageCounterRecord | null = null;
    if (options.lockRows && coupon.totalUsageLimit !== null) {
      usageCounter = await this.lockUsageCounter(client, coupon.id);
    } else if (coupon.totalUsageLimit !== null) {
      usageCounter = await this.readUsageCounter(client, coupon.id);
    }
    if (options.lockRows && (coupon.perCustomerLimit !== null || coupon.firstOrderOnly)) {
      await this.lockCustomerForCouponChecks(client, input.customerId);
    }

    await this.assertUsageAllowed(coupon, input.customerId, client, usageCounter);
    await this.assertFirstOrderAllowed(coupon, input.customerId, client);

    const eligibleItems = await this.eligibleCheckoutItems(
      coupon,
      input.customerId,
      input.items,
      client,
    );
    const merchandiseBasisPaise = eligibleItems.reduce(
      (total, item) => total + this.nonNegativeInt(item.lineTotalPaise),
      0,
    );
    if (merchandiseBasisPaise <= 0) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }
    if (coupon.minSubtotalPaise !== null && merchandiseBasisPaise < coupon.minSubtotalPaise) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }
    if (coupon.maxSubtotalPaise !== null && merchandiseBasisPaise > coupon.maxSubtotalPaise) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }

    const shippingBasisPaise =
      coupon.discountType === CouponDiscountType.FREE_SHIPPING
        ? this.eligibleShippingBasis(input, eligibleItems)
        : 0;
    const merchandiseDiscountPaise = this.merchandiseDiscount(coupon, merchandiseBasisPaise);
    const shippingDiscountPaise =
      coupon.discountType === CouponDiscountType.FREE_SHIPPING ? shippingBasisPaise : 0;
    const itemAllocations = this.allocateItems(
      coupon,
      eligibleItems,
      merchandiseDiscountPaise,
    );
    const sellerAllocations = this.allocateSellers(
      coupon,
      itemAllocations,
      shippingDiscountPaise,
      input.shippingSnapshot,
    );
    const platformFundedDiscountPaise = sellerAllocations.reduce(
      (total, item) => total + item.platformFundedDiscountPaise,
      0,
    );
    const sellerFundedDiscountPaise = sellerAllocations.reduce(
      (total, item) => total + item.sellerFundedDiscountPaise,
      0,
    );
    const discountPaise = merchandiseDiscountPaise + shippingDiscountPaise;
    if (discountPaise <= 0) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }

    const snapshot = {
      couponId: coupon.id,
      code: coupon.code,
      title: coupon.title,
      discountType: coupon.discountType,
      fundingSource: coupon.fundingSource,
      discountValueBps: coupon.discountValueBps,
      discountAmountPaise: coupon.discountAmountPaise,
      maxDiscountPaise:
        coupon.discountType === CouponDiscountType.FREE_SHIPPING
          ? null
          : coupon.maxDiscountPaise,
      minSubtotalPaise: coupon.minSubtotalPaise,
      maxSubtotalPaise: coupon.maxSubtotalPaise,
      merchandiseBasisPaise,
      shippingBasisPaise,
      merchandiseDiscountPaise,
      shippingDiscountPaise,
      discountPaise,
      platformFundedDiscountPaise,
      sellerFundedDiscountPaise,
      itemAllocations,
      sellerAllocations,
      evaluatedAt: new Date().toISOString(),
    } satisfies Prisma.InputJsonObject;

    return {
      couponId: coupon.id,
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      discountType: coupon.discountType,
      fundingSource: coupon.fundingSource,
      merchandiseBasisPaise,
      shippingBasisPaise,
      merchandiseDiscountPaise,
      shippingDiscountPaise,
      discountPaise,
      platformFundedDiscountPaise,
      sellerFundedDiscountPaise,
      itemAllocations,
      sellerAllocations,
      snapshot,
    };
  }

  private async eligibleCheckoutItems(
    coupon: CouponRecord,
    customerId: string,
    items: CouponCheckoutItem[],
    client: CouponClient,
  ) {
    if (coupon.isMarketplaceWide && coupon.fundingSource === CouponFundingSource.PLATFORM) {
      return items.filter((item) => item.lineTotalPaise > 0);
    }

    const sellerIds = new Set(coupon.sellerEligibilities.map((item) => item.sellerId));
    const productIds = new Set(coupon.productEligibilities.map((item) => item.productId));
    const categoryIds = await this.categoryEligibilityIds(coupon, client);
    const customerIds = new Set(coupon.customerEligibilities.map((item) => item.customerId));
    const acceptedSellerIds = new Set(
      coupon.sellerParticipations
        .filter((item) => item.status === CouponSellerParticipationStatus.ACCEPTED)
        .map((item) => item.sellerId),
    );

    return items.filter((item) => {
      if (customerIds.size && !customerIds.has(customerId)) {
        return false;
      }
      if (sellerIds.size && !sellerIds.has(item.sellerId)) {
        return false;
      }
      if (productIds.size && !productIds.has(item.productId)) {
        return false;
      }
      if (categoryIds.size && !categoryIds.has(item.categoryId)) {
        return false;
      }
      if (
        coupon.fundingSource === CouponFundingSource.SELLER &&
        !acceptedSellerIds.has(item.sellerId)
      ) {
        return false;
      }

      return item.lineTotalPaise > 0;
    });
  }

  private async categoryEligibilityIds(coupon: CouponRecord, client: CouponClient) {
    const rootIds = coupon.categoryEligibilities.map((item) => item.categoryId);
    const ids = new Set(rootIds);
    let frontier = rootIds;

    while (frontier.length) {
      const children = await client.category.findMany({
        where: {
          parentId: { in: frontier },
          deletedAt: null,
        },
        select: { id: true },
      });
      frontier = children.map((child) => child.id).filter((id) => !ids.has(id));
      for (const id of frontier) {
        ids.add(id);
      }
    }

    return ids;
  }

  private merchandiseDiscount(coupon: CouponRecord, basisPaise: number) {
    if (coupon.discountType === CouponDiscountType.FREE_SHIPPING) {
      return 0;
    }
    const raw =
      coupon.discountType === CouponDiscountType.PERCENTAGE
        ? Math.round((basisPaise * (coupon.discountValueBps ?? 0)) / 10_000)
        : (coupon.discountAmountPaise ?? 0);
    const capped =
      coupon.maxDiscountPaise
        ? Math.min(raw, coupon.maxDiscountPaise)
        : raw;
    return Math.min(this.nonNegativeInt(capped), basisPaise);
  }

  private eligibleShippingBasis(input: CouponCheckoutInput, eligibleItems: CouponCheckoutItem[]) {
    const sellerIds = new Set(eligibleItems.map((item) => item.sellerId));
    const shipments = this.shipmentSnapshots(input.shippingSnapshot);
    if (!shipments.length) {
      return this.nonNegativeInt(input.shippingPaise);
    }

    return shipments
      .filter((shipment) => !shipment.sellerId || sellerIds.has(shipment.sellerId))
      .reduce((total, shipment) => total + shipment.shippingPaise, 0);
  }

  private allocateItems(
    coupon: CouponRecord,
    eligibleItems: CouponCheckoutItem[],
    merchandiseDiscountPaise: number,
  ): CouponItemAllocation[] {
    const bases = new Map(eligibleItems.map((item) => [item.key, item.lineTotalPaise]));
    const shares = this.allocateMinorAmountByKey(merchandiseDiscountPaise, bases);

    return eligibleItems.map((item) => {
      const discountPaise = shares.get(item.key) ?? 0;
      return {
        key: item.key,
        sellerId: item.sellerId,
        productId: item.productId,
        categoryId: item.categoryId,
        lineTotalPaise: item.lineTotalPaise,
        discountPaise,
        platformFundedDiscountPaise:
          coupon.fundingSource === CouponFundingSource.PLATFORM ? discountPaise : 0,
        sellerFundedDiscountPaise:
          coupon.fundingSource === CouponFundingSource.SELLER ? discountPaise : 0,
      };
    });
  }

  private allocateSellers(
    coupon: CouponRecord,
    itemAllocations: CouponItemAllocation[],
    shippingDiscountPaise: number,
    shippingSnapshot?: Prisma.InputJsonValue | null,
  ) {
    const merchandiseBySeller = new Map<string, number>();
    for (const item of itemAllocations) {
      merchandiseBySeller.set(
        item.sellerId,
        (merchandiseBySeller.get(item.sellerId) ?? 0) + item.discountPaise,
      );
    }
    const shippingBases = new Map<string, number>();
    const eligibleSellerIds = new Set(itemAllocations.map((item) => item.sellerId));
    for (const shipment of this.shipmentSnapshots(shippingSnapshot)) {
      if (shipment.sellerId && eligibleSellerIds.has(shipment.sellerId)) {
        shippingBases.set(
          shipment.sellerId,
          (shippingBases.get(shipment.sellerId) ?? 0) + shipment.shippingPaise,
        );
      }
    }
    if (!shippingBases.size) {
      for (const sellerId of eligibleSellerIds) {
        shippingBases.set(sellerId, merchandiseBySeller.get(sellerId) ?? 1);
      }
    }
    const shippingBySeller = this.allocateMinorAmountByKey(shippingDiscountPaise, shippingBases);
    const sellerIds = new Set([...eligibleSellerIds, ...shippingBySeller.keys()]);

    return Array.from(sellerIds).map((sellerId) => {
      const merchandiseDiscountPaise = merchandiseBySeller.get(sellerId) ?? 0;
      const shippingDiscountForSeller = shippingBySeller.get(sellerId) ?? 0;
      const discountPaise = merchandiseDiscountPaise + shippingDiscountForSeller;
      return {
        sellerId,
        merchandiseDiscountPaise,
        shippingDiscountPaise: shippingDiscountForSeller,
        discountPaise,
        platformFundedDiscountPaise:
          coupon.fundingSource === CouponFundingSource.PLATFORM ? discountPaise : 0,
        sellerFundedDiscountPaise:
          coupon.fundingSource === CouponFundingSource.SELLER ? merchandiseDiscountPaise : 0,
      };
    });
  }

  private shipmentSnapshots(value?: Prisma.InputJsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }
    const shipping = (value as Record<string, unknown>).shipping;
    if (!shipping || typeof shipping !== "object" || Array.isArray(shipping)) {
      return [];
    }
    const shipments = (shipping as Record<string, unknown>).shipments;
    if (!Array.isArray(shipments)) {
      return [];
    }

    return shipments
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, unknown>;
        const sellerId = typeof record.sellerId === "string" ? record.sellerId : null;
        const shippingPaise = this.nonNegativeInt(
          typeof record.shippingPaise === "number" ? record.shippingPaise : 0,
        );
        return { sellerId, shippingPaise };
      })
      .filter((item): item is { sellerId: string | null; shippingPaise: number } =>
        Boolean(item),
      );
  }

  private async assertUsageAllowed(
    coupon: CouponRecord,
    customerId: string,
    client: CouponClient,
    usageCounter?: CouponUsageCounterRecord | null,
  ) {
    if (
      coupon.totalUsageLimit !== null &&
      this.couponUsedCount(coupon, usageCounter) >= coupon.totalUsageLimit
    ) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }

    if (coupon.perCustomerLimit !== null) {
      const customerUseCount = await client.couponRedemption.count({
        where: {
          couponId: coupon.id,
          customerId,
          status: { not: CouponRedemptionStatus.FULLY_REVERSED },
        },
      });
      if (customerUseCount >= coupon.perCustomerLimit) {
        throw new BadRequestException("Coupon cannot be applied to this order.");
      }
    }
  }

  private async assertFirstOrderAllowed(coupon: CouponRecord, customerId: string, client: CouponClient) {
    if (!coupon.firstOrderOnly) {
      return;
    }
    const previousOrders = await client.order.count({
      where: {
        customerId,
        orderStatus: { not: OrderStatus.CANCELLED },
      },
    });
    if (previousOrders > 0) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }
  }

  private assertCouponCurrentlyValid(coupon: CouponRecord) {
    const now = new Date();
    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      throw new BadRequestException("Coupon cannot be applied to this order.");
    }
  }

  private async normalizeCouponData(dto: CouponNormalizeInput, client: CouponClient) {
    const code = this.normalizeCode(dto.code);
    const title = dto.title.trim();
    const description = this.emptyToNull(dto.description);
    const internalNote = this.emptyToNull(dto.internalNote);
    const startsAt = dto.startsAt ? this.parseDate(dto.startsAt, "startsAt") : null;
    const endsAt = dto.endsAt ? this.parseDate(dto.endsAt, "endsAt") : null;
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException("Coupon start date must be before end date.");
    }
    if (
      dto.minSubtotalPaise !== undefined &&
      dto.minSubtotalPaise !== null &&
      dto.maxSubtotalPaise !== undefined &&
      dto.maxSubtotalPaise !== null &&
      dto.maxSubtotalPaise < dto.minSubtotalPaise
    ) {
      throw new BadRequestException("Maximum subtotal must be greater than minimum subtotal.");
    }

    if (dto.discountType === CouponDiscountType.FREE_SHIPPING) {
      if (dto.fundingSource !== CouponFundingSource.PLATFORM) {
        throw new BadRequestException("Free-shipping coupons must be platform funded.");
      }
    } else if (dto.discountType === CouponDiscountType.PERCENTAGE) {
      if (!dto.discountValueBps) {
        throw new BadRequestException("Percentage coupons require discountValueBps.");
      }
    } else if (dto.discountType === CouponDiscountType.FIXED_AMOUNT && !dto.discountAmountPaise) {
      throw new BadRequestException("Fixed amount coupons require discountAmountPaise.");
    }

    const sellerIds = this.uniqueIds(dto.sellerIds);
    const productIds = this.uniqueIds(dto.productIds);
    const categoryIds = this.uniqueIds(dto.categoryIds);
    const customerIds = this.uniqueIds(dto.customerIds);
    if (dto.fundingSource === CouponFundingSource.SELLER && !sellerIds.length) {
      throw new BadRequestException("Seller-funded coupons require at least one seller.");
    }
    const isMarketplaceWide =
      !sellerIds.length && !productIds.length && !categoryIds.length && !customerIds.length;

    await this.assertEligibleReferencesExist(client, {
      sellerIds,
      productIds,
      categoryIds,
      customerIds,
    });

    return {
      code,
      title,
      description,
      discountType: dto.discountType,
      fundingSource: dto.fundingSource,
      discountValueBps:
        dto.discountType === CouponDiscountType.PERCENTAGE ? dto.discountValueBps ?? null : null,
      discountAmountPaise:
        dto.discountType === CouponDiscountType.FIXED_AMOUNT ? dto.discountAmountPaise ?? null : null,
      maxDiscountPaise:
        dto.discountType === CouponDiscountType.FREE_SHIPPING
          ? null
          : dto.maxDiscountPaise ?? null,
      minSubtotalPaise: dto.minSubtotalPaise ?? null,
      maxSubtotalPaise: dto.maxSubtotalPaise ?? null,
      totalUsageLimit: dto.totalUsageLimit ?? null,
      perCustomerLimit: dto.perCustomerLimit ?? null,
      isMarketplaceWide,
      firstOrderOnly: dto.firstOrderOnly ?? false,
      startsAt,
      endsAt,
      internalNote,
      sellerIds,
      productIds,
      categoryIds,
      customerIds,
    };
  }

  private async replaceEligibility(
    tx: Prisma.TransactionClient,
    couponId: string,
    normalized: Awaited<ReturnType<typeof this.normalizeCouponData>>,
  ) {
    await Promise.all([
      tx.couponSellerEligibility.deleteMany({ where: { couponId } }),
      tx.couponProductEligibility.deleteMany({ where: { couponId } }),
      tx.couponCategoryEligibility.deleteMany({ where: { couponId } }),
      tx.couponCustomerEligibility.deleteMany({ where: { couponId } }),
    ]);

    await Promise.all([
      normalized.sellerIds.length
        ? tx.couponSellerEligibility.createMany({
            data: normalized.sellerIds.map((sellerId) => ({ couponId, sellerId })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
      normalized.productIds.length
        ? tx.couponProductEligibility.createMany({
            data: normalized.productIds.map((productId) => ({ couponId, productId })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
      normalized.categoryIds.length
        ? tx.couponCategoryEligibility.createMany({
            data: normalized.categoryIds.map((categoryId) => ({ couponId, categoryId })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
      normalized.customerIds.length
        ? tx.couponCustomerEligibility.createMany({
            data: normalized.customerIds.map((customerId) => ({ couponId, customerId })),
            skipDuplicates: true,
          })
        : Promise.resolve(),
    ]);
  }

  private async ensureSellerParticipations(
    tx: Prisma.TransactionClient,
    couponId: string,
    normalized: Awaited<ReturnType<typeof this.normalizeCouponData>>,
  ) {
    if (normalized.fundingSource !== CouponFundingSource.SELLER) {
      await tx.couponSellerParticipation.deleteMany({
        where: {
          couponId,
          lockedAt: null,
        },
      });
      return;
    }

    const desiredSellerIds = new Set(normalized.sellerIds);
    for (const sellerId of desiredSellerIds) {
      const existing = await tx.couponSellerParticipation.findUnique({
        where: { couponId_sellerId: { couponId, sellerId } },
      });
      if (!existing) {
        await tx.couponSellerParticipation.create({
          data: {
            couponId,
            sellerId,
            status: CouponSellerParticipationStatus.PENDING,
          },
        });
        continue;
      }

      await tx.couponSellerParticipation.update({
        where: { id: existing.id },
        data: {
          status:
            existing.status === CouponSellerParticipationStatus.REMOVED
              ? CouponSellerParticipationStatus.PENDING
              : existing.status,
          acceptedAt:
            existing.status === CouponSellerParticipationStatus.REMOVED ? null : existing.acceptedAt,
          declinedAt:
            existing.status === CouponSellerParticipationStatus.REMOVED ? null : existing.declinedAt,
          removedAt: null,
        },
      });
    }

    await tx.couponSellerParticipation.updateMany({
      where: {
        couponId,
        sellerId: { notIn: Array.from(desiredSellerIds) },
        lockedAt: null,
      },
      data: {
        status: CouponSellerParticipationStatus.REMOVED,
        removedAt: new Date(),
      },
    });
  }

  private async assertEligibleReferencesExist(
    client: CouponClient,
    input: {
      sellerIds: string[];
      productIds: string[];
      categoryIds: string[];
      customerIds: string[];
    },
  ) {
    const [sellerCount, productCount, categoryCount, customerCount] = await Promise.all([
      input.sellerIds.length
        ? client.seller.count({
            where: {
              id: { in: input.sellerIds },
              status: SellerStatus.APPROVED,
              approvalStatus: ApprovalStatus.APPROVED,
              deletedAt: null,
            },
          })
        : 0,
      input.productIds.length
        ? client.product.count({
            where: {
              id: { in: input.productIds },
              status: ProductStatus.ACTIVE,
              approvalStatus: ApprovalStatus.APPROVED,
              deletedAt: null,
              listingMode: { not: ProductListingMode.ENQUIRY_ONLY },
            },
          })
        : 0,
      input.categoryIds.length
        ? client.category.count({
            where: {
              id: { in: input.categoryIds },
              deletedAt: null,
            },
          })
        : 0,
      input.customerIds.length
        ? client.customer.count({ where: { id: { in: input.customerIds } } })
        : 0,
    ]);

    if (sellerCount !== input.sellerIds.length) {
      throw new BadRequestException("Coupon sellers must be approved active sellers.");
    }
    if (productCount !== input.productIds.length) {
      throw new BadRequestException("Coupon products must be active approved cart products.");
    }
    if (categoryCount !== input.categoryIds.length) {
      throw new BadRequestException("Coupon categories must be active categories.");
    }
    if (customerCount !== input.customerIds.length) {
      throw new BadRequestException("Coupon customer eligibility contains invalid customers.");
    }
  }

  private assertCouponCanActivate(coupon: CouponRecord) {
    if (coupon.status === CouponStatus.ARCHIVED) {
      throw new BadRequestException("Archived coupons cannot be activated.");
    }
    if (coupon.endsAt && coupon.endsAt <= new Date()) {
      throw new BadRequestException("Expired coupons cannot be activated.");
    }
    if (coupon.fundingSource === CouponFundingSource.SELLER) {
      const eligibleSellerIds = new Set(coupon.sellerEligibilities.map((item) => item.sellerId));
      if (!eligibleSellerIds.size) {
        throw new BadRequestException("Seller-funded coupons require seller eligibility.");
      }
    }
  }

  private assertUpdateAllowed(coupon: CouponRecord, dto: UpdateCouponDto) {
    const hasRedemption = coupon._count.redemptions > 0 || this.couponUsedCount(coupon) > 0;
    if (!hasRedemption) {
      return;
    }
    const lockedFields: Array<keyof UpdateCouponDto> = [
      "code",
      "discountType",
      "fundingSource",
      "discountValueBps",
      "discountAmountPaise",
      "maxDiscountPaise",
    ];
    if (lockedFields.some((field) => dto[field] !== undefined)) {
      throw new BadRequestException(
        "Coupon code, funding, and discount math are locked after redemption.",
      );
    }
  }

  private async sellerDecision(
    actor: RequestUser,
    sellerId: string,
    couponId: string,
    status: CouponSellerParticipationStatus,
  ) {
    const coupon = await this.getCouponOrThrow(couponId);
    if (coupon.fundingSource !== CouponFundingSource.SELLER) {
      throw new BadRequestException("Only seller-funded coupons require seller consent.");
    }
    const participation = await this.prisma.client.couponSellerParticipation.findUnique({
      where: { couponId_sellerId: { couponId, sellerId } },
    });
    if (!participation) {
      throw new ForbiddenException("This coupon is not connected to your store.");
    }
    if (participation.lockedAt && participation.status === CouponSellerParticipationStatus.ACCEPTED) {
      throw new BadRequestException("Accepted participation is locked after coupon redemption.");
    }

    const now = new Date();
    const updated = await this.prisma.client.couponSellerParticipation.update({
      where: { couponId_sellerId: { couponId, sellerId } },
      data: {
        status,
        acceptedAt: status === CouponSellerParticipationStatus.ACCEPTED ? now : null,
        declinedAt: status === CouponSellerParticipationStatus.DECLINED ? now : null,
        removedAt: null,
      },
      include: { coupon: true },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action:
          status === CouponSellerParticipationStatus.ACCEPTED
            ? "coupon.seller.accepted"
            : "coupon.seller.declined",
        entityType: "coupon_seller_participation",
        entityId: updated.id,
        oldValue: { status: participation.status },
        newValue: { status: updated.status, couponId, sellerId },
      },
    });

    this.clearCouponCache(coupon.code);
    return updated;
  }

  private async getCouponOrThrow(couponId: string, client: CouponClient = this.prisma.client) {
    const coupon = await client.coupon.findUnique({
      where: { id: couponId },
      include: couponInclude,
    });
    if (!coupon) {
      throw new NotFoundException("Coupon not found.");
    }
    return coupon;
  }

  private async resolveSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({ where: { userId: actor.id } });
    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }
    return seller;
  }

  private async resolveApprovedSeller(actor: RequestUser) {
    const seller = await this.resolveSeller(actor);
    if (seller.status !== SellerStatus.APPROVED || seller.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException("Only approved sellers can accept coupon participation.");
    }
    return seller;
  }

  private assertPreviewRateLimit(actor: RequestUser, couponCode?: string | null) {
    const key = `${actor.id}:${this.normalizeCodeLoose(couponCode ?? "")}`;
    const now = Date.now();
    const existing = this.validationBuckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.validationBuckets.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (existing.count >= 20) {
      throw new HttpException("Please wait before trying another coupon.", HttpStatus.TOO_MANY_REQUESTS);
    }
    existing.count += 1;
  }

  private normalizeCode(value: string) {
    const normalized = this.normalizeCodeLoose(value);
    if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) {
      throw new BadRequestException("Coupon code must be 3-32 characters using A-Z, 0-9, _ or -.");
    }
    return normalized;
  }

  private normalizeCodeLoose(value: string) {
    return value.trim().toUpperCase();
  }

  private parseDate(value: string, fieldName: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date.`);
    }
    return date;
  }

  private uniqueIds(values?: string[]) {
    return Array.from(new Set((values ?? []).map((item) => item.trim()).filter(Boolean)));
  }

  private emptyToNull(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private nonNegativeInt(value: number) {
    return Math.max(0, Math.round(value));
  }

  private allocateMinorAmountByKey(amountPaise: number, bases: Map<string, number>) {
    const amount = this.nonNegativeInt(amountPaise);
    const entries = Array.from(bases.entries()).filter(([, value]) => value > 0);
    const totalBasis = entries.reduce((total, [, value]) => total + value, 0);
    const allocations = new Map<string, number>();
    if (amount <= 0 || totalBasis <= 0 || !entries.length) {
      for (const [key] of entries) {
        allocations.set(key, 0);
      }
      return allocations;
    }

    let allocated = 0;
    const fractional = entries.map(([key, basis]) => {
      const exact = (amount * basis) / totalBasis;
      const floor = Math.floor(exact);
      allocated += floor;
      allocations.set(key, floor);
      return { key, remainder: exact - floor };
    });
    let remainder = amount - allocated;
    fractional.sort((left, right) => right.remainder - left.remainder);
    for (const item of fractional) {
      if (remainder <= 0) {
        break;
      }
      allocations.set(item.key, (allocations.get(item.key) ?? 0) + 1);
      remainder -= 1;
    }
    return allocations;
  }

  private withUsageCounterReadback<T extends CouponRecord>(coupon: T): T {
    return {
      ...coupon,
      redeemedCount: this.couponUsedCount(coupon),
    } as T;
  }

  private couponUsedCount(coupon: CouponRecord, usageCounter?: CouponUsageCounterRecord | null) {
    return usageCounter?.usedCount ?? coupon.usageCounter?.usedCount ?? coupon.redeemedCount;
  }

  private clearCouponCache(code?: string | null) {
    if (!code) {
      this.couponMetadataCache.clear();
      return;
    }
    this.couponMetadataCache.delete(this.normalizeCodeLoose(code));
  }

  private async getCouponForEvaluation(code: string, client: CouponClient, useCache: boolean) {
    if (useCache) {
      const cached = this.couponMetadataCache.get(code);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.coupon;
      }
      if (cached) {
        this.couponMetadataCache.delete(code);
      }
    }

    const coupon = await client.coupon.findUnique({
      where: { code },
      include: couponInclude,
    });
    if (coupon && useCache) {
      this.couponMetadataCache.set(code, {
        coupon,
        expiresAt: Date.now() + this.couponMetadataCacheTtlMs,
      });
    }
    return coupon;
  }

  private async ensureUsageCounterRow(client: CouponClient, couponId: string) {
    await client.$executeRaw`
      INSERT INTO "coupon_usage_counters" ("coupon_id")
      VALUES (${couponId}::uuid)
      ON CONFLICT ("coupon_id") DO NOTHING
    `;
  }

  private async readUsageCounter(client: CouponClient, couponId: string) {
    const counter = await client.couponUsageCounter.findUnique({
      where: { couponId },
    });
    return counter as CouponUsageCounterRecord | null;
  }

  private async lockUsageCounter(client: CouponClient, couponId: string) {
    await this.ensureUsageCounterRow(client, couponId);
    const rows = await client.$queryRaw<CouponUsageCounterRecord[]>`
      SELECT
        "coupon_id" AS "couponId",
        "used_count" AS "usedCount",
        "discount_paise" AS "discountPaise",
        "platform_funded_discount_paise" AS "platformFundedDiscountPaise",
        "seller_funded_discount_paise" AS "sellerFundedDiscountPaise",
        "version",
        "updated_at" AS "updatedAt"
      FROM "coupon_usage_counters"
      WHERE "coupon_id" = ${couponId}::uuid
      FOR UPDATE SKIP LOCKED
    `;
    if (!rows[0]) {
      throw new HttpException(
        "Coupon validation is busy. Please try again.",
        HttpStatus.CONFLICT,
      );
    }
    return rows[0];
  }

  private async lockCustomerForCouponChecks(client: CouponClient, customerId: string) {
    await client.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customerId}::uuid FOR UPDATE`;
  }

  private async incrementUsageCounter(tx: Prisma.TransactionClient, result: CouponEvaluationResult) {
    await this.ensureUsageCounterRow(tx, result.couponId);
    await tx.couponUsageCounter.update({
      where: { couponId: result.couponId },
      data: {
        usedCount: { increment: 1 },
        discountPaise: { increment: result.discountPaise },
        platformFundedDiscountPaise: { increment: result.platformFundedDiscountPaise },
        sellerFundedDiscountPaise: { increment: result.sellerFundedDiscountPaise },
        version: { increment: 1 },
      },
    });
  }

  private async decrementUsageCounter(
    tx: Prisma.TransactionClient,
    couponId: string,
    amounts: {
      discountPaise: number;
      platformFundedDiscountPaise: number;
      sellerFundedDiscountPaise: number;
    },
  ) {
    await this.ensureUsageCounterRow(tx, couponId);
    await tx.$executeRaw`
      UPDATE "coupon_usage_counters"
      SET
        "used_count" = GREATEST("used_count" - 1, 0),
        "discount_paise" = GREATEST("discount_paise" - ${this.nonNegativeInt(amounts.discountPaise)}, 0),
        "platform_funded_discount_paise" = GREATEST(
          "platform_funded_discount_paise" - ${this.nonNegativeInt(amounts.platformFundedDiscountPaise)},
          0
        ),
        "seller_funded_discount_paise" = GREATEST(
          "seller_funded_discount_paise" - ${this.nonNegativeInt(amounts.sellerFundedDiscountPaise)},
          0
        ),
        "version" = "version" + 1,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "coupon_id" = ${couponId}::uuid
    `;
  }

  private isUniqueConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private compactCouponAudit(coupon: CouponRecord) {
    return {
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      status: coupon.status,
      discountType: coupon.discountType,
      fundingSource: coupon.fundingSource,
      redeemedCount: this.couponUsedCount(coupon),
    };
  }

  private auditValue(
    coupon: {
      id: string;
      code: string;
      title: string;
      status: CouponStatus;
      discountType: CouponDiscountType;
      fundingSource: CouponFundingSource;
    },
    normalized: Awaited<ReturnType<typeof this.normalizeCouponData>>,
  ) {
    return {
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      status: coupon.status,
      discountType: coupon.discountType,
      fundingSource: coupon.fundingSource,
      sellerIds: normalized.sellerIds,
      productIds: normalized.productIds,
      categoryIds: normalized.categoryIds,
      customerIds: normalized.customerIds,
    };
  }
}
