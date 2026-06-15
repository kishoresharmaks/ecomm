import { Inject, Injectable } from "@nestjs/common";
import { CommissionType, FinanceRuleScope, Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";

type FinanceRule = Prisma.CommissionRuleGetPayload<Record<string, never>>;
type FinanceSplit = Prisma.OrderSellerSplitGetPayload<{
  include: {
    order: {
      include: {
        items: {
          include: {
            product: true;
          };
        };
      };
    };
  };
}>;

export type SplitFinanceCalculation = {
  commissionRuleId?: string;
  grossSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  netPayablePaise: number;
  snapshot: Prisma.InputJsonValue;
};

@Injectable()
export class FinanceCalculatorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async calculateSplit(split: FinanceSplit, tx: Prisma.TransactionClient = this.prisma.client) {
    const ruleCache = new Map<string, FinanceRule | null>();
    const items = split.order.items.filter((item) => item.sellerId === split.sellerId);
    const lineSnapshots: Prisma.InputJsonObject[] = [];
    const ruleIds = new Set<string>();
    let commissionPaise = 0;
    let gstOnCommissionPaise = 0;
    let tdsPaise = 0;
    let tcsPaise = 0;
    let platformFeePaise = 0;
    let couponSellerFundedDiscountPaise = 0;

    for (const item of items) {
      const categoryId = item.product.categoryId;
      const rule = await this.resolveRule(split.sellerId, categoryId, split.order.createdAt, ruleCache, tx);
      const lineAmount = item.lineTotalPaise;
      const lineCouponSellerFundedDiscountPaise = item.couponSellerFundedDiscountPaise ?? 0;
      const lineCommission = rule ? this.amountForRule(rule.commissionType, rule.commissionValueBps, rule.commissionFixedPaise, lineAmount) : 0;
      const linePlatformFee = rule ? this.amountForRule(rule.platformFeeType, rule.platformFeeValueBps, rule.platformFeeFixedPaise, lineAmount) : 0;
      const lineGst = rule ? this.percentOf(lineCommission + linePlatformFee, rule.gstRateBps) : 0;
      const lineTds = rule ? this.percentOf(lineAmount, rule.tdsRateBps) : 0;
      const lineTcs = rule ? this.percentOf(lineAmount, rule.tcsRateBps) : 0;

      if (rule) {
        ruleIds.add(rule.id);
      }

      commissionPaise += lineCommission;
      gstOnCommissionPaise += lineGst;
      tdsPaise += lineTds;
      tcsPaise += lineTcs;
      platformFeePaise += linePlatformFee;
      couponSellerFundedDiscountPaise += lineCouponSellerFundedDiscountPaise;

      lineSnapshots.push({
        orderItemId: item.id,
        productId: item.productId,
        categoryId,
        lineTotalPaise: lineAmount,
        couponSellerFundedDiscountPaise: lineCouponSellerFundedDiscountPaise,
        ruleId: rule?.id ?? null,
        ruleName: rule?.name ?? "No commission rule",
        commissionPaise: lineCommission,
        gstOnCommissionPaise: lineGst,
        tdsPaise: lineTds,
        tcsPaise: lineTcs,
        platformFeePaise: linePlatformFee
      });
    }

    const deductionsPaise = commissionPaise + gstOnCommissionPaise + tdsPaise + tcsPaise + platformFeePaise;
    const refundAdjustmentPaise = split.refundAdjustmentPaise ?? 0;
    const couponAdjustmentPaise = split.couponAdjustmentPaise ?? 0;
    const netPayablePaise =
      split.sellerSubtotalPaise -
      deductionsPaise -
      couponSellerFundedDiscountPaise +
      refundAdjustmentPaise +
      couponAdjustmentPaise;
    const ruleIdList = Array.from(ruleIds);

    return {
      ...(ruleIdList.length === 1 ? { commissionRuleId: ruleIdList[0] } : {}),
      grossSalesPaise: split.sellerSubtotalPaise,
      commissionPaise,
      gstOnCommissionPaise,
      tdsPaise,
      tcsPaise,
      platformFeePaise,
      refundAdjustmentPaise,
      netPayablePaise,
      snapshot: {
        calculationVersion: 2,
        rulesUsed: ruleIdList,
        sellerFundedCouponDiscountPaise: couponSellerFundedDiscountPaise,
        couponAdjustmentPaise,
        lines: lineSnapshots
      }
    } satisfies SplitFinanceCalculation;
  }

  private async resolveRule(
    sellerId: string,
    categoryId: string,
    effectiveAt: Date,
    cache: Map<string, FinanceRule | null>,
    tx: Prisma.TransactionClient
  ) {
    const cacheKey = `${sellerId}:${categoryId}:${effectiveAt.toISOString().slice(0, 10)}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey) ?? null;
    }

    const rules = await tx.commissionRule.findMany({
      where: {
        active: true,
        OR: [
          { scope: FinanceRuleScope.SELLER_CATEGORY, sellerId, categoryId },
          { scope: FinanceRuleScope.SELLER, sellerId },
          { scope: FinanceRuleScope.CATEGORY, categoryId },
          { scope: FinanceRuleScope.GLOBAL }
        ],
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: effectiveAt } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }] }
        ]
      }
    });

    const [rule] = rules.sort((left, right) => {
      const scopeDiff = this.scopeRank(left.scope) - this.scopeRank(right.scope);
      if (scopeDiff !== 0) {
        return scopeDiff;
      }

      const priorityDiff = left.priority - right.priority;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });

    cache.set(cacheKey, rule ?? null);
    return rule ?? null;
  }

  private scopeRank(scope: FinanceRuleScope) {
    switch (scope) {
      case FinanceRuleScope.SELLER_CATEGORY:
        return 1;
      case FinanceRuleScope.SELLER:
        return 2;
      case FinanceRuleScope.CATEGORY:
        return 3;
      case FinanceRuleScope.GLOBAL:
        return 4;
      default:
        return 99;
    }
  }

  private amountForRule(type: CommissionType, valueBps: number | null, fixedPaise: number | null, basePaise: number) {
    if (type === CommissionType.PERCENTAGE) {
      return this.percentOf(basePaise, valueBps ?? 0);
    }

    if (type === CommissionType.FIXED) {
      return fixedPaise ?? 0;
    }

    return 0;
  }

  private percentOf(amountPaise: number, basisPoints: number) {
    return Math.round((amountPaise * basisPoints) / 10_000);
  }
}
