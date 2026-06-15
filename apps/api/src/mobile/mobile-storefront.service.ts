import { Inject, Injectable } from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  Prisma,
  ProductStatus,
  SellerStatus,
} from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { CmsService } from "../cms/cms.service";
import { PublicSellerQueryDto } from "../sellers/dto/public-seller-query.dto";
import { StorefrontService } from "../storefront/storefront.service";
import { MobileHomeQueryDto } from "./dto/mobile-home-query.dto";

const mobileSellerSelect = {
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
    select: {
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
    },
  },
} satisfies Prisma.SellerSelect;

type DesktopHomePayload = {
  banners?: unknown[];
  categories?: unknown[];
  homepageSections?: unknown[];
  sections?: unknown[];
  storesNearYou?: unknown[];
  productRails?: {
    featured?: unknown[];
    latest?: unknown[];
    deals?: unknown[];
  };
  generatedAt?: string;
};

type MobileSellerRecord = Prisma.SellerGetPayload<{ select: typeof mobileSellerSelect }>;

@Injectable()
export class MobileStorefrontService {
  constructor(
    @Inject(StorefrontService) private readonly storefrontService: StorefrontService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CmsService) private readonly cms: CmsService,
  ) {}

  async getMobileHome(query: MobileHomeQueryDto = {}) {
    const storefrontQuery = this.toStorefrontLocationQuery(query);
    const [desktopHome, supportConfig, liveHomepageSections] = await Promise.all([
      this.storefrontService.getHome(storefrontQuery) as Promise<DesktopHomePayload>,
      this.storefrontService.getContactConfig(),
      this.cms.listPublishedHomepageSections({ includeInactiveSchedule: true }),
    ]);
    const storesNearYou = this.shouldUseGpsRanking(query)
      ? await this.listGpsRankedStores(query)
      : desktopHome.storesNearYou ?? [];
    const sections = liveHomepageSections.length
      ? liveHomepageSections
      : desktopHome.homepageSections ?? desktopHome.sections ?? [];

    return {
      banners: desktopHome.banners ?? [],
      categories: desktopHome.categories ?? [],
      sections,
      productRails: {
        featured: desktopHome.productRails?.featured ?? [],
        latest: desktopHome.productRails?.latest ?? [],
        deals: desktopHome.productRails?.deals ?? [],
      },
      storesNearYou,
      supportConfig,
      generatedAt: new Date().toISOString(),
    };
  }

  shouldUseGpsRanking(query: Pick<MobileHomeQueryDto, "latitude" | "longitude" | "accuracyMeters">) {
    return (
      isValidLatitude(query.latitude) &&
      isValidLongitude(query.longitude) &&
      typeof query.accuracyMeters === "number" &&
      Number.isFinite(query.accuracyMeters) &&
      query.accuracyMeters <= mobileGpsMaxAccuracyMeters()
    );
  }

  private toStorefrontLocationQuery(query: MobileHomeQueryDto): PublicSellerQueryDto {
    return {
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.stateCode ? { stateCode: query.stateCode } : {}),
      ...(query.cityCode ? { cityCode: query.cityCode } : {}),
      ...(query.localAreaCode ? { localAreaCode: query.localAreaCode } : {}),
      ...(query.pincode ? { pincode: query.pincode } : {}),
      ...(query.limit ? { limit: query.limit } : {}),
    };
  }

  private async listGpsRankedStores(query: MobileHomeQueryDto) {
    const limit = query.limit ?? 8;
    const sellers = await this.prisma.client.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      select: mobileSellerSelect,
      orderBy: { storeName: "asc" },
      take: 200,
    });
    const sellerIds = sellers.map((seller) => seller.id);
    const productCounts = sellerIds.length
      ? await this.prisma.client.product.groupBy({
          by: ["sellerId"],
          where: {
            deletedAt: null,
            status: ProductStatus.ACTIVE,
            approvalStatus: ApprovalStatus.APPROVED,
            sellerId: { in: sellerIds },
            category: {
              status: CategoryStatus.ACTIVE,
              deletedAt: null,
            },
          },
          _count: { _all: true },
        })
      : [];
    const productCountBySeller = new Map(
      productCounts.map((count) => [count.sellerId, count._count._all]),
    );

    return sellers
      .map((seller) =>
        this.toMobileSellerResponse(
          seller,
          productCountBySeller.get(seller.id) ?? 0,
          query.latitude as number,
          query.longitude as number,
        ),
      )
      .sort((left, right) => {
        const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return left.storeName.localeCompare(right.storeName, undefined, { sensitivity: "base" });
      })
      .slice(0, limit);
  }

  private toMobileSellerResponse(
    seller: MobileSellerRecord,
    productCount: number,
    userLatitude: number,
    userLongitude: number,
  ) {
    const nearestAddress = nearestSellerAddress(seller.addresses, userLatitude, userLongitude);

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
      locationMatchLevel: nearestAddress ? "GPS" : "NONE",
      distanceMeters: nearestAddress?.distanceMeters ?? null,
      _count: {
        products: productCount,
      },
    };
  }
}

function nearestSellerAddress(
  addresses: MobileSellerRecord["addresses"],
  userLatitude: number,
  userLongitude: number,
) {
  const ranked = addresses
    .map((address) => {
      const latitude = decimalToNumber(address.latitude);
      const longitude = decimalToNumber(address.longitude);

      if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        return null;
      }

      return {
        address,
        distanceMeters: Math.round(haversineKm(userLatitude, userLongitude, latitude, longitude) * 1000),
      };
    })
    .filter((item): item is { address: MobileSellerRecord["addresses"][number]; distanceMeters: number } =>
      Boolean(item),
    )
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  return ranked[0] ?? null;
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

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function positiveIntegerEnv(key: string, fallback: number) {
  const value = process.env[key]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function mobileGpsMaxAccuracyMeters() {
  return positiveIntegerEnv("MOBILE_GPS_MAX_ACCURACY_METERS", 1000);
}
