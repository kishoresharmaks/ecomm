import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CommissionType, FinanceRuleScope, Prisma } from "@indihub/database";
import { paginationFromQuery } from "../common/pagination";
import { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { CommissionRuleQueryDto, UpsertCommissionRuleDto } from "./dto/finance.dto";

@Injectable()
export class CommissionRulesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listRules(query: CommissionRuleQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const where: Prisma.CommissionRuleWhereInput = {
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { seller: { storeName: { contains: query.search, mode: "insensitive" } } },
              { category: { name: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.commissionRule.findMany({
        where,
        include: {
          seller: { select: { id: true, storeName: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } }
        },
        orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "desc" }],
        skip,
        take
      });
      const total = await tx.commissionRule.count({ where });
      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async createRule(dto: UpsertCommissionRuleDto, actor: RequestUser) {
    this.assertRuleScope(dto);

    const rule = await this.prisma.client.commissionRule.create({
      data: {
        ...this.ruleData(dto),
        createdById: actor.id
      },
      include: {
        seller: { select: { id: true, storeName: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    await this.audit(actor, "finance.commission_rule.created", rule.id, null, rule);
    return rule;
  }

  async updateRule(ruleId: string, dto: UpsertCommissionRuleDto, actor: RequestUser) {
    this.assertRuleScope(dto);
    const existing = await this.prisma.client.commissionRule.findUnique({ where: { id: ruleId } });

    if (!existing) {
      throw new NotFoundException("Commission rule not found.");
    }

    const rule = await this.prisma.client.commissionRule.update({
      where: { id: ruleId },
      data: this.ruleData(dto),
      include: {
        seller: { select: { id: true, storeName: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    await this.audit(actor, "finance.commission_rule.updated", rule.id, existing, rule);
    return rule;
  }

  async setRuleActive(ruleId: string, active: boolean, actor: RequestUser) {
    const existing = await this.prisma.client.commissionRule.findUnique({ where: { id: ruleId } });

    if (!existing) {
      throw new NotFoundException("Commission rule not found.");
    }

    const rule = await this.prisma.client.commissionRule.update({
      where: { id: ruleId },
      data: { active },
      include: {
        seller: { select: { id: true, storeName: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } }
      }
    });

    await this.audit(actor, active ? "finance.commission_rule.activated" : "finance.commission_rule.deactivated", rule.id, existing, rule);
    return rule;
  }

  private ruleData(dto: UpsertCommissionRuleDto) {
    const platformFeeType = dto.platformFeeType ?? CommissionType.MANUAL;

    return {
      name: dto.name,
      scope: dto.scope,
      sellerId: dto.sellerId ?? null,
      categoryId: dto.categoryId ?? null,
      commissionType: dto.commissionType,
      commissionValueBps: dto.commissionType === CommissionType.PERCENTAGE ? this.percentToBps(dto.commissionRatePercent ?? 0) : null,
      commissionFixedPaise: dto.commissionType === CommissionType.FIXED ? (dto.commissionFixedPaise ?? 0) : null,
      gstRateBps: this.percentToBps(dto.gstRatePercent ?? 0),
      tdsRateBps: this.percentToBps(dto.tdsRatePercent ?? 0),
      tcsRateBps: this.percentToBps(dto.tcsRatePercent ?? 0),
      platformFeeType,
      platformFeeValueBps: platformFeeType === CommissionType.PERCENTAGE ? this.percentToBps(dto.platformFeeRatePercent ?? 0) : null,
      platformFeeFixedPaise: platformFeeType === CommissionType.FIXED ? (dto.platformFeeFixedPaise ?? 0) : null,
      priority: dto.priority ?? 100,
      active: dto.active ?? true,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null
    };
  }

  private assertRuleScope(dto: UpsertCommissionRuleDto) {
    if (dto.scope === FinanceRuleScope.GLOBAL && (dto.sellerId || dto.categoryId)) {
      throw new BadRequestException("Global commission rules cannot target a seller or category.");
    }

    if (dto.scope === FinanceRuleScope.SELLER && !dto.sellerId) {
      throw new BadRequestException("Seller commission rules require a seller.");
    }

    if (dto.scope === FinanceRuleScope.CATEGORY && !dto.categoryId) {
      throw new BadRequestException("Category commission rules require a category.");
    }

    if (dto.scope === FinanceRuleScope.SELLER_CATEGORY && (!dto.sellerId || !dto.categoryId)) {
      throw new BadRequestException("Seller-category commission rules require both seller and category.");
    }

    if (dto.commissionType === CommissionType.PERCENTAGE && dto.commissionRatePercent === undefined) {
      throw new BadRequestException("Percentage commission rules require commissionRatePercent.");
    }

    if (dto.commissionType === CommissionType.FIXED && dto.commissionFixedPaise === undefined) {
      throw new BadRequestException("Fixed commission rules require commissionFixedPaise.");
    }
  }

  private percentToBps(percent: number) {
    return Math.round(percent * 100);
  }

  private async audit(actor: RequestUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action,
        entityType: "commission_rule",
        entityId,
        oldValue: oldValue as Prisma.InputJsonValue,
        newValue: newValue as Prisma.InputJsonValue
      }
    });
  }
}

