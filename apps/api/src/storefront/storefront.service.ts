import { createHash } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  ContentStatus,
  DealProductEnrollmentStatus,
  DealStatus,
  Prisma,
  ProductReviewStatus,
  ProductStatus,
  SellerStatus,
  UserStatus,
  VariantStatus,
} from "@indihub/database";
import { isSoldResaleProduct } from "@indihub/shared-types";
import { ClerkAuthService } from "../auth/clerk-auth.service";
import { CmsService } from "../cms/cms.service";
import { paginationFromQuery } from "../common/pagination";
import { StorefrontCacheService } from "./storefront-cache.service";
import { DealPricingService } from "../deals/deal-pricing.service";
import { MarketService } from "../market/market.service";
import { ProductQueryDto } from "../products/dto/product-query.dto";
import { PrismaService } from "../prisma/prisma.service";
import { PublicSellerQueryDto } from "../sellers/dto/public-seller-query.dto";
import { contactSettingKey, contactSettingsFromSetting, publicContactConfig } from "../settings/contact-settings";
import { readBooleanSetting } from "../settings/setting-value-utils";
import { isTransientPrismaConnectionError, retryTransientPrismaRead } from "../prisma/transient-read-retry";
import {
  StorefrontStoreRankingService,
  type PublicStoreSellerRecord,
  type StoreLocationMatchLevel,
  type StoreRankingMode,
  type StoreRankingReason,
} from "./storefront-store-ranking.service";

const publicSellerProfileSelect = {
  logoUrl: true,
  bannerUrl: true,
  description: true,
};

const productTemplateInclude = {
  fields: {
    orderBy: [
      { scope: "asc" as const },
      { sortOrder: "asc" as const },
      { label: "asc" as const },
    ],
  },
};

const publicCategoryCardSelect = {
  id: true,
  parentId: true,
  productTemplateId: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  defaultTaxClassification: true,
  defaultHsnCode: true,
  defaultSacCode: true,
  defaultSacMasterId: true,
  defaultGstRatePercent: true,
  defaultTaxDescription: true,
  sortOrder: true,
} satisfies Prisma.CategorySelect;

const publicProductVariantSelect = {
  id: true,
  variantName: true,
  pricePaise: true,
  mrpPaise: true,
  currency: true,
  stockQuantity: true,
  packageWeightGrams: true,
  packageLengthCm: true,
  packageBreadthCm: true,
  packageHeightCm: true,
  status: true,
  attributes: true,
} satisfies Prisma.ProductVariantSelect;

const publicProductInclude = {
  category: {
    select: publicCategoryCardSelect,
  },
  seller: {
    select: {
      id: true,
      storeName: true,
      slug: true,
      sellerType: true,
      profile: {
        select: publicSellerProfileSelect,
      },
    },
  },
  images: {
    select: {
      id: true,
      url: true,
      altText: true,
      sortOrder: true,
      isPrimary: true,
    },
    orderBy: [
      { isPrimary: "desc" as const },
      { sortOrder: "asc" as const },
      { createdAt: "asc" as const },
    ],
    take: 4,
  },
  variants: {
    select: publicProductVariantSelect,
    where: {
      status: VariantStatus.ACTIVE,
    },
    orderBy: [
      { stockQuantity: "desc" as const },
      { createdAt: "asc" as const },
    ],
    take: 4,
  },
};

const publicProductWhere: Prisma.ProductWhereInput = {
  deletedAt: null,
  status: ProductStatus.ACTIVE,
  approvalStatus: ApprovalStatus.APPROVED,
  seller: {
    status: SellerStatus.APPROVED,
    approvalStatus: ApprovalStatus.APPROVED,
  },
  category: {
    status: CategoryStatus.ACTIVE,
    deletedAt: null,
  },
};

const DEAL_SECTION_TYPE = "deal_strip";
const HOME_OPTIONAL_READ_TIMEOUT_MS = positiveIntegerEnv(
  "STOREFRONT_HOME_OPTIONAL_READ_TIMEOUT_MS",
  10_000,
);
const HOME_OPTIONAL_CACHE_TTL_MS = positiveIntegerEnv(
  "STOREFRONT_HOME_OPTIONAL_CACHE_TTL_MS",
  120_000,
);
const HOME_PAYLOAD_CACHE_TTL_MS = positiveIntegerEnv("STOREFRONT_HOME_CACHE_TTL_MS", 30_000);
const homeOptionalReadCache = new Map<string, { expiresAt: number; value: unknown }>();
const homePayloadCache = new Map<string, { expiresAt: number; value: unknown }>();

