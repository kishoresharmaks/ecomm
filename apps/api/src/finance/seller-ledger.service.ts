import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SellerLedgerEntryType, SellerPayoutStatus, SellerSettlementStatus } from "@indihub/database";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
} from "../common/pagination";
import { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { ManualLedgerAdjustmentDto, PayoutQueryDto } from "./dto/finance.dto";

type LedgerEntryInput = {
  sellerId: string;
  entryType: SellerLedgerEntryType;
  description: string;
  debitPaise?: number;
  creditPaise?: number;
  orderId?: string | null;
  orderSellerSplitId?: string | null;
  payoutId?: string | null;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
  createdById?: string;
};

@Injectable()
export class SellerLedgerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listLedger(query: PayoutQueryDto, sellerIdFromPath?: string) {
    const sellerId = sellerIdFromPath ?? query.sellerId;

    if (!sellerId) {
      throw new BadRequestException("sellerId is required.");
    }

    const search = query.search?.trim();
    const where: Prisma.SellerLedgerEntryWhereInput = {
      sellerId,
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: "insensitive" } },
              { referenceId: { contains: search, mode: "insensitive" } },
              { payout: { payoutNumber: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query, {
        defaultLimit: 25,
        maxLimit: 100
      });
      const cursorWhere = createdAtCursorWhere(cursor) as
        | Prisma.SellerLedgerEntryWhereInput
        | undefined;
      const [items, latest] = await this.prisma.client.$transaction(async (tx) => {
        const items = await tx.sellerLedgerEntry.findMany({
          where: cursorWhere ? { AND: [where, cursorWhere] } : where,
          include: {
            payout: { select: { id: true, payoutNumber: true, status: true } },
            orderSellerSplit: { select: { id: true, order: { select: { orderNumber: true } } } }
          },
          orderBy: createdAtCursorOrderBy(),
          take: take + 1
        });
        const latest = await tx.sellerLedgerEntry.findFirst({
          where: { sellerId },
          orderBy: createdAtCursorOrderBy(),
          select: { balanceAfterPaise: true }
        });
        return [items, latest] as const;
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take, balancePaise: latest?.balanceAfterPaise ?? 0 };
    }

    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const [items, total, latest] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.sellerLedgerEntry.findMany({
        where,
        include: {
          payout: { select: { id: true, payoutNumber: true, status: true } },
          orderSellerSplit: { select: { id: true, order: { select: { orderNumber: true } } } }
        },
        orderBy: createdAtCursorOrderBy(),
        skip,
        take
      });
      const total = await tx.sellerLedgerEntry.count({ where });
      const latest = await tx.sellerLedgerEntry.findFirst({
        where: { sellerId },
        orderBy: createdAtCursorOrderBy(),
        select: { balanceAfterPaise: true }
      });
      return [items, total, latest] as const;
    });

    return { items, total, page, limit: take, balancePaise: latest?.balanceAfterPaise ?? 0 };
  }

  async addManualAdjustment(dto: ManualLedgerAdjustmentDto, actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({ where: { id: dto.sellerId } });

    if (!seller) {
      throw new NotFoundException("Seller not found.");
    }

    const entry = await this.prisma.client.$transaction(async (tx) =>
      this.createEntry(tx, {
        sellerId: dto.sellerId,
        entryType: SellerLedgerEntryType.MANUAL_ADJUSTMENT,
        description: dto.description,
        creditPaise: dto.direction === "CREDIT" ? dto.amountPaise : 0,
        debitPaise: dto.direction === "DEBIT" ? dto.amountPaise : 0,
        referenceType: "manual_adjustment",
        referenceId: actor.id,
        createdById: actor.id,
        metadata: {
          direction: dto.direction
        }
      })
    );

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "finance.ledger.adjustment_created",
        entityType: "seller",
        entityId: dto.sellerId,
        newValue: {
          entryId: entry.id,
          direction: dto.direction,
          amountPaise: dto.amountPaise,
          description: dto.description
        }
      }
    });

    return entry;
  }

  async createEntry(tx: Prisma.TransactionClient, input: LedgerEntryInput) {
    const debitPaise = input.debitPaise ?? 0;
    const creditPaise = input.creditPaise ?? 0;

    if (debitPaise < 0 || creditPaise < 0 || (debitPaise === 0 && creditPaise === 0)) {
      throw new BadRequestException("Ledger entry must have a positive debit or credit amount.");
    }

    const latest = await tx.sellerLedgerEntry.findFirst({
      where: { sellerId: input.sellerId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfterPaise: true }
    });
    const balanceAfterPaise = (latest?.balanceAfterPaise ?? 0) + creditPaise - debitPaise;

    return tx.sellerLedgerEntry.create({
      data: {
        sellerId: input.sellerId,
        orderId: input.orderId ?? null,
        orderSellerSplitId: input.orderSellerSplitId ?? null,
        payoutId: input.payoutId ?? null,
        entryType: input.entryType,
        description: input.description,
        debitPaise,
        creditPaise,
        balanceAfterPaise,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        createdById: input.createdById ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
      }
    });
  }

  async postPayoutApprovalEntries(tx: Prisma.TransactionClient, payoutId: string, actor: RequestUser) {
    const payout = await tx.sellerPayout.findUnique({
      where: { id: payoutId },
      include: {
        orderSplits: true,
        b2bOrders: true
      }
    });

    if (!payout) {
      throw new NotFoundException("Seller payout not found.");
    }

    for (const split of payout.orderSplits) {
      await this.createEntry(tx, {
        sellerId: payout.sellerId,
        orderId: split.orderId,
        orderSellerSplitId: split.id,
        payoutId: payout.id,
        entryType: SellerLedgerEntryType.ORDER_EARNING,
        description: `Order earning for payout ${payout.payoutNumber}`,
        creditPaise: split.sellerSubtotalPaise,
        referenceType: "order_split",
        referenceId: split.id,
        createdById: actor.id
      });

      await this.createDeductionEntry(tx, payout, split, SellerLedgerEntryType.COMMISSION_DEDUCTION, split.commissionPaise, "Marketplace commission", actor);
      await this.createDeductionEntry(tx, payout, split, SellerLedgerEntryType.COUPON_DISCOUNT, split.couponSellerFundedDiscountPaise, "Seller-funded coupon discount", actor);
      await this.createDeductionEntry(tx, payout, split, SellerLedgerEntryType.GST_ON_COMMISSION, split.gstOnCommissionPaise, "GST on commission", actor);
      await this.createDeductionEntry(tx, payout, split, SellerLedgerEntryType.TDS_DEDUCTION, split.tdsPaise, "TDS deduction", actor);
      await this.createDeductionEntry(tx, payout, split, SellerLedgerEntryType.TCS_DEDUCTION, split.tcsPaise, "TCS deduction", actor);
      await this.createDeductionEntry(tx, payout, split, SellerLedgerEntryType.PLATFORM_FEE, split.platformFeePaise, "Seller settlement fee", actor);
    }

    for (const order of payout.b2bOrders) {
      const existing = await tx.sellerLedgerEntry.findFirst({
        where: {
          payoutId: payout.id,
          referenceType: "b2b_order",
          referenceId: order.id,
          entryType: SellerLedgerEntryType.B2B_ORDER_EARNING
        },
        select: { id: true }
      });
      if (existing) {
        continue;
      }

      await this.createEntry(tx, {
        sellerId: payout.sellerId,
        payoutId: payout.id,
        entryType: SellerLedgerEntryType.B2B_ORDER_EARNING,
        description: `B2B order payout for ${order.orderNumber}`,
        creditPaise: order.buyerPayableAmountPaise,
        referenceType: "b2b_order",
        referenceId: order.id,
        createdById: actor.id,
        metadata: {
          orderNumber: order.orderNumber,
          commissionRateBps: order.commissionRateBps,
          sellerPayoutAmountPaise: order.sellerPayoutAmountPaise
        }
      });

      if (order.commissionAmountPaise > 0) {
        await this.createEntry(tx, {
          sellerId: payout.sellerId,
          payoutId: payout.id,
          entryType: SellerLedgerEntryType.B2B_COMMISSION,
          description: `B2B platform commission for ${order.orderNumber}`,
          debitPaise: order.commissionAmountPaise,
          referenceType: "b2b_order",
          referenceId: order.id,
          createdById: actor.id,
          metadata: {
            orderNumber: order.orderNumber,
            commissionRateBps: order.commissionRateBps
          }
        });
      }
    }
  }

  async postPayoutPaidEntry(tx: Prisma.TransactionClient, payoutId: string, actor: RequestUser) {
    const payout = await tx.sellerPayout.findUnique({ where: { id: payoutId } });

    if (!payout) {
      throw new NotFoundException("Seller payout not found.");
    }

    return this.createEntry(tx, {
      sellerId: payout.sellerId,
      payoutId: payout.id,
      entryType: SellerLedgerEntryType.PAYOUT_PAID,
      description: `Payout paid ${payout.payoutNumber}`,
      debitPaise: Math.max(payout.netPayablePaise, 0),
      referenceType: "payout",
      referenceId: payout.payoutNumber,
      createdById: actor.id
    });
  }

  async recordRefundAdjustmentForOrder(tx: Prisma.TransactionClient, orderId: string, actor: RequestUser, note?: string) {
    const splits = await tx.orderSellerSplit.findMany({
      where: { orderId },
      include: {
        payout: true
      }
    });

    for (const split of splits) {
      if (split.payout?.status === SellerPayoutStatus.PAID && split.netPayablePaise > 0) {
        const existingAdjustment = await tx.sellerLedgerEntry.findFirst({
          where: {
            orderSellerSplitId: split.id,
            entryType: SellerLedgerEntryType.REFUND_ADJUSTMENT
          }
        });

        if (!existingAdjustment) {
          await this.createEntry(tx, {
            sellerId: split.sellerId,
            orderId: split.orderId,
            orderSellerSplitId: split.id,
            payoutId: split.payoutId,
            entryType: SellerLedgerEntryType.REFUND_ADJUSTMENT,
            description: note ?? "Refund adjustment after payout",
            debitPaise: split.netPayablePaise,
            referenceType: "refund",
            referenceId: split.orderId,
            createdById: actor.id
          });
        }

        await tx.orderSellerSplit.update({
          where: { id: split.id },
          data: {
            refundAdjustmentPaise: -Math.abs(split.netPayablePaise),
            settlementStatus: SellerSettlementStatus.ADJUSTED
          }
        });
      } else if (split.settlementStatus !== SellerSettlementStatus.PAID) {
        await tx.orderSellerSplit.update({
          where: { id: split.id },
          data: {
            payoutId: null,
            settlementStatus: SellerSettlementStatus.CANCELLED
          }
        });
      }
    }
  }

  private async createDeductionEntry(
    tx: Prisma.TransactionClient,
    payout: { id: string; sellerId: string; payoutNumber: string },
    split: { id: string; orderId: string },
    entryType: SellerLedgerEntryType,
    amountPaise: number,
    label: string,
    actor: RequestUser
  ) {
    if (amountPaise <= 0) {
      return;
    }

    await this.createEntry(tx, {
      sellerId: payout.sellerId,
      orderId: split.orderId,
      orderSellerSplitId: split.id,
      payoutId: payout.id,
      entryType,
      description: `${label} for payout ${payout.payoutNumber}`,
      debitPaise: amountPaise,
      referenceType: "order_split",
      referenceId: split.id,
      createdById: actor.id
    });
  }
}
