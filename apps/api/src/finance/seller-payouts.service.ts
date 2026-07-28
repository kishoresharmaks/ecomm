import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ApprovalStatus,
  B2BOrderStatus,
  B2BPaymentStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ServiceReceivableOffsetPolicy,
  ServiceSellerReceivableStatus,
  SellerCashReceivableStatus,
  SellerLedgerEntryType,
  SellerOrderStatus,
  SellerPayoutStatus,
  SellerSettlementStatus,
  SellerStatus,
} from "@indihub/database";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
} from "../common/pagination";
import { RequestUser } from "../auth/types/indihub-request";
import { sellerPayoutValue } from "../common/seller-payout-secret";
import { MarketService, type MarketCurrencySnapshot } from "../market/market.service";
import { PrismaService } from "../prisma/prisma.service";
import { readBooleanSetting, readNumberSetting } from "../settings/setting-value-utils";
import { MarkPayoutPaidDto, PayoutActionDto, PayoutQueryDto, SellerPayoutProfileVerificationDto, SellerPayoutRequestDto } from "./dto/finance.dto";
import { FinanceCalculatorService, SplitFinanceCalculation } from "./finance-calculator.service";
import { SellerLedgerService } from "./seller-ledger.service";

const payoutSettingKeys = {
  requestsEnabled: "seller.payout.requests_enabled",
  minimumPaise: "seller.payout.minimum_paise"
} as const;
const defaultMinimumPayoutPaise = 10_000;
const payoutMoneyFields = [
  "grossSalesPaise",
  "commissionPaise",
  "gstOnCommissionPaise",
  "tdsPaise",
  "tcsPaise",
  "platformFeePaise",
  "refundAdjustmentPaise",
  "adjustmentPaise",
  "netPayablePaise",
] as const;
const payoutOrderSplitMoneyFields = [
  "sellerSubtotalPaise",
  "commissionPaise",
  "gstOnCommissionPaise",
  "tdsPaise",
  "tcsPaise",
  "platformFeePaise",
  "couponSellerFundedDiscountPaise",
  "couponAdjustmentPaise",
  "refundAdjustmentPaise",
  "netPayablePaise",
] as const;
const payoutB2BOrderMoneyFields = [
  "subtotalPaise",
  "buyerPayableAmountPaise",
  "paidAmountPaise",
  "commissionAmountPaise",
  "sellerPayoutAmountPaise",
  "transportChargePaise",
] as const;
const serviceSettlementMoneyFields = [
  "grossAmountPaise",
  "commissionPaise",
  "gstOnCommissionPaise",
  "tdsPaise",
  "tcsPaise",
  "platformFeePaise",
  "refundAdjustmentPaise",
  "netPayablePaise",
] as const;
const receivableOffsetMoneyFields = [
  "grossCashCollectedPaise",
  "commissionPaise",
  "gstOnCommissionPaise",
  "tdsPaise",
  "tcsPaise",
  "platformFeePaise",
  "amountDueToPlatformPaise",
  "settledPaise",
  "waivedPaise",
  "reversalPaise",
  "offsetPaise",
  "outstandingPaise",
] as const;
const ledgerEntryMoneyFields = ["debitPaise", "creditPaise", "balanceAfterPaise"] as const;

type PayoutRequestSplit = Prisma.OrderSellerSplitGetPayload<{
  include: {
    order: {
      include: {
        items: {
          include: {
            product: { select: { categoryId: true } };
          };
        };
      };
    };
  };
}>;

type PayoutRequestCalculation = {
  split: PayoutRequestSplit;
  calculation: SplitFinanceCalculation;
};

type B2BPayoutOrder = Prisma.B2BOrderGetPayload<Record<string, never>>;
type ServicePayoutReceivable = Prisma.ServiceSellerReceivableGetPayload<Record<string, never>>;
type SellerCashPayoutReceivable = Prisma.SellerCashReceivableGetPayload<Record<string, never>>;

