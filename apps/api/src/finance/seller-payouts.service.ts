import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, OrderStatus, PaymentStatus, Prisma, SellerOrderStatus, SellerPayoutStatus, SellerSettlementStatus, SellerStatus } from "@indihub/database";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
} from "../common/pagination";
import { RequestUser } from "../auth/types/indihub-request";
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

type PayoutRequestSplit = Prisma.OrderSellerSplitGetPayload<{
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

type PayoutRequestCalculation = {
  split: PayoutRequestSplit;
  calculation: SplitFinanceCalculation;
};

@Injectable()
export class SellerPayoutsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceCalculatorService) private readonly calculator: FinanceCalculatorService,
    @Inject(SellerLedgerService) private readonly ledger: SellerLedgerService
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

      return { ...pageResult, limit: take };
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

    return { items, total, page, limit: take };
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
              accountNumber: true,
              ifscCode: true,
              upiId: true,
              isVerified: true
            }
          }
        }
      },
      settlementRun: { select: { id: true, runNumber: true, status: true } },
      _count: { select: { orderSplits: true, ledgerEntries: true, statements: true } }
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
        events: { orderBy: { createdAt: "asc" } },
        statements: { orderBy: { generatedAt: "desc" } }
      }
    });

    if (!payout) {
      throw new NotFoundException("Seller payout not found.");
    }

    return payout;
  }

  async updateSellerPayoutProfileVerification(sellerId: string, dto: SellerPayoutProfileVerificationDto, actor: RequestUser) {
    const profile = await this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.findFirst({
        where: { id: sellerId, deletedAt: null },
        include: { payoutProfile: true }
      });

      if (!seller) {
        throw new NotFoundException("Seller not found.");
      }
      if (!seller.payoutProfile) {
        throw new BadRequestException("Seller payout profile is not configured.");
      }
      if (dto.verified && !this.hasPayoutMethod(seller.payoutProfile)) {
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
      accountNumber: profile.accountNumber,
      ifscCode: profile.ifscCode,
      upiId: profile.upiId,
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

      const splitSummary = await this.payoutSplitSummary(tx, payoutId);
      if (splitSummary.count < 1) {
        throw new BadRequestException("Payout has no linked order splits.");
      }
      if (splitSummary.netPayablePaise !== payout.netPayablePaise) {
        throw new ConflictException("Payout split totals changed. Refresh and try again.");
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
      if (splitUpdate.count !== splitSummary.count) {
        throw new ConflictException("Payout splits changed. Refresh and try again.");
      }

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

      const splitSummary = await this.payoutSplitSummary(tx, payoutId);
      if (splitSummary.count < 1) {
        throw new BadRequestException("Payout has no linked order splits.");
      }
      if (splitSummary.netPayablePaise !== payout.netPayablePaise) {
        throw new ConflictException("Payout split totals changed. Refresh and try again.");
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
      if (splitUpdate.count !== splitSummary.count) {
        throw new ConflictException("Payout splits changed. Refresh and try again.");
      }

      await this.ledger.postPayoutPaidEntry(tx, payoutId, actor);
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

  private async payoutSplitSummary(tx: Prisma.TransactionClient, payoutId: string) {
    const summary = await tx.orderSellerSplit.aggregate({
      where: { payoutId },
      _count: { _all: true },
      _sum: { netPayablePaise: true }
    });

    return {
      count: summary._count._all,
      netPayablePaise: summary._sum.netPayablePaise ?? 0
    };
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
    const [seller, settings, splits] = await Promise.all([
      tx.seller.findUnique({
        where: { id: sellerId },
        include: {
          payoutProfile: true
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
      })
    ]);

    if (!seller) {
      throw new NotFoundException("Seller not found.");
    }

    const calculations: PayoutRequestCalculation[] = [];
    for (const split of splits) {
      const calculation = await this.calculator.calculateSplit(split, tx);
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

    const orderDates = calculations.map(({ split }) => split.order.createdAt);
    const sellerReady = seller.status === SellerStatus.APPROVED && seller.approvalStatus === ApprovalStatus.APPROVED && !seller.deletedAt;
    const hasPayoutMethod = this.hasPayoutMethod(seller.payoutProfile);

    return {
      ...settings,
      sellerReady,
      hasPayoutMethod,
      eligibleSplitCount: calculations.length,
      periodFrom: orderDates.length ? new Date(Math.min(...orderDates.map((date) => date.getTime()))) : null,
      periodTo: orderDates.length ? new Date(Math.max(...orderDates.map((date) => date.getTime()))) : null,
      calculations,
      ...totals
    };
  }

  private publicAvailability(availability: Awaited<ReturnType<typeof this.calculateSellerPayoutAvailability>>) {
    const blockers = this.requestBlockers(availability);

    return {
      requestEnabled: availability.requestEnabled,
      minimumPayoutPaise: availability.minimumPayoutPaise,
      sellerReady: availability.sellerReady,
      hasPayoutMethod: availability.hasPayoutMethod,
      eligibleSplitCount: availability.eligibleSplitCount,
      periodFrom: availability.periodFrom?.toISOString() ?? null,
      periodTo: availability.periodTo?.toISOString() ?? null,
      grossSalesPaise: availability.grossSalesPaise,
      commissionPaise: availability.commissionPaise,
      gstOnCommissionPaise: availability.gstOnCommissionPaise,
      tdsPaise: availability.tdsPaise,
      tcsPaise: availability.tcsPaise,
      platformFeePaise: availability.platformFeePaise,
      refundAdjustmentPaise: availability.refundAdjustmentPaise,
      netPayablePaise: availability.netPayablePaise,
      currency: availability.currency,
      canRequest: blockers.length === 0,
      blockers
    };
  }

  private requestBlockers(availability: {
    requestEnabled: boolean;
    sellerReady: boolean;
    hasPayoutMethod: boolean;
    eligibleSplitCount: number;
    netPayablePaise: number;
    minimumPayoutPaise: number;
  }) {
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
    if (availability.eligibleSplitCount === 0 || availability.netPayablePaise <= 0) {
      blockers.push("No delivered and paid orders are currently eligible for payout.");
    }
    if (availability.netPayablePaise > 0 && availability.netPayablePaise < availability.minimumPayoutPaise) {
      blockers.push(`Available payout is below the minimum amount of INR ${(availability.minimumPayoutPaise / 100).toLocaleString("en-IN")}.`);
    }

    return blockers;
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

  private hasPayoutMethod(profile: { accountHolderName?: string | null; bankName?: string | null; accountNumber?: string | null; ifscCode?: string | null; upiId?: string | null } | null) {
    if (!profile) {
      return false;
    }

    const hasUpi = Boolean(profile.accountHolderName?.trim() && profile.upiId?.trim());
    const hasBank = Boolean(profile.accountHolderName?.trim() && profile.bankName?.trim() && profile.accountNumber?.trim() && profile.ifscCode?.trim());

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
      netPayablePaise: 0,
      currency: "INR"
    };
  }

  private makePayoutNumber() {
    return `PO-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
}
