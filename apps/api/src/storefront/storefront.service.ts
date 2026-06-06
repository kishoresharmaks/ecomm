import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  ContentStatus,
  Prisma,
  ProductStatus,
  SellerStatus,
  UserStatus,
  VariantStatus,
} from "@indihub/database";
import { isSoldResaleProduct } from "@indihub/shared-types";
import { CmsService } from "../cms/cms.service";
import { paginationFromQuery } from "../common/pagination";
import { ProductQueryDto } from "../products/dto/product-query.dto";
import { PrismaService } from "../prisma/prisma.service";
import { PublicSellerQueryDto } from "../sellers/dto/public-seller-query.dto";
import { isTransientPrismaConnectionError, retryTransientPrismaRead } from "../prisma/transient-read-retry";

const publicSellerProfileSelect = {
  logoUrl: true,
  bannerUrl: true,
  description: true,
};

const publicSellerAddressSelect = {
  area: true,
  city: true,
  state: true,
  country: true,
  countryCode: true,
  stateCode: true,
  cityCode: true,
  localAreaCode: true,
  pincode: true,
};

const publicSellerSelect = {
  id: true,
  storeName: true,
  slug: true,
  sellerType: true,
  createdAt: true,
  profile: {
    select: publicSellerProfileSelect,
  },
  addresses: {
    select: publicSellerAddressSelect,
  },
} satisfies Prisma.SellerSelect;

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
  defaultHsnCode: true,
  defaultGstRatePercent: true,
  defaultTaxDescription: true,
  sortOrder: true,
} satisfies Prisma.CategorySelect;

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
    select: {
      id: true,
      sku: true,
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
    },
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

const publicSellerLocationMatchRanks = {
  NONE: 0,
  COUNTRY: 1,
  STATE: 2,
  CITY: 3,
  LOCAL_AREA: 4,
} as const;

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

