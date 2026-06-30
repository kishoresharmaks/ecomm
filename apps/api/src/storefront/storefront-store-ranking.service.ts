import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  OrderItemLifecycleStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductReviewStatus,
  ProductStatus,
  SellerStatus,
} from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { PublicSellerQueryDto } from "../sellers/dto/public-seller-query.dto";

export type StoreRankingMode =
  | "LOCATION_MATCH"
  | "GPS_NEAREST"
  | "CUSTOMER_RECENT_ORDERS"
  | "PLATFORM_TRENDING"
  | "DAILY_ROTATION";

export type StoreRankingReason =
  | "LOCAL_AREA_AND_PINCODE"
  | "LOCAL_AREA"
  | "PINCODE"
  | "CITY"
  | "STATE"
  | "COUNTRY"
  | "GPS_NEAREST"
  | "CUSTOMER_RECENT_ORDER"
  | "PLATFORM_TRENDING"
  | "DAILY_ROTATION";

export type StoreLocationMatchLevel =
  | "LOCAL_AREA"
  | "PINCODE"
  | "CITY"
  | "STATE"
  | "COUNTRY"
  | "NONE";

export type RankedStore = {
  seller: PublicStoreSellerRecord;
  productCount: number;
  locationMatchLevel: StoreLocationMatchLevel;
  rankingReason: StoreRankingReason;
  distanceMeters: number | null;
};

export type StoreRankingResult = {
  stores: RankedStore[];
  mode: StoreRankingMode;
};

export const publicStoreSellerAddressSelect = {
  area: true,
  city: true,
  state: true,
  country: true,
  countryCode: true,
  stateCode: true,
  cityCode: true,
  localAreaCode: true,
  pincode: true,
  latitude: true,
  longitude: true,
};

export const publicStoreSellerSelect = {
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
    },
  },
  addresses: {
    select: publicStoreSellerAddressSelect,
  },
} satisfies Prisma.SellerSelect;

export type PublicStoreSellerRecord = Prisma.SellerGetPayload<{
  select: typeof publicStoreSellerSelect;
}>;

const candidateLimit = positiveIntegerEnv("STOREFRONT_TOP_STORE_CANDIDATE_LIMIT", 200);
const customerRecentOrderDays = positiveIntegerEnv("STOREFRONT_TOP_STORE_CUSTOMER_ORDER_DAYS", 90);
const platformTrendingDays = positiveIntegerEnv("STOREFRONT_TOP_STORE_TRENDING_DAYS", 30);
const gpsMaxAccuracyMeters = positiveIntegerEnv("STOREFRONT_TOP_STORE_GPS_MAX_ACCURACY_METERS", 100);

