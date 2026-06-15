import type pino from "pino";
import {
  ApprovalStatus,
  CategoryStatus,
  DealProductEnrollmentStatus,
  DealStatus,
  ProductReviewStatus,
  ProductStatus,
  SearchDocumentEntityType,
  SearchDocumentVisibilityStatus,
  SearchIndexJobStatus,
  SellerStatus,
  VariantStatus,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;

type IndexJobClaim = {
  id: string;
  entityType: SearchDocumentEntityType;
  entityId: string;
  attempts: number;
  maxAttempts: number;
};

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

export function startSearchIndexPolling(logger: Logger) {
  if (process.env.SEARCH_INDEX_WORKER_ENABLED === "false") {
    logger.info("PostgreSQL search index worker disabled by SEARCH_INDEX_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.SEARCH_INDEX_POLL_INTERVAL_MS, 5000);
  const batchSize = positiveInteger(process.env.SEARCH_INDEX_BATCH_SIZE, 25);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await processSearchIndexJobs(batchSize);
      if (result.claimed > 0) {
        logger.info(result, "PostgreSQL search index jobs processed");
      }
    } catch (error) {
      logger.error({ error }, "PostgreSQL search index worker poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs, batchSize }, "PostgreSQL search index worker started");
}

export async function processSearchIndexJobs(limit = 25) {
  const jobs = await claimSearchIndexJobs(limit);
  const result = {
    claimed: jobs.length,
    completed: 0,
    failed: 0,
  };

  for (const job of jobs) {
    try {
      await indexEntity(job.entityType, job.entityId);
      await prisma.searchIndexJob.update({
        where: { id: job.id },
        data: {
          status: SearchIndexJobStatus.COMPLETED,
          completedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
      result.completed += 1;
    } catch (error) {
      const retrySeconds = Math.min(300, 2 ** Math.min(job.attempts, 8) * 10);
      await prisma.searchIndexJob.update({
        where: { id: job.id },
        data: {
          status: SearchIndexJobStatus.FAILED,
          lockedAt: null,
          availableAt: new Date(Date.now() + retrySeconds * 1000),
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      result.failed += 1;
    }
  }

  return result;
}

async function claimSearchIndexJobs(limit: number) {
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));

  return prisma.$transaction(async (tx) => {
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
              AND locked_at < NOW() - ('10 minutes')::interval
            )
          )
        ORDER BY available_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${take}
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

async function indexEntity(entityType: SearchDocumentEntityType, entityId: string) {
  if (entityType === SearchDocumentEntityType.PRODUCT) {
    await indexProduct(entityId);
    return;
  }

  if (entityType === SearchDocumentEntityType.STORE) {
    await indexSeller(entityId);
    return;
  }

  await indexCategory(entityId);
}

async function indexProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      seller: { include: { profile: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      variants: true,
    },
  });

  if (!product) {
    await deleteDocument(SearchDocumentEntityType.PRODUCT, productId);
    return;
  }

  const activeVariants = product.variants.filter((variant) => variant.status === VariantStatus.ACTIVE);
  const prices = activeVariants.map((variant) => variant.pricePaise);
  const inStock = activeVariants.some((variant) => variant.stockQuantity > 0);
  const [reviewSummary, dealSummary] = await Promise.all([
    productReviewSummary(product.id),
    activeProductDealSummary(product.id),
  ]);
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

  await upsertDocument({
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

async function indexSeller(sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: { profile: true, addresses: true },
  });

  if (!seller) {
    await deleteDocument(SearchDocumentEntityType.STORE, sellerId);
    return;
  }

  const [productStats, reviewSummary, dealSummary] = await Promise.all([
    sellerProductStats(seller.id),
    sellerReviewSummary(seller.id),
    activeSellerDealSummary(seller.id),
  ]);
  const primaryAddress = seller.addresses[0] ?? null;
  const visible =
    seller.deletedAt === null &&
    seller.status === SellerStatus.APPROVED &&
    seller.approvalStatus === ApprovalStatus.APPROVED;

  await upsertDocument({
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

async function indexCategory(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: true },
  });

  if (!category) {
    await deleteDocument(SearchDocumentEntityType.CATEGORY, categoryId);
    return;
  }

  const productCount = await prisma.product.count({
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

  await upsertDocument({
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

function upsertDocument(input: SearchDocumentInput) {
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

  return prisma.searchDocument.upsert({
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

function deleteDocument(entityType: SearchDocumentEntityType, entityId: string) {
  return prisma.searchDocument.deleteMany({ where: { entityType, entityId } });
}

async function productReviewSummary(productId: string) {
  const aggregate = await prisma.productReview.aggregate({
    where: { productId, status: ProductReviewStatus.APPROVED },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return {
    averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
    reviewCount: aggregate._count._all,
  };
}

async function sellerReviewSummary(sellerId: string) {
  const aggregate = await prisma.productReview.aggregate({
    where: { sellerId, status: ProductReviewStatus.APPROVED },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return {
    averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
    reviewCount: aggregate._count._all,
  };
}

async function activeProductDealSummary(productId: string) {
  const enrollment = await prisma.dealProductEnrollment.findFirst({
    where: activeDealEnrollmentWhere({ productId }),
    include: { deal: { select: { discountBps: true } } },
    orderBy: { createdAt: "desc" },
  });

  return { hasDeal: Boolean(enrollment), dealDiscountBps: enrollment?.deal.discountBps ?? 0 };
}

async function activeSellerDealSummary(sellerId: string) {
  const enrollment = await prisma.dealProductEnrollment.findFirst({
    where: activeDealEnrollmentWhere({ sellerId }),
    include: { deal: { select: { discountBps: true } } },
    orderBy: { createdAt: "desc" },
  });

  return { hasDeal: Boolean(enrollment), dealDiscountBps: enrollment?.deal.discountBps ?? 0 };
}

function activeDealEnrollmentWhere(filter: { productId?: string; sellerId?: string }) {
  const now = new Date();

  return {
    ...filter,
    status: DealProductEnrollmentStatus.ENROLLED,
    deal: {
      status: DealStatus.PUBLISHED,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
  };
}

async function sellerProductStats(sellerId: string) {
  const [productCount, inStockProduct] = await Promise.all([
    prisma.product.count({
      where: {
        sellerId,
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
      },
    }),
    prisma.product.findFirst({
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

  return { productCount, inStock: Boolean(inStockProduct) };
}

function compactText(values: Array<unknown>, joiner = " ") {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
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

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isSoldResaleProduct(product: { attributes?: unknown; variants?: Array<{ stockQuantity?: number | null; status?: string | null }> | null }) {
  const condition = productConditionValue(product.attributes);
  if (!condition || !["used", "refurbished"].includes(condition.toLowerCase())) {
    return false;
  }

  return !product.variants?.some((variant) => {
    const isActive = !variant.status || variant.status === VariantStatus.ACTIVE;
    return isActive && typeof variant.stockQuantity === "number" && variant.stockQuantity > 0;
  });
}

function productConditionValue(attributes: unknown) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return null;
  }

  const condition = (attributes as Record<string, unknown>).condition;
  return typeof condition === "string" ? condition.trim() : null;
}
