import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  B2BOrderStatus,
  B2BPaymentStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ServiceReceivableOffsetPolicy,
  ServiceSellerReceivableStatus,
  SellerOrderStatus,
  SellerPayoutStatus,
  SellerSettlementStatus,
} from "@indihub/database";
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
  b2bOrders: Prisma.B2BOrderGetPayload<Record<string, never>>[];
  serviceSettlements: Prisma.ServiceBookingSettlementGetPayload<{ include: { booking: true } }>[];
  receivableOffsets: Array<Prisma.ServiceSellerReceivableGetPayload<Record<string, never>> & { offsetAmountPaise: number }>;
  holdReceivableCount: number;
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
            },
            b2bOrders: { orderBy: { createdAt: "asc" } },
            serviceSettlements: {
              include: { booking: true },
              orderBy: { createdAt: "asc" }
            },
            serviceReceivableOffsets: {
              include: { booking: true },
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
      const [splits, b2bOrders, serviceSettlements, openServiceReceivables] = await Promise.all([
        tx.orderSellerSplit.findMany({
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
        }),
        tx.b2BOrder.findMany({
          where: {
            payoutId: null,
            sellerId: { not: null },
            status: B2BOrderStatus.FULFILLED,
            paymentStatus: B2BPaymentStatus.PAID,
            settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
            createdAt: {
              gte: dateFrom,
              lte: dateTo
            }
          },
          orderBy: { createdAt: "asc" }
        }),
        tx.serviceBookingSettlement.findMany({
          where: {
            payoutId: null,
            status: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
            netPayablePaise: { gt: 0 },
            booking: {
              status: { in: ["COMPLETED", "CLOSED_AFTER_INSPECTION"] },
              createdAt: {
                gte: dateFrom,
                lte: dateTo
              }
            }
          },
          include: { booking: true },
          orderBy: { createdAt: "asc" }
        }),
        tx.serviceSellerReceivable.findMany({
          where: {
            payoutOffsetId: null,
            status: { in: [ServiceSellerReceivableStatus.OPEN, ServiceSellerReceivableStatus.PARTIALLY_SETTLED] },
            offsetPolicy: {
              in: [
                ServiceReceivableOffsetPolicy.AUTO_OFFSET_NEXT_PAYOUT,
                ServiceReceivableOffsetPolicy.HOLD_PAYOUT_UNTIL_SETTLED
              ]
            }
          },
          orderBy: { createdAt: "asc" }
        })
      ]);

      if (!splits.length && !b2bOrders.length && !serviceSettlements.length) {
        throw new BadRequestException("No eligible seller order, B2B, or service payout sources found for this settlement period.");
      }

      const drafts = new Map<string, SellerDraft>();
      for (const split of splits) {
        const calculation = await this.calculator.calculateSplit(split, tx);
        const sellerDraft = this.getOrCreateDraft(drafts, split.sellerId);
        sellerDraft.splits.push({ split, calculation });
        drafts.set(split.sellerId, sellerDraft);
      }
      for (const order of b2bOrders) {
        if (!order.sellerId || order.sellerPayoutAmountPaise <= 0) {
          continue;
        }
        const sellerDraft = this.getOrCreateDraft(drafts, order.sellerId);
        sellerDraft.b2bOrders.push(order);
        drafts.set(order.sellerId, sellerDraft);
      }
      for (const settlement of serviceSettlements) {
        if (settlement.netPayablePaise <= 0) {
          continue;
        }
        const sellerDraft = this.getOrCreateDraft(drafts, settlement.sellerId);
        sellerDraft.serviceSettlements.push(settlement);
        drafts.set(settlement.sellerId, sellerDraft);
      }
      for (const receivable of openServiceReceivables) {
        if (!drafts.has(receivable.sellerId)) {
          continue;
        }
        const sellerDraft = this.getOrCreateDraft(drafts, receivable.sellerId);
        const outstanding = this.receivableOutstanding(receivable);
        if (outstanding <= 0) {
          continue;
        }
        if (receivable.offsetPolicy === ServiceReceivableOffsetPolicy.HOLD_PAYOUT_UNTIL_SETTLED) {
          sellerDraft.holdReceivableCount += 1;
          continue;
        }
        sellerDraft.receivableOffsets.push({ ...receivable, offsetAmountPaise: 0 });
        drafts.set(receivable.sellerId, sellerDraft);
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
        if (sellerDraft.holdReceivableCount > 0) {
          throw new BadRequestException("One or more sellers have service cash receivables configured to hold payouts until settled.");
        }
        this.applyReceivableOffsetsToDraft(sellerDraft);
        const totals = this.totalsForDraft(sellerDraft);
        const payout = await tx.sellerPayout.create({
          data: {
            payoutNumber: this.makePayoutNumber(),
            settlementRunId: settlementRun.id,
            sellerId: sellerDraft.sellerId,
            periodFrom: dateFrom,
            periodTo: dateTo,
            status: SellerPayoutStatus.DRAFT,
            adjustmentPaise: -sellerDraft.receivableOffsets.reduce((sum, item) => sum + item.offsetAmountPaise, 0),
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
        for (const order of sellerDraft.b2bOrders) {
          const b2bUpdate = await tx.b2BOrder.updateMany({
            where: {
              id: order.id,
              payoutId: null,
              sellerId: sellerDraft.sellerId,
              status: B2BOrderStatus.FULFILLED,
              paymentStatus: B2BPaymentStatus.PAID,
              settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
              createdAt: {
                gte: dateFrom,
                lte: dateTo
              }
            },
            data: {
              payoutId: payout.id,
              settlementStatus: SellerSettlementStatus.DRAFTED,
              settlementEligibleAt: order.settlementEligibleAt ?? new Date()
            }
          });
          if (b2bUpdate.count !== 1) {
            throw new ConflictException("B2B settlement eligibility changed while creating this draft. Refresh and try again.");
          }
        }
        for (const settlement of sellerDraft.serviceSettlements) {
          const serviceUpdate = await tx.serviceBookingSettlement.updateMany({
            where: {
              id: settlement.id,
              payoutId: null,
              sellerId: sellerDraft.sellerId,
              netPayablePaise: { gt: 0 },
              status: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] }
            },
            data: {
              payoutId: payout.id,
              status: SellerSettlementStatus.DRAFTED
            }
          });
          if (serviceUpdate.count !== 1) {
            throw new ConflictException("Service settlement eligibility changed while creating this draft. Refresh and try again.");
          }
        }
        for (const offset of sellerDraft.receivableOffsets) {
          if (offset.offsetAmountPaise <= 0) {
            continue;
          }
          const offsetUpdate = await tx.serviceSellerReceivable.updateMany({
            where: {
              id: offset.id,
              sellerId: sellerDraft.sellerId,
              payoutOffsetId: null,
              offsetPolicy: ServiceReceivableOffsetPolicy.AUTO_OFFSET_NEXT_PAYOUT,
              status: { in: [ServiceSellerReceivableStatus.OPEN, ServiceSellerReceivableStatus.PARTIALLY_SETTLED] }
            },
            data: {
              payoutOffsetId: payout.id,
              offsetPaise: offset.offsetAmountPaise,
              offsetScheduledAt: new Date(),
              offsetAppliedAt: null,
              status: ServiceSellerReceivableStatus.OFFSET_SCHEDULED
            }
          });
          if (offsetUpdate.count !== 1) {
            throw new ConflictException("Service receivable offset changed while creating this draft. Refresh and try again.");
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
            splitCount: splits.length,
            b2bOrderCount: b2bOrders.length,
            serviceSettlementCount: serviceSettlements.length,
            serviceReceivableOffsetCount: Array.from(drafts.values()).reduce((sum, draft) => sum + draft.receivableOffsets.filter((item) => item.offsetAmountPaise > 0).length, 0)
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
    for (const order of draft.b2bOrders) {
      totals.grossSalesPaise += order.buyerPayableAmountPaise;
      totals.commissionPaise += order.commissionAmountPaise;
      totals.netPayablePaise += order.sellerPayoutAmountPaise;
    }
    for (const settlement of draft.serviceSettlements) {
      totals.grossSalesPaise += settlement.grossAmountPaise;
      totals.commissionPaise += settlement.commissionPaise;
      totals.gstOnCommissionPaise += settlement.gstOnCommissionPaise;
      totals.tdsPaise += settlement.tdsPaise;
      totals.tcsPaise += settlement.tcsPaise;
      totals.platformFeePaise += settlement.platformFeePaise;
      totals.refundAdjustmentPaise += settlement.refundAdjustmentPaise;
      totals.netPayablePaise += settlement.netPayablePaise;
    }

    const offsetPaise = draft.receivableOffsets.reduce((sum, receivable) => sum + receivable.offsetAmountPaise, 0);
    totals.netPayablePaise = Math.max(0, totals.netPayablePaise - offsetPaise);

    return totals;
  }

  private getOrCreateDraft(drafts: Map<string, SellerDraft>, sellerId: string) {
    const existing = drafts.get(sellerId);
    if (existing) {
      return existing;
    }
    const draft: SellerDraft = {
      sellerId,
      splits: [],
      b2bOrders: [],
      serviceSettlements: [],
      receivableOffsets: [],
      holdReceivableCount: 0
    };
    drafts.set(sellerId, draft);
    return draft;
  }

  private applyReceivableOffsetsToDraft(draft: SellerDraft) {
    let availableNetPaise = 0;
    for (const { calculation } of draft.splits) {
      availableNetPaise += calculation.netPayablePaise;
    }
    for (const order of draft.b2bOrders) {
      availableNetPaise += order.sellerPayoutAmountPaise;
    }
    for (const settlement of draft.serviceSettlements) {
      availableNetPaise += settlement.netPayablePaise;
    }

    for (const receivable of draft.receivableOffsets) {
      if (availableNetPaise <= 0) {
        receivable.offsetAmountPaise = 0;
        continue;
      }
      const offsetAmountPaise = Math.min(this.receivableOutstanding(receivable), availableNetPaise);
      receivable.offsetAmountPaise = offsetAmountPaise;
      availableNetPaise -= offsetAmountPaise;
    }
  }

  private receivableOutstanding(
    receivable: Pick<
      Prisma.ServiceSellerReceivableGetPayload<Record<string, never>>,
      "amountDueToPlatformPaise" | "settledPaise" | "waivedPaise" | "reversalPaise" | "offsetPaise"
    >
  ) {
    return Math.max(
      0,
      receivable.amountDueToPlatformPaise -
        receivable.settledPaise -
        receivable.waivedPaise -
        receivable.reversalPaise -
        receivable.offsetPaise
    );
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