@Injectable()
export class SellerPayoutsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceCalculatorService) private readonly calculator: FinanceCalculatorService,
    @Inject(SellerLedgerService) private readonly ledger: SellerLedgerService,
    @Inject(MarketService) private readonly marketService: MarketService
  ) {}

  async listPayouts(query: PayoutQueryDto, sellerIdFromAuth?: string) {
    const sellerId = sellerIdFromAuth ?? query.sellerId;
    const search = query.search?.trim();
    const where: Prisma.SellerPayoutWhereInput = {
      ...(sellerId ? { sellerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { payoutNumber: { contains: search, mode: "insensitive" } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
              { transactionReference: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query, {
        defaultLimit: 20,
        maxLimit: 100
      });
      const cursorWhere = createdAtCursorWhere(cursor) as Prisma.SellerPayoutWhereInput | undefined;
      const items = await this.prisma.client.sellerPayout.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: this.payoutListInclude(),
        orderBy: createdAtCursorOrderBy(),
        take: take + 1
      });
      const pageResult = cursorPageFromItems(items, take);
      const readableItems = pageResult.items.map((item) => this.payoutListReadback(item));

      if (sellerIdFromAuth) {
        const market = await this.marketForSellerId(sellerIdFromAuth);
        return { ...pageResult, items: readableItems.map((item) => this.convertPayoutForSeller(item, market)), limit: take };
      }

      return { ...pageResult, items: readableItems, limit: take };
    }

    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.sellerPayout.findMany({
        where,
        include: this.payoutListInclude(),
        orderBy: createdAtCursorOrderBy(),
        skip,
        take
      });
      const total = await tx.sellerPayout.count({ where });
      return [items, total] as const;
    });

    const readableItems = items.map((item) => this.payoutListReadback(item));
    if (sellerIdFromAuth) {
      const market = await this.marketForSellerId(sellerIdFromAuth);
      return { items: readableItems.map((item) => this.convertPayoutForSeller(item, market)), total, page, limit: take };
    }

    return { items: readableItems, total, page, limit: take };
  }

  private payoutListInclude() {
    return {
      seller: {
        select: {
          id: true,
          storeName: true,
          slug: true,
          payoutProfile: {
            select: {
              accountHolderName: true,
              bankName: true,
              accountNumberLast4: true,
              upiIdHint: true,
              isVerified: true
            }
          }
        }
      },
      settlementRun: { select: { id: true, runNumber: true, status: true } },
      _count: { select: { orderSplits: true, b2bOrders: true, serviceSettlements: true, serviceReceivableOffsets: true, sellerCashReceivableOffsets: true, ledgerEntries: true, statements: true } }
    } satisfies Prisma.SellerPayoutInclude;
  }

  async sellerPayoutAvailability(sellerId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const availability = await this.calculateSellerPayoutAvailability(tx, sellerId);
      return this.publicAvailability(availability);
    });
  }

  async requestSellerPayout(sellerId: string, dto: SellerPayoutRequestDto, actor: RequestUser) {
    const payoutId = await this.prisma.client.$transaction(async (tx) => {
      const availability = await this.calculateSellerPayoutAvailability(tx, sellerId);
      const blockers = this.requestBlockers(availability);

      if (blockers.length) {
        throw new BadRequestException(`Payout request cannot be created: ${blockers.join(" ")}`);
      }

      const payout = await tx.sellerPayout.create({
        data: {
          payoutNumber: this.makePayoutNumber(),
          sellerId,
          periodFrom: availability.periodFrom ?? new Date(),
          periodTo: availability.periodTo ?? new Date(),
          status: SellerPayoutStatus.PENDING_APPROVAL,
          grossSalesPaise: availability.grossSalesPaise,
          commissionPaise: availability.commissionPaise,
          gstOnCommissionPaise: availability.gstOnCommissionPaise,
          tdsPaise: availability.tdsPaise,
          tcsPaise: availability.tcsPaise,
          platformFeePaise: availability.platformFeePaise,
          refundAdjustmentPaise: availability.refundAdjustmentPaise,
          adjustmentPaise: availability.manualAdjustmentPaise - availability.serviceReceivableOffsetPaise - availability.sellerCashReceivableOffsetPaise - availability.ledgerDebtOffsetPaise,
          netPayablePaise: availability.netPayablePaise,
          currency: availability.currency,
          note: dto.note?.trim() || "Requested by seller for manual payout."
        }
      });

      for (const { split, calculation } of availability.calculations) {
        const updated = await tx.orderSellerSplit.updateMany({
          where: {
            id: split.id,
            sellerId,
            payoutId: null,
            sellerStatus: { not: SellerOrderStatus.CANCELLED },
            settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
            order: {
              orderStatus: OrderStatus.DELIVERED,
              paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.NOT_REQUIRED] }
            },
            sellerCashReceivables: {
              none: {
                status: { not: SellerCashReceivableStatus.CANCELLED },
              },
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

        if (updated.count !== 1) {
          throw new ConflictException("Eligible payout amount changed while creating this request. Refresh and try again.");
        }
      }

      for (const order of availability.b2bOrders) {
        const updated = await tx.b2BOrder.updateMany({
          where: {
            id: order.id,
            sellerId,
            payoutId: null,
            status: { in: [B2BOrderStatus.DELIVERY_ACCEPTED, B2BOrderStatus.CLOSED] },
            paymentStatus: B2BPaymentStatus.PAID,
            settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
          },
          data: {
            payoutId: payout.id,
            settlementStatus: SellerSettlementStatus.DRAFTED,
            settlementEligibleAt: order.settlementEligibleAt ?? new Date(),
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException("Eligible B2B payout amount changed while creating this request. Refresh and try again.");
        }
      }

      for (const settlement of availability.serviceSettlements) {
        const updated = await tx.serviceBookingSettlement.updateMany({
          where: {
            id: settlement.id,
            sellerId,
            payoutId: null,
            netPayablePaise: { gt: 0 },
            status: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
            booking: {
              status: { in: ["COMPLETED", "CLOSED_AFTER_INSPECTION"] },
            },
          },
          data: {
            payoutId: payout.id,
            status: SellerSettlementStatus.DRAFTED,
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException("Eligible service payout amount changed while creating this request. Refresh and try again.");
        }
      }

      for (const offset of availability.receivableOffsets) {
        const updated = await tx.serviceSellerReceivable.updateMany({
          where: {
            id: offset.id,
            sellerId,
            payoutOffsetId: null,
            offsetPolicy: ServiceReceivableOffsetPolicy.AUTO_OFFSET_NEXT_PAYOUT,
            status: { in: [ServiceSellerReceivableStatus.OPEN, ServiceSellerReceivableStatus.PARTIALLY_SETTLED] },
          },
          data: {
            payoutOffsetId: payout.id,
            offsetPaise: offset.offsetAmountPaise,
            offsetScheduledAt: new Date(),
            offsetAppliedAt: null,
            status: ServiceSellerReceivableStatus.OFFSET_SCHEDULED,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException("Service receivable offset changed while creating this request. Refresh and try again.");
        }
      }

      for (const offset of availability.sellerCashReceivableOffsets) {
        const updated = await tx.sellerCashReceivable.updateMany({
          where: {
            id: offset.id,
            sellerId,
            payoutOffsetId: null,
            status: { in: [SellerCashReceivableStatus.OPEN, SellerCashReceivableStatus.PARTIALLY_OFFSET] },
          },
          data: {
            payoutOffsetId: payout.id,
            offsetPaise: offset.offsetAmountPaise,
            offsetScheduledAt: new Date(),
            offsetAppliedAt: null,
            status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException("Seller cash receivable offset changed while creating this request. Refresh and try again.");
        }
      }

      for (const entry of availability.manualAdjustments) {
        const updated = await tx.sellerLedgerEntry.updateMany({
          where: {
            id: entry.id,
            sellerId,
            payoutId: null,
            entryType: SellerLedgerEntryType.MANUAL_ADJUSTMENT,
          },
          data: {
            payoutId: payout.id,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException("Manual adjustment changed while creating this request. Refresh and try again.");
        }
      }

      await this.createEvent(tx, payout.id, "payout.requested_by_seller", SellerPayoutStatus.DRAFT, SellerPayoutStatus.PENDING_APPROVAL, actor, dto.note);
      await this.audit(
        tx,
        actor,
        "finance.payout.requested_by_seller",
        payout.id,
        null,
        {
          sellerId,
          payoutNumber: payout.payoutNumber,
          eligibleSplitCount: availability.eligibleSplitCount,
          eligibleB2BOrderCount: availability.eligibleB2BOrderCount,
          eligibleServiceSettlementCount: availability.eligibleServiceSettlementCount,
          serviceReceivableOffsetPaise: availability.serviceReceivableOffsetPaise,
          sellerCashReceivableOffsetPaise: availability.sellerCashReceivableOffsetPaise,
          ledgerDebtOffsetPaise: availability.ledgerDebtOffsetPaise,
          manualAdjustmentPaise: availability.manualAdjustmentPaise,
          netPayablePaise: availability.netPayablePaise,
          note: dto.note
        }
      );

      return payout.id;
    });

    return this.getPayout(payoutId, sellerId);
  }

  async getPayout(payoutId: string, sellerIdFromAuth?: string) {
    const payout = await this.prisma.client.sellerPayout.findFirst({
      where: {
        id: payoutId,
        ...(sellerIdFromAuth ? { sellerId: sellerIdFromAuth } : {})
      },
      include: {
        seller: { include: { profile: true, payoutProfile: true } },
        settlementRun: true,
        orderSplits: {
          include: {
            order: true
          },
          orderBy: { createdAt: "asc" }
        },
        b2bOrders: {
          orderBy: { createdAt: "asc" }
        },
        serviceSettlements: {
          include: { booking: true },
          orderBy: { createdAt: "asc" }
        },
        serviceReceivableOffsets: {
          include: { booking: true },
          orderBy: { createdAt: "asc" }
        },
        sellerCashReceivableOffsets: {
          include: {
            order: { select: { orderNumber: true } },
            orderShipment: { select: { shipmentNumber: true, deliveryMode: true } },
          },
          orderBy: { createdAt: "asc" }
        },
        ledgerEntries: {
          where: { entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OFFSET },
          include: {
            sellerCashReceivable: {
              include: {
                order: { select: { orderNumber: true } },
                orderShipment: { select: { shipmentNumber: true, deliveryMode: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        events: { orderBy: { createdAt: "asc" } },
        statements: { orderBy: { generatedAt: "desc" } }
      }
    });

    if (!payout) {
      throw new NotFoundException("Seller payout not found.");
    }

    const readablePayout = this.payoutReadback(payout);
    if (sellerIdFromAuth) {
      const market = await this.marketForSellerId(sellerIdFromAuth);
      return this.convertPayoutForSeller(readablePayout, market);
    }

    return readablePayout;
  }

  async updateSellerPayoutProfileVerification(sellerId: string, dto: SellerPayoutProfileVerificationDto, actor: RequestUser) {
    const profile = await this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.findFirst({
        where: { id: sellerId, deletedAt: null },
        include: { payoutProfile: true, profile: true }
      });

      if (!seller) {
        throw new NotFoundException("Seller not found.");
      }
      if (!seller.payoutProfile) {
        throw new BadRequestException("Seller payout profile is not configured.");
      }
      if (dto.verified && !this.hasPayoutMethod(seller.payoutProfile, seller.profile)) {
        throw new BadRequestException("Seller payout profile is incomplete.");
      }

      const updatedProfile = await tx.sellerPayoutProfile.update({
        where: { sellerId },
        data: { isVerified: dto.verified },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: dto.verified ? "seller.payout_profile.verified" : "seller.payout_profile.unverified",
          entityType: "seller_payout_profile",
          entityId: sellerId,
          oldValue: {
            sellerId,
            isVerified: seller.payoutProfile.isVerified,
          },
          newValue: {
            sellerId,
            isVerified: updatedProfile.isVerified,
            note: dto.note,
          } as Prisma.InputJsonValue,
        },
      });

      return updatedProfile;
    });

    return {
      accountHolderName: profile.accountHolderName,
      bankName: profile.bankName,
      accountNumber: sellerPayoutValue(
        profile.accountNumberEncrypted,
        profile.legacyAccountNumber,
      ),
      ifscCode: sellerPayoutValue(profile.ifscCodeEncrypted, profile.legacyIfscCode),
      upiId: sellerPayoutValue(profile.upiIdEncrypted, profile.legacyUpiId),
      isVerified: profile.isVerified,
    };
  }

  async approvePayout(payoutId: string, dto: PayoutActionDto, actor: RequestUser) {
    await this.prisma.client.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.findUnique({
        where: { id: payoutId },
        include: { seller: { include: { payoutProfile: true } } }
      });

      if (!payout) {
        throw new NotFoundException("Seller payout not found.");
      }

      if (payout.status !== SellerPayoutStatus.PENDING_APPROVAL) {
        throw new BadRequestException("Only payouts pending approval can be approved.");
      }
      if (!payout.seller.payoutProfile?.isVerified) {
        throw new BadRequestException("Seller payout details must be verified before payout approval.");
      }

      const splitSummary = await this.payoutSplitSummary(tx, payoutId, payout.adjustmentPaise);
      if (splitSummary.count < 1) {
        throw new BadRequestException("Payout has no linked order, B2B, or service sources.");
      }
      if (splitSummary.netPayablePaise !== payout.netPayablePaise) {
        throw new ConflictException("Payout source totals changed. Refresh and try again.");
      }

      const payoutUpdate = await tx.sellerPayout.updateMany({
        where: { id: payoutId, status: SellerPayoutStatus.PENDING_APPROVAL },
        data: {
          status: SellerPayoutStatus.APPROVED,
          approvedById: actor.id,
          approvedAt: new Date(),
          note: dto.note ?? payout.note
        }
      });
      if (payoutUpdate.count !== 1) {
        throw new ConflictException("Payout status changed. Refresh and try again.");
      }

      const splitUpdate = await tx.orderSellerSplit.updateMany({
        where: {
          payoutId,
          sellerStatus: { not: SellerOrderStatus.CANCELLED },
          settlementStatus: SellerSettlementStatus.DRAFTED
        },
        data: {
          settlementStatus: SellerSettlementStatus.APPROVED,
          settledAt: new Date()
        }
      });
      if (splitUpdate.count !== splitSummary.splitCount) {
        throw new ConflictException("Payout splits changed. Refresh and try again.");
      }

      const b2bUpdate = await tx.b2BOrder.updateMany({
        where: {
          payoutId,
          settlementStatus: SellerSettlementStatus.DRAFTED
        },
        data: {
          settlementStatus: SellerSettlementStatus.APPROVED,
          settledAt: new Date()
        }
      });
      if (b2bUpdate.count !== splitSummary.b2bOrderCount) {
        throw new ConflictException("B2B payout sources changed. Refresh and try again.");
      }

      const serviceUpdate = await tx.serviceBookingSettlement.updateMany({
        where: {
          payoutId,
          status: SellerSettlementStatus.DRAFTED,
        },
        data: {
          status: SellerSettlementStatus.APPROVED,
        },
      });
      if (serviceUpdate.count !== splitSummary.serviceSettlementCount) {
        throw new ConflictException("Service payout sources changed. Refresh and try again.");
      }

      await this.applyServiceReceivableOffsets(tx, payoutId, actor);
      await this.applySellerCashReceivableOffsets(tx, payoutId, actor);

      await this.ledger.postPayoutApprovalEntries(tx, payoutId, actor);
      await this.createEvent(tx, payoutId, "payout.approved", payout.status, SellerPayoutStatus.APPROVED, actor, dto.note);
      await this.audit(tx, actor, "finance.payout.approved", payoutId, { status: payout.status }, { status: SellerPayoutStatus.APPROVED, note: dto.note });

      if (payout.settlementRunId) {
        await this.refreshRunStatus(tx, payout.settlementRunId);
      }
    });

    return this.getPayout(payoutId);
  }

  async rejectPayout(payoutId: string, dto: PayoutActionDto, actor: RequestUser) {
    await this.prisma.client.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.findUnique({ where: { id: payoutId } });

      if (!payout) {
        throw new NotFoundException("Seller payout not found.");
      }

      const rejectableStatuses: SellerPayoutStatus[] = [SellerPayoutStatus.DRAFT, SellerPayoutStatus.PENDING_APPROVAL];
      if (!rejectableStatuses.includes(payout.status)) {
        throw new BadRequestException("Only draft or pending payouts can be rejected.");
      }

      const payoutUpdate = await tx.sellerPayout.updateMany({
        where: { id: payoutId, status: { in: rejectableStatuses } },
        data: {
          status: SellerPayoutStatus.REJECTED,
          note: dto.note ?? payout.note
        }
      });
      if (payoutUpdate.count !== 1) {
        throw new ConflictException("Payout status changed. Refresh and try again.");
      }

      await tx.orderSellerSplit.updateMany({
        where: {
          payoutId,
          settlementStatus: { in: [SellerSettlementStatus.DRAFTED, SellerSettlementStatus.APPROVED] }
        },
        data: {
          payoutId: null,
          settlementStatus: SellerSettlementStatus.ELIGIBLE
        }
      });

      await tx.b2BOrder.updateMany({
        where: {
          payoutId,
          settlementStatus: { in: [SellerSettlementStatus.DRAFTED, SellerSettlementStatus.APPROVED] }
        },
        data: {
          payoutId: null,
          settlementStatus: SellerSettlementStatus.ELIGIBLE
        }
      });

      await tx.serviceBookingSettlement.updateMany({
        where: {
          payoutId,
          status: { in: [SellerSettlementStatus.DRAFTED, SellerSettlementStatus.APPROVED] },
        },
        data: {
          payoutId: null,
          status: SellerSettlementStatus.ELIGIBLE,
        },
      });

      await tx.serviceSellerReceivable.updateMany({
        where: {
          payoutOffsetId: payoutId,
          status: { in: [ServiceSellerReceivableStatus.OFFSET_SCHEDULED, ServiceSellerReceivableStatus.OFFSET_APPLIED, ServiceSellerReceivableStatus.PARTIALLY_SETTLED] },
        },
        data: {
          payoutOffsetId: null,
          offsetPaise: 0,
          offsetScheduledAt: null,
          offsetAppliedAt: null,
          status: ServiceSellerReceivableStatus.OPEN,
        },
      });

      await tx.sellerCashReceivable.updateMany({
        where: {
          payoutOffsetId: payoutId,
          status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
          OR: [
            { settledPaise: { gt: 0 } },
            { waivedPaise: { gt: 0 } },
            { offsetAppliedAt: { not: null } },
            { ledgerEntries: { some: { entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OFFSET } } },
          ],
        },
        data: {
          payoutOffsetId: null,
          offsetPaise: 0,
          offsetScheduledAt: null,
          offsetAppliedAt: null,
          status: SellerCashReceivableStatus.PARTIALLY_OFFSET,
        },
      });

      await tx.sellerCashReceivable.updateMany({
        where: {
          payoutOffsetId: payoutId,
          status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
        },
        data: {
          payoutOffsetId: null,
          offsetPaise: 0,
          offsetScheduledAt: null,
          offsetAppliedAt: null,
          status: SellerCashReceivableStatus.OPEN,
        },
      });

      await tx.sellerLedgerEntry.updateMany({
        where: {
          payoutId,
          entryType: SellerLedgerEntryType.MANUAL_ADJUSTMENT,
        },
        data: {
          payoutId: null,
        },
      });

      await this.createEvent(tx, payoutId, "payout.rejected", payout.status, SellerPayoutStatus.REJECTED, actor, dto.note);
      await this.audit(tx, actor, "finance.payout.rejected", payoutId, { status: payout.status }, { status: SellerPayoutStatus.REJECTED, note: dto.note });

      if (payout.settlementRunId) {
        await this.refreshRunStatus(tx, payout.settlementRunId);
      }
    });

    return this.getPayout(payoutId);
  }

  async markPaid(payoutId: string, dto: MarkPayoutPaidDto, actor: RequestUser) {
    await this.prisma.client.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.findUnique({ where: { id: payoutId } });

      if (!payout) {
        throw new NotFoundException("Seller payout not found.");
      }

      if (payout.status !== SellerPayoutStatus.APPROVED) {
        throw new BadRequestException("Only approved payouts can be marked paid.");
      }

      const splitSummary = await this.payoutSplitSummary(tx, payoutId, payout.adjustmentPaise);
      if (splitSummary.count < 1) {
        throw new BadRequestException("Payout has no linked order, B2B, or service sources.");
      }
      if (splitSummary.netPayablePaise !== payout.netPayablePaise) {
        throw new ConflictException("Payout source totals changed. Refresh and try again.");
      }

      const payoutUpdate = await tx.sellerPayout.updateMany({
        where: { id: payoutId, status: SellerPayoutStatus.APPROVED },
        data: {
          status: SellerPayoutStatus.PAID,
          paymentMode: dto.paymentMode,
          transactionReference: dto.transactionReference,
          paidById: actor.id,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          note: dto.note ?? payout.note
        }
      });
      if (payoutUpdate.count !== 1) {
        throw new ConflictException("Payout status changed. Refresh and try again.");
      }

      const splitUpdate = await tx.orderSellerSplit.updateMany({
        where: { payoutId, settlementStatus: SellerSettlementStatus.APPROVED },
        data: {
          settlementStatus: SellerSettlementStatus.PAID
        }
      });
      if (splitUpdate.count !== splitSummary.splitCount) {
        throw new ConflictException("Payout splits changed. Refresh and try again.");
      }

      const b2bUpdate = await tx.b2BOrder.updateMany({
        where: { payoutId, settlementStatus: SellerSettlementStatus.APPROVED },
        data: {
          settlementStatus: SellerSettlementStatus.PAID
        }
      });
      if (b2bUpdate.count !== splitSummary.b2bOrderCount) {
        throw new ConflictException("B2B payout sources changed. Refresh and try again.");
      }

      const serviceUpdate = await tx.serviceBookingSettlement.updateMany({
        where: { payoutId, status: SellerSettlementStatus.APPROVED },
        data: {
          status: SellerSettlementStatus.PAID,
        },
      });
      if (serviceUpdate.count !== splitSummary.serviceSettlementCount) {
        throw new ConflictException("Service payout sources changed. Refresh and try again.");
      }

      await this.ledger.postPayoutPaidEntry(tx, payoutId, actor);
      await this.releasePartiallyOffsetSellerCashReceivables(tx, payoutId);
      await this.createEvent(tx, payoutId, "payout.marked_paid", payout.status, SellerPayoutStatus.PAID, actor, dto.note);
      await this.audit(tx, actor, "finance.payout.paid", payoutId, { status: payout.status }, { status: SellerPayoutStatus.PAID, transactionReference: dto.transactionReference });

      if (payout.settlementRunId) {
        await this.refreshRunStatus(tx, payout.settlementRunId);
      }
    });

    return this.getPayout(payoutId);
  }

  private async refreshRunStatus(tx: Prisma.TransactionClient, runId: string) {
    const payouts = await tx.sellerPayout.findMany({
      where: { settlementRunId: runId },
      select: { status: true }
    });

    if (!payouts.length) {
      return;
    }

    const statuses = payouts.map((payout) => payout.status);
    const nextStatus = statuses.every((status) => status === SellerPayoutStatus.PAID)
      ? SellerPayoutStatus.PAID
      : statuses.every((status) => status === SellerPayoutStatus.APPROVED || status === SellerPayoutStatus.PAID)
        ? SellerPayoutStatus.APPROVED
        : statuses.every((status) => status === SellerPayoutStatus.REJECTED)
          ? SellerPayoutStatus.REJECTED
          : undefined;

    if (nextStatus) {
      await tx.sellerSettlementRun.update({
        where: { id: runId },
        data: { status: nextStatus }
      });
    }
  }

  private async payoutSplitSummary(tx: Prisma.TransactionClient, payoutId: string, adjustmentPaise: number) {
    const [summary, b2bSummary, serviceSummary] = await Promise.all([
      tx.orderSellerSplit.aggregate({
        where: { payoutId },
        _count: { _all: true },
        _sum: { netPayablePaise: true }
      }),
      tx.b2BOrder.aggregate({
        where: { payoutId },
        _count: { _all: true },
        _sum: { sellerPayoutAmountPaise: true }
      }),
      tx.serviceBookingSettlement.aggregate({
        where: { payoutId },
        _count: { _all: true },
        _sum: { netPayablePaise: true }
      })
    ]);

    return {
      splitCount: summary._count._all,
      b2bOrderCount: b2bSummary._count._all,
      serviceSettlementCount: serviceSummary._count._all,
      count: summary._count._all + b2bSummary._count._all + serviceSummary._count._all,
      netPayablePaise:
        (summary._sum.netPayablePaise ?? 0) +
        (b2bSummary._sum.sellerPayoutAmountPaise ?? 0) +
        (serviceSummary._sum.netPayablePaise ?? 0) +
        adjustmentPaise
    };
  }

  private async applyServiceReceivableOffsets(tx: Prisma.TransactionClient, payoutId: string, actor: RequestUser) {
    const payout = await tx.sellerPayout.findUnique({
      where: { id: payoutId },
      select: { id: true, sellerId: true, payoutNumber: true },
    });
    if (!payout) {
      throw new NotFoundException("Seller payout not found.");
    }

    const offsets = await tx.serviceSellerReceivable.findMany({
      where: {
        payoutOffsetId: payoutId,
        status: ServiceSellerReceivableStatus.OFFSET_SCHEDULED,
        offsetPaise: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const offset of offsets) {
      const outstandingBeforeOffset = Math.max(
        0,
        offset.amountDueToPlatformPaise - offset.settledPaise - offset.waivedPaise - offset.reversalPaise,
      );
      const nextStatus =
        offset.offsetPaise >= outstandingBeforeOffset
          ? ServiceSellerReceivableStatus.OFFSET_APPLIED
          : ServiceSellerReceivableStatus.PARTIALLY_SETTLED;
      const updated = await tx.serviceSellerReceivable.updateMany({
        where: {
          id: offset.id,
          payoutOffsetId: payoutId,
          status: ServiceSellerReceivableStatus.OFFSET_SCHEDULED,
        },
        data: {
          status: nextStatus,
          offsetAppliedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Service receivable offset changed while approving payout. Refresh and try again.");
      }

      await tx.serviceSellerReceivableEvent.create({
        data: {
          receivableId: offset.id,
          eventType: "service_receivable.offset_applied",
          oldStatus: ServiceSellerReceivableStatus.OFFSET_SCHEDULED,
          newStatus: nextStatus,
          amountDeltaPaise: -offset.offsetPaise,
          oldAmountDuePaise: outstandingBeforeOffset,
          newAmountDuePaise: Math.max(0, outstandingBeforeOffset - offset.offsetPaise),
          note: `Offset applied against payout ${payout.payoutNumber}`,
          actorUserId: actor.id,
          metadata: {
            payoutId,
            payoutNumber: payout.payoutNumber,
            receivableNumber: offset.receivableNumber,
          },
        },
      });

      const existingLedger = await tx.sellerLedgerEntry.findFirst({
        where: {
          payoutId,
          referenceType: "service_seller_receivable",
          referenceId: offset.id,
          entryType: SellerLedgerEntryType.SERVICE_RECEIVABLE_OFFSET,
        },
        select: { id: true },
      });
      if (!existingLedger) {
        await this.ledger.createEntry(tx, {
          sellerId: offset.sellerId,
          serviceBookingId: offset.bookingId,
          payoutId,
          entryType: SellerLedgerEntryType.SERVICE_RECEIVABLE_OFFSET,
          description: `Service receivable offset against payout ${payout.payoutNumber}`,
          debitPaise: offset.offsetPaise,
          currency: offset.currency,
          referenceType: "service_seller_receivable",
          referenceId: offset.id,
          metadata: { receivableNumber: offset.receivableNumber, payoutNumber: payout.payoutNumber },
          createdById: actor.id,
        });
      }
    }
  }

  private async applySellerCashReceivableOffsets(tx: Prisma.TransactionClient, payoutId: string, actor: RequestUser) {
    const payout = await tx.sellerPayout.findUnique({
      where: { id: payoutId },
      select: { id: true, sellerId: true, payoutNumber: true },
    });
    if (!payout) {
      throw new NotFoundException("Seller payout not found.");
    }

    const offsets = await tx.sellerCashReceivable.findMany({
      where: {
        payoutOffsetId: payoutId,
        status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
        offsetPaise: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const offset of offsets) {
      const outstandingBeforeOffset = Math.max(0, offset.outstandingPaise);
      const nextOutstanding = Math.max(0, outstandingBeforeOffset - offset.offsetPaise);
      const nextStatus =
        nextOutstanding === 0
          ? SellerCashReceivableStatus.SETTLED
          : SellerCashReceivableStatus.PARTIALLY_OFFSET;
      const updated = await tx.sellerCashReceivable.updateMany({
        where: {
          id: offset.id,
          payoutOffsetId: payoutId,
          status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
        },
        data: {
          status: nextStatus,
          outstandingPaise: nextOutstanding,
          offsetAppliedAt: new Date(),
          ...(nextStatus === SellerCashReceivableStatus.SETTLED ? { settledAt: new Date() } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Seller cash receivable offset changed while approving payout. Refresh and try again.");
      }

      await tx.sellerCashReceivableEvent.create({
        data: {
          receivableId: offset.id,
          eventType: "seller_cash_receivable.offset_applied",
          oldStatus: SellerCashReceivableStatus.OFFSET_SCHEDULED,
          newStatus: nextStatus,
          amountDeltaPaise: -offset.offsetPaise,
          oldOutstandingPaise: outstandingBeforeOffset,
          newOutstandingPaise: nextOutstanding,
          note: `Offset applied against payout ${payout.payoutNumber}`,
          actorUserId: actor.id,
          metadata: {
            payoutId,
            payoutNumber: payout.payoutNumber,
            receivableNumber: offset.receivableNumber,
          },
        },
      });

      const existingLedger = await tx.sellerLedgerEntry.findFirst({
        where: {
          payoutId,
          referenceType: "seller_cash_receivable",
          referenceId: offset.id,
          entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OFFSET,
        },
        select: { id: true },
      });
      if (!existingLedger) {
        await this.ledger.createEntry(tx, {
          sellerId: offset.sellerId,
          orderId: offset.orderId,
          orderSellerSplitId: offset.orderSellerSplitId,
          sellerCashReceivableId: offset.id,
          payoutId,
          entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OFFSET,
          description: `Seller-collected COD offset against payout ${payout.payoutNumber}`,
          debitPaise: offset.offsetPaise,
          currency: offset.currency,
          referenceType: "seller_cash_receivable",
          referenceId: offset.id,
          metadata: { receivableNumber: offset.receivableNumber, payoutNumber: payout.payoutNumber },
          createdById: actor.id,
        });
      }
    }
  }

  private async releasePartiallyOffsetSellerCashReceivables(tx: Prisma.TransactionClient, payoutId: string) {
    await tx.sellerCashReceivable.updateMany({
      where: {
        payoutOffsetId: payoutId,
        status: SellerCashReceivableStatus.PARTIALLY_OFFSET,
        outstandingPaise: { gt: 0 },
      },
      data: {
        payoutOffsetId: null,
        offsetPaise: 0,
        offsetScheduledAt: null,
      },
    });
  }

  private createEvent(
    tx: Prisma.TransactionClient,
    payoutId: string,
    eventType: string,
    oldStatus: SellerPayoutStatus,
    newStatus: SellerPayoutStatus,
    actor: RequestUser,
    note?: string
  ) {
    return tx.sellerPayoutEvent.create({
      data: {
        payoutId,
        eventType,
        oldStatus,
        newStatus,
        actorUserId: actor.id,
        note: note ?? null
      }
    });
  }

  private audit(tx: Prisma.TransactionClient, actor: RequestUser, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    return tx.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action,
        entityType: "seller_payout",
        entityId,
        oldValue: oldValue as Prisma.InputJsonValue,
        newValue: newValue as Prisma.InputJsonValue
      }
    });
  }

  private async calculateSellerPayoutAvailability(tx: Prisma.TransactionClient, sellerId: string) {
    const [seller, settings, splits, b2bOrders, serviceSettlements, receivables, sellerCashReceivables, manualAdjustments, latestLedgerEntry, pendingPayoutsAgg, paidPayoutsAgg] = await Promise.all([
      tx.seller.findUnique({
        where: { id: sellerId },
        include: {
          payoutProfile: true,
          profile: true,
          addresses: {
            select: { countryCode: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        }
      }),
      this.payoutRequestSettings(tx),
      tx.orderSellerSplit.findMany({
        where: {
          sellerId,
          payoutId: null,
          sellerStatus: { not: SellerOrderStatus.CANCELLED },
          settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
          order: {
            orderStatus: OrderStatus.DELIVERED,
            paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.NOT_REQUIRED] }
          },
          sellerCashReceivables: {
            none: {
              status: { not: SellerCashReceivableStatus.CANCELLED },
            },
          },
        },
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: { select: { categoryId: true } }
                }
              }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }),
      tx.b2BOrder.findMany({
        where: {
          sellerId,
          payoutId: null,
          status: { in: [B2BOrderStatus.DELIVERY_ACCEPTED, B2BOrderStatus.CLOSED] },
          paymentStatus: B2BPaymentStatus.PAID,
          settlementStatus: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
        },
        orderBy: { createdAt: "asc" }
      }),
      tx.serviceBookingSettlement.findMany({
        where: {
          sellerId,
          payoutId: null,
          status: { in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE] },
          netPayablePaise: { gt: 0 },
          booking: {
            status: { in: ["COMPLETED", "CLOSED_AFTER_INSPECTION"] },
          },
        },
        include: { booking: true },
        orderBy: { createdAt: "asc" },
      }),
      tx.serviceSellerReceivable.findMany({
        where: {
          sellerId,
          payoutOffsetId: null,
          status: { in: [ServiceSellerReceivableStatus.OPEN, ServiceSellerReceivableStatus.PARTIALLY_SETTLED] },
          offsetPolicy: { in: [ServiceReceivableOffsetPolicy.AUTO_OFFSET_NEXT_PAYOUT, ServiceReceivableOffsetPolicy.HOLD_PAYOUT_UNTIL_SETTLED] },
        },
        orderBy: { createdAt: "asc" },
      }),
      tx.sellerCashReceivable.findMany({
        where: {
          sellerId,
          payoutOffsetId: null,
          status: { in: [SellerCashReceivableStatus.OPEN, SellerCashReceivableStatus.PARTIALLY_OFFSET] },
          outstandingPaise: { gt: 0 },
        },
        orderBy: { createdAt: "asc" },
      }),
      tx.sellerLedgerEntry.findMany({
        where: {
          sellerId,
          payoutId: null,
          entryType: SellerLedgerEntryType.MANUAL_ADJUSTMENT,
        },
        orderBy: { createdAt: "asc" },
      }),
      tx.sellerLedgerEntry.findFirst({
        where: { sellerId },
        orderBy: { createdAt: "desc" },
        select: { balanceAfterPaise: true }
      }),
      tx.sellerPayout.aggregate({
        where: { sellerId, status: { in: [SellerPayoutStatus.PENDING_APPROVAL, SellerPayoutStatus.APPROVED] } },
        _sum: { netPayablePaise: true }
      }),
      tx.sellerPayout.aggregate({
        where: { sellerId, status: SellerPayoutStatus.PAID },
        _sum: { netPayablePaise: true }
      })
    ]);

    if (!seller) {
      throw new NotFoundException("Seller not found.");
    }

    const calculations: PayoutRequestCalculation[] = [];
    const splitCalculations = await this.calculator.calculateSplits(splits, tx);
    for (const [index, split] of splits.entries()) {
      const calculation = splitCalculations[index]!;
      if (calculation.netPayablePaise > 0) {
        calculations.push({ split, calculation });
      }
    }

    const totals = this.emptyTotals();
    for (const { calculation } of calculations) {
      totals.grossSalesPaise += calculation.grossSalesPaise;
      totals.commissionPaise += calculation.commissionPaise;
      totals.gstOnCommissionPaise += calculation.gstOnCommissionPaise;
      totals.tdsPaise += calculation.tdsPaise;
      totals.tcsPaise += calculation.tcsPaise;
      totals.platformFeePaise += calculation.platformFeePaise;
      totals.refundAdjustmentPaise += calculation.refundAdjustmentPaise;
      totals.netPayablePaise += calculation.netPayablePaise;
    }
    const eligibleB2BOrders: B2BPayoutOrder[] = [];
    for (const order of b2bOrders) {
      if (order.sellerPayoutAmountPaise <= 0) {
        continue;
      }
      eligibleB2BOrders.push(order);
      totals.grossSalesPaise += order.buyerPayableAmountPaise;
      totals.commissionPaise += order.commissionAmountPaise;
      totals.netPayablePaise += order.sellerPayoutAmountPaise;
    }
    const eligibleServiceSettlements = serviceSettlements.filter((settlement) => settlement.netPayablePaise > 0);
    for (const settlement of eligibleServiceSettlements) {
      totals.grossSalesPaise += settlement.grossAmountPaise;
      totals.commissionPaise += settlement.commissionPaise;
      totals.gstOnCommissionPaise += settlement.gstOnCommissionPaise;
      totals.tdsPaise += settlement.tdsPaise;
      totals.tcsPaise += settlement.tcsPaise;
      totals.platformFeePaise += settlement.platformFeePaise;
      totals.refundAdjustmentPaise += settlement.refundAdjustmentPaise;
      totals.netPayablePaise += settlement.netPayablePaise;
    }

    const manualAdjustmentPaise = manualAdjustments.reduce((sum, entry) => sum + (entry.creditPaise - entry.debitPaise), 0);
    totals.adjustmentPaise += manualAdjustmentPaise;
    totals.netPayablePaise += totals.adjustmentPaise;

    const holdReceivableCount = receivables.filter(
      (receivable) =>
        receivable.offsetPolicy === ServiceReceivableOffsetPolicy.HOLD_PAYOUT_UNTIL_SETTLED &&
        this.receivableOutstanding(receivable) > 0,
    ).length;
    const receivableOffsets: Array<ServicePayoutReceivable & { offsetAmountPaise: number }> = [];
    let remainingOffsetCapacity = totals.netPayablePaise;
    for (const receivable of receivables) {
      if (receivable.offsetPolicy !== ServiceReceivableOffsetPolicy.AUTO_OFFSET_NEXT_PAYOUT) {
        continue;
      }
      const outstanding = this.receivableOutstanding(receivable);
      if (outstanding <= 0 || remainingOffsetCapacity <= 0) {
        continue;
      }
      const offsetAmountPaise = Math.min(outstanding, remainingOffsetCapacity);
      receivableOffsets.push({ ...receivable, offsetAmountPaise });
      remainingOffsetCapacity -= offsetAmountPaise;
    }
    const serviceReceivableOffsetPaise = receivableOffsets.reduce((sum, receivable) => sum + receivable.offsetAmountPaise, 0);
    totals.netPayablePaise = Math.max(0, totals.netPayablePaise - serviceReceivableOffsetPaise);

    const sellerCashReceivableOffsets: Array<SellerCashPayoutReceivable & { offsetAmountPaise: number }> = [];
    remainingOffsetCapacity = totals.netPayablePaise;
    for (const receivable of sellerCashReceivables) {
      const outstanding = this.sellerCashReceivableOutstanding(receivable);
      if (outstanding <= 0 || remainingOffsetCapacity <= 0) {
        continue;
      }
      const offsetAmountPaise = Math.min(outstanding, remainingOffsetCapacity);
      sellerCashReceivableOffsets.push({ ...receivable, offsetAmountPaise });
      remainingOffsetCapacity -= offsetAmountPaise;
    }
    const sellerCashReceivableOffsetPaise = sellerCashReceivableOffsets.reduce((sum, receivable) => sum + receivable.offsetAmountPaise, 0);
    const sellerCashReceivableOutstandingPaise = sellerCashReceivables.reduce((sum, receivable) => sum + this.sellerCashReceivableOutstanding(receivable), 0);
    totals.netPayablePaise = Math.max(0, totals.netPayablePaise - sellerCashReceivableOffsetPaise);

    const currentWalletBalancePaise = latestLedgerEntry?.balanceAfterPaise ?? 0;
    const ledgerDebtOffsetPaise = currentWalletBalancePaise < 0 ? Math.min(Math.abs(currentWalletBalancePaise), totals.netPayablePaise) : 0;
    totals.netPayablePaise = Math.max(0, totals.netPayablePaise - ledgerDebtOffsetPaise);

    const orderDates = [
      ...calculations.map(({ split }) => split.order.createdAt),
      ...eligibleB2BOrders.map((order) => order.createdAt),
      ...eligibleServiceSettlements.map((settlement) => settlement.booking.createdAt),
    ];
    const sellerReady = seller.status === SellerStatus.APPROVED && seller.approvalStatus === ApprovalStatus.APPROVED && !seller.deletedAt;
    const hasPayoutMethod = this.hasPayoutMethod(seller.payoutProfile, seller.profile);

    return {
      ...settings,
      sellerReady,
      sellerCountryCode: seller.addresses?.[0]?.countryCode?.trim().toUpperCase() || "IN",
      hasPayoutMethod,
      eligibleSplitCount: calculations.length,
      eligibleB2BOrderCount: eligibleB2BOrders.length,
      eligibleServiceSettlementCount: eligibleServiceSettlements.length,
      holdReceivableCount,
      serviceReceivableOffsetPaise,
      sellerCashReceivableOffsetPaise,
      sellerCashReceivableOutstandingPaise,
      manualAdjustmentPaise,
      ledgerDebtOffsetPaise,
      pendingPayoutsPaise: pendingPayoutsAgg._sum.netPayablePaise ?? 0,
      paidPayoutsPaise: paidPayoutsAgg._sum.netPayablePaise ?? 0,
      periodFrom: orderDates.length ? new Date(Math.min(...orderDates.map((date) => date.getTime()))) : null,
      periodTo: orderDates.length ? new Date(Math.max(...orderDates.map((date) => date.getTime()))) : null,
      calculations,
      splits,
      b2bOrders: eligibleB2BOrders,
      serviceSettlements: eligibleServiceSettlements,
      receivableOffsets,
      sellerCashReceivableOffsets,
      manualAdjustments,
      ...totals
    };
  }

  private async publicAvailability(availability: Awaited<ReturnType<typeof this.calculateSellerPayoutAvailability>>) {
    const market = await this.marketService.getMarketCurrency(availability.sellerCountryCode, {
      requireFresh: true,
      forceRefresh: true,
    });
    const blockers = this.requestBlockers(availability, market);

    return {
      requestEnabled: availability.requestEnabled,
      minimumPayoutPaise: this.marketService.convertMinorUnits(availability.minimumPayoutPaise, market),
      sellerReady: availability.sellerReady,
      hasPayoutMethod: availability.hasPayoutMethod,
      eligibleSplitCount: availability.eligibleSplitCount,
      eligibleB2BOrderCount: availability.eligibleB2BOrderCount,
      eligibleServiceSettlementCount: availability.eligibleServiceSettlementCount,
      serviceReceivableOffsetPaise: this.marketService.convertMinorUnits(availability.serviceReceivableOffsetPaise, market),
      sellerCashReceivableOffsetPaise: this.marketService.convertMinorUnits(availability.sellerCashReceivableOffsetPaise, market),
      sellerCashReceivableOutstandingPaise: this.marketService.convertMinorUnits(availability.sellerCashReceivableOutstandingPaise, market),
      ledgerDebtOffsetPaise: this.marketService.convertMinorUnits(availability.ledgerDebtOffsetPaise, market),
      holdReceivableCount: availability.holdReceivableCount,
      pendingPayoutsPaise: this.marketService.convertMinorUnits(availability.pendingPayoutsPaise, market),
      paidPayoutsPaise: this.marketService.convertMinorUnits(availability.paidPayoutsPaise, market),
      periodFrom: availability.periodFrom?.toISOString() ?? null,
      periodTo: availability.periodTo?.toISOString() ?? null,
      grossSalesPaise: this.marketService.convertMinorUnits(availability.grossSalesPaise, market),
      commissionPaise: this.marketService.convertMinorUnits(availability.commissionPaise, market),
      gstOnCommissionPaise: this.marketService.convertMinorUnits(availability.gstOnCommissionPaise, market),
      tdsPaise: this.marketService.convertMinorUnits(availability.tdsPaise, market),
      tcsPaise: this.marketService.convertMinorUnits(availability.tcsPaise, market),
      platformFeePaise: this.marketService.convertMinorUnits(availability.platformFeePaise, market),
      refundAdjustmentPaise: this.marketService.convertMinorUnits(availability.refundAdjustmentPaise, market),
      netPayablePaise: this.marketService.convertMinorUnits(availability.netPayablePaise, market),
      currency: market.currency,
      baseCurrency: market.baseCurrency,
      fxRate: market.rate,
      canRequest: blockers.length === 0,
      blockers
    };
  }

  private async marketForSellerId(sellerId: string) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { id: sellerId },
      select: {
        addresses: {
          select: { countryCode: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    return this.marketService.getMarketCurrency(seller?.addresses[0]?.countryCode?.trim().toUpperCase() || "IN", {
      requireFresh: true,
      forceRefresh: true,
    });
  }

  private payoutReadback<T extends Record<string, unknown>>(payout: T): T {
    const seller = payout.seller;
    if (!seller || typeof seller !== "object" || Array.isArray(seller)) {
      return payout;
    }
    const sellerRecord = seller as Record<string, unknown>;
    const profile = sellerRecord.payoutProfile;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return payout;
    }
    const profileRecord = profile as Record<string, unknown>;
    const value = (key: string) =>
      typeof profileRecord[key] === "string" ? (profileRecord[key] as string) : null;

    return {
      ...payout,
      seller: {
        ...sellerRecord,
        payoutProfile: {
          accountHolderName: value("accountHolderName"),
          bankName: value("bankName"),
          accountNumber: sellerPayoutValue(
            value("accountNumberEncrypted"),
            value("legacyAccountNumber"),
          ),
          ifscCode: sellerPayoutValue(
            value("ifscCodeEncrypted"),
            value("legacyIfscCode"),
          ),
          upiId: sellerPayoutValue(value("upiIdEncrypted"), value("legacyUpiId")),
          isVerified: profileRecord.isVerified === true,
        },
      },
    } as T;
  }

  private payoutListReadback<T extends Record<string, unknown>>(payout: T): T {
    const seller = payout.seller;
    if (!seller || typeof seller !== "object" || Array.isArray(seller)) {
      return payout;
    }
    const sellerRecord = seller as Record<string, unknown>;
    const profile = sellerRecord.payoutProfile;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return payout;
    }
    const profileRecord = profile as Record<string, unknown>;

    return {
      ...payout,
      seller: {
        ...sellerRecord,
        payoutProfile: {
          accountHolderName: profileRecord.accountHolderName ?? null,
          bankName: profileRecord.bankName ?? null,
          accountNumberLast4: profileRecord.accountNumberLast4 ?? null,
          upiIdHint: profileRecord.upiIdHint ?? null,
          isVerified: profileRecord.isVerified === true,
        },
      },
    } as T;
  }

  private convertPayoutForSeller<T extends Record<string, unknown>>(payout: T, market: MarketCurrencySnapshot) {
    const converted = this.convertCurrencyRecord(payout, payoutMoneyFields, market) as Record<string, unknown>;

    if (Array.isArray(converted.orderSplits)) {
      converted.orderSplits = converted.orderSplits.map((split) =>
        this.convertCurrencyRecord(split as Record<string, unknown>, payoutOrderSplitMoneyFields, market),
      );
    }
    if (Array.isArray(converted.b2bOrders)) {
      converted.b2bOrders = converted.b2bOrders.map((order) =>
        this.convertCurrencyRecord(order as Record<string, unknown>, payoutB2BOrderMoneyFields, market),
      );
    }
    if (Array.isArray(converted.serviceSettlements)) {
      converted.serviceSettlements = converted.serviceSettlements.map((settlement) =>
        this.convertCurrencyRecord(settlement as Record<string, unknown>, serviceSettlementMoneyFields, market),
      );
    }
    if (Array.isArray(converted.serviceReceivableOffsets)) {
      converted.serviceReceivableOffsets = converted.serviceReceivableOffsets.map((offset) =>
        this.convertCurrencyRecord(offset as Record<string, unknown>, receivableOffsetMoneyFields, market),
      );
    }
    if (Array.isArray(converted.sellerCashReceivableOffsets)) {
      converted.sellerCashReceivableOffsets = converted.sellerCashReceivableOffsets.map((offset) =>
        this.convertCurrencyRecord(offset as Record<string, unknown>, receivableOffsetMoneyFields, market),
      );
    }
    if (Array.isArray(converted.ledgerEntries)) {
      converted.ledgerEntries = converted.ledgerEntries.map((entry) =>
        this.convertCurrencyRecord(entry as Record<string, unknown>, ledgerEntryMoneyFields, market),
      );
    }

    return converted as T;
  }

  private convertCurrencyRecord<T extends Record<string, unknown>, K extends readonly string[]>(
    record: T,
    fields: K,
    market: MarketCurrencySnapshot,
  ) {
    const converted: Record<string, unknown> = { ...record };
    for (const field of fields) {
      const value = converted[field];
      if (typeof value === "number") {
        converted[field] = this.marketService.convertMinorUnits(value, market);
      }
    }
    converted.currency = market.currency;

    return converted as T;
  }

  private requestBlockers(availability: {
    requestEnabled: boolean;
    sellerReady: boolean;
    hasPayoutMethod: boolean;
    eligibleSplitCount: number;
    eligibleB2BOrderCount?: number;
    eligibleServiceSettlementCount?: number;
    holdReceivableCount?: number;
    sellerCashReceivableOffsetPaise?: number;
    netPayablePaise: number;
    minimumPayoutPaise: number;
  }, market?: MarketCurrencySnapshot) {
    const blockers: string[] = [];

    if (!availability.requestEnabled) {
      blockers.push("Manual payout requests are disabled by admin.");
    }
    if (!availability.sellerReady) {
      blockers.push("Seller account must be approved and active.");
    }
    if (!availability.hasPayoutMethod) {
      blockers.push("Add bank account or UPI payout details in seller profile.");
    }
    if ((availability.holdReceivableCount ?? 0) > 0) {
      blockers.push("Open service cash receivables are configured to hold payouts until settled.");
    }
    const eligibleSourceCount =
      availability.eligibleSplitCount +
      (availability.eligibleB2BOrderCount ?? 0) +
      (availability.eligibleServiceSettlementCount ?? 0);
    if (eligibleSourceCount === 0) {
      blockers.push("No delivered and paid orders are currently eligible for payout.");
    }
    if (eligibleSourceCount > 0 && availability.netPayablePaise <= 0 && (availability.sellerCashReceivableOffsetPaise ?? 0) <= 0) {
      blockers.push("No delivered and paid orders are currently eligible for payout.");
    }
    if (availability.netPayablePaise > 0 && availability.netPayablePaise < availability.minimumPayoutPaise) {
      const minimumMinor = market ? this.marketService.convertMinorUnits(availability.minimumPayoutPaise, market) : availability.minimumPayoutPaise;
      const minimumCurrency = market?.currency ?? "INR";
      blockers.push(`Available payout is below the minimum amount of ${this.formatMinorAmount(minimumMinor, minimumCurrency)}.`);
    }

    return blockers;
  }

  private formatMinorAmount(minor: number, currency: string) {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: (minor / 100) % 1 === 0 ? 0 : 2,
    }).format(minor / 100);
  }

  private async payoutRequestSettings(tx: Prisma.TransactionClient) {
    const settings = await tx.setting.findMany({
      where: {
        key: {
          in: [payoutSettingKeys.requestsEnabled, payoutSettingKeys.minimumPaise]
        }
      }
    });
    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      requestEnabled: this.booleanSetting(settingMap, payoutSettingKeys.requestsEnabled, true),
      minimumPayoutPaise: this.numberSetting(settingMap, payoutSettingKeys.minimumPaise, defaultMinimumPayoutPaise)
    };
  }

  private booleanSetting(settingMap: Map<string, Prisma.JsonValue>, key: string, fallback: boolean) {
    return readBooleanSetting(settingMap.get(key), fallback);
  }

  private numberSetting(settingMap: Map<string, Prisma.JsonValue>, key: string, fallback: number) {
    return readNumberSetting(settingMap.get(key), fallback);
  }

  private hasPayoutMethod(
    payoutProfile: {
      accountHolderName?: string | null;
      bankName?: string | null;
      accountNumberEncrypted?: string | null;
      ifscCodeEncrypted?: string | null;
      upiIdEncrypted?: string | null;
      legacyAccountNumber?: string | null;
      legacyIfscCode?: string | null;
      legacyUpiId?: string | null;
    } | null,
    sellerProfile?: { contactName?: string | null; businessLegalName?: string | null } | null
  ) {
    if (!payoutProfile) {
      return false;
    }

    const name = payoutProfile.accountHolderName?.trim() || sellerProfile?.contactName?.trim() || sellerProfile?.businessLegalName?.trim();
    const accountNumber = sellerPayoutValue(
      payoutProfile.accountNumberEncrypted,
      payoutProfile.legacyAccountNumber,
    );
    const ifscCode = sellerPayoutValue(
      payoutProfile.ifscCodeEncrypted,
      payoutProfile.legacyIfscCode,
    );
    const upiId = sellerPayoutValue(payoutProfile.upiIdEncrypted, payoutProfile.legacyUpiId);
    const hasUpi = Boolean(name && upiId);
    const hasBank = Boolean(name && payoutProfile.bankName?.trim() && accountNumber && ifscCode);

    return hasUpi || hasBank;
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
      adjustmentPaise: 0,
      netPayablePaise: 0,
      currency: "INR"
    };
  }

  private makePayoutNumber() {
    return `PO-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  private receivableOutstanding(
    receivable: Pick<ServicePayoutReceivable, "amountDueToPlatformPaise" | "settledPaise" | "waivedPaise" | "reversalPaise" | "offsetPaise">,
  ) {
    return Math.max(
      0,
      receivable.amountDueToPlatformPaise -
        receivable.settledPaise -
        receivable.waivedPaise -
        receivable.reversalPaise -
        receivable.offsetPaise,
    );
  }

  private sellerCashReceivableOutstanding(
    receivable: Pick<SellerCashPayoutReceivable, "outstandingPaise" | "platformDuePaise" | "settledPaise" | "waivedPaise" | "offsetPaise">,
  ) {
    return Math.max(
      0,
      receivable.outstandingPaise ??
        receivable.platformDuePaise - receivable.settledPaise - receivable.waivedPaise - receivable.offsetPaise,
    );
  }
}
