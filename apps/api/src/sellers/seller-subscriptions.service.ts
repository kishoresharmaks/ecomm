import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SellerSubscriptionBillingCycle, SellerSubscriptionStatus } from "@indihub/database";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  AssignSellerSubscriptionDto,
  CreateSellerSubscriptionPlanDto,
  SellerSubscriptionPlanQueryDto,
  UpdateSellerSubscriptionPlanDto
} from "./dto/seller-subscription.dto";

type SellerPlanWriteDto = CreateSellerSubscriptionPlanDto | UpdateSellerSubscriptionPlanDto;

@Injectable()
export class SellerSubscriptionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublicPlans() {
    const items = await this.prisma.client.sellerSubscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return {
      items,
      defaultPlanId: items.find((plan) => plan.isDefault)?.id ?? items[0]?.id ?? null
    };
  }

  async listAdminPlans(query: SellerSubscriptionPlanQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const where: Prisma.SellerSubscriptionPlanWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.sellerSubscriptionPlan.findMany({
        where,
        include: {
          _count: {
            select: {
              currentSellers: true,
              subscriptions: true
            }
          }
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip,
        take
      });
      const total = await tx.sellerSubscriptionPlan.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async createPlan(dto: CreateSellerSubscriptionPlanDto, actor: RequestUser) {
    const plan = await this.prisma.client.$transaction(async (tx) => {
      this.assertDefaultAllowed(dto);

      if (dto.isDefault) {
        await tx.sellerSubscriptionPlan.updateMany({ data: { isDefault: false } });
      }

      const plan = await tx.sellerSubscriptionPlan.create({
        data: this.createPlanData(dto)
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription_plan.created",
          entityType: "seller_subscription_plan",
          entityId: plan.id,
          newValue: this.auditPlanValue(plan)
        }
      });

      return plan;
    });

    return plan;
  }

  async updatePlan(planId: string, dto: UpdateSellerSubscriptionPlanDto, actor: RequestUser) {
    const plan = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.sellerSubscriptionPlan.findUnique({ where: { id: planId } });

      if (!existing) {
        throw new NotFoundException("Seller subscription plan not found.");
      }

      this.assertDefaultAllowed(dto, existing);

      if (dto.isDefault) {
        await tx.sellerSubscriptionPlan.updateMany({
          where: { id: { not: planId } },
          data: { isDefault: false }
        });
      }

      const plan = await tx.sellerSubscriptionPlan.update({
        where: { id: planId },
        data: this.planData(dto)
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription_plan.updated",
          entityType: "seller_subscription_plan",
          entityId: plan.id,
          oldValue: this.auditPlanValue(existing),
          newValue: this.auditPlanValue(plan)
        }
      });

      return plan;
    });

    return plan;
  }

  async setDefaultPlan(planId: string, actor: RequestUser) {
    const plan = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.sellerSubscriptionPlan.findUnique({ where: { id: planId } });

      if (!existing) {
        throw new NotFoundException("Seller subscription plan not found.");
      }

      if (!existing.isActive) {
        throw new BadRequestException("Only active seller subscription plans can be set as default.");
      }

      await tx.sellerSubscriptionPlan.updateMany({
        where: { id: { not: planId } },
        data: { isDefault: false }
      });

      const plan = await tx.sellerSubscriptionPlan.update({
        where: { id: planId },
        data: { isDefault: true }
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription_plan.default_set",
          entityType: "seller_subscription_plan",
          entityId: plan.id,
          oldValue: this.auditPlanValue(existing),
          newValue: this.auditPlanValue(plan)
        }
      });

      return plan;
    });

    return plan;
  }

  async assignSellerPlan(sellerId: string, dto: AssignSellerSubscriptionDto, actor: RequestUser) {
    const updatedSeller = await this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.findFirst({
        where: { id: sellerId, deletedAt: null },
        include: { subscriptionPlan: true }
      });

      if (!seller) {
        throw new NotFoundException("Seller not found.");
      }

      const plan = await tx.sellerSubscriptionPlan.findFirst({
        where: {
          id: dto.planId,
          isActive: true
        }
      });

      if (!plan) {
        throw new BadRequestException("Select an active seller subscription plan.");
      }

      const status = dto.status ?? SellerSubscriptionStatus.ACTIVE;
      const currentPeriodEnd = dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null;
      await tx.sellerSubscription.updateMany({
        where: {
          sellerId,
          isCurrent: true
        },
        data: {
          isCurrent: false
        }
      });

      await tx.sellerSubscription.create({
        data: {
          sellerId,
          planId: plan.id,
          status,
          isCurrent: true,
          currentPeriodEnd,
          note: dto.note ?? null,
          createdById: actor.id
        }
      });

      const updatedSeller = await tx.seller.update({
        where: { id: sellerId },
        data: {
          subscriptionPlanId: plan.id,
          subscriptionStatus: status,
          subscriptionStartedAt: new Date(),
          subscriptionCurrentPeriodEnd: currentPeriodEnd
        },
        include: {
          user: true,
          profile: true,
          addresses: true,
          subscriptionPlan: true,
          subscriptions: {
            where: { isCurrent: true },
            include: { plan: true },
            orderBy: { createdAt: "desc" }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription.assigned",
          entityType: "seller",
          entityId: sellerId,
          oldValue: {
            planId: seller.subscriptionPlanId,
            planName: seller.subscriptionPlan?.name,
            status: seller.subscriptionStatus
          },
          newValue: {
            planId: plan.id,
            planName: plan.name,
            status,
            note: dto.note
          }
        }
      });

      return updatedSeller;
    });

    return updatedSeller;
  }

  async getSellerSubscription(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      include: {
        subscriptionPlan: true,
        subscriptions: {
          where: { isCurrent: true },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }

    return {
      sellerId: seller.id,
      subscriptionStatus: seller.subscriptionStatus,
      subscriptionStartedAt: seller.subscriptionStartedAt,
      subscriptionCurrentPeriodEnd: seller.subscriptionCurrentPeriodEnd,
      plan: seller.subscriptionPlan,
      currentSubscription: seller.subscriptions[0] ?? null
    };
  }

  async resolveRegistrationPlan(tx: Prisma.TransactionClient, planId?: string) {
    if (planId) {
      const selectedPlan = await tx.sellerSubscriptionPlan.findFirst({
        where: {
          id: planId,
          isActive: true
        }
      });

      if (!selectedPlan) {
        throw new BadRequestException("Select an active seller subscription plan.");
      }

      return selectedPlan;
    }

    const defaultPlan = await tx.sellerSubscriptionPlan.findFirst({
      where: {
        isDefault: true,
        isActive: true
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    if (defaultPlan) {
      return defaultPlan;
    }

    return tx.sellerSubscriptionPlan.findFirst({
      where: {
        isActive: true
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async recordRegistrationAssignment(
    tx: Prisma.TransactionClient,
    sellerId: string,
    plan: { id: string } | null,
    actorId: string
  ) {
    if (!plan) {
      return;
    }

    await tx.sellerSubscription.create({
      data: {
        sellerId,
        planId: plan.id,
        status: SellerSubscriptionStatus.ACTIVE,
        isCurrent: true,
        createdById: actorId,
        note: "Assigned during seller onboarding."
      }
    });
  }

  private createPlanData(dto: CreateSellerSubscriptionPlanDto): Prisma.SellerSubscriptionPlanCreateInput {
    return {
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      pricePaise: dto.pricePaise ?? 0,
      currency: dto.currency?.trim().toUpperCase() ?? "INR",
      billingCycle: dto.billingCycle ?? SellerSubscriptionBillingCycle.MONTHLY,
      productLimit: dto.productLimit ?? null,
      featuredProductLimit: dto.featuredProductLimit ?? null,
      b2bEnquiryLimit: dto.b2bEnquiryLimit ?? null,
      commissionDiscountBps: dto.commissionDiscountBps ?? 0,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 100
    };
  }

  private planData(dto: SellerPlanWriteDto): Prisma.SellerSubscriptionPlanUpdateInput {
    return {
      ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.pricePaise !== undefined ? { pricePaise: dto.pricePaise } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() } : {}),
      ...(dto.billingCycle !== undefined ? { billingCycle: dto.billingCycle } : {}),
      ...(dto.productLimit !== undefined ? { productLimit: dto.productLimit } : {}),
      ...(dto.featuredProductLimit !== undefined ? { featuredProductLimit: dto.featuredProductLimit } : {}),
      ...(dto.b2bEnquiryLimit !== undefined ? { b2bEnquiryLimit: dto.b2bEnquiryLimit } : {}),
      ...(dto.commissionDiscountBps !== undefined ? { commissionDiscountBps: dto.commissionDiscountBps } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
    };
  }

  private assertDefaultAllowed(dto: SellerPlanWriteDto, existing?: { isDefault: boolean; isActive: boolean }) {
    const nextIsDefault = dto.isDefault ?? existing?.isDefault ?? false;
    const nextIsActive = dto.isActive ?? existing?.isActive ?? true;

    if (nextIsDefault && !nextIsActive) {
      throw new BadRequestException("Default seller subscription plan must be active.");
    }

    if (existing?.isDefault && dto.isActive === false && dto.isDefault !== false) {
      throw new BadRequestException("Set another active default plan before disabling the current default.");
    }
  }

  private auditPlanValue(plan: {
    code: string;
    name: string;
    pricePaise: number;
    currency: string;
    billingCycle: string;
    isDefault: boolean;
    isActive: boolean;
    productLimit?: number | null;
    b2bEnquiryLimit?: number | null;
  }) {
    return {
      code: plan.code,
      name: plan.name,
      pricePaise: plan.pricePaise,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      isDefault: plan.isDefault,
      isActive: plan.isActive,
      productLimit: plan.productLimit,
      b2bEnquiryLimit: plan.b2bEnquiryLimit
    };
  }
}
