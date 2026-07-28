import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  Prisma,
  ProductReviewStatus,
  ProductStatus,
  SearchDocumentEntityType,
  SearchDocumentVisibilityStatus,
  SellerStatus,
} from "@indihub/database";
import { isSoldResaleProduct } from "@indihub/shared-types";
import { decodeCursorPayload, encodeCursorPayload } from "../common/pagination";
import { DealPricingService } from "../deals/deal-pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { SearchQueryDto, SearchSuggestionsQueryDto, type SearchSort } from "./dto/search-query.dto";

const publicSellerProfileSelect = {
  logoUrl: true,
  bannerUrl: true,
  description: true,
};

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
    include: {
      productTemplate: {
        include: {
          fields: {
            orderBy: [{ scope: "asc" as const }, { sortOrder: "asc" as const }, { label: "asc" as const }],
          },
        },
      },
    },
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
  hsnMaster: true,
  images: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
  variants: {
    select: publicProductVariantSelect,
    orderBy: [{ createdAt: "asc" as const }],
  },
};

type SearchCursorPayload = {
  sort: SearchSort;
  sortKey: number;
  score: number;
  sortDate: string;
  id: string;
};

type SearchDocumentRow = {
  id: string;
  entityType: SearchDocumentEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  sellerId: string | null;
  minPricePaise: number | null;
  maxPricePaise: number | null;
  ratingAverage: Prisma.Decimal | number | null;
  reviewCount: number;
  inStock: boolean;
  hasDeal: boolean;
  dealDiscountBps: number;
  score: number;
  sortKey: number;
  sortDate: Date;
};

type ProductReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