type PublicProduct = Prisma.ProductGetPayload<{ include: typeof publicProductInclude }>;
type PublicSellerRecord = PublicStoreSellerRecord;

type PublicReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};
type HomepageSectionRecord = {
  sectionType: string;
  config: Prisma.JsonValue;
  status: ContentStatus;
};
type HomepageDealItem = {
  sourceId: string;
  label: string | null;
  badge: string | null;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
};

type HomeRequestOptions = {
  authorizationHeader?: string;
  clerkUserId?: string;
  platformUserId?: string;
  customerId?: string | null;
};

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CmsService) private readonly cms: CmsService,
    @Inject(StorefrontStoreRankingService)
    private readonly storeRanking: StorefrontStoreRankingService,
    @Inject(StorefrontCacheService) private readonly cache: StorefrontCacheService,
    @Optional()
    @Inject(ClerkAuthService)
    private readonly clerkAuthService?: ClerkAuthService,
    @Optional()
    @Inject(DealPricingService)
    private readonly dealPricing?: DealPricingService,
    @Inject(MarketService) private readonly marketService?: MarketService,
  ) {}

  async getHome(query: PublicSellerQueryDto = {}, options: HomeRequestOptions = {}) {
    const customerId =
      options.customerId ?? (await this.resolveOptionalHomepageCustomerId(options)) ?? null;
    const cacheKey = `home:${this.homeLocationCacheKey(query)}:${this.homeViewerCacheKey(customerId)}`;
    const cached = await this.readHomePayloadCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const payload = await retryTransientPrismaRead(() => this.getHomePayload(query, { customerId }));
      await this.writeHomePayloadCache(cacheKey, payload);
      return payload;
    } catch (error) {
      if (!isTransientPrismaConnectionError(error)) {
        throw error;
      }

      const stale = await this.readHomePayloadCache(cacheKey, { allowStale: true });
      if (stale) {
        this.logger.warn("Transient database connection issue while reading homepage; returning stale homepage cache.");
        return stale;
      }

      throw error;
    }
  }

  private async getHomePayload(
    query: PublicSellerQueryDto = {},
    options: { customerId?: string | null } = {},
  ) {
    const [banners, homepageSections, headerMenu, footerMenu, legalMenu] = await Promise.all([
      this.cms.listPublishedBanners(),
      this.cms.listPublishedHomepageSections({ includeInactiveSchedule: true }),
      this.cms.listPublishedMenuItems("header"),
      this.cms.listPublishedMenuItems("footer"),
      this.cms.listPublishedMenuItems("legal"),
    ]);

    const liveHomepageSections = homepageSections.filter((section) =>
      homepageSectionScheduleIsLive(section),
    );
    const activeDealSection =
      liveHomepageSections.find((section) => section.sectionType === DEAL_SECTION_TYPE) ?? null;
    const hasConfiguredDealSection = homepageSections.some(
      (section) => section.sectionType === DEAL_SECTION_TYPE,
    );

    const [
      categories,
      categoryProductCounts,
      storesNearYou,
      featuredProducts,
      latestProducts,
      dealProducts,
      stats,
      fallbackHeroSetting,
    ] = await Promise.all([
      this.optionalHomeRead("home categories", "home:categories", () => this.listHomeCategories(), []),
      this.optionalHomeRead(
        "home category product counts",
        "home:category-product-counts",
        () => this.listPublicCategoryProductCounts(),
        [],
      ),
      this.optionalHomeRead(
        "home nearby stores",
        `home:stores:${this.homeLocationCacheKey(query)}:${this.homeViewerCacheKey(options.customerId)}`,
        () => this.listHomeStores(query, options),
        { stores: [], mode: "DAILY_ROTATION" as StoreRankingMode },
      ),
      this.optionalHomeRead(
        "featured home products",
        "home:products:featured",
        () =>
          this.listHomeProducts({
            orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
            take: 10,
          }),
        [],
      ),
      this.optionalHomeRead(
        "latest home products",
        "home:products:latest",
        () =>
          this.listHomeProducts({
            orderBy: [{ createdAt: "desc" }],
            take: 10,
          }),
        [],
      ),
      this.optionalHomeRead(
        "home deal products",
        `home:products:deals:${activeDealSection?.id ?? (hasConfiguredDealSection ? "configured" : "automatic")}`,
        () => this.resolveHomeDealProducts(activeDealSection, hasConfiguredDealSection),
        [],
      ),
      this.optionalHomeRead("home stats", "home:stats", () => this.getStats(), {
        liveProducts: 0,
        approvedStores: 0,
        activeCustomers: 0,
        activeCategories: 0,
        verifiedSellers: 0,
        verifiedSellerPercent: 0,
      }),
      this.optionalHomeRead(
        "fallback hero setting",
        "home:fallback-hero-setting",
        () =>
          this.prisma.client.setting?.findUnique
            ? this.prisma.client.setting.findUnique({ where: { key: "cms.fallback_hero.enabled" } })
            : Promise.resolve(null),
        null,
      ),
    ]);

    const categoryCounts = new Map(
      categoryProductCounts.map((count) => [count.categoryId, count._count._all]),
    );
    const liveCategories = this.withLiveProductCounts(categories, categoryCounts);
    const sellerCta = liveHomepageSections.find((section) => section.sectionType === "seller_cta") ?? null;
    const serviceBadges =
      liveHomepageSections.find((section) => section.sectionType === "service_badges") ??
      liveHomepageSections.find((section) => section.sectionType === "trust_highlights") ??
      null;
    const fallbackHeroEnabled = readBooleanSetting(fallbackHeroSetting?.value, true);

    return {
      banners,
      fallbackHeroEnabled,
      homepageSections: liveHomepageSections,
      categories: liveCategories,
      storesNearYou: storesNearYou.stores,
      storeRankingMode: storesNearYou.mode,
      productRails: {
        featured: featuredProducts,
        latest: latestProducts,
        deals: dealProducts,
      },
      stats,
      menus: {
        header: headerMenu,
        footer: footerMenu,
        legal: legalMenu,
      },
      sellerCta,
      serviceBadges,
      generatedAt: new Date().toISOString(),
    };
  }

  async listDeals(query: ProductQueryDto = {}) {
    return retryTransientPrismaRead(() => this.listDealsPayload(query));
  }

  async getContactConfig() {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key: contactSettingKey },
    });

    return publicContactConfig(contactSettingsFromSetting(setting));
  }

  clearHomeCache() {
    this.logger.debug("Clearing storefront home cache");
    homeOptionalReadCache.clear();
    homePayloadCache.clear();
  }

  private async listDealsPayload(query: ProductQueryDto = {}) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 24, maxLimit: 100 });
    const homepageSections = await this.cms.listPublishedHomepageSections({
      includeInactiveSchedule: true,
    });
    const liveHomepageSections = homepageSections.filter((section) =>
      homepageSectionScheduleIsLive(section),
    );
    const activeDealSection =
      liveHomepageSections.find((section) => section.sectionType === DEAL_SECTION_TYPE) ?? null;
    const hasConfiguredDealSection = homepageSections.some(
      (section) => section.sectionType === DEAL_SECTION_TYPE,
    );

    let products: PublicProduct[] = [];
    if (activeDealSection) {
      const selectedProductIds = productIdsFromHomepageSection(activeDealSection);
      if (selectedProductIds.length) {
        products = await this.listSelectedDealProducts(activeDealSection, query);
      } else {
        products = await this.listDiscountedProducts({ query, candidateLimit: 500 });
      }
    } else if (!hasConfiguredDealSection) {
      products = await this.listDiscountedProducts({ query, candidateLimit: 500 });
    }

    return {
      items: products.slice(skip, skip + take),
      total: products.length,
      page,
      limit: take,
    };
  }

  private listHomeCategories() {
    return this.prisma.client.category.findMany({
      where: {
        status: CategoryStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        productTemplate: {
          include: productTemplateInclude,
        },
        children: {
          where: {
            status: CategoryStatus.ACTIVE,
            deletedAt: null,
          },
          include: {
            productTemplate: {
              include: productTemplateInclude,
            },
            _count: {
              select: { products: true, children: true },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        _count: {
          select: { products: true, children: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 16,
    });
  }

  private listPublicCategoryProductCounts() {
    return this.prisma.client.product.groupBy({
      by: ["categoryId"],
      where: publicProductWhere,
      _count: { _all: true },
    });
  }

  private async listHomeStores(
    query: PublicSellerQueryDto,
    options: { customerId?: string | null } = {},
  ) {
    const ranked = await this.storeRanking.rankHomeStores({
      query,
      customerId: options.customerId ?? null,
    });
    const sellerIds = ranked.stores.map((store) => store.seller.id);
    const [previewProductsBySeller, reviewSummaries] = await Promise.all([
      this.listStorePreviewProducts(sellerIds),
      this.reviewSummariesForSellers(sellerIds),
    ]);

    return {
      mode: ranked.mode,
      stores: ranked.stores.map((rankedStore) =>
        this.toPublicSellerResponse(
          rankedStore.seller,
          rankedStore.productCount,
          rankedStore.locationMatchLevel,
          previewProductsBySeller.get(rankedStore.seller.id) ?? [],
          reviewSummaries.get(rankedStore.seller.id),
          rankedStore.rankingReason,
          rankedStore.distanceMeters,
        ),
      ),
    };
  }

  private async listStorePreviewProducts(sellerIds: string[]) {
    const previews = new Map<string, PublicProduct[]>();
    if (!sellerIds.length) {
      return previews;
    }

    await Promise.all(
      sellerIds.map(async (sellerId) => {
        const products = await this.prisma.client.product.findMany({
          where: {
            ...publicProductWhere,
            sellerId,
          },
          include: publicProductInclude,
          orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
          take: 12,
        });

        const decorated = await this.decoratePublicProducts(this.publicVisibleProducts(products));
        previews.set(sellerId, decorated.slice(0, 3));
      })
    );

    return previews;
  }

  private async listHomeProducts(input: {
    orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
    take: number;
  }) {
    const products = await this.prisma.client.product.findMany({
      where: publicProductWhere,
      include: publicProductInclude,
      orderBy: input.orderBy,
      take: input.take * 3,
    });

    return this.decoratePublicProducts(this.publicVisibleProducts(products).slice(0, input.take));
  }

  private async resolveHomeDealProducts(
    activeDealSection: HomepageSectionRecord | null,
    hasConfiguredDealSection: boolean,
  ) {
    if (activeDealSection) {
      const selectedDealProducts = await this.listSelectedDealProducts(activeDealSection);
      return selectedDealProducts.length
        ? selectedDealProducts
        : this.listDiscountedProducts({ resultLimit: 8 });
    }

    return hasConfiguredDealSection ? [] : this.listDiscountedProducts({ resultLimit: 8 });
  }

  private async listSelectedDealProducts(
    section: HomepageSectionRecord,
    query: ProductQueryDto = {},
  ) {
    const dealItems = dealItemsFromHomepageSection(section);
    const productIds = dealItems.map((item) => item.sourceId);
    if (!productIds.length) {
      return [];
    }

    const products = await this.prisma.client.product.findMany({
      where: {
        ...publicProductWhere,
        ...this.publicProductQueryWhere(query),
        id: { in: productIds },
      },
      include: publicProductInclude,
    });
    const productById = new Map(
      this.publicVisibleProducts(products).map((product) => [product.id, product]),
    );
    const dealItemByProductId = new Map(dealItems.map((item) => [item.sourceId, item]));

    const selectedProducts = productIds.flatMap((productId) => {
      const product = productById.get(productId);
      const dealItem = dealItemByProductId.get(productId);
      return product
        ? [
            {
              ...product,
              campaignBadge: dealItem?.badge ?? null,
              campaignLabel: dealItem?.label ?? null,
              campaignDescription: dealItem?.description ?? null,
              campaignImageUrl: dealItem?.imageUrl ?? null,
              campaignLinkUrl: dealItem?.linkUrl ?? null,
            },
          ]
        : [];
    });

    return this.decoratePublicProducts(selectedProducts);
  }

  private async listDiscountedProducts(input: {
    query?: ProductQueryDto;
    candidateLimit?: number;
    resultLimit?: number;
  } = {}) {
    const activeDealProductIds = await this.activeDealProductIds();
    const products = await this.prisma.client.product.findMany({
      where: {
        AND: [
          publicProductWhere,
          this.publicProductQueryWhere(input.query ?? {}),
          {
            OR: [
              ...(activeDealProductIds.length ? [{ id: { in: activeDealProductIds } }] : []),
              {
                variants: {
                  some: {
                    status: VariantStatus.ACTIVE,
                    mrpPaise: { not: null },
                  },
                },
              },
            ],
          },
        ],
      },
      include: publicProductInclude,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: input.candidateLimit ?? 24,
    });

    const decoratedProducts = await this.decoratePublicProducts(products);
    const discountedProducts = this.sortDealProducts(
      decoratedProducts.filter(
        (product) =>
          !isSoldResaleProduct(product) &&
          ((product as PublicProduct & { activeDeal?: unknown }).activeDeal ||
            discountedVariantScore(product).discountPercent > 0),
      ),
    );

    return typeof input.resultLimit === "number"
      ? discountedProducts.slice(0, input.resultLimit)
      : discountedProducts;
  }

  private async activeDealProductIds() {
    const now = new Date();
    const enrollments = await this.prisma.client.dealProductEnrollment.findMany({
      where: {
        status: DealProductEnrollmentStatus.ENROLLED,
        deal: {
          status: DealStatus.PUBLISHED,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      },
      select: { productId: true },
      distinct: ["productId"],
      take: 500,
    });
    return enrollments.map((enrollment) => enrollment.productId);
  }

  private async decoratePublicProducts<T extends { id: string; variants: Array<{ pricePaise: number } & Record<string, unknown>> }>(
    products: T[],
  ) {
    const decoratedProducts = this.dealPricing ? await this.dealPricing.applyActiveDealsToProducts(products) : products;
    const reviewSummaries = await this.reviewSummariesForProducts(decoratedProducts.map((product) => product.id));

    return Promise.all(
      decoratedProducts.map(async (product) => ({
        ...product,
        variants: await Promise.all(product.variants.map((variant) => this.publicVariantPriceReadback(variant))),
        reviewSummary: reviewSummaries.get(product.id) ?? this.emptyReviewSummary(),
      })),
    );
  }

  private async publicVariantPriceReadback<T extends {
    pricePaise: number;
    mrpPaise?: number | null;
    currency?: string | null;
    originalPricePaise?: number | null;
    dealPricePaise?: number | null;
  }>(variant: T) {
    const baseCurrency = (process.env.FX_BASE_CURRENCY ?? "INR").toUpperCase();
    const sourceCurrency = variant.currency?.trim().toUpperCase() || baseCurrency;
    const convert = (value?: number | null) =>
      value === undefined || value === null
        ? Promise.resolve(value ?? null)
        : this.marketService!.convertMinorUnitsToBase(value, sourceCurrency);

    const [basePricePaise, baseMrpPaise, baseOriginalPricePaise, baseDealPricePaise] = await Promise.all([
      convert(variant.pricePaise),
      convert(variant.mrpPaise),
      convert(variant.originalPricePaise),
      convert(variant.dealPricePaise),
    ]);

    return {
      ...variant,
      basePricePaise,
      baseMrpPaise,
      baseOriginalPricePaise,
      baseDealPricePaise,
      baseCurrency,
    };
  }

  private async reviewSummariesForProducts(productIds: string[]) {
    const summaries = new Map<string, PublicReviewSummary>();
    if (!productIds.length) {
      return summaries;
    }

    const where = {
      productId: { in: productIds },
      status: ProductReviewStatus.APPROVED,
    };
    const [aggregates, distributionRows] = await Promise.all([
      this.prisma.client.productReview.groupBy({
        by: ["productId"],
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.client.productReview.groupBy({
        by: ["productId", "rating"],
        where,
        _count: { _all: true },
      }),
    ]);

    for (const aggregate of aggregates) {
      summaries.set(aggregate.productId, {
        ...this.emptyReviewSummary(),
        averageRating:
          aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
        reviewCount: aggregate._count._all,
      });
    }

    for (const row of distributionRows) {
      const summary = summaries.get(row.productId) ?? this.emptyReviewSummary();
      if (row.rating >= 1 && row.rating <= 5) {
        summary.distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
      }
      summaries.set(row.productId, summary);
    }

    return summaries;
  }

  private emptyReviewSummary(): PublicReviewSummary {
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

  private async reviewSummariesForSellers(sellerIds: string[]) {
    const summaries = new Map<string, PublicReviewSummary>();
    if (!sellerIds.length) {
      return summaries;
    }

    const where = {
      sellerId: { in: sellerIds },
      status: ProductReviewStatus.APPROVED,
    };
    const [aggregates, distributionRows] = await Promise.all([
      this.prisma.client.productReview.groupBy({
        by: ["sellerId"],
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.client.productReview.groupBy({
        by: ["sellerId", "rating"],
        where,
        _count: { _all: true },
      }),
    ]);

    for (const aggregate of aggregates) {
      summaries.set(aggregate.sellerId, {
        ...this.emptyReviewSummary(),
        averageRating:
          aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
        reviewCount: aggregate._count._all,
      });
    }

    for (const row of distributionRows) {
      const summary = summaries.get(row.sellerId) ?? this.emptyReviewSummary();
      if (row.rating >= 1 && row.rating <= 5) {
        summary.distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
      }
      summaries.set(row.sellerId, summary);
    }

    return summaries;
  }

  private publicProductQueryWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    return {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { searchText: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private publicVisibleProducts<T extends PublicProduct>(products: T[]) {
    return products.filter((product) => !isSoldResaleProduct(product));
  }

  private sortDealProducts(products: PublicProduct[]) {
    return [...products].sort((left, right) => {
      const leftScore = discountedVariantScore(left);
      const rightScore = discountedVariantScore(right);
      const discountDelta = rightScore.discountPercent - leftScore.discountPercent;

      if (discountDelta !== 0) {
        return discountDelta;
      }

      const stockDelta = dealStockRank(leftScore.stockQuantity) - dealStockRank(rightScore.stockQuantity);
      if (stockDelta !== 0) {
        return stockDelta;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }

  private async getStats() {
    const [
      liveProducts,
      approvedSellers,
      activeCustomers,
      activeCategories,
      totalSellers,
    ] = await Promise.all([
      this.prisma.client.product.count({ where: publicProductWhere }),
      this.prisma.client.seller.count({
        where: {
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
          deletedAt: null,
        },
      }),
      this.prisma.client.customer.count({
        where: {
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.client.category.count({
        where: {
          status: CategoryStatus.ACTIVE,
          deletedAt: null,
        },
      }),
      this.prisma.client.seller.count({
        where: {
          deletedAt: null,
        },
      }),
    ]);

    return {
      liveProducts,
      approvedStores: approvedSellers,
      activeCustomers,
      activeCategories,
      verifiedSellers: approvedSellers,
      verifiedSellerPercent: totalSellers
        ? Math.round((approvedSellers / totalSellers) * 100)
        : approvedSellers > 0
          ? 100
          : 0,
    };
  }

  private async optionalHomeRead<T>(
    label: string,
    cacheKey: string,
    operation: () => Promise<T>,
    fallback: T,
  ) {
    const cached = await this.readHomeCache<T>(cacheKey);

    try {
      const value = await retryTransientPrismaRead(
        () => withTimeout(operation(), HOME_OPTIONAL_READ_TIMEOUT_MS, label),
        { attempts: 2, delayMs: 250 },
      );
      await this.writeHomeCache(cacheKey, value);
      return value;
    } catch (error) {
      if (!isHomeOptionalReadFallbackError(error)) {
        throw error;
      }

      const suffix = cached ? "returning cached value" : "returning empty fallback";
      this.logger.warn(`Homepage optional read failed for ${label}; ${suffix}.`);
      return cached ?? fallback;
    }
  }

  private async readHomeCache<T>(cacheKey: string): Promise<T | undefined> {
    if (this.cache.isAvailable()) {
      const cached = await this.cache.get<T>(cacheKey);
      return cached ?? undefined;
    }

    const cached = homeOptionalReadCache.get(cacheKey);
    if (!cached || cached.expiresAt <= Date.now()) {
      homeOptionalReadCache.delete(cacheKey);
      return undefined;
    }

    return cached.value as T;
  }

  private async writeHomeCache<T>(cacheKey: string, value: T): Promise<void> {
    if (this.cache.isAvailable()) {
      await this.cache.set(cacheKey, value, HOME_OPTIONAL_CACHE_TTL_MS);
      return;
    }

    homeOptionalReadCache.set(cacheKey, {
      expiresAt: Date.now() + HOME_OPTIONAL_CACHE_TTL_MS,
      value,
    });
  }

  private async readHomePayloadCache<T>(cacheKey: string, options: { allowStale?: boolean } = {}): Promise<T | undefined> {
    if (this.cache.isAvailable()) {
      const cached = await this.cache.get<T>(cacheKey);
      return cached ?? undefined;
    }

    const cached = homePayloadCache.get(cacheKey);
    if (!cached) {
      return undefined;
    }

    if (!options.allowStale && cached.expiresAt <= Date.now()) {
      homePayloadCache.delete(cacheKey);
      return undefined;
    }

    return cached.value as T;
  }

  private async writeHomePayloadCache<T>(cacheKey: string, value: T): Promise<void> {
    if (this.cache.isAvailable()) {
      await this.cache.set(cacheKey, value, HOME_PAYLOAD_CACHE_TTL_MS);
      return;
    }

    homePayloadCache.set(cacheKey, {
      expiresAt: Date.now() + HOME_PAYLOAD_CACHE_TTL_MS,
      value,
    });
  }

  async invalidateHomepageCache(): Promise<void> {
    if (this.cache.isAvailable()) {
      await this.cache.deletePattern("home:*");
    } else {
      homePayloadCache.clear();
      homeOptionalReadCache.clear();
    }
    this.logger.log("Homepage cache invalidated.");
  }

  private homeLocationCacheKey(query: PublicSellerQueryDto) {
    return [
      query.countryCode ?? "",
      query.stateCode ?? "",
      query.cityCode ?? "",
      query.localAreaCode ?? "",
      query.pincode ?? "",
      query.latitude ?? "",
      query.longitude ?? "",
      query.accuracyMeters ?? "",
      query.limit ?? "",
    ].join("|");
  }

  private homeViewerCacheKey(customerId?: string | null) {
    if (!customerId) {
      return "guest";
    }
    return `customer:${createHash("sha256").update(customerId).digest("hex").slice(0, 16)}`;
  }

  private async resolveOptionalHomepageCustomerId(options: HomeRequestOptions) {
    try {
      const userWhere = await this.resolveOptionalHomepageUserWhere(options);
      if (!userWhere) {
        return null;
      }

      const user = await this.prisma.client.user.findFirst({
        where: userWhere,
        select: {
          customer: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      return user?.customer?.status === UserStatus.ACTIVE ? user.customer.id : null;
    } catch {
      return null;
    }
  }

  private async resolveOptionalHomepageUserWhere(options: HomeRequestOptions) {
    if (options.authorizationHeader && this.clerkAuthService) {
      const clerkUserId = await this.clerkAuthService.verifyAuthorizationHeader(
        options.authorizationHeader,
      );
      return { clerkUserId };
    }

    if (this.allowDevAuth()) {
      if (options.platformUserId) {
        return { id: options.platformUserId };
      }
      if (options.clerkUserId) {
        return { clerkUserId: options.clerkUserId };
      }
    }

    return null;
  }

  private allowDevAuth() {
    return process.env.NODE_ENV !== "production" || process.env.INDIHUB_ALLOW_DEV_AUTH === "true";
  }

  private withLiveProductCounts<
    T extends {
      id: string;
      children?: Array<{ id: string; _count?: { products?: number; children?: number } }>;
      _count?: { products?: number; children?: number };
    },
  >(categories: T[], counts: Map<string, number>): T[] {
    return categories.map((category) => ({
      ...category,
      _count: {
        ...(category._count ?? {}),
        products: counts.get(category.id) ?? 0,
      },
      children: category.children?.map((child) => ({
        ...child,
        _count: {
          ...(child._count ?? {}),
          products: counts.get(child.id) ?? 0,
        },
      })),
    }));
  }

  private toPublicSellerResponse(
    seller: PublicSellerRecord,
    productCount: number,
    locationMatchLevel: StoreLocationMatchLevel = "NONE",
    previewProducts: PublicProduct[] = [],
    reviewSummary: PublicReviewSummary = this.emptyReviewSummary(),
    rankingReason: StoreRankingReason = "DAILY_ROTATION",
    distanceMeters: number | null = null,
  ) {
    return {
      id: seller.id,
      storeName: seller.storeName,
      slug: seller.slug,
      sellerType: seller.sellerType,
      createdAt: seller.createdAt,
      profile: seller.profile
        ? {
            logoUrl: seller.profile.logoUrl,
            bannerUrl: seller.profile.bannerUrl,
            description: seller.profile.description,
          }
        : null,
      addresses: seller.addresses.map((address) => ({
        area: address.area,
        city: address.city,
        state: address.state,
        country: address.country,
        countryCode: address.countryCode,
      })),
      locationMatchLevel,
      _count: {
        products: productCount,
      },
      reviewSummary,
      previewProducts,
      rankingReason,
      distanceMeters,
    };
  }
}

function productIdsFromHomepageSection(section: HomepageSectionRecord) {
  return dealItemsFromHomepageSection(section).map((item) => item.sourceId);
}

function dealItemsFromHomepageSection(section: HomepageSectionRecord) {
  const config = jsonRecord(section.config);
  const items = Array.isArray(config.items) ? config.items : [];
  const dealItems: HomepageDealItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const sourceType = stringRecordValue(record.sourceType);
    const sourceId = stringRecordValue(record.sourceId);

    if (sourceType === "product" && sourceId && !dealItems.some((dealItem) => dealItem.sourceId === sourceId)) {
      dealItems.push({
        sourceId,
        label:
          stringRecordValue(record.label) ||
          stringRecordValue(record.title) ||
          stringRecordValue(record.name) ||
          null,
        badge: stringRecordValue(record.badge) || null,
        description:
          stringRecordValue(record.description) ||
          stringRecordValue(record.subtitle) ||
          null,
        imageUrl:
          stringRecordValue(record.imageUrl) ||
          stringRecordValue(record.image) ||
          null,
        linkUrl:
          stringRecordValue(record.linkUrl) ||
          stringRecordValue(record.href) ||
          stringRecordValue(record.url) ||
          null,
      });
    }
  }

  return dealItems;
}

function stringRecordValue(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function discountedVariantScore(product: PublicProduct) {
  return product.variants.reduce(
    (best, variant) => {
      if (
        variant.status !== VariantStatus.ACTIVE ||
        variant.mrpPaise === null ||
        variant.mrpPaise <= variant.pricePaise
      ) {
        return best;
      }

      const discountPercent = Math.round(
        ((variant.mrpPaise - variant.pricePaise) / variant.mrpPaise) * 100,
      );

      if (discountPercent <= best.discountPercent) {
        return best;
      }

      return {
        discountPercent,
        stockQuantity: variant.stockQuantity,
      };
    },
    { discountPercent: 0, stockQuantity: 0 },
  );
}

function dealStockRank(stockQuantity: number) {
  if (stockQuantity > 0 && stockQuantity < 10) {
    return 0;
  }

  if (stockQuantity >= 10) {
    return 1;
  }

  return 2;
}

class HomeOptionalReadTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} exceeded ${timeoutMs}ms.`);
    this.name = "HomeOptionalReadTimeoutError";
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new HomeOptionalReadTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([
    operation.finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }),
    timeout,
  ]);
}

function isHomeOptionalReadFallbackError(error: unknown) {
  return error instanceof HomeOptionalReadTimeoutError || isTransientPrismaConnectionError(error);
}

function positiveIntegerEnv(key: string, fallback: number) {
  const value = process.env[key]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function homepageSectionScheduleIsLive(section: HomepageSectionRecord, now = new Date()) {
  const config = jsonRecord(section.config);
  const startsAt = parseScheduleDate(config.startsAt);
  const endsAt = parseScheduleDate(config.endsAt ?? config.timerEndsAt);

  if (section.status === ContentStatus.SCHEDULED && !startsAt) {
    return false;
  }

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

function parseScheduleDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
