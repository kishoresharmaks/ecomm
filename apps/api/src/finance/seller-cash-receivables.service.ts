import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CodCollectionSource,
  CodCollectionStatus,
  DeliveryMode,
  DeliveryStatus,
  PaymentProvider,
  Prisma,
  SellerCashReceivableSource,
  SellerCashReceivableStatus,
  SellerLedgerEntryType,
} from "@indihub/database";
import { createdAtCursorOrderBy, paginationFromQuery } from "../common/pagination";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { SellerCashReceivableActionDto, SellerCashReceivableQueryDto } from "./dto/finance.dto";
import { FinanceCalculatorService } from "./finance-calculator.service";
import { SellerLedgerService } from "./seller-ledger.service";

type ReceivableOpenInput = {
  orderId: string;
  orderSellerSplitId: string;
  orderShipmentId: string | null;
  paymentId: string | null;
  source: SellerCashReceivableSource;
  grossCashCollectedPaise: number;
  note?: string | null;
  actor: RequestUser;
};

@Injectable()
export class SellerCashReceivablesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceCalculatorService) private readonly calculator: FinanceCalculatorService,
    @Inject(SellerLedgerService) private readonly ledger: SellerLedgerService,
  ) {}

  async listReceivables(query: SellerCashReceivableQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.SellerCashReceivableWhereInput = {
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(search
        ? {
            OR: [
              { receivableNumber: { contains: search, mode: "insensitive" } },
              { order: { orderNumber: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.sellerCashReceivable.findMany({
        where,
        include: this.receivableListInclude(),
        orderBy: createdAtCursorOrderBy(),
        skip,
        take,
      });
      const total = await tx.sellerCashReceivable.count({ where });
      return [items, total] as const;
    });
    return { items, total, page, limit: take };
  }

  async getReceivable(receivableNumber: string) {
    const receivable = await this.prisma.client.sellerCashReceivable.findUnique({
      where: { receivableNumber },
      include: {
        ...this.receivableListInclude(),
        events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, email: true, fullName: true } } } },
        ledgerEntries: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!receivable) {
      throw new NotFoundException("Seller cash receivable not found.");
    }
    return receivable;
  }

  async settleReceivable(receivableNumber: string, dto: SellerCashReceivableActionDto, actor: RequestUser) {
    if (dto.amountPaise !== undefined && dto.amountPaise <= 0) {
      throw new BadRequestException("Settlement amount must be greater than zero.");
    }
    const id = await this.prisma.client.$transaction(async (tx) => {
      const receivable = await tx.sellerCashReceivable.findUnique({ where: { receivableNumber } });
      if (!receivable) {
        throw new NotFoundException("Seller cash receivable not found.");
      }
      this.assertOpenForFinanceAction(receivable);
      const amountPaise = dto.amountPaise ?? receivable.outstandingPaise;
      if (amountPaise > receivable.outstandingPaise) {
        throw new BadRequestException("Settlement amount cannot exceed the outstanding platform due.");
      }
      const nextOutstanding = Math.max(0, receivable.outstandingPaise - amountPaise);
      const nextStatus = nextOutstanding === 0 ? SellerCashReceivableStatus.SETTLED : SellerCashReceivableStatus.PARTIALLY_OFFSET;
      await tx.sellerCashReceivable.update({
        where: { id: receivable.id },
        data: {
          settledPaise: { increment: amountPaise },
          outstandingPaise: nextOutstanding,
          status: nextStatus,
          settledAt: new Date(),
          settledById: actor.id,
          note: dto.note?.trim() || receivable.note,
        },
      });
      await this.createEvent(tx, receivable, "seller_cash_receivable.settled", nextStatus, -amountPaise, nextOutstanding, actor, dto.note);
      await this.ledger.createEntry(tx, {
        sellerId: receivable.sellerId,
        orderId: receivable.orderId,
        orderSellerSplitId: receivable.orderSellerSplitId,
        sellerCashReceivableId: receivable.id,
        entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_SETTLED,
        description: `Seller cash receivable settled ${receivable.receivableNumber}`,
        debitPaise: amountPaise,
        currency: receivable.currency,
        referenceType: "seller_cash_receivable",
        referenceId: receivable.id,
        createdById: actor.id,
        metadata: { receivableNumber, note: dto.note ?? null },
      });
      await this.audit(tx, actor, "finance.seller_cash_receivable.settled", receivable.id, receivable, { amountPaise, note: dto.note ?? null });
      return receivable.id;
    });
    return this.getReceivableById(id);
  }

  async waiveReceivable(receivableNumber: string, dto: SellerCashReceivableActionDto, actor: RequestUser) {
    const note = dto.note?.trim();
    if (!note) {
      throw new BadRequestException("Waiver note is required.");
    }
    if (dto.amountPaise !== undefined && dto.amountPaise <= 0) {
      throw new BadRequestException("Waiver amount must be greater than zero.");
    }
    const id = await this.prisma.client.$transaction(async (tx) => {
      const receivable = await tx.sellerCashReceivable.findUnique({ where: { receivableNumber } });
      if (!receivable) {
        throw new NotFoundException("Seller cash receivable not found.");
      }
      this.assertOpenForFinanceAction(receivable);
      const amountPaise = dto.amountPaise ?? receivable.outstandingPaise;
      if (amountPaise > receivable.outstandingPaise) {
        throw new BadRequestException("Waiver amount cannot exceed the outstanding platform due.");
      }
      const nextOutstanding = Math.max(0, receivable.outstandingPaise - amountPaise);
      const nextStatus = nextOutstanding === 0 ? SellerCashReceivableStatus.WAIVED : SellerCashReceivableStatus.PARTIALLY_OFFSET;
      await tx.sellerCashReceivable.update({
        where: { id: receivable.id },
        data: {
          waivedPaise: { increment: amountPaise },
          outstandingPaise: nextOutstanding,
          status: nextStatus,
          waivedAt: new Date(),
          waivedById: actor.id,
          note,
        },
      });
      await this.createEvent(tx, receivable, "seller_cash_receivable.waived", nextStatus, -amountPaise, nextOutstanding, actor, note);
      await this.ledger.createEntry(tx, {
        sellerId: receivable.sellerId,
        orderId: receivable.orderId,
        orderSellerSplitId: receivable.orderSellerSplitId,
        sellerCashReceivableId: receivable.id,
        entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_WAIVED,
        description: `Seller cash receivable waived ${receivable.receivableNumber}`,
        creditPaise: amountPaise,
        currency: receivable.currency,
        referenceType: "seller_cash_receivable",
        referenceId: receivable.id,
        createdById: actor.id,
        metadata: { receivableNumber, note },
      });
      await this.audit(tx, actor, "finance.seller_cash_receivable.waived", receivable.id, receivable, { amountPaise, note });
      return receivable.id;
    });
    return this.getReceivableById(id);
  }

  async openForSellerCollectedCod(tx: Prisma.TransactionClient, input: ReceivableOpenInput) {
    const existing = await tx.sellerCashReceivable.findUnique({
      where: {
        orderSellerSplitId_source: {
          orderSellerSplitId: input.orderSellerSplitId,
          source: input.source,
        },
      },
    });
    if (existing) {
      return existing;
    }

    const split = await tx.orderSellerSplit.findUnique({
      where: { id: input.orderSellerSplitId },
      include: {
        order: {
          include: {
            items: { include: { product: true } },
            sellerSplits: true,
          },
        },
        shipment: true,
      },
    });
    if (!split) {
      throw new NotFoundException("Seller split not found.");
    }
    if (split.orderId !== input.orderId) {
      throw new BadRequestException("Seller split does not belong to this order.");
    }

    const calculation = await this.calculator.calculateSplit(split, tx);
    const buyerPlatformFeePaise = this.allocatedBuyerPlatformFeePaise(split.order, split);
    const platformDuePaise = Math.max(0, calculation.grossSalesPaise - calculation.netPayablePaise) + buyerPlatformFeePaise;
    const expectedCashPaise = this.expectedSellerCashPaise(
      split.order,
      split,
      input.orderShipmentId ? split.shipment : null,
      buyerPlatformFeePaise,
    );
    if (input.grossCashCollectedPaise !== expectedCashPaise) {
      throw new BadRequestException(
        `Collected COD amount (${input.grossCashCollectedPaise / 100}) must exactly match this seller package amount (${expectedCashPaise / 100}).`,
      );
    }

    const receivable = await tx.sellerCashReceivable.create({
      data: {
        receivableNumber: this.makeReceivableNumber(),
        sellerId: split.sellerId,
        orderId: split.orderId,
        orderSellerSplitId: split.id,
        orderShipmentId: input.orderShipmentId,
        paymentId: input.paymentId,
        source: input.source,
        grossCashCollectedPaise: input.grossCashCollectedPaise,
        platformDuePaise,
        outstandingPaise: platformDuePaise,
        commissionPaise: calculation.commissionPaise,
        gstOnCommissionPaise: calculation.gstOnCommissionPaise,
        tdsPaise: calculation.tdsPaise,
        tcsPaise: calculation.tcsPaise,
        sellerPlatformFeePaise: calculation.platformFeePaise,
        buyerPlatformFeePaise,
        currency: split.order.currency,
        idempotencyKey: `${input.source}:${split.id}`,
        note: input.note ?? null,
        financeSnapshot: {
          ...calculation.snapshot,
          sellerCollectedCod: true,
          source: input.source,
          expectedCashPaise,
          buyerPlatformFeePaise,
        },
      },
    });

    if (input.orderShipmentId) {
      await tx.orderShipment.update({
        where: { id: input.orderShipmentId },
        data: {
          codCollectionSource: CodCollectionSource.SELLER,
          codCollectionStatus: CodCollectionStatus.COLLECTED,
          codCollectedAmountPaise: input.grossCashCollectedPaise,
          codCollectedAt: new Date(),
          codCollectedById: input.actor.id,
          codCollectionNote: input.note ?? "Seller collected COD cash; platform due opened in seller wallet.",
          codVerifiedAt: null,
          codVerifiedById: null,
          codVerificationNote: null,
        },
      });
    }

    if (platformDuePaise > 0) {
      await this.ledger.createEntry(tx, {
        sellerId: split.sellerId,
        orderId: split.orderId,
        orderSellerSplitId: split.id,
        sellerCashReceivableId: receivable.id,
        entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OPENED,
        description: `Seller-collected COD platform due opened ${receivable.receivableNumber}`,
        debitPaise: platformDuePaise,
        currency: split.order.currency,
        referenceType: "seller_cash_receivable",
        referenceId: receivable.id,
        createdById: input.actor.id,
        metadata: {
          receivableNumber: receivable.receivableNumber,
          source: input.source,
          grossCashCollectedPaise: input.grossCashCollectedPaise,
          buyerPlatformFeePaise,
        },
      });
    }

    await tx.sellerCashReceivableEvent.create({
      data: {
        receivableId: receivable.id,
        eventType: "seller_cash_receivable.opened",
        newStatus: SellerCashReceivableStatus.OPEN,
        amountDeltaPaise: platformDuePaise,
        oldOutstandingPaise: 0,
        newOutstandingPaise: platformDuePaise,
        note: input.note ?? "Seller-collected COD platform due opened.",
        actorUserId: input.actor.id,
        metadata: { source: input.source, grossCashCollectedPaise: input.grossCashCollectedPaise },
      },
    });

    await this.audit(tx, input.actor, "finance.seller_cash_receivable.opened", receivable.id, null, {
      receivableNumber: receivable.receivableNumber,
      orderId: split.orderId,
      orderSellerSplitId: split.id,
      sellerId: split.sellerId,
      platformDuePaise,
      grossCashCollectedPaise: input.grossCashCollectedPaise,
      source: input.source,
    });

    return receivable;
  }

  async sellerCollectedCodAccounted(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        shipments: {
          where: { status: { not: DeliveryStatus.CANCELLED } },
          include: { sellerCashReceivable: true },
        },
        deliveryDetail: true,
      },
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    const codPayment = order.payments.find((payment) => payment.provider === PaymentProvider.COD || payment.method === "COD");
    if (!codPayment) {
      return { accounted: false, codPayment: null };
    }
    for (const shipment of order.shipments) {
      if (shipment.deliveryMode === DeliveryMode.STORE_PICKUP || shipment.deliveryMode === DeliveryMode.MANUAL_TRANSPORT) {
        if (!shipment.sellerCashReceivable || shipment.sellerCashReceivable.status === SellerCashReceivableStatus.CANCELLED) {
          return { accounted: false, codPayment };
        }
        continue;
      }
      if (shipment.deliveryMode === DeliveryMode.LOCAL_DELIVERY_PARTNER) {
        if (order.deliveryDetail?.codCollectionStatus !== CodCollectionStatus.VERIFIED) {
          return { accounted: false, codPayment };
        }
        continue;
      }
      if (shipment.deliveryMode === DeliveryMode.THIRD_PARTY_COURIER) {
        if (shipment.codCollectionStatus !== CodCollectionStatus.VERIFIED) {
          return { accounted: false, codPayment };
        }
      }
    }
    return { accounted: true, codPayment };
  }

  expectedSellerCashPaise(
    order: {
      subtotalPaise: number;
      platformFeePaise: number;
      sellerSplits?: Array<{ id?: string | null; sellerSubtotalPaise: number }>;
    },
    split: { id?: string | null; sellerSubtotalPaise: number },
    shipment: { shippingPaise: number; codSurchargePaise: number } | null,
    buyerPlatformFeePaise = this.allocatedBuyerPlatformFeePaise(order, split),
  ) {
    return split.sellerSubtotalPaise + (shipment?.shippingPaise ?? 0) + (shipment?.codSurchargePaise ?? 0) + buyerPlatformFeePaise;
  }

  receivableOutstanding(receivable: Pick<SellerCashReceivableProjection, "outstandingPaise" | "platformDuePaise" | "offsetPaise" | "settledPaise" | "waivedPaise">) {
    return Math.max(0, receivable.outstandingPaise ?? receivable.platformDuePaise - receivable.offsetPaise - receivable.settledPaise - receivable.waivedPaise);
  }

  private allocatedBuyerPlatformFeePaise(
    order: {
      subtotalPaise: number;
      platformFeePaise: number;
      sellerSplits?: Array<{ id?: string | null; sellerSubtotalPaise: number }>;
    },
    split: { id?: string | null; sellerSubtotalPaise: number },
  ) {
    if (order.platformFeePaise <= 0 || order.subtotalPaise <= 0 || split.sellerSubtotalPaise <= 0) {
      return 0;
    }
    const sellerSplits = order.sellerSplits?.filter((sellerSplit) => sellerSplit.sellerSubtotalPaise > 0) ?? [];
    const targetIndex = sellerSplits.findIndex((sellerSplit) =>
      split.id ? sellerSplit.id === split.id : sellerSplit.sellerSubtotalPaise === split.sellerSubtotalPaise,
    );

    if (sellerSplits.length <= 1 || targetIndex < 0) {
      return Math.round((order.platformFeePaise * split.sellerSubtotalPaise) / order.subtotalPaise);
    }

    const allocations = sellerSplits.map((sellerSplit, index) => {
      const numerator = order.platformFeePaise * sellerSplit.sellerSubtotalPaise;
      return {
        index,
        base: Math.floor(numerator / order.subtotalPaise),
        remainder: numerator % order.subtotalPaise,
      };
    });
    let remainderPaise = order.platformFeePaise - allocations.reduce((sum, allocation) => sum + allocation.base, 0);
    const ranked = [...allocations].sort((left, right) => {
      if (right.remainder !== left.remainder) {
        return right.remainder - left.remainder;
      }
      return left.index - right.index;
    });
    const extraIndexes = new Set<number>();
    for (const allocation of ranked) {
      if (remainderPaise <= 0) {
        break;
      }
      extraIndexes.add(allocation.index);
      remainderPaise -= 1;
    }
    const targetAllocation = allocations[targetIndex];
    if (!targetAllocation) {
      return Math.round((order.platformFeePaise * split.sellerSubtotalPaise) / order.subtotalPaise);
    }
    return targetAllocation.base + (extraIndexes.has(targetIndex) ? 1 : 0);
  }

  private async getReceivableById(id: string) {
    const receivable = await this.prisma.client.sellerCashReceivable.findUnique({
      where: { id },
      include: {
        ...this.receivableListInclude(),
        events: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!receivable) {
      throw new NotFoundException("Seller cash receivable not found.");
    }
    return receivable;
  }

  private assertOpenForFinanceAction(receivable: Pick<SellerCashReceivableProjection, "status" | "payoutOffsetId">) {
    if (receivable.payoutOffsetId) {
      throw new ConflictException("Seller cash receivable is already linked to a payout.");
    }
    const openStatuses: SellerCashReceivableStatus[] = [
      SellerCashReceivableStatus.OPEN,
      SellerCashReceivableStatus.PARTIALLY_OFFSET,
    ];
    if (!openStatuses.includes(receivable.status)) {
      throw new ConflictException(
        receivable.status === SellerCashReceivableStatus.OFFSET_SCHEDULED
          ? "Seller cash receivable is already scheduled against a payout."
          : "Seller cash receivable is already closed.",
      );
    }
  }

  private async createEvent(
    tx: Prisma.TransactionClient,
    receivable: SellerCashReceivableProjection,
    eventType: string,
    newStatus: SellerCashReceivableStatus,
    amountDeltaPaise: number,
    newOutstandingPaise: number,
    actor: RequestUser,
    note?: string | null,
  ) {
    await tx.sellerCashReceivableEvent.create({
      data: {
        receivableId: receivable.id,
        eventType,
        oldStatus: receivable.status,
        newStatus,
        amountDeltaPaise,
        oldOutstandingPaise: receivable.outstandingPaise,
        newOutstandingPaise,
        note: note ?? null,
        actorUserId: actor.id,
      },
    });
  }

  private receivableListInclude() {
    return {
      seller: { select: { id: true, storeName: true, slug: true } },
      order: { select: { id: true, orderNumber: true, orderStatus: true, paymentStatus: true, deliveryStatus: true } },
      orderSellerSplit: { select: { id: true, sellerStatus: true, settlementStatus: true } },
      orderShipment: { select: { id: true, shipmentNumber: true, deliveryMode: true, status: true, codCollectionStatus: true } },
      payment: { select: { id: true, provider: true, method: true, amountPaise: true, status: true } },
      payoutOffset: { select: { id: true, payoutNumber: true, status: true } },
    } satisfies Prisma.SellerCashReceivableInclude;
  }

  private makeReceivableNumber() {
    return `SCR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private async audit(tx: Prisma.TransactionClient, actor: RequestUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action,
        entityType: "seller_cash_receivable",
        entityId,
        ...(oldValue ? { oldValue: oldValue as Prisma.InputJsonValue } : {}),
        newValue: newValue as Prisma.InputJsonValue,
      },
    });
  }
}

type SellerCashReceivableProjection = Prisma.SellerCashReceivableGetPayload<Record<string, never>>;