@Injectable()
export class SearchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(DealPricingService)
    private readonly dealPricing?: DealPricingService,
  ) {}

  async search(query: SearchQueryDto) {
    this.assertValidQuery(query);

    const limit = query.limit ?? 24;
    const normalizedQuery = normalizeSearchQuery(query.q);
    const sort = query.sort ?? "relevance";
    const entityTypes = this.resolveEntityTypes(query);
    const cursor = this.decodeCursor(query.cursor, sort);
    const rows = await this.findRows(query, normalizedQuery, entityTypes, limit + 1, cursor);
    const pageRows = rows.slice(0, limit);
    const lastRow = pageRows[pageRows.length - 1] ?? null;
    const hydrated = await this.hydrateRows(pageRows);

    return {
      query: query.q,
      limit,
      sort,
      items: hydrated.items,
      products: hydrated.products,
      stores: hydrated.stores,
      categories: hydrated.categories,
      filters: this.facetsFromRows(pageRows),
      pageInfo: {
        hasNextPage: rows.length > limit,
        nextCursor:
          rows.length > limit && lastRow
            ? this.encodeCursor(sort, lastRow)
            : null,
      },
    };
  }

  async suggestions(query: SearchSuggestionsQueryDto) {
    const limit = query.limit ?? 8;
    const normalizedQuery = normalizeSearchQuery(query.q);
    const rows = await this.findRows(
      { q: query.q, sort: "relevance" },
      normalizedQuery,
      [
        SearchDocumentEntityType.PRODUCT,
        SearchDocumentEntityType.STORE,
        SearchDocumentEntityType.CATEGORY,
      ],
      limit,
      null,
      { suggestionsOnly: true },
    );
    const suggestions = rows.map((row) => this.toSuggestion(row));

    return {
      query: query.q,
      suggestions,
      products: suggestions.filter((item) => item.type === "product"),
      stores: suggestions.filter((item) => item.type === "store"),
      categories: suggestions.filter((item) => item.type === "category"),
      limit,
    };
  }

  async explain(query: SearchQueryDto) {
    this.assertValidQuery(query);
    const normalizedQuery = normalizeSearchQuery(query.q);
    const entityTypes = this.resolveEntityTypes(query);
    const sort = query.sort ?? "relevance";
    const fragments = this.searchSqlFragments(query, normalizedQuery, entityTypes, sort, null);

    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('statement_timeout', '3000ms', true)`;

      return tx.$queryRaw<Array<{ "QUERY PLAN": string }>>`
        EXPLAIN (ANALYZE false, BUFFERS false, FORMAT TEXT)
        SELECT sd.id
        FROM search_documents sd
        WHERE ${Prisma.join(fragments.clauses, " AND ")}
        ORDER BY ${fragments.sortKeySql} DESC, ${fragments.scoreSql} DESC, ${fragments.sortDateSql} DESC, sd.id DESC
        LIMIT ${Math.min(query.limit ?? 24, 50)}
      `;
    });
  }

  private async findRows(
    query: Pick<SearchQueryDto, "q" | "sort" | "categoryId" | "sellerId" | "minPricePaise" | "maxPricePaise" | "inStock" | "deals" | "rating">,
    normalizedQuery: string,
    entityTypes: SearchDocumentEntityType[],
    limit: number,
    cursor: SearchCursorPayload | null,
    options: { suggestionsOnly?: boolean } = {},
  ) {
    const sort = query.sort ?? "relevance";
    const fragments = this.searchSqlFragments(query, normalizedQuery, entityTypes, sort, cursor);

    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('statement_timeout', '1500ms', true)`;

      return tx.$queryRaw<SearchDocumentRow[]>`
        SELECT
          sd.id::text AS id,
          sd.entity_type::text AS "entityType",
          sd.entity_id::text AS "entityId",
          sd.title,
          sd.subtitle,
          sd.slug,
          sd.image_url AS "imageUrl",
          sd.category_id::text AS "categoryId",
          sd.seller_id::text AS "sellerId",
          sd.min_price_paise AS "minPricePaise",
          sd.max_price_paise AS "maxPricePaise",
          sd.rating_average AS "ratingAverage",
          sd.review_count AS "reviewCount",
          sd.in_stock AS "inStock",
          sd.has_deal AS "hasDeal",
          sd.deal_discount_bps AS "dealDiscountBps",
          ${fragments.scoreSql}::float8 AS score,
          ${fragments.sortKeySql}::float8 AS "sortKey",
          ${fragments.sortDateSql} AS "sortDate"
        FROM search_documents sd
        WHERE ${Prisma.join(fragments.clauses, " AND ")}
        ORDER BY
          ${fragments.sortKeySql} DESC,
          ${fragments.scoreSql} DESC,
          ${fragments.sortDateSql} DESC,
          sd.id DESC
        LIMIT ${Math.min(limit, options.suggestionsOnly ? 10 : 51)}
      `;
    });
  }

  private searchSqlFragments(
    query: Pick<SearchQueryDto, "q" | "sort" | "categoryId" | "sellerId" | "minPricePaise" | "maxPricePaise" | "inStock" | "deals" | "rating">,
    normalizedQuery: string,
    entityTypes: SearchDocumentEntityType[],
    sort: SearchSort,
    cursor: SearchCursorPayload | null,
  ) {
    const searchQuery = Prisma.sql`websearch_to_tsquery('simple', ${query.q})`;
    const prefixQuery = `${normalizedQuery}%`;
    const containsQuery = `%${normalizedQuery}%`;
    const entityTypeSql = Prisma.join(
      entityTypes.map((type) => Prisma.sql`${type}::"SearchDocumentEntityType"`),
    );
    const sortDateSql = Prisma.sql`coalesce(sd.source_updated_at, sd.updated_at)`;
    const scoreSql = Prisma.sql`(
      CASE WHEN sd.normalized_title = ${normalizedQuery} THEN 12 ELSE 0 END +
      CASE WHEN sd.normalized_title LIKE ${prefixQuery} THEN 4 ELSE 0 END +
      CASE
        WHEN sd.entity_type = ${SearchDocumentEntityType.PRODUCT}::"SearchDocumentEntityType" THEN 0.40
        WHEN sd.entity_type = ${SearchDocumentEntityType.STORE}::"SearchDocumentEntityType" THEN 0.25
        ELSE 0.15
      END +
      ts_rank_cd(sd.search_vector, ${searchQuery}) * 6 +
      similarity(sd.normalized_title, ${normalizedQuery}) * 2 +
      similarity(sd.search_text, ${normalizedQuery}) * 0.5 +
      LEAST(sd.rank_boost, 100)::float8 / 100 +
      CASE WHEN sd.in_stock THEN 0.25 ELSE 0 END +
      CASE WHEN sd.has_deal THEN 0.20 ELSE 0 END +
      coalesce(sd.rating_average::float8, 0) * 0.08 +
      LEAST(sd.review_count, 100)::float8 / 500 +
      GREATEST(0, 0.20 - (EXTRACT(EPOCH FROM (NOW() - ${sortDateSql})) / 2592000.0 * 0.05))
    )`;
    const sortKeySql = this.sortKeySql(sort, scoreSql, sortDateSql);
    const clauses = [
      Prisma.sql`sd.visibility_status = ${SearchDocumentVisibilityStatus.VISIBLE}::"SearchDocumentVisibilityStatus"`,
      Prisma.sql`sd.entity_type IN (${entityTypeSql})`,
      Prisma.sql`(
        sd.search_vector @@ ${searchQuery}
        OR sd.normalized_title % ${normalizedQuery}
        OR sd.search_text % ${normalizedQuery}
        OR sd.normalized_title LIKE ${containsQuery}
        OR sd.search_text LIKE ${containsQuery}
      )`,
    ];

    if (query.categoryId) {
      clauses.push(Prisma.sql`sd.category_id = ${query.categoryId}::uuid`);
    }
    if (query.sellerId) {
      clauses.push(Prisma.sql`sd.seller_id = ${query.sellerId}::uuid`);
    }
    if (query.minPricePaise !== undefined) {
      clauses.push(Prisma.sql`sd.max_price_paise >= ${query.minPricePaise}`);
    }
    if (query.maxPricePaise !== undefined) {
      clauses.push(Prisma.sql`sd.min_price_paise <= ${query.maxPricePaise}`);
    }
    if (query.inStock === true) {
      clauses.push(Prisma.sql`sd.in_stock = true`);
    }
    if (query.deals === true) {
      clauses.push(Prisma.sql`sd.has_deal = true`);
    }
    if (query.rating !== undefined) {
      clauses.push(Prisma.sql`coalesce(sd.rating_average, 0) >= ${query.rating}`);
    }
    if (cursor) {
      clauses.push(Prisma.sql`(${sortKeySql}, ${scoreSql}, ${sortDateSql}, sd.id) < (${cursor.sortKey}, ${cursor.score}, ${new Date(cursor.sortDate)}, ${cursor.id}::uuid)`);
    }

    return {
      clauses,
      scoreSql,
      sortKeySql,
      sortDateSql,
    };
  }

  private sortKeySql(sort: SearchSort, scoreSql: Prisma.Sql, sortDateSql: Prisma.Sql) {
    if (sort === "newest") {
      return Prisma.sql`EXTRACT(EPOCH FROM ${sortDateSql})`;
    }
    if (sort === "price_asc") {
      return Prisma.sql`-coalesce(sd.min_price_paise, 2147483647)`;
    }
    if (sort === "price_desc") {
      return Prisma.sql`coalesce(sd.max_price_paise, -1)`;
    }
    if (sort === "rating") {
      return Prisma.sql`coalesce(sd.rating_average::float8, -1)`;
    }
    if (sort === "discount") {
      return Prisma.sql`sd.deal_discount_bps`;
    }

    return scoreSql;
  }

  private assertValidQuery(query: SearchQueryDto) {
    if (query.minPricePaise !== undefined && query.maxPricePaise !== undefined && query.minPricePaise > query.maxPricePaise) {
      throw new BadRequestException("minPricePaise must not be greater than maxPricePaise.");
    }

    const productOnlyFilters = Boolean(
      query.categoryId ||
        query.sellerId ||
        query.minPricePaise !== undefined ||
        query.maxPricePaise !== undefined ||
        query.inStock !== undefined ||
        query.deals !== undefined,
    );
    const productOnlySort = query.sort === "price_asc" || query.sort === "price_desc" || query.sort === "discount";

    if ((query.type === "store" || query.type === "category") && (productOnlyFilters || productOnlySort)) {
      throw new BadRequestException("Product-only filters and price/discount sorts cannot be used with store or category searches.");
    }
  }

  private resolveEntityTypes(query: SearchQueryDto) {
    if (query.type === "product") {
      return [SearchDocumentEntityType.PRODUCT];
    }
    if (query.type === "store") {
      return [SearchDocumentEntityType.STORE];
    }
    if (query.type === "category") {
      return [SearchDocumentEntityType.CATEGORY];
    }

    if (
      query.categoryId ||
      query.sellerId ||
      query.minPricePaise !== undefined ||
      query.maxPricePaise !== undefined ||
      query.inStock !== undefined ||
      query.deals !== undefined ||
      query.sort === "price_asc" ||
      query.sort === "price_desc" ||
      query.sort === "discount"
    ) {
      return [SearchDocumentEntityType.PRODUCT];
    }

    return [
      SearchDocumentEntityType.PRODUCT,
      SearchDocumentEntityType.STORE,
      SearchDocumentEntityType.CATEGORY,
    ];
  }

  private decodeCursor(cursorValue: string | undefined, sort: SearchSort) {
    const cursor = decodeCursorPayload<SearchCursorPayload>(cursorValue);
    if (!cursor) {
      return null;
    }

    if (
      cursor.sort !== sort ||
      typeof cursor.sortKey !== "number" ||
      typeof cursor.score !== "number" ||
      typeof cursor.sortDate !== "string" ||
      Number.isNaN(new Date(cursor.sortDate).getTime()) ||
      typeof cursor.id !== "string"
    ) {
      throw new BadRequestException("cursor is invalid for this search sort.");
    }

    return cursor;
  }

  private encodeCursor(sort: SearchSort, row: SearchDocumentRow) {
    return encodeCursorPayload({
      sort,
      sortKey: Number(row.sortKey),
      score: Number(row.score),
      sortDate: row.sortDate.toISOString(),
      id: row.id,
    });
  }

  private async hydrateRows(rows: SearchDocumentRow[]) {
    const productIds = rows
      .filter((row) => row.entityType === SearchDocumentEntityType.PRODUCT)
      .map((row) => row.entityId);
    const storeIds = rows
      .filter((row) => row.entityType === SearchDocumentEntityType.STORE)
      .map((row) => row.entityId);
    const categoryIds = rows
      .filter((row) => row.entityType === SearchDocumentEntityType.CATEGORY)
      .map((row) => row.entityId);
    const [products, stores, categories] = await Promise.all([
      this.hydrateProducts(productIds),
      this.hydrateStores(storeIds),
      this.hydrateCategories(categoryIds),
    ]);

    const productById = new Map(products.map((product) => [product.id, product]));
    const storeById = new Map(stores.map((store) => [store.id, store]));
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const items: Array<
      | { type: "product"; score: number; product: (typeof products)[number] }
      | { type: "store"; score: number; store: (typeof stores)[number] }
      | { type: "category"; score: number; category: (typeof categories)[number] }
    > = [];

    for (const row of rows) {
      if (row.entityType === SearchDocumentEntityType.PRODUCT) {
        const product = productById.get(row.entityId);
        if (product) {
          items.push({ type: "product", score: row.score, product });
        }
        continue;
      }
      if (row.entityType === SearchDocumentEntityType.STORE) {
        const store = storeById.get(row.entityId);
        if (store) {
          items.push({ type: "store", score: row.score, store });
        }
        continue;
      }

      const category = categoryById.get(row.entityId);
      if (category) {
        items.push({ type: "category", score: row.score, category });
      }
    }

    return { products, stores, categories, items };
  }

  private async hydrateProducts(productIds: string[]) {
    const ids = unique(productIds);
    if (!ids.length) {
      return [];
    }

    const products = await this.prisma.client.product.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        seller: {
          deletedAt: null,
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
        },
        category: {
          deletedAt: null,
          status: CategoryStatus.ACTIVE,
        },
      },
      include: publicProductInclude,
    });
    const decoratedProducts = this.dealPricing
      ? await this.dealPricing.applyActiveDealsToProducts(products)
      : products;
    const reviewSummaries = await this.reviewSummariesForProducts(decoratedProducts.map((product) => product.id));
    const productById = new Map(
      decoratedProducts
        .filter((product) => !isSoldResaleProduct(product))
        .map((product) => [
          product.id,
          {
            ...product,
            reviewSummary: reviewSummaries.get(product.id) ?? this.emptyReviewSummary(),
          },
        ]),
    );

    return ids.flatMap((id) => {
      const product = productById.get(id);
      return product ? [product] : [];
    });
  }

  private async hydrateStores(storeIds: string[]) {
    const ids = unique(storeIds);
    if (!ids.length) {
      return [];
    }

    const sellers = await this.prisma.client.seller.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      select: {
        id: true,
        storeName: true,
        slug: true,
        sellerType: true,
        createdAt: true,
        profile: {
          select: {
            logoUrl: true,
            bannerUrl: true,
            description: true,
            createdAt: true,
          },
        },
        addresses: {
          select: {
            area: true,
            city: true,
            state: true,
            country: true,
            countryCode: true,
          },
        },
      },
    });
    const [productCounts, reviewSummaries] = await Promise.all([
      this.productCountsForSellers(ids),
      this.reviewSummariesForSellers(ids),
    ]);
    const sellerById = new Map(
      sellers.map((seller) => [
        seller.id,
        {
          ...seller,
          _count: {
            products: productCounts.get(seller.id) ?? 0,
          },
          reviewSummary: reviewSummaries.get(seller.id) ?? this.emptyReviewSummary(),
        },
      ]),
    );

    return ids.flatMap((id) => {
      const seller = sellerById.get(id);
      return seller ? [seller] : [];
    });
  }

  private async hydrateCategories(categoryIds: string[]) {
    const ids = unique(categoryIds);
    if (!ids.length) {
      return [];
    }

    const categories = await this.prisma.client.category.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        status: CategoryStatus.ACTIVE,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    return ids.flatMap((id) => {
      const category = categoryById.get(id);
      return category ? [category] : [];
    });
  }

  private async productCountsForSellers(sellerIds: string[]) {
    const counts = new Map<string, number>();
    if (!sellerIds.length) {
      return counts;
    }

    const rows = await this.prisma.client.product.groupBy({
      by: ["sellerId"],
      where: {
        sellerId: { in: sellerIds },
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      _count: { _all: true },
    });

    for (const row of rows) {
      counts.set(row.sellerId, row._count._all);
    }

    return counts;
  }

  private async reviewSummariesForProducts(productIds: string[]) {
    const summaries = new Map<string, ProductReviewSummary>();
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
        averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
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

  private async reviewSummariesForSellers(sellerIds: string[]) {
    const summaries = new Map<string, ProductReviewSummary>();
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
        averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
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

  private emptyReviewSummary(): ProductReviewSummary {
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

  private facetsFromRows(rows: SearchDocumentRow[]) {
    const categories = new Map<string, { categoryId: string; label: string; count: number }>();
    const stores = new Map<string, { sellerId: string; label: string; count: number }>();
    let minPrice: number | null = null;
    let maxPrice: number | null = null;

    for (const row of rows) {
      if (row.categoryId) {
        const current = categories.get(row.categoryId) ?? {
          categoryId: row.categoryId,
          label: row.entityType === SearchDocumentEntityType.CATEGORY ? row.title : "Category",
          count: 0,
        };
        current.count += 1;
        categories.set(row.categoryId, current);
      }
      if (row.sellerId) {
        const current = stores.get(row.sellerId) ?? {
          sellerId: row.sellerId,
          label: row.entityType === SearchDocumentEntityType.STORE ? row.title : "Store",
          count: 0,
        };
        current.count += 1;
        stores.set(row.sellerId, current);
      }
      if (row.minPricePaise !== null) {
        minPrice = minPrice === null ? row.minPricePaise : Math.min(minPrice, row.minPricePaise);
      }
      if (row.maxPricePaise !== null) {
        maxPrice = maxPrice === null ? row.maxPricePaise : Math.max(maxPrice, row.maxPricePaise);
      }
    }

    return {
      categories: Array.from(categories.values()).sort((left, right) => right.count - left.count),
      stores: Array.from(stores.values()).sort((left, right) => right.count - left.count),
      price: { minPricePaise: minPrice, maxPricePaise: maxPrice },
    };
  }

  private toSuggestion(row: SearchDocumentRow) {
    const type = row.entityType === SearchDocumentEntityType.PRODUCT
      ? "product"
      : row.entityType === SearchDocumentEntityType.STORE
        ? "store"
        : "category";
    const href = type === "product"
      ? `/products/${row.slug ?? row.entityId}`
      : type === "store"
        ? `/stores/${row.slug ?? row.entityId}`
        : `/categories/${row.slug ?? row.entityId}`;

    return {
      id: row.entityId,
      type,
      title: row.title,
      subtitle: row.subtitle,
      href,
      imageUrl: row.imageUrl,
      score: row.score,
    };
  }
}

function normalizeSearchQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s./-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
