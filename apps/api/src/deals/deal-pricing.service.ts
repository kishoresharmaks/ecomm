import { Inject, Injectable } from "@nestjs/common";
import {
  DealProductEnrollmentStatus,
  DealStatus,
  Prisma,
} from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";

type PricingClient = Prisma.TransactionClient | PrismaService["client"];

export type DealPriceSnapshot = {
  dealId: string;
  title: string;
  discountBps: number;
  startsAt: string;
  endsAt: string;
};

export type ResolvedDealPrice = {
  originalUnitPricePaise: number;
  effectiveUnitPricePaise: number;
  dealDiscountBps: number | null;
  dealDiscountPaise: number;
  dealSnapshot: DealPriceSnapshot | null;
};

type VariantLike = {
  pricePaise: number;
};

type ProductWithVariants = {
  id: string;
  variants: Array<VariantLike & Record<string, unknown>>;
};

type ActiveDealEnrollment = Awaited<
  ReturnType<DealPricingService["findActiveDealEnrollmentsForProducts"]>
>[number];

@Injectable()
export class DealPricingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveVariantPrice(
    variant: VariantLike,
    productId: string,
    client: PricingClient = this.prisma.client,
    at = new Date(),
  ): Promise<ResolvedDealPrice> {
    const enrollment = await client.dealProductEnrollment.findFirst({
      where: this.activeEnrollmentWhere(productId, at),
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            discountBps: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return this.priceFromEnrollment(variant.pricePaise, enrollment);
  }

  async applyActiveDealsToProducts<T extends ProductWithVariants>(
    products: T[],
    client: PricingClient = this.prisma.client,
    at = new Date(),
  ) {
    if (!products.length) {
      return products;
    }

    const enrollments = await this.findActiveDealEnrollmentsForProducts(
      products.map((product) => product.id),
      client,
      at,
    );
    const enrollmentByProductId = new Map(enrollments.map((entry) => [entry.productId, entry]));

    return products.map((product) => {
      const enrollment = enrollmentByProductId.get(product.id) ?? null;
      return {
        ...product,
        activeDeal: enrollment ? this.dealSummary(enrollment) : null,
        variants: product.variants.map((variant) => {
          const price = this.priceFromEnrollment(variant.pricePaise, enrollment);
          return {
            ...variant,
            pricePaise: price.effectiveUnitPricePaise,
            originalPricePaise: price.originalUnitPricePaise,
            dealPricePaise: price.dealSnapshot ? price.effectiveUnitPricePaise : null,
            dealDiscountBps: price.dealDiscountBps,
            dealDiscountPaise: price.dealDiscountPaise,
            activeDeal: price.dealSnapshot,
          };
        }),
      };
    });
  }

  async findActiveDealEnrollmentsForProducts(
    productIds: string[],
    client: PricingClient = this.prisma.client,
    at = new Date(),
  ) {
    const ids = Array.from(new Set(productIds.filter(Boolean)));
    if (!ids.length) {
      return [];
    }

    return client.dealProductEnrollment.findMany({
      where: {
        productId: { in: ids },
        status: DealProductEnrollmentStatus.ENROLLED,
        deal: {
          status: DealStatus.PUBLISHED,
          startsAt: { lte: at },
          endsAt: { gte: at },
        },
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            discountBps: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  calculateDealPrice(originalPricePaise: number, discountBps: number) {
    const normalizedPrice = Math.max(0, Math.trunc(originalPricePaise));
    const normalizedDiscount = Math.min(9000, Math.max(100, Math.trunc(discountBps)));
    return Math.round((normalizedPrice * (10000 - normalizedDiscount)) / 10000);
  }

  private activeEnrollmentWhere(productId: string, at: Date): Prisma.DealProductEnrollmentWhereInput {
    return {
      productId,
      status: DealProductEnrollmentStatus.ENROLLED,
      deal: {
        status: DealStatus.PUBLISHED,
        startsAt: { lte: at },
        endsAt: { gte: at },
      },
    };
  }

  private priceFromEnrollment(
    originalPricePaise: number,
    enrollment: ActiveDealEnrollment | null,
  ): ResolvedDealPrice {
    if (!enrollment) {
      return {
        originalUnitPricePaise: originalPricePaise,
        effectiveUnitPricePaise: originalPricePaise,
        dealDiscountBps: null,
        dealDiscountPaise: 0,
        dealSnapshot: null,
      };
    }

    const effectiveUnitPricePaise = this.calculateDealPrice(
      originalPricePaise,
      enrollment.deal.discountBps,
    );
    return {
      originalUnitPricePaise: originalPricePaise,
      effectiveUnitPricePaise,
      dealDiscountBps: enrollment.deal.discountBps,
      dealDiscountPaise: Math.max(0, originalPricePaise - effectiveUnitPricePaise),
      dealSnapshot: this.dealSummary(enrollment),
    };
  }

  private dealSummary(enrollment: ActiveDealEnrollment): DealPriceSnapshot {
    return {
      dealId: enrollment.deal.id,
      title: enrollment.deal.title,
      discountBps: enrollment.deal.discountBps,
      startsAt: enrollment.deal.startsAt.toISOString(),
      endsAt: enrollment.deal.endsAt.toISOString(),
    };
  }
}