type PublicSellerLocationMatchLevel = keyof typeof publicSellerLocationMatchRanks;
type PublicProduct = Prisma.ProductGetPayload<{ include: typeof publicProductInclude }>;
type PublicSellerRecord = Prisma.SellerGetPayload<{ select: typeof publicSellerSelect }>;
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

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CmsService) private readonly cms: CmsService,
  ) {}

  async getHome(query: PublicSellerQueryDto = {}) {
    const cacheKey = `home:${this.homeLocationCacheKey(query)}`;
    const cached = this.readHomePayloadCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const payload = await retryTransientPrismaRead(() => this.getHomePayload(query));
      this.writeHomePayloadCache(cacheKey, payload);
      return payload;
    } catch (error) {
      if (!isTransientPrismaConnectionError(error)) {
        throw error;
      }

      const stale = this.readHomePayloadCache(cacheKey, { allowStale: true });
      if (stale) {
        this.logger.warn("Transient database connection issue while reading homepage; returning stale homepage cache.");
        return stale;
      }

      throw error;
    }
  }

  private async getHomePayload(query: PublicSellerQueryDto = {}) {
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
        `home:stores:${this.homeLocationCacheKey(query)}`,
        () => this.listHomeStores(query),
        [],
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

    return {
      banners,
      homepageSections: liveHomepageSections,
      categories: liveCategories,
      storesNearYou,
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

  private async listHomeStores(query: PublicSellerQueryDto) {
    const limit = query.limit ?? 6;
    const sellers = await this.prisma.client.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      select: publicSellerSelect,
      orderBy: { storeName: "asc" },
    });
    const sellerIds = sellers.map((seller) => seller.id);
    const productCounts = sellerIds.length
      ? await this.prisma.client.product.groupBy({
          by: ["sellerId"],
          where: {
            ...publicProductWhere,
            sellerId: { in: sellerIds },
          },
          _count: { _all: true },
        })
      : [];
    const productCountBySeller = new Map(
      productCounts.map((count) => [count.sellerId, count._count._all]),
    );
    const hasLocationPreference = Boolean(
      query.countryCode ||
        query.stateCode ||
        query.cityCode ||
        query.localAreaCode ||
        query.pincode,
    );
    const rankedSellers = sellers.map((seller) =>
      this.toPublicSellerResponse(
        seller,
        productCountBySeller.get(seller.id) ?? 0,
        this.resolvePublicSellerLocationMatchLevel(seller.addresses, query),
      ),
    );

    if (hasLocationPreference) {
      rankedSellers.sort((left, right) => {
        const rankDelta =
          publicSellerLocationMatchRanks[right.locationMatchLevel] -
          publicSellerLocationMatchRanks[left.locationMatchLevel];
        if (rankDelta !== 0) {
          return rankDelta;
        }

        return left.storeName.localeCompare(right.storeName, undefined, {
          sensitivity: "base",
        });
      });
    }

    return rankedSellers.slice(0, limit);
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

    return this.publicVisibleProducts(products).slice(0, input.take);
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

    return productIds.flatMap((productId) => {
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
  }

  private async listDiscountedProducts(input: {
    query?: ProductQueryDto;
    candidateLimit?: number;
    resultLimit?: number;
  } = {}) {
    const products = await this.prisma.client.product.findMany({
      where: {
        ...publicProductWhere,
        ...this.publicProductQueryWhere(input.query ?? {}),
        variants: {
          some: {
            status: VariantStatus.ACTIVE,
            mrpPaise: { not: null },
          },
        },
      },
      include: publicProductInclude,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: input.candidateLimit ?? 24,
    });

    const discountedProducts = this.sortDealProducts(
      products.filter(
        (product) =>
          !isSoldResaleProduct(product) &&
          discountedVariantScore(product).discountPercent > 0,
      ),
    );

    return typeof input.resultLimit === "number"
      ? discountedProducts.slice(0, input.resultLimit)
      : discountedProducts;
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
    const cached = this.readHomeCache<T>(cacheKey);

    try {
      const value = await retryTransientPrismaRead(
        () => withTimeout(operation(), HOME_OPTIONAL_READ_TIMEOUT_MS, label),
        { attempts: 2, delayMs: 250 },
      );
      this.writeHomeCache(cacheKey, value);
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

  private readHomeCache<T>(cacheKey: string) {
    const cached = homeOptionalReadCache.get(cacheKey);
    if (!cached || cached.expiresAt <= Date.now()) {
      homeOptionalReadCache.delete(cacheKey);
      return undefined;
    }

    return cached.value as T;
  }

  private writeHomeCache<T>(cacheKey: string, value: T) {
    homeOptionalReadCache.set(cacheKey, {
      expiresAt: Date.now() + HOME_OPTIONAL_CACHE_TTL_MS,
      value,
    });
  }

  private readHomePayloadCache<T>(cacheKey: string, options: { allowStale?: boolean } = {}) {
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

  private writeHomePayloadCache<T>(cacheKey: string, value: T) {
    homePayloadCache.set(cacheKey, {
      expiresAt: Date.now() + HOME_PAYLOAD_CACHE_TTL_MS,
      value,
    });
  }

  private homeLocationCacheKey(query: PublicSellerQueryDto) {
    return [
      query.countryCode ?? "",
      query.stateCode ?? "",
      query.cityCode ?? "",
      query.localAreaCode ?? "",
      query.pincode ?? "",
      query.limit ?? "",
    ].join("|");
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
    locationMatchLevel: PublicSellerLocationMatchLevel = "NONE",
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
    };
  }

  private resolvePublicSellerLocationMatchLevel(
    addresses: Array<{
      countryCode?: string | null;
      stateCode?: string | null;
      cityCode?: string | null;
      localAreaCode?: string | null;
      pincode?: string | null;
    }>,
    query: PublicSellerQueryDto,
  ): PublicSellerLocationMatchLevel {
    let bestMatch: PublicSellerLocationMatchLevel = "NONE";

    for (const address of addresses) {
      const level = this.resolveAddressLocationMatchLevel(address, query);
      if (publicSellerLocationMatchRanks[level] > publicSellerLocationMatchRanks[bestMatch]) {
        bestMatch = level;
      }

      if (bestMatch === "LOCAL_AREA") {
        return bestMatch;
      }
    }

    return bestMatch;
  }

  private resolveAddressLocationMatchLevel(
    address: {
      countryCode?: string | null;
      stateCode?: string | null;
      cityCode?: string | null;
      localAreaCode?: string | null;
      pincode?: string | null;
    },
    query: PublicSellerQueryDto,
  ): PublicSellerLocationMatchLevel {
    const countryCode = query.countryCode?.trim().toUpperCase();
    const stateCode = query.stateCode?.trim().toUpperCase();
    const cityCode = query.cityCode?.trim().toUpperCase();
    const localAreaCode = query.localAreaCode?.trim().toUpperCase();
    const pincode = query.pincode?.trim().toUpperCase();
    const addressCountry = address.countryCode?.trim().toUpperCase();
    const addressState = address.stateCode?.trim().toUpperCase();
    const addressCity = address.cityCode?.trim().toUpperCase();
    const addressLocalArea = address.localAreaCode?.trim().toUpperCase();
    const addressPincode = address.pincode?.trim().toUpperCase();

    if (
      (localAreaCode && addressLocalArea === localAreaCode) ||
      (pincode && addressPincode === pincode)
    ) {
      return "LOCAL_AREA";
    }

    if (cityCode && addressCity === cityCode) {
      return "CITY";
    }

    if (stateCode && addressState === stateCode) {
      return "STATE";
    }

    if (countryCode && addressCountry === countryCode) {
      return "COUNTRY";
    }

    return "NONE";
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