const locationRank: Record<StoreLocationMatchLevel, number> = {
  NONE: 0,
  COUNTRY: 1,
  STATE: 2,
  CITY: 3,
  PINCODE: 4,
  LOCAL_AREA: 5,
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

@Injectable()
export class StorefrontStoreRankingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async rankHomeStores(input: {
    query?: PublicSellerQueryDto;
    customerId?: string | null;
    dateSeed?: Date;
  }): Promise<StoreRankingResult> {
    const query = input.query ?? {};
    const limit = query.limit ?? 6;
    const location = normalizedLocation(query);
    const hasLocation = hasLocationPreference(location);
    const hasReliableGps = isReliableGps(query);
    const dateSeed = input.dateSeed ?? new Date();
    const stores = await this.loadEligibleStoreCandidates(limit);

    if (!stores.length) {
      return { stores: [], mode: "DAILY_ROTATION" };
    }

    const productCountBySeller = new Map(stores.map((item) => [item.seller.id, item.productCount]));
    const sellerIds = stores.map((item) => item.seller.id);
    const [customerSignals, trendingSignals, reviewSignals] = await Promise.all([
      input.customerId && !hasLocation
        ? this.recentOrderSignals({
            sellerIds,
            customerId: input.customerId,
            since: daysAgo(customerRecentOrderDays),
          })
        : Promise.resolve(new Map<string, OrderSignal>()),
      this.recentOrderSignals({
        sellerIds,
        since: daysAgo(platformTrendingDays),
      }),
      this.reviewSignals(sellerIds),
    ]);

    const scored = stores.map((candidate) =>
      this.scoreStore({
        candidate,
        productCount: productCountBySeller.get(candidate.seller.id) ?? 0,
        location,
        hasLocation,
        hasReliableGps,
        customerSignal: customerSignals.get(candidate.seller.id),
        trendingSignal: trendingSignals.get(candidate.seller.id),
        reviewSignal: reviewSignals.get(candidate.seller.id),
        dateSeed,
      }),
    );

    const mode = this.resolveMode({
      hasLocation,
      hasReliableGps,
      scored,
      customerSignals,
      trendingSignals,
    });

    return {
      mode,
      stores: scored
        .sort((left, right) => compareRankedStores(left, right, mode))
        .slice(0, limit)
        .map((item) => ({
          seller: item.candidate.seller,
          productCount: item.productCount,
          locationMatchLevel: item.locationMatchLevel,
          rankingReason: item.rankingReason,
          distanceMeters: item.distanceMeters,
        })),
    };
  }

  private async loadEligibleStoreCandidates(limit: number) {
    const take = Math.max(candidateLimit, limit);
    const sellers = await this.prisma.client.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
        products: {
          some: publicProductWhere,
        },
      },
      select: publicStoreSellerSelect,
      orderBy: [{ storeName: "asc" }, { createdAt: "desc" }],
      take,
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

    return sellers
      .map((seller) => ({
        seller,
        productCount: productCountBySeller.get(seller.id) ?? 0,
      }))
      .filter((candidate) => candidate.productCount > 0);
  }

  private async reviewSignals(sellerIds: string[]) {
    if (!sellerIds.length) {
      return new Map<string, ReviewSignal>();
    }

    const rows = await this.prisma.client.productReview.groupBy({
      by: ["sellerId"],
      where: {
        sellerId: { in: sellerIds },
        status: ProductReviewStatus.APPROVED,
      },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return new Map(
      rows.map((row) => [
        row.sellerId,
        {
          averageRating: row._avg.rating ?? 0,
          reviewCount: row._count._all,
        },
      ]),
    );
  }

  private async recentOrderSignals(input: {
    sellerIds: string[];
    since: Date;
    customerId?: string;
  }) {
    const signals = new Map<string, OrderSignal>();
    if (!input.sellerIds.length) {
      return signals;
    }

    const rows = await this.prisma.client.orderItem.findMany({
      where: {
        sellerId: { in: input.sellerIds },
        activeQuantity: { gt: 0 },
        lifecycleStatus: { not: OrderItemLifecycleStatus.CANCELLED },
        order: {
          createdAt: { gte: input.since },
          orderStatus: { not: OrderStatus.CANCELLED },
          paymentStatus: { notIn: [PaymentStatus.FAILED, PaymentStatus.REFUNDED] },
          ...(input.customerId ? { customerId: input.customerId } : {}),
        },
      },
      select: {
        sellerId: true,
        quantity: true,
        activeQuantity: true,
        order: {
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: {
        order: {
          createdAt: "desc",
        },
      },
      take: input.customerId ? 120 : 500,
    });

    for (const row of rows) {
      const signal = signals.get(row.sellerId) ?? {
        count: 0,
        quantity: 0,
        latestAt: row.order.createdAt,
      };
      signal.count += 1;
      signal.quantity += row.activeQuantity || row.quantity || 0;
      if (row.order.createdAt > signal.latestAt) {
        signal.latestAt = row.order.createdAt;
      }
      signals.set(row.sellerId, signal);
    }

    return signals;
  }

  private scoreStore(input: {
    candidate: { seller: PublicStoreSellerRecord; productCount: number };
    productCount: number;
    location: NormalizedLocation;
    hasLocation: boolean;
    hasReliableGps: boolean;
    customerSignal: OrderSignal | undefined;
    trendingSignal: OrderSignal | undefined;
    reviewSignal: ReviewSignal | undefined;
    dateSeed: Date;
  }): ScoredStore {
    const bestLocation = bestSellerLocationMatch(input.candidate.seller.addresses, input.location);
    const customerScore = orderSignalScore(input.customerSignal);
    const trendingScore = orderSignalScore(input.trendingSignal);
    const reviewScore = reviewConfidenceScore(input.reviewSignal);
    const stableScore = dailyStableScore(input.candidate.seller.id, input.dateSeed);
    const productScore = Math.min(input.productCount, 50);

    let rankingReason: StoreRankingReason = "DAILY_ROTATION";
    if (input.hasLocation && bestLocation.reason !== "DAILY_ROTATION") {
      rankingReason = bestLocation.reason;
    } else if (input.hasReliableGps && bestLocation.distanceMeters !== null) {
      rankingReason = "GPS_NEAREST";
    } else if (input.customerSignal) {
      rankingReason = "CUSTOMER_RECENT_ORDER";
    } else if (input.trendingSignal) {
      rankingReason = "PLATFORM_TRENDING";
    }

    return {
      candidate: input.candidate,
      productCount: input.productCount,
      locationMatchLevel: bestLocation.level,
      locationSpecificity: bestLocation.specificity,
      distanceMeters: input.hasReliableGps ? bestLocation.distanceMeters : null,
      customerScore,
      customerLatestAt: input.customerSignal?.latestAt?.getTime() ?? 0,
      trendingScore,
      trendingLatestAt: input.trendingSignal?.latestAt?.getTime() ?? 0,
      reviewScore,
      productScore,
      stableScore,
      rankingReason,
    };
  }

  private resolveMode(input: {
    hasLocation: boolean;
    hasReliableGps: boolean;
    scored: ScoredStore[];
    customerSignals: Map<string, OrderSignal>;
    trendingSignals: Map<string, OrderSignal>;
  }): StoreRankingMode {
    if (input.hasLocation) {
      return "LOCATION_MATCH";
    }
    if (input.hasReliableGps && input.scored.some((item) => item.distanceMeters !== null)) {
      return "GPS_NEAREST";
    }
    if (input.customerSignals.size > 0) {
      return "CUSTOMER_RECENT_ORDERS";
    }
    if (input.trendingSignals.size > 0) {
      return "PLATFORM_TRENDING";
    }
    return "DAILY_ROTATION";
  }
}

type NormalizedLocation = {
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  localAreaCode?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
};

type OrderSignal = {
  count: number;
  quantity: number;
  latestAt: Date;
};

type ReviewSignal = {
  averageRating: number;
  reviewCount: number;
};

type ScoredStore = {
  candidate: { seller: PublicStoreSellerRecord; productCount: number };
  productCount: number;
  locationMatchLevel: StoreLocationMatchLevel;
  locationSpecificity: number;
  distanceMeters: number | null;
  customerScore: number;
  customerLatestAt: number;
  trendingScore: number;
  trendingLatestAt: number;
  reviewScore: number;
  productScore: number;
  stableScore: number;
  rankingReason: StoreRankingReason;
};

function compareRankedStores(left: ScoredStore, right: ScoredStore, mode: StoreRankingMode) {
  const byNumberDesc = (leftValue: number, rightValue: number) =>
    compareNumbers(rightValue, leftValue);
  const byNumberAsc = (leftValue: number, rightValue: number) =>
    compareNumbers(leftValue, rightValue);
  const distance = (item: ScoredStore) => item.distanceMeters ?? Number.POSITIVE_INFINITY;

  const comparators: number[] =
    mode === "LOCATION_MATCH"
      ? [
          byNumberDesc(
            locationRank[left.locationMatchLevel],
            locationRank[right.locationMatchLevel],
          ),
          byNumberDesc(left.locationSpecificity, right.locationSpecificity),
          byNumberAsc(distance(left), distance(right)),
          byNumberDesc(left.reviewScore, right.reviewScore),
          byNumberDesc(left.productScore, right.productScore),
          byNumberDesc(left.trendingScore, right.trendingScore),
          byNumberDesc(left.stableScore, right.stableScore),
        ]
      : mode === "GPS_NEAREST"
        ? [
            byNumberAsc(distance(left), distance(right)),
            byNumberDesc(left.reviewScore, right.reviewScore),
            byNumberDesc(left.productScore, right.productScore),
            byNumberDesc(left.trendingScore, right.trendingScore),
            byNumberDesc(left.stableScore, right.stableScore),
          ]
        : mode === "CUSTOMER_RECENT_ORDERS"
          ? [
              byNumberDesc(left.customerLatestAt, right.customerLatestAt),
              byNumberDesc(left.customerScore, right.customerScore),
              byNumberDesc(left.reviewScore, right.reviewScore),
              byNumberDesc(left.trendingScore, right.trendingScore),
              byNumberDesc(left.productScore, right.productScore),
              byNumberDesc(left.stableScore, right.stableScore),
            ]
          : mode === "PLATFORM_TRENDING"
            ? [
                byNumberDesc(left.trendingScore, right.trendingScore),
                byNumberDesc(left.trendingLatestAt, right.trendingLatestAt),
                byNumberDesc(left.reviewScore, right.reviewScore),
                byNumberDesc(left.productScore, right.productScore),
                byNumberDesc(left.stableScore, right.stableScore),
              ]
            : [
                byNumberDesc(left.stableScore, right.stableScore),
                byNumberDesc(left.reviewScore, right.reviewScore),
                byNumberDesc(left.productScore, right.productScore),
              ];

  for (const result of comparators) {
    if (result !== 0) {
      return result;
    }
  }

  return left.candidate.seller.storeName.localeCompare(right.candidate.seller.storeName, undefined, {
    sensitivity: "base",
  });
}

function bestSellerLocationMatch(
  addresses: PublicStoreSellerRecord["addresses"],
  location: NormalizedLocation,
) {
  return addresses
    .map((address) => addressLocationMatch(address, location))
    .sort((left, right) => {
      const rankDelta = locationRank[right.level] - locationRank[left.level];
      if (rankDelta !== 0) {
        return rankDelta;
      }
      if (right.specificity !== left.specificity) {
        return right.specificity - left.specificity;
      }
      return (
        (left.distanceMeters ?? Number.POSITIVE_INFINITY) -
        (right.distanceMeters ?? Number.POSITIVE_INFINITY)
      );
    })[0] ?? {
    level: "NONE" as StoreLocationMatchLevel,
    specificity: 0,
    reason: "DAILY_ROTATION" as StoreRankingReason,
    distanceMeters: null,
  };
}

function addressLocationMatch(
  address: PublicStoreSellerRecord["addresses"][number],
  location: NormalizedLocation,
) {
  const addressCountry = normalizeCode(address.countryCode);
  const addressState = normalizeCode(address.stateCode);
  const addressCity = normalizeCode(address.cityCode);
  const addressArea = normalizeCode(address.localAreaCode);
  const addressPincode = normalizePincode(address.pincode, addressCountry);
  const addressLatitude = decimalToNumber(address.latitude);
  const addressLongitude = decimalToNumber(address.longitude);
  const localAreaMatch = Boolean(location.localAreaCode && addressArea === location.localAreaCode);
  const pincodeMatch = Boolean(location.pincode && addressPincode === location.pincode);
  const distanceMeters =
    isFiniteCoordinate(location.latitude, location.longitude) &&
    isFiniteCoordinate(addressLatitude, addressLongitude)
      ? Math.round(
          haversineKm(
            location.latitude as number,
            location.longitude as number,
            addressLatitude as number,
            addressLongitude as number,
          ) * 1000,
        )
      : null;

  if (localAreaMatch && pincodeMatch) {
    return {
      level: "LOCAL_AREA" as StoreLocationMatchLevel,
      specificity: 6,
      reason: "LOCAL_AREA_AND_PINCODE" as StoreRankingReason,
      distanceMeters,
    };
  }
  if (localAreaMatch) {
    return {
      level: "LOCAL_AREA" as StoreLocationMatchLevel,
      specificity: 5,
      reason: "LOCAL_AREA" as StoreRankingReason,
      distanceMeters,
    };
  }
  if (pincodeMatch) {
    return {
      level: "PINCODE" as StoreLocationMatchLevel,
      specificity: 4,
      reason: "PINCODE" as StoreRankingReason,
      distanceMeters,
    };
  }
  if (location.cityCode && addressCity === location.cityCode) {
    return {
      level: "CITY" as StoreLocationMatchLevel,
      specificity: 3,
      reason: "CITY" as StoreRankingReason,
      distanceMeters,
    };
  }
  if (location.stateCode && addressState === location.stateCode) {
    return {
      level: "STATE" as StoreLocationMatchLevel,
      specificity: 2,
      reason: "STATE" as StoreRankingReason,
      distanceMeters,
    };
  }
  if (location.countryCode && addressCountry === location.countryCode) {
    return {
      level: "COUNTRY" as StoreLocationMatchLevel,
      specificity: 1,
      reason: "COUNTRY" as StoreRankingReason,
      distanceMeters,
    };
  }

  return {
    level: "NONE" as StoreLocationMatchLevel,
    specificity: 0,
    reason: distanceMeters === null ? "DAILY_ROTATION" : ("GPS_NEAREST" as StoreRankingReason),
    distanceMeters,
  };
}

function normalizedLocation(query: PublicSellerQueryDto): NormalizedLocation {
  const countryCode = normalizeCode(query.countryCode);
  const stateCode = normalizeCode(query.stateCode);
  const cityCode = normalizeCode(query.cityCode);
  const localAreaCode = normalizeCode(query.localAreaCode);
  const pincode = normalizePincode(query.pincode, countryCode);
  const location: NormalizedLocation = {};

  if (countryCode) {
    location.countryCode = countryCode;
  }
  if (stateCode) {
    location.stateCode = stateCode;
  }
  if (cityCode) {
    location.cityCode = cityCode;
  }
  if (localAreaCode) {
    location.localAreaCode = localAreaCode;
  }
  if (pincode) {
    location.pincode = pincode;
  }
  if (typeof query.latitude === "number") {
    location.latitude = query.latitude;
  }
  if (typeof query.longitude === "number") {
    location.longitude = query.longitude;
  }

  return location;
}

function hasLocationPreference(location: NormalizedLocation) {
  return Boolean(
    location.countryCode ||
      location.stateCode ||
      location.cityCode ||
      location.localAreaCode ||
      location.pincode,
  );
}

function isReliableGps(query: PublicSellerQueryDto) {
  return (
    isFiniteCoordinate(query.latitude, query.longitude) &&
    typeof query.accuracyMeters === "number" &&
    Number.isFinite(query.accuracyMeters) &&
    query.accuracyMeters >= 0 &&
    query.accuracyMeters <= gpsMaxAccuracyMeters
  );
}

function isFiniteCoordinate(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || undefined;
}

function normalizePincode(value: string | null | undefined, countryCode?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (countryCode === "IN") {
    return trimmed.replace(/\D/g, "") || undefined;
  }
  return trimmed.toUpperCase();
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNumbers(left: number, right: number) {
  if (Number.isNaN(left) && Number.isNaN(right)) {
    return 0;
  }
  if (Number.isNaN(left)) {
    return 1;
  }
  if (Number.isNaN(right)) {
    return -1;
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function orderSignalScore(signal: OrderSignal | undefined) {
  if (!signal) {
    return 0;
  }
  return signal.count * 100 + Math.min(signal.quantity, 50);
}

function reviewConfidenceScore(signal: ReviewSignal | undefined) {
  if (!signal) {
    return 0;
  }
  return signal.averageRating * 100 + Math.min(signal.reviewCount, 100);
}

function dailyStableScore(sellerId: string, dateSeed: Date) {
  const seed = dateSeed.toISOString().slice(0, 10);
  const digest = createHash("sha256").update(`${seed}:${sellerId}`).digest("hex").slice(0, 8);
  return Number.parseInt(digest, 16);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function haversineKm(
  originLatitude: number,
  originLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destinationLatitude - originLatitude);
  const longitudeDelta = toRadians(destinationLongitude - originLongitude);
  const originLatRadians = toRadians(originLatitude);
  const destinationLatRadians = toRadians(destinationLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatRadians) *
      Math.cos(destinationLatRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function positiveIntegerEnv(key: string, fallback: number) {
  const value = process.env[key]?.trim();
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
