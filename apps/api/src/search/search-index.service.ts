import { Inject, Injectable } from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  DealProductEnrollmentStatus,
  DealStatus,
  Prisma,
  ProductReviewStatus,
  ProductStatus,
  SearchDocumentEntityType,
  SearchDocumentVisibilityStatus,
  SearchIndexJobStatus,
  SellerStatus,
  VariantStatus,
} from "@indihub/database";
import { isSoldResaleProduct } from "@indihub/shared-types";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";

type IndexJobClaim = {
  id: string;
  entityType: SearchDocumentEntityType;
  entityId: string;
  attempts: number;
  maxAttempts: number;
};

type SearchEntityPayload = Prisma.InputJsonObject | undefined;

type SearchDocumentInput = {
  entityType: SearchDocumentEntityType;
  entityId: string;
  title: string;
  subtitle?: string | null;
  searchText: string;
  slug?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  sellerId?: string | null;
  minPricePaise?: number | null;
  maxPricePaise?: number | null;
  ratingAverage?: number | null;
  reviewCount?: number;
  inStock?: boolean;
  hasDeal?: boolean;
  dealDiscountBps?: number;
  rankBoost?: number;
  visibilityStatus: SearchDocumentVisibilityStatus;
  sourceUpdatedAt?: Date | null;
};

const searchJobStaleMinutes = 10;

