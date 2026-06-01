import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, PaymentStatus, Prisma, SellerOrderStatus, SellerPayoutStatus, SellerSettlementStatus } from "@indihub/database";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
} from "../common/pagination";
import { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { SettlementDraftDto, SettlementQueryDto } from "./dto/finance.dto";
import { FinanceCalculatorService, SplitFinanceCalculation } from "./finance-calculator.service";

type DraftSplit = Prisma.OrderSellerSplitGetPayload<{
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

type SellerDraft = {
  sellerId: string;
  splits: Array<{ split: DraftSplit; calculation: SplitFinanceCalculation }>;
};

type FinanceTotals = {
  grossSalesPaise: number;
  commissionPaise: number;
  gstOnCommissionPaise: number;
  tdsPaise: number;
  tcsPaise: number;
  platformFeePaise: number;
  refundAdjustmentPaise: number;
  netPayablePaise: number;
  currency: string;
};

@Injectable()
export class SellerSettlementsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceCalculatorService) private readonly calculator: FinanceCalculatorService
  ) {}

  async listRuns(query: SettlementQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.SellerSettlementRunWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { runNumber: { contains: search, mode: "insensitive" } } : {})
    };

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query, {
        defaultLimit: 20,
        maxLimit: 100
      });
      const cursorWhere = createdAtCursorWhere(cursor) as
        | Prisma.SellerSettlementRunWhereInput
        | undefined;
      const items = await this.prisma.client.sellerSettlementRun.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: this.runListInclude(),
        orderBy: createdAtCursorOrderBy(),
        take: take + 1
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.sellerSettlementRun.findMany({
        where,
        include: this.runListInclude(),
        orderBy: createdAtCursorOrderBy(),
        skip,
        take
      });
      const total = await tx.sellerSettlementRun.count({ where });
      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  private runListInclude() {
    return {
      payouts: {
        include: {
          seller: { select: { id: true, storeName: true, slug: true } }
        },
        orderBy: { netPayablePaise: "desc" as const }
      }
    } satisfies Prisma.SellerSettlementRunInclude;
  }

  async getRun(runId: string) {
    const run = await this.prisma.client.sellerSettlementRun.findUnique({
      where: { id: runId },
      include: {
        payouts: {
          include: {
            seller: { include: { profile: true } },
            orderSplits: {
              include: {
                order: true
              },
              orderBy: { createdAt: "asc" }
            }
          },
          orderBy: { seller: { storeName: "asc" } }
        }
      }
    });

    if (!run) {
      throw new NotFoundException("Settlement run not found.");
    }

    return run;
  }

  async createDraft(dto: SettlementDraftDto, actor: RequestUser) {
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);

    if (dateFrom > dateTo) {
      throw new BadRequestException("dateFrom must be before dateTo.");
    }

    const run = await this.prisma.client.$transaction(async (tx) => {
      const splits = await tx.orderSellerSplit.findMany({
        where: {
          payoutId: null,
          sellerStatus: { not: SellerOrderStatus.CANCELLED },
          settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
          order: {
            orderStatus: OrderStatus.DELIVERED,
            paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.NOT_REQUIRED] },
            createdAt: {
              gte: dateFrom,
              lte: dateTo
            }
          }
        },
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      });

      if (!splits.length) {
        throw new BadRequestException("No eligible seller order splits found for this settlement period.");
      }

      const drafts = new Map<string, SellerDraft>();
      for (const split of splits) {
        const calculation = await this.calculator.calculateSplit(split, tx);
        const sellerDraft = drafts.get(split.sellerId) ?? { sellerId: split.sellerId, splits: [] };
        sellerDraft.splits.push({ split, calculation });
        drafts.set(split.sellerId, sellerDraft);
      }

      const runNumber = this.makeRunNumber();
      const settlementRun = await tx.sellerSettlementRun.create({
        data: {
          runNumber,
          periodFrom: dateFrom,
          periodTo: dateTo,
          status: SellerPayoutStatus.DRAFT,
          note: dto.note ?? null,
          createdById: actor.id
        }
      });

      const runTotals = this.emptyTotals();
      for (const sellerDraft of drafts.values()) {
        const totals = this.totalsForDraft(sellerDraft);
        const payout = await tx.sellerPayout.create({
          data: {
            payoutNumber: this.makePayoutNumber(),
            settlementRunId: settlementRun.id,
            sellerId: sellerDraft.sellerId,
            periodFrom: dateFrom,
            periodTo: dateTo,
            status: SellerPayoutStatus.DRAFT,
            ...totals
          }
        });

        for (const { split, calculation } of sellerDraft.splits) {
          const splitUpdate = await tx.orderSellerSplit.updateMany({
            where: {
              id: split.id,
              payoutId: null,
              sellerStatus: { not: SellerOrderStatus.CANCELLED },
              settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
              order: {
                orderStatus: OrderStatus.DELIVERED,
                paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.NOT_REQUIRED] },
                createdAt: {
                  gte: dateFrom,
                  lte: dateTo
                }
              }
            },
            data: {
              payoutId: payout.id,
              commissionRuleId: calculation.commissionRuleId ?? null,
              commissionPaise: calculation.commissionPaise,
              gstOnCommissionPaise: calculation.gstOnCommissionPaise,
              tdsPaise: calculation.tdsPaise,
              tcsPaise: calculation.tcsPaise,
              platformFeePaise: calculation.platformFeePaise,
              refundAdjustmentPaise: calculation.refundAdjustmentPaise,
              netPayablePaise: calculation.netPayablePaise,
              financeSnapshot: calculation.snapshot,
              settlementStatus: SellerSettlementStatus.DRAFTED,
              settlementEligibleAt: split.settlementEligibleAt ?? new Date()
            }
          });
          if (splitUpdate.count !== 1) {
            throw new ConflictException("Settlement eligibility changed while creating this draft. Refresh and try again.");
          }
        }

        this.addTotals(runTotals, totals);
      }

      await tx.sellerSettlementRun.update({
        where: { id: settlementRun.id },
        data: runTotals
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "finance.settlement.draft_created",
          entityType: "seller_settlement_run",
          entityId: settlementRun.id,
          newValue: {
            runNumber,
            periodFrom: dto.dateFrom,
            periodTo: dto.dateTo,
            payoutCount: drafts.size,
            splitCount: splits.length
          }
        }
      });

      return settlementRun;
    });

    return this.getRun(run.id);
  }

  async submitRun(runId: string, actor: RequestUser) {
    await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.sellerSettlementRun.findUnique({
        where: { id: runId },
        include: { payouts: true }
      });

      if (!existing) {
        throw new NotFoundException("Settlement run not found.");
      }

      if (existing.status !== SellerPayoutStatus.DRAFT) {
        throw new BadRequestException("Only draft settlement runs can be submitted for approval.");
      }

      const runUpdate = await tx.sellerSettlementRun.updateMany({
        where: { id: runId, status: SellerPayoutStatus.DRAFT },
        data: {
          status: SellerPayoutStatus.PENDING_APPROVAL,
          submittedById: actor.id,
          submittedAt: new Date()
        }
      });
      if (runUpdate.count !== 1) {
        throw new ConflictException("Settlement run status changed. Refresh and try again.");
      }

      const payoutUpdate = await tx.sellerPayout.updateMany({
        where: { settlementRunId: runId, status: SellerPayoutStatus.DRAFT },
        data: { status: SellerPayoutStatus.PENDING_APPROVAL }
      });
      if (payoutUpdate.count !== existing.payouts.length) {
        throw new ConflictException("Settlement payouts changed. Refresh and try again.");
      }

      for (const payout of existing.payouts) {
        await tx.sellerPayoutEvent.create({
          data: {
            payoutId: payout.id,
            eventType: "payout.submitted_for_approval",
            oldStatus: SellerPayoutStatus.DRAFT,
            newStatus: SellerPayoutStatus.PENDING_APPROVAL,
            actorUserId: actor.id
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "finance.settlement.submitted",
          entityType: "seller_settlement_run",
          entityId: runId,
          oldValue: { status: existing.status },
          newValue: { status: SellerPayoutStatus.PENDING_APPROVAL }
        }
      });
    });

    return this.getRun(runId);
  }

  private totalsForDraft(draft: SellerDraft) {
    const totals = this.emptyTotals();
    for (const { calculation } of draft.splits) {
      totals.grossSalesPaise += calculation.grossSalesPaise;
      totals.commissionPaise += calculation.commissionPaise;
      totals.gstOnCommissionPaise += calculation.gstOnCommissionPaise;
      totals.tdsPaise += calculation.tdsPaise;
      totals.tcsPaise += calculation.tcsPaise;
      totals.platformFeePaise += calculation.platformFeePaise;
      totals.refundAdjustmentPaise += calculation.refundAdjustmentPaise;
      totals.netPayablePaise += calculation.netPayablePaise;
    }

    return totals;
  }

  private emptyTotals() {
    return {
      grossSalesPaise: 0,
      commissionPaise: 0,
      gstOnCommissionPaise: 0,
      tdsPaise: 0,
      tcsPaise: 0,
      platformFeePaise: 0,
      refundAdjustmentPaise: 0,
      netPayablePaise: 0,
      currency: "INR"
    };
  }

  private addTotals(target: FinanceTotals, source: FinanceTotals) {
    target.grossSalesPaise += source.grossSalesPaise;
    target.commissionPaise += source.commissionPaise;
    target.gstOnCommissionPaise += source.gstOnCommissionPaise;
    target.tdsPaise += source.tdsPaise;
    target.tcsPaise += source.tcsPaise;
    target.platformFeePaise += source.platformFeePaise;
    target.refundAdjustmentPaise += source.refundAdjustmentPaise;
    target.netPayablePaise += source.netPayablePaise;
  }

  private makeRunNumber() {
    return `SET-${this.timestamp()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  private makePayoutNumber() {
    return `PO-${this.timestamp()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  private timestamp() {
    return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  }
}
