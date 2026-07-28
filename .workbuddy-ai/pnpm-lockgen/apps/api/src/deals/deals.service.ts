import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  DealParticipationStatus,
  DealProductEnrollmentStatus,
  DealStatus,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  PushNotificationType,
  ProductListingMode,
  ProductStatus,
  SellerStatus,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { ExpoPushService } from "../notifications/expo-push.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDealDto, DealQueryDto, EnrollDealProductsDto, UpdateDealDto } from "./dto/deal.dto";

type DealClient = Prisma.TransactionClient | PrismaService["client"];
type DealDataInput = {
  title: string;
  description?: string | null | undefined;
  categoryId: string;
  discountBps?: number | undefined;
  discountPercent?: number | undefined;
  joinDeadline: string;
  startsAt: string;
  endsAt: string;
  maxSellers?: number | undefined;
  maxProducts?: number | undefined;
};

const adminDealInclude = {
  category: true,
  _count: {
    select: {
      participations: true,
      productEnrollments: true,
      orderItems: true,
    },
  },
} satisfies Prisma.DealInclude;

const sellerDealInclude = {
  category: true,
  participations: true,
  productEnrollments: {
    include: {
      product: {
        include: {
          images: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
          variants: { orderBy: { createdAt: "asc" as const } },
          category: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExpoPushService) private readonly expoPush: ExpoPushService,
  ) {}

  async createDeal(actor: RequestUser, dto: CreateDealDto) {
    const data = await this.dealData(dto, this.prisma.client);
    const deal = await this.prisma.client.deal.create({
      data: {
        ...data,
        createdById: actor.id,
        updatedById: actor.id,
      },
      include: adminDealInclude,
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "deal.created",
        entityType: "deal",
        entityId: deal.id,
        newValue: this.dealAuditValue(deal),
      },
    });

    return deal;
  }

  async listAdminDeals(query: DealQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const where: Prisma.DealWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.deal.findMany({
        where,
        include: adminDealInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.deal.count({ where }),
    ]);

    return { items, total, page, limit: take };
  }

  async getAdminDeal(dealId: string) {
    const deal = await this.prisma.client.deal.findUnique({
      where: { id: dealId },
      include: {
        category: true,
        participations: {
          include: {
            seller: {
              include: {
                profile: true,
                user: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
        productEnrollments: {
          include: {
            seller: true,
            product: {
              include: {
                category: true,
                images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
                variants: { orderBy: { createdAt: "asc" } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
        _count: {
          select: {
            participations: true,
            productEnrollments: true,
            orderItems: true,
          },
        },
      },
    });

    if (!deal) {
      throw new NotFoundException("Deal not found.");
    }

    return deal;
  }

  async updateDeal(actor: RequestUser, dealId: string, dto: UpdateDealDto) {
    const existing = await this.getDealOrThrow(dealId);
    if (existing.status === DealStatus.CANCELLED) {
      throw new BadRequestException("Cancelled deals cannot be edited.");
    }

    const data = await this.dealData(
      {
        title: dto.title ?? existing.title,
        description: dto.description ?? existing.description ?? undefined,
        categoryId: dto.categoryId ?? existing.categoryId,
        discountBps:
          dto.discountPercent !== undefined && dto.discountBps === undefined
            ? undefined
            : dto.discountBps ?? existing.discountBps,
        discountPercent: dto.discountPercent,
        joinDeadline: dto.joinDeadline ?? existing.joinDeadline.toISOString(),
        startsAt: dto.startsAt ?? existing.startsAt.toISOString(),
        endsAt: dto.endsAt ?? existing.endsAt.toISOString(),
        maxSellers: dto.maxSellers ?? existing.maxSellers ?? undefined,
        maxProducts: dto.maxProducts ?? existing.maxProducts ?? undefined,
      },
      this.prisma.client,
    );

    await this.ensurePublishedDealUpdateIsSafe(existing, data, this.prisma.client);
    const deal = await this.prisma.client.deal.update({
      where: { id: dealId },
      data: {
        ...data,
        updatedById: actor.id,
      },
      include: adminDealInclude,
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "deal.updated",
        entityType: "deal",
        entityId: deal.id,
        oldValue: this.dealAuditValue(existing),
        newValue: this.dealAuditValue(deal),
      },
    });

    return deal;
  }

  async publishDeal(actor: RequestUser, dealId: string) {
    const now = new Date();
    const result = await this.prisma.client.$transaction(async (tx) => {
      const existing = await this.getDealOrThrow(dealId, tx);
      if (existing.status === DealStatus.CANCELLED) {
        throw new BadRequestException("Cancelled deals cannot be published.");
      }
      if (existing.status === DealStatus.PUBLISHED) {
        return { deal: existing, transitionedToPublished: false };
      }
      if (existing.endsAt <= now) {
        throw new BadRequestException("Deal end date must be in the future before publishing.");
      }
      if (existing.startsAt >= existing.endsAt || existing.joinDeadline >= existing.endsAt) {
        throw new BadRequestException("Deal dates are invalid.");
      }

      return {
        deal: await tx.deal.update({
          where: { id: dealId },
          data: {
            status: DealStatus.PUBLISHED,
            publishedAt: now,
            updatedById: actor.id,
          },
          include: adminDealInclude,
        }),
        transitionedToPublished: true,
      };
    });

    if (!result.transitionedToPublished) {
      return result.deal;
    }

    await Promise.all([
      this.prisma.client.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "deal.published",
          entityType: "deal",
          entityId: result.deal.id,
          newValue: this.dealAuditValue(result.deal),
        },
      }),
      this.createSellerDealNotifications(result.deal.id),
      this.createCustomerDealNotifications(result.deal.id),
    ]);

    return result.deal;
  }

  async cancelDeal(actor: RequestUser, dealId: string) {
    const existing = await this.getDealOrThrow(dealId);
    if (existing.status === DealStatus.CANCELLED) {
      return this.getAdminDeal(dealId);
    }

    const deal = await this.prisma.client.deal.update({
      where: { id: dealId },
      data: {
        status: DealStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedById: actor.id,
      },
      include: adminDealInclude,
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "deal.cancelled",
        entityType: "deal",
        entityId: deal.id,
        oldValue: this.dealAuditValue(existing),
        newValue: this.dealAuditValue(deal),
      },
    });

    return deal;
  }

  async getAdminDealDashboard(dealId: string) {
    await this.getDealOrThrow(dealId);
    const [deal, orderAggregate, orderItems, orderCount] = await Promise.all([
      this.getAdminDeal(dealId),
      this.prisma.client.orderItem.aggregate({
        where: { dealId },
        _sum: {
          lineTotalPaise: true,
          dealDiscountPaise: true,
        },
        _count: { _all: true },
      }),
      this.prisma.client.orderItem.findMany({
        where: { dealId },
        include: {
          order: true,
          seller: true,
          product: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.client.orderItem
        .findMany({
          where: { dealId },
          select: { orderId: true },
          distinct: ["orderId"],
        })
        .then((items) => items.length),
    ]);

    return {
      deal,
      metrics: {
        acceptedSellers: deal.participations.filter((item) => item.status === DealParticipationStatus.ACCEPTED).length,
        declinedSellers: deal.participations.filter((item) => item.status === DealParticipationStatus.DECLINED).length,
        enrolledProducts: deal.productEnrollments.filter((item) => item.status === DealProductEnrollmentStatus.ENROLLED).length,
        orderCount,
        orderItemCount: orderAggregate._count._all,
        revenuePaise: orderAggregate._sum.lineTotalPaise ?? 0,
        discountPaise: orderAggregate._sum.dealDiscountPaise ?? 0,
      },
      recentOrderItems: orderItems,
    };
  }

  async listSellerDeals(actor: RequestUser) {
    const seller = await this.resolveSeller(actor);
    const deals = await this.findSellerVisibleDeals(seller.id);
    return { items: deals };
  }

  async getSellerDeal(actor: RequestUser, dealId: string) {
    const seller = await this.resolveSeller(actor);
    const deal = await this.getSellerVisibleDealOrThrow(seller.id, dealId);
    const eligibleProductIds = new Set(await this.eligibleSellerProductIdsForDeal(seller.id, deal, this.prisma.client));

    return {
      ...this.withSellerDealState(deal, seller.id, eligibleProductIds.size),
      eligibleProducts: await this.prisma.client.product.findMany({
        where: {
          id: { in: Array.from(eligibleProductIds) },
        },
        include: {
          category: true,
          images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          variants: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      }),
    };
  }

  async acceptSellerDeal(actor: RequestUser, dealId: string) {
    const seller = await this.resolveApprovedSeller(actor);
    return this.prisma.client.$transaction(async (tx) => {
      const deal = await this.getSellerVisibleDealOrThrow(seller.id, dealId, tx);
      this.assertSellerJoinWindow(deal);
      await this.assertSellerHasEligibleProducts(seller.id, deal, tx);
      const existing = await tx.dealParticipation.findUnique({
        where: { dealId_sellerId: { dealId, sellerId: seller.id } },
      });
      if (existing?.status === DealParticipationStatus.ACCEPTED) {
        return existing;
      }
      if (!existing) {
        await this.assertSellerCapAvailable(deal, tx);
      }

      return tx.dealParticipation.upsert({
        where: { dealId_sellerId: { dealId, sellerId: seller.id } },
        update: {
          status: DealParticipationStatus.ACCEPTED,
          acceptedAt: new Date(),
          declinedAt: null,
        },
        create: {
          dealId,
          sellerId: seller.id,
          status: DealParticipationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });
    });
  }

  async declineSellerDeal(actor: RequestUser, dealId: string) {
    const seller = await this.resolveSeller(actor);
    const deal = await this.getSellerVisibleDealOrThrow(seller.id, dealId);
    if (deal.status === DealStatus.CANCELLED) {
      throw new BadRequestException("Cancelled deals do not need a seller decision.");
    }

    return this.prisma.client.dealParticipation.upsert({
      where: { dealId_sellerId: { dealId, sellerId: seller.id } },
      update: {
        status: DealParticipationStatus.DECLINED,
        declinedAt: new Date(),
        acceptedAt: null,
      },
      create: {
        dealId,
        sellerId: seller.id,
        status: DealParticipationStatus.DECLINED,
        declinedAt: new Date(),
      },
    });
  }

  async enrollSellerProducts(actor: RequestUser, dealId: string, dto: EnrollDealProductsDto) {
    const seller = await this.resolveApprovedSeller(actor);
    const productIds = Array.from(new Set(dto.productIds));

    return this.prisma.client.$transaction(async (tx) => {
      const deal = await this.getSellerVisibleDealOrThrow(seller.id, dealId, tx);
      this.assertSellerJoinWindow(deal);
      await this.assertSellerAccepted(dealId, seller.id, tx);

      const enrolled = [];
      for (const productId of productIds) {
        const product = await this.getEligibleSellerProductForDeal(seller.id, productId, deal, tx);
        const existing = await tx.dealProductEnrollment.findUnique({
          where: { dealId_productId: { dealId, productId } },
        });
        if (existing?.status !== DealProductEnrollmentStatus.ENROLLED) {
          await this.assertProductCapAvailable(deal, tx);
        }
        await this.assertNoOverlappingDealEnrollment(product.id, deal, tx);
        enrolled.push(
          await tx.dealProductEnrollment.upsert({
            where: { dealId_productId: { dealId, productId } },
            update: {
              sellerId: seller.id,
              status: DealProductEnrollmentStatus.ENROLLED,
              enrolledAt: new Date(),
              removedAt: null,
            },
            create: {
              dealId,
              sellerId: seller.id,
              productId: product.id,
              status: DealProductEnrollmentStatus.ENROLLED,
              enrolledAt: new Date(),
            },
          }),
        );
      }

      return { items: enrolled };
    });
  }

  async removeSellerProduct(actor: RequestUser, dealId: string, productId: string) {
    const seller = await this.resolveApprovedSeller(actor);
    return this.prisma.client.$transaction(async (tx) => {
      const deal = await this.getSellerVisibleDealOrThrow(seller.id, dealId, tx);
      this.assertSellerJoinWindow(deal);
      const enrollment = await tx.dealProductEnrollment.findFirst({
        where: {
          dealId,
          productId,
          sellerId: seller.id,
        },
      });
      if (!enrollment) {
        throw new NotFoundException("Deal product enrollment not found.");
      }

      return tx.dealProductEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: DealProductEnrollmentStatus.REMOVED,
          removedAt: new Date(),
        },
      });
    });
  }

  private async dealData(dto: DealDataInput, client: DealClient) {
    const category = await client.category.findFirst({
      where: {
        id: dto.categoryId,
        status: CategoryStatus.ACTIVE,
        deletedAt: null,
      },
    });
    if (!category) {
      throw new BadRequestException("Deal category must be an active category.");
    }

    const discountBps = this.resolveDiscountBps(dto);
    const joinDeadline = this.parseDate(dto.joinDeadline, "joinDeadline");
    const startsAt = this.parseDate(dto.startsAt, "startsAt");
    const endsAt = this.parseDate(dto.endsAt, "endsAt");
    if (startsAt >= endsAt) {
      throw new BadRequestException("Deal start date must be before end date.");
    }
    if (joinDeadline >= endsAt) {
      throw new BadRequestException("Join deadline must be before the deal end date.");
    }

    return {
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      categoryId: dto.categoryId,
      discountBps,
      joinDeadline,
      startsAt,
      endsAt,
      maxSellers: dto.maxSellers ?? null,
      maxProducts: dto.maxProducts ?? null,
    };
  }

  private resolveDiscountBps(dto: Pick<DealDataInput, "discountBps" | "discountPercent">) {
    const discountBps =
      dto.discountBps !== undefined ? dto.discountBps : (dto.discountPercent ?? 0) * 100;
    if (!Number.isInteger(discountBps) || discountBps < 100 || discountBps > 9000) {
      throw new BadRequestException("Deal discount must be between 1% and 90%.");
    }
    return discountBps;
  }

  private parseDate(value: string, fieldName: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date.`);
    }
    return parsed;
  }

  private async getDealOrThrow(dealId: string, client: DealClient = this.prisma.client) {
    const deal = await client.deal.findUnique({ where: { id: dealId }, include: adminDealInclude });
    if (!deal) {
      throw new NotFoundException("Deal not found.");
    }
    return deal;
  }

  private async resolveSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      include: { user: true },
    });
    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }
    return seller;
  }

  private async resolveApprovedSeller(actor: RequestUser) {
    const seller = await this.resolveSeller(actor);
    if (seller.status !== SellerStatus.APPROVED || seller.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException("Only approved sellers can join deals.");
    }
    return seller;
  }

  private async findSellerVisibleDeals(sellerId: string, client: DealClient = this.prisma.client) {
    const deals = await client.deal.findMany({
      where: {
        status: DealStatus.PUBLISHED,
        endsAt: { gte: new Date() },
      },
      include: sellerDealInclude,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });
    const result = [];
    for (const deal of deals) {
      const productIds = await this.eligibleSellerProductIdsForDeal(sellerId, deal, client);
      result.push(this.withSellerDealState(deal, sellerId, productIds.length));
    }
    return result;
  }

  private async getSellerVisibleDealOrThrow(
    sellerId: string,
    dealId: string,
    client: DealClient = this.prisma.client,
  ) {
    const deal = await client.deal.findUnique({
      where: { id: dealId },
      include: sellerDealInclude,
    });
    if (!deal) {
      throw new NotFoundException("Deal not found.");
    }
    if (deal.status !== DealStatus.PUBLISHED && !deal.participations.some((item) => item.sellerId === sellerId)) {
      throw new ForbiddenException("This deal is not available for this seller.");
    }
    return deal;
  }

  private withSellerDealState<T extends { participations: Array<{ sellerId: string; status: DealParticipationStatus }>; productEnrollments: Array<{ sellerId: string; status: DealProductEnrollmentStatus }> }>(
    deal: T,
    sellerId: string,
    eligibleProductCount?: number,
  ) {
    const participation = deal.participations.find((item) => item.sellerId === sellerId) ?? null;
    return {
      ...deal,
      sellerParticipation: participation,
      sellerEligibleProductCount: eligibleProductCount ?? 0,
      sellerEnrolledProductCount: deal.productEnrollments.filter(
        (item) => item.sellerId === sellerId && item.status === DealProductEnrollmentStatus.ENROLLED,
      ).length,
    };
  }

  private assertSellerJoinWindow(deal: { status: DealStatus; joinDeadline: Date }) {
    if (deal.status !== DealStatus.PUBLISHED) {
      throw new BadRequestException("Only published deals can be joined.");
    }
    if (deal.joinDeadline < new Date()) {
      throw new BadRequestException("Deal join deadline has passed.");
    }
  }

  private async assertSellerAccepted(dealId: string, sellerId: string, client: DealClient) {
    const participation = await client.dealParticipation.findUnique({
      where: { dealId_sellerId: { dealId, sellerId } },
    });
    if (participation?.status !== DealParticipationStatus.ACCEPTED) {
      throw new ForbiddenException("Accept the deal before adding products.");
    }
  }

  private async assertSellerHasEligibleProducts(sellerId: string, deal: { categoryId: string }, client: DealClient) {
    const productIds = await this.eligibleSellerProductIdsForDeal(sellerId, deal, client);
    if (!productIds.length) {
      throw new BadRequestException("Add an active approved product in this deal category before accepting.");
    }
  }

  private async assertSellerCapAvailable(deal: { id: string; maxSellers: number | null }, client: DealClient) {
    if (!deal.maxSellers) {
      return;
    }
    const count = await client.dealParticipation.count({
      where: {
        dealId: deal.id,
        status: DealParticipationStatus.ACCEPTED,
      },
    });
    if (count >= deal.maxSellers) {
      throw new ConflictException("This deal has reached its seller limit.");
    }
  }

  private async assertProductCapAvailable(deal: { id: string; maxProducts: number | null }, client: DealClient) {
    if (!deal.maxProducts) {
      return;
    }
    const count = await client.dealProductEnrollment.count({
      where: {
        dealId: deal.id,
        status: DealProductEnrollmentStatus.ENROLLED,
      },
    });
    if (count >= deal.maxProducts) {
      throw new ConflictException("This deal has reached its product limit.");
    }
  }

  private async getEligibleSellerProductForDeal(
    sellerId: string,
    productId: string,
    deal: { categoryId: string },
    client: DealClient,
  ) {
    const product = await client.product.findFirst({
      where: {
        id: productId,
        sellerId,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
        listingMode: { not: ProductListingMode.ENQUIRY_ONLY },
      },
      include: { category: true },
    });
    if (!product) {
      throw new BadRequestException("Product is not active, approved, or owned by this seller.");
    }
    const categoryIds = await this.categoryAndDescendantIds(deal.categoryId, client);
    if (!categoryIds.has(product.categoryId)) {
      throw new BadRequestException("Product category is not eligible for this deal.");
    }
    return product;
  }

  private async eligibleSellerProductIdsForDeal(
    sellerId: string,
    deal: { categoryId: string },
    client: DealClient,
  ) {
    const categoryIds = await this.categoryAndDescendantIds(deal.categoryId, client);
    const products = await client.product.findMany({
      where: {
        sellerId,
        categoryId: { in: Array.from(categoryIds) },
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
        listingMode: { not: ProductListingMode.ENQUIRY_ONLY },
      },
      select: { id: true },
    });
    return products.map((product) => product.id);
  }

  private async categoryAndDescendantIds(categoryId: string, client: DealClient) {
    const ids = new Set<string>([categoryId]);
    let frontier = [categoryId];
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

  private async assertNoOverlappingDealEnrollment(
    productId: string,
    deal: { id: string; startsAt: Date; endsAt: Date },
    client: DealClient,
  ) {
    const overlap = await client.dealProductEnrollment.findFirst({
      where: {
        productId,
        status: DealProductEnrollmentStatus.ENROLLED,
        dealId: { not: deal.id },
        deal: {
          status: DealStatus.PUBLISHED,
          startsAt: { lte: deal.endsAt },
          endsAt: { gte: deal.startsAt },
        },
      },
      include: { deal: true },
    });
    if (overlap) {
      throw new ConflictException(`Product is already enrolled in overlapping deal "${overlap.deal.title}".`);
    }
  }

  private async ensurePublishedDealUpdateIsSafe(
    existing: { id: string; status: DealStatus },
    next: { startsAt: Date; endsAt: Date },
    client: DealClient,
  ) {
    if (existing.status !== DealStatus.PUBLISHED) {
      return;
    }
    const enrollments = await client.dealProductEnrollment.findMany({
      where: {
        dealId: existing.id,
        status: DealProductEnrollmentStatus.ENROLLED,
      },
      select: { productId: true },
    });
    for (const enrollment of enrollments) {
      await this.assertNoOverlappingDealEnrollment(enrollment.productId, { id: existing.id, ...next }, client);
    }
  }

  private async createSellerDealNotifications(dealId: string) {
    const deal = await this.prisma.client.deal.findUnique({
      where: { id: dealId },
      include: { category: true },
    });
    if (!deal) {
      return;
    }
    const categoryIds = Array.from(await this.categoryAndDescendantIds(deal.categoryId, this.prisma.client));
    const sellers = await this.prisma.client.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
        products: {
          some: {
            categoryId: { in: categoryIds },
            status: ProductStatus.ACTIVE,
            approvalStatus: ApprovalStatus.APPROVED,
            deletedAt: null,
          },
        },
      },
      include: { user: true },
    });
    if (!sellers.length) {
      return;
    }

    await this.prisma.client.notificationLog.createMany({
      data: sellers.map((seller) => ({
        userId: seller.userId,
        channel: NotificationChannel.PUSH,
        templateCode: "DEAL_CAMPAIGN_AVAILABLE",
        eventCode: "deal.published",
        recipient: seller.user.email,
        subject: `${deal.title} is available for your catalogue`,
        body: `${deal.discountBps / 100}% seller-funded deal. Join by ${deal.joinDeadline.toISOString()}.`,
        variables: {
          dealId: deal.id,
          dealTitle: deal.title,
          discountBps: deal.discountBps,
          categoryName: deal.category.name,
          joinDeadline: deal.joinDeadline.toISOString(),
          startsAt: deal.startsAt.toISOString(),
          endsAt: deal.endsAt.toISOString(),
        },
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  private async createCustomerDealNotifications(dealId: string) {
    const deal = await this.prisma.client.deal.findUnique({
      where: { id: dealId },
      include: { category: true },
    });
    if (!deal || deal.status !== DealStatus.PUBLISHED) {
      return;
    }

    const customers = await this.prisma.client.customer.findMany({
      where: {
        status: UserStatus.ACTIVE,
        dealAlertsEnabled: true,
      },
      select: { id: true },
    });

    await Promise.allSettled(
      customers.map((customer) =>
        this.expoPush.notifyCustomer({
          customerId: customer.id,
          type: PushNotificationType.DEAL_PUBLISHED,
          templateCode: "CUSTOMER_DEAL_PUBLISHED_PUSH",
          eventCode: "deal.published.customer",
          title: `${deal.title} is live`,
          body: `${deal.discountBps / 100}% off selected ${deal.category.name} products.`,
          href: "/deals",
          sourceType: "deal",
          sourceId: deal.id,
          promotionalPreference: "dealAlertsEnabled",
          data: {
            type: "deal",
            dealId: deal.id,
            href: "/deals",
          },
        }),
      ),
    );
  }

  private dealAuditValue(deal: {
    id: string;
    title: string;
    categoryId: string;
    discountBps: number;
    joinDeadline: Date;
    startsAt: Date;
    endsAt: Date;
    status: DealStatus;
    maxSellers: number | null;
    maxProducts: number | null;
  }) {
    return {
      id: deal.id,
      title: deal.title,
      categoryId: deal.categoryId,
      discountBps: deal.discountBps,
      joinDeadline: deal.joinDeadline.toISOString(),
      startsAt: deal.startsAt.toISOString(),
      endsAt: deal.endsAt.toISOString(),
      status: deal.status,
      maxSellers: deal.maxSellers,
      maxProducts: deal.maxProducts,
    };
  }
}