@Injectable()
export class SearchIndexService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  enqueueProduct(productId: string, payload?: SearchEntityPayload) {
    return this.enqueue(SearchDocumentEntityType.PRODUCT, productId, payload);
  }

  enqueueSeller(sellerId: string, payload?: SearchEntityPayload) {
    return this.enqueue(SearchDocumentEntityType.STORE, sellerId, payload);
  }

  enqueueCategory(categoryId: string, payload?: SearchEntityPayload) {
    return this.enqueue(SearchDocumentEntityType.CATEGORY, categoryId, payload);
  }

  async enqueue(entityType: SearchDocumentEntityType, entityId: string, payload?: SearchEntityPayload) {
    const dedupeKey = `${entityType}:${entityId}`;

    return this.prisma.client.searchIndexJob.upsert({
      where: { dedupeKey },
      update: {
        status: SearchIndexJobStatus.PENDING,
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        completedAt: null,
        lastError: null,
        payload: payload ?? Prisma.JsonNull,
      },
      create: {
        entityType,
        entityId,
        dedupeKey,
        payload: payload ?? Prisma.JsonNull,
      },
    });
  }

  async requestFullReindex(actor?: RequestUser) {
    const [productIds, sellerIds, categoryIds] = await Promise.all([
      this.prisma.client.product.findMany({ select: { id: true } }),
      this.prisma.client.seller.findMany({ select: { id: true } }),
      this.prisma.client.category.findMany({ select: { id: true } }),
    ]);

    for (const product of productIds) {
      await this.enqueueProduct(product.id, { reason: "full-reindex" });
    }
    for (const seller of sellerIds) {
      await this.enqueueSeller(seller.id, { reason: "full-reindex" });
    }
    for (const category of categoryIds) {
      await this.enqueueCategory(category.id, { reason: "full-reindex" });
    }

    if (actor) {
      await this.prisma.client.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "search.full_reindex.requested",
          entityType: "search",
          entityId: actor.id,
          newValue: {
            products: productIds.length,
            stores: sellerIds.length,
            categories: categoryIds.length,
          },
        },
      });
    }

    return {
      queued: {
        products: productIds.length,
        stores: sellerIds.length,
        categories: categoryIds.length,
        total: productIds.length + sellerIds.length + categoryIds.length,
      },
    };
  }

  async jobOverview() {
    const grouped = await this.prisma.client.searchIndexJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    const lastCompleted = await this.prisma.client.searchIndexJob.findFirst({
      where: { status: SearchIndexJobStatus.COMPLETED },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, entityType: true, entityId: true },
    });

    return {
      counts: {
        pending: counts[SearchIndexJobStatus.PENDING] ?? 0,
        processing: counts[SearchIndexJobStatus.PROCESSING] ?? 0,
        completed: counts[SearchIndexJobStatus.COMPLETED] ?? 0,
        failed: counts[SearchIndexJobStatus.FAILED] ?? 0,
      },
      lastCompleted,
    };
  }

  async processPendingJobs(limit = 25) {
    const take = Math.min(100, Math.max(1, Math.trunc(limit)));
    const jobs = await this.claimJobs(take);
    const result = {
      claimed: jobs.length,
      completed: 0,
      failed: 0,
    };

    for (const job of jobs) {
      try {
        await this.indexEntity(job.entityType, job.entityId);
        await this.markJobCompleted(job.id);
        result.completed += 1;
      } catch (error) {
        await this.markJobFailed(job, error);
        result.failed += 1;
      }
    }

    return result;
  }

  async indexEntity(entityType: SearchDocumentEntityType, entityId: string) {
    if (entityType === SearchDocumentEntityType.PRODUCT) {
      return this.indexProduct(entityId);
    }

    if (entityType === SearchDocumentEntityType.STORE) {
      return this.indexSeller(entityId);
    }

    return this.indexCategory(entityId);
  }

  private async claimJobs(limit: number) {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('statement_timeout', '2000ms', true)`;

      return tx.$queryRaw<IndexJobClaim[]>`
        UPDATE search_index_jobs
        SET
          status = ${SearchIndexJobStatus.PROCESSING}::"SearchIndexJobStatus",
          locked_at = NOW(),
          attempts = attempts + 1,
          updated_at = NOW()
        WHERE id IN (
          SELECT id
          FROM search_index_jobs
          WHERE
            attempts < max_attempts
            AND available_at <= NOW()
            AND (
              status IN (
                ${SearchIndexJobStatus.PENDING}::"SearchIndexJobStatus",
                ${SearchIndexJobStatus.FAILED}::"SearchIndexJobStatus"
              )
              OR (
                status = ${SearchIndexJobStatus.PROCESSING}::"SearchIndexJobStatus"
                AND locked_at < NOW() - (${searchJobStaleMinutes}::text || ' minutes')::interval
              )
            )
          ORDER BY available_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        RETURNING
          id,
          entity_type::text AS "entityType",
          entity_id::text AS "entityId",
          attempts,
          max_attempts AS "maxAttempts"
      `;
    });
  }

  private markJobCompleted(jobId: string) {
    return this.prisma.client.searchIndexJob.update({
      where: { id: jobId },
      data: {
        status: SearchIndexJobStatus.COMPLETED,
        completedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
  }

  private markJobFailed(job: IndexJobClaim, error: unknown) {
    const retrySeconds = Math.min(300, 2 ** Math.min(job.attempts, 8) * 10);

    return this.prisma.client.searchIndexJob.update({
      where: { id: job.id },
      data: {
        status: SearchIndexJobStatus.FAILED,
        lockedAt: null,
        availableAt: new Date(Date.now() + retrySeconds * 1000),
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }

  private async indexProduct(productId: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        seller: {
          include: {
            profile: true,
          },
        },
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        variants: true,
      },
    });

    if (!product) {
      await this.deleteDocument(SearchDocumentEntityType.PRODUCT, productId);
      return;
    }

    const activeVariants = product.variants.filter((variant) => variant.status === VariantStatus.ACTIVE);
    const prices = activeVariants.map((variant) => variant.pricePaise);
    const inStock = activeVariants.some((variant) => variant.stockQuantity > 0);
    const visible =
      product.deletedAt === null &&
      product.status === ProductStatus.ACTIVE &&
      product.approvalStatus === ApprovalStatus.APPROVED &&
      product.category.deletedAt === null &&
      product.category.status === CategoryStatus.ACTIVE &&
      product.seller.deletedAt === null &&
      product.seller.status === SellerStatus.APPROVED &&
      product.seller.approvalStatus === ApprovalStatus.APPROVED &&
      !isSoldResaleProduct(product);

    const [reviewSummary, dealSummary] = await Promise.all([
      this.productReviewSummary(product.id),
      this.activeProductDealSummary(product.id),
    ]);

    await this.upsertDocument({
      entityType: SearchDocumentEntityType.PRODUCT,
      entityId: product.id,
      title: product.name,
      subtitle: `${product.seller.storeName} - ${product.category.name}`,
      searchText: compactText([
        product.name,
        product.description,
        product.searchText,
        product.seller.storeName,
        product.category.name,
        jsonSearchText(product.attributes),
        product.variants.map((variant) => compactText([variant.sku, variant.variantName, jsonSearchText(variant.attributes)])).join(" "),
      ]),
      slug: product.slug,
      imageUrl: product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null,
      categoryId: product.categoryId,
      sellerId: product.sellerId,
      minPricePaise: prices.length ? Math.min(...prices) : null,
      maxPricePaise: prices.length ? Math.max(...prices) : null,
      ratingAverage: reviewSummary.averageRating,
      reviewCount: reviewSummary.reviewCount,
      inStock,
      hasDeal: dealSummary.hasDeal,
      dealDiscountBps: dealSummary.dealDiscountBps,
      rankBoost: (product.isFeatured ? 40 : 0) + (dealSummary.hasDeal ? 12 : 0) + Math.min(reviewSummary.reviewCount, 50),
      visibilityStatus: visible ? SearchDocumentVisibilityStatus.VISIBLE : SearchDocumentVisibilityStatus.HIDDEN,
      sourceUpdatedAt: product.updatedAt,
    });
  }

  private async indexSeller(sellerId: string) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { id: sellerId },
      include: {
        profile: true,
        addresses: true,
      },
    });

    if (!seller) {
      await this.deleteDocument(SearchDocumentEntityType.STORE, sellerId);
      return;
    }

    const [productStats, reviewSummary, dealSummary] = await Promise.all([
      this.sellerProductStats(seller.id),
      this.sellerReviewSummary(seller.id),
      this.activeSellerDealSummary(seller.id),
    ]);
    const primaryAddress = seller.addresses[0] ?? null;
    const visible =
      seller.deletedAt === null &&
      seller.status === SellerStatus.APPROVED &&
      seller.approvalStatus === ApprovalStatus.APPROVED;

    await this.upsertDocument({
      entityType: SearchDocumentEntityType.STORE,
      entityId: seller.id,
      title: seller.storeName,
      subtitle: compactText([primaryAddress?.area, primaryAddress?.city], ", "),
      searchText: compactText([
        seller.storeName,
        seller.slug,
        seller.sellerType,
        seller.profile?.description,
        seller.profile?.businessLegalName,
        seller.addresses.map((address) => compactText([address.area, address.city, address.state, address.country, address.pincode])).join(" "),
      ]),
      slug: seller.slug,
      imageUrl: seller.profile?.logoUrl ?? null,
      sellerId: seller.id,
      ratingAverage: reviewSummary.averageRating,
      reviewCount: reviewSummary.reviewCount,
      inStock: productStats.inStock,
      hasDeal: dealSummary.hasDeal,
      dealDiscountBps: dealSummary.dealDiscountBps,
      rankBoost: Math.min(productStats.productCount, 60) + Math.min(reviewSummary.reviewCount, 60),
      visibilityStatus: visible ? SearchDocumentVisibilityStatus.VISIBLE : SearchDocumentVisibilityStatus.HIDDEN,
      sourceUpdatedAt: seller.updatedAt,
    });
  }

  private async indexCategory(categoryId: string) {
    const category = await this.prisma.client.category.findUnique({
      where: { id: categoryId },
      include: {
        parent: true,
      },
    });

    if (!category) {
      await this.deleteDocument(SearchDocumentEntityType.CATEGORY, categoryId);
      return;
    }

    const productCount = await this.prisma.client.product.count({
      where: {
        categoryId: category.id,
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        seller: {
          deletedAt: null,
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
        },
      },
    });
    const visible = category.deletedAt === null && category.status === CategoryStatus.ACTIVE;

    await this.upsertDocument({
      entityType: SearchDocumentEntityType.CATEGORY,
      entityId: category.id,
      title: category.name,
      subtitle: productCount === 1 ? "1 product" : `${productCount} products`,
      searchText: compactText([category.name, category.slug, category.description, category.parent?.name]),
      slug: category.slug,
      imageUrl: category.imageUrl,
      categoryId: category.id,
      rankBoost: Math.max(0, 30 - category.sortOrder) + Math.min(productCount, 40),
      visibilityStatus: visible ? SearchDocumentVisibilityStatus.VISIBLE : SearchDocumentVisibilityStatus.HIDDEN,
      sourceUpdatedAt: category.updatedAt,
    });
  }

  private upsertDocument(input: SearchDocumentInput) {
    const data = {
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      normalizedTitle: normalizeIndexText(input.title),
      subtitle: input.subtitle || null,
      normalizedSubtitle: input.subtitle ? normalizeIndexText(input.subtitle) : null,
      searchText: normalizeIndexText(input.searchText),
      slug: input.slug ?? null,
      imageUrl: input.imageUrl ?? null,
      categoryId: input.categoryId ?? null,
      sellerId: input.sellerId ?? null,
      minPricePaise: input.minPricePaise ?? null,
      maxPricePaise: input.maxPricePaise ?? null,
      ratingAverage: input.ratingAverage ?? null,
      reviewCount: input.reviewCount ?? 0,
      inStock: input.inStock ?? false,
      hasDeal: input.hasDeal ?? false,
      dealDiscountBps: input.dealDiscountBps ?? 0,
      rankBoost: input.rankBoost ?? 0,
      visibilityStatus: input.visibilityStatus,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null,
    };

    return this.prisma.client.searchDocument.upsert({
      where: {
        entityType_entityId: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      update: data,
      create: data,
    });
  }

  private deleteDocument(entityType: SearchDocumentEntityType, entityId: string) {
    return this.prisma.client.searchDocument.deleteMany({
      where: { entityType, entityId },
    });
  }

  private async productReviewSummary(productId: string) {
    const aggregate = await this.prisma.client.productReview.aggregate({
      where: { productId, status: ProductReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
      reviewCount: aggregate._count._all,
    };
  }

  private async sellerReviewSummary(sellerId: string) {
    const aggregate = await this.prisma.client.productReview.aggregate({
      where: { sellerId, status: ProductReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
      reviewCount: aggregate._count._all,
    };
  }

  private async activeProductDealSummary(productId: string) {
    const enrollment = await this.prisma.client.dealProductEnrollment.findFirst({
      where: activeDealEnrollmentWhere({ productId }),
      include: { deal: { select: { discountBps: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      hasDeal: Boolean(enrollment),
      dealDiscountBps: enrollment?.deal.discountBps ?? 0,
    };
  }

  private async activeSellerDealSummary(sellerId: string) {
    const enrollment = await this.prisma.client.dealProductEnrollment.findFirst({
      where: activeDealEnrollmentWhere({ sellerId }),
      include: { deal: { select: { discountBps: true } } },
      orderBy: { createdAt: "desc" },
    });

    return {
      hasDeal: Boolean(enrollment),
      dealDiscountBps: enrollment?.deal.discountBps ?? 0,
    };
  }

  private async sellerProductStats(sellerId: string) {
    const [productCount, inStockProduct] = await Promise.all([
      this.prisma.client.product.count({
        where: {
          sellerId,
          deletedAt: null,
          status: ProductStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
        },
      }),
      this.prisma.client.product.findFirst({
        where: {
          sellerId,
          deletedAt: null,
          status: ProductStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
          variants: {
            some: {
              status: VariantStatus.ACTIVE,
              stockQuantity: { gt: 0 },
            },
          },
        },
        select: { id: true },
      }),
    ]);

    return {
      productCount,
      inStock: Boolean(inStockProduct),
    };
  }
}

function activeDealEnrollmentWhere(filter: { productId?: string; sellerId?: string }) {
  return {
    ...filter,
    status: DealProductEnrollmentStatus.ENROLLED,
    deal: {
      status: DealStatus.PUBLISHED,
      startsAt: { lte: new Date() },
      endsAt: { gte: new Date() },
    },
  };
}

function compactText(values: Array<unknown>, joiner = " ") {
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      return [value];
    })
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(joiner)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function normalizeIndexText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function jsonSearchText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const output: string[] = [];
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (typeof entry === "string" || typeof entry === "number") {
      output.push(String(entry));
    } else if (Array.isArray(entry)) {
      output.push(
        entry
          .filter((item) => typeof item === "string" || typeof item === "number")
          .map(String)
          .join(" "),
      );
    }
  }

  return output.join(" ");
}
