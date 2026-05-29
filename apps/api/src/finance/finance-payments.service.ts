import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CodCollectionStatus,
  EmailRecipientType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SellerOrderStatus,
  SellerPayoutStatus,
  SellerSettlementStatus,
  StatusEventType,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  FinanceOfflinePaymentVerificationDecision,
  FinanceOfflinePaymentVerificationDto,
  FinancePaymentCollectionQueryDto,
} from "./dto/finance.dto";

const offlinePaymentProviders = [PaymentProvider.BANK_TRANSFER, PaymentProvider.MANUAL] as const;

@Injectable()
export class FinancePaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async dashboard() {
    const [
      codPending,
      codCollected,
      bankTransferPending,
      manualPending,
      onlinePaid,
      settlementDue,
      payoutPending,
      payoutPaid,
      recentPayments,
    ] = await Promise.all([
      this.paymentMetric({ provider: PaymentProvider.COD, status: PaymentStatus.PENDING }),
      this.paymentMetric({
        provider: PaymentProvider.COD,
        order: {
          deliveryDetail: {
            is: {
              codCollectionStatus: CodCollectionStatus.COLLECTED,
            },
          },
        },
      }),
      this.paymentMetric({
        provider: PaymentProvider.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
      }),
      this.paymentMetric({ provider: PaymentProvider.MANUAL, status: PaymentStatus.PENDING }),
      this.paymentMetric({ provider: PaymentProvider.RAZORPAY, status: PaymentStatus.PAID }),
      this.prisma.client.orderSellerSplit.aggregate({
        where: { settlementStatus: SellerSettlementStatus.ELIGIBLE },
        _count: { _all: true },
        _sum: { sellerSubtotalPaise: true },
      }),
      this.prisma.client.sellerPayout.aggregate({
        where: {
          status: { in: [SellerPayoutStatus.PENDING_APPROVAL, SellerPayoutStatus.APPROVED] },
        },
        _count: { _all: true },
        _sum: { netPayablePaise: true },
      }),
      this.prisma.client.sellerPayout.aggregate({
        where: { status: SellerPayoutStatus.PAID },
        _count: { _all: true },
        _sum: { netPayablePaise: true },
      }),
      this.recentPayments(),
    ]);

    return {
      metrics: {
        codPending,
        codCollected,
        bankTransferPending,
        manualPending,
        onlinePaid,
        settlementDue: this.aggregateMetric(
          settlementDue._count._all,
          settlementDue._sum.sellerSubtotalPaise,
        ),
        payoutPending: this.aggregateMetric(
          payoutPending._count._all,
          payoutPending._sum.netPayablePaise,
        ),
        payoutPaid: this.aggregateMetric(payoutPaid._count._all, payoutPaid._sum.netPayablePaise),
      },
      recentPayments,
    };
  }

  async listPaymentCollections(query: FinancePaymentCollectionQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const where = this.paymentCollectionWhere(query);
    const items = await this.prisma.client.payment.findMany({
      where,
      include: this.paymentCollectionInclude(),
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    });
    const total = await this.prisma.client.payment.count({ where });

    return {
      items: items.map((payment) => this.toPaymentCollection(payment)),
      total,
      page,
      limit: take,
    };
  }

  async verifyOfflinePayment(
    actor: RequestUser,
    orderNumber: string,
    dto: FinanceOfflinePaymentVerificationDto,
  ) {
    const existing = await this.prisma.client.order.findUnique({
      where: { orderNumber },
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        deliveryDetail: true,
        payments: true,
      },
    });

    if (!existing) {
      throw new NotFoundException("Order not found.");
    }

    const payment = existing.payments.find((item) =>
      offlinePaymentProviders.includes(item.provider as (typeof offlinePaymentProviders)[number]),
    );
    if (!payment) {
      throw new BadRequestException(
        "Only bank transfer or manual payment records can be verified here.",
      );
    }

    if (
      existing.paymentStatus !== PaymentStatus.PENDING ||
      payment.status !== PaymentStatus.PENDING
    ) {
      throw new BadRequestException("Only pending offline payments can be verified or rejected.");
    }

    const isVerified = dto.decision === FinanceOfflinePaymentVerificationDecision.VERIFY;
    const nextStatus = isVerified ? PaymentStatus.PAID : PaymentStatus.FAILED;
    const eventType = isVerified
      ? "finance.offline_payment.verified"
      : "finance.offline_payment.rejected";
    const note =
      dto.note ??
      (isVerified
        ? "Offline payment verified by finance."
        : "Offline payment rejected by finance.");
    const transactionReference =
      dto.transactionReference?.trim() || this.paymentReference(payment.rawResponse) || null;

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const paymentUpdate = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: nextStatus,
          providerPaymentId: transactionReference,
          rawResponse: this.mergePaymentRawResponse(payment.rawResponse, {
            financeVerification: {
              decision: dto.decision,
              note,
              transactionReference,
              verifiedById: actor.id,
              verifiedAt: new Date().toISOString(),
            },
          }),
        },
      });
      if (paymentUpdate.count !== 1) {
        throw new BadRequestException("Payment status changed. Refresh and try again.");
      }

      const orderUpdate = await tx.order.updateMany({
        where: { id: existing.id, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: nextStatus },
      });
      if (orderUpdate.count !== 1) {
        throw new BadRequestException("Order payment status changed. Refresh and try again.");
      }

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType,
          oldStatus: payment.status,
          newStatus: nextStatus,
          payload: {
            orderNumber: existing.orderNumber,
            transactionReference,
            note,
          },
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: existing.id,
          statusType: StatusEventType.PAYMENT,
          oldStatus: existing.paymentStatus,
          newStatus: nextStatus,
          note,
          createdById: actor.id,
        },
      });

      if (isVerified && existing.orderStatus === OrderStatus.DELIVERED) {
        await tx.orderSellerSplit.updateMany({
          where: {
            orderId: existing.id,
            sellerStatus: { not: SellerOrderStatus.CANCELLED },
            payoutId: null,
          },
          data: {
            settlementStatus: SellerSettlementStatus.ELIGIBLE,
            settlementEligibleAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: eventType,
          entityType: "order",
          entityId: existing.id,
          oldValue: {
            paymentStatus: existing.paymentStatus,
            paymentId: payment.id,
            provider: payment.provider,
          },
          newValue: {
            paymentStatus: nextStatus,
            transactionReference,
            note,
          },
        },
      });

      return existing.id;
    });

    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        payments: true,
        deliveryDetail: true,
      },
    });

    if (order) {
      await this.notifications.notifyEvent({
        eventCode: isVerified
          ? EMAIL_TRIGGER_EVENTS.PAYMENT_SUCCESS
          : EMAIL_TRIGGER_EVENTS.PAYMENT_FAILED,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: order.customer.user.email,
        userId: order.customer.userId,
        variables: {
          orderNumber: order.orderNumber,
          paymentStatus: nextStatus,
          note,
        },
      });
    }

    return order;
  }

  async paymentReports(query: FinancePaymentCollectionQueryDto) {
    const where = this.paymentCollectionWhere(query);
    const [byProvider, byPaymentStatus, codByCollectionStatus, bySettlementStatus, byPayoutStatus] =
      await Promise.all([
        this.prisma.client.payment.groupBy({
          by: ["provider"],
          where,
          _count: { _all: true },
          _sum: { amountPaise: true },
        }),
        this.prisma.client.payment.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
          _sum: { amountPaise: true },
        }),
        this.prisma.client.deliveryDetail.groupBy({
          by: ["codCollectionStatus"],
          _count: { _all: true },
          _sum: { codCollectedAmountPaise: true },
        }),
        this.prisma.client.orderSellerSplit.groupBy({
          by: ["settlementStatus"],
          _count: { _all: true },
          _sum: { sellerSubtotalPaise: true },
        }),
        this.prisma.client.sellerPayout.groupBy({
          by: ["status"],
          _count: { _all: true },
          _sum: { netPayablePaise: true },
        }),
      ]);

    return {
      byProvider: byProvider.map((item) =>
        this.groupMetric(item.provider, item._count._all, item._sum.amountPaise),
      ),
      byPaymentStatus: byPaymentStatus.map((item) =>
        this.groupMetric(item.status, item._count._all, item._sum.amountPaise),
      ),
      codByCollectionStatus: codByCollectionStatus.map((item) =>
        this.groupMetric(
          item.codCollectionStatus,
          item._count._all,
          item._sum.codCollectedAmountPaise,
        ),
      ),
      bySettlementStatus: bySettlementStatus.map((item) =>
        this.groupMetric(item.settlementStatus, item._count._all, item._sum.sellerSubtotalPaise),
      ),
      byPayoutStatus: byPayoutStatus.map((item) =>
        this.groupMetric(item.status, item._count._all, item._sum.netPayablePaise),
      ),
    };
  }

  private paymentMetric(where: Prisma.PaymentWhereInput) {
    return this.prisma.client.payment
      .aggregate({
        where,
        _count: { _all: true },
        _sum: { amountPaise: true },
      })
      .then((result) => this.aggregateMetric(result._count._all, result._sum.amountPaise));
  }

  private recentPayments() {
    return this.prisma.client.payment
      .findMany({
        where: {
          provider: {
            in: [
              PaymentProvider.RAZORPAY,
              PaymentProvider.COD,
              PaymentProvider.BANK_TRANSFER,
              PaymentProvider.MANUAL,
            ],
          },
        },
        include: this.paymentCollectionInclude(),
        orderBy: { updatedAt: "desc" },
        take: 8,
      })
      .then((payments) => payments.map((payment) => this.toPaymentCollection(payment)));
  }

  private paymentCollectionWhere(
    query: FinancePaymentCollectionQueryDto,
  ): Prisma.PaymentWhereInput {
    const createdAt: Prisma.DateTimeFilter = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };

    return {
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.paymentStatus ? { status: query.paymentStatus } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(query.search
        ? {
            order: {
              OR: [
                { orderNumber: { contains: query.search, mode: "insensitive" } },
                { customer: { user: { email: { contains: query.search, mode: "insensitive" } } } },
                {
                  customer: { user: { fullName: { contains: query.search, mode: "insensitive" } } },
                },
              ],
            },
          }
        : {}),
    };
  }

  private paymentCollectionInclude() {
    return {
      events: {
        orderBy: { createdAt: "desc" as const },
        take: 5,
      },
      order: {
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          deliveryDetail: {
            include: {
              codCollectedBy: true,
              codVerifiedBy: true,
            },
          },
          sellerSplits: {
            include: {
              seller: true,
            },
          },
        },
      },
    };
  }

  private toPaymentCollection(
    payment: Prisma.PaymentGetPayload<{
      include: ReturnType<FinancePaymentsService["paymentCollectionInclude"]>;
    }>,
  ) {
    return {
      id: payment.id,
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      providerPaymentId: payment.providerPaymentId,
      providerOrderId: payment.providerOrderId,
      customerReference: this.paymentReference(payment.rawResponse),
      bankTransferDetails: this.bankTransferDetails(payment.rawResponse),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      order: {
        id: payment.order.id,
        orderNumber: payment.order.orderNumber,
        orderStatus: payment.order.orderStatus,
        paymentStatus: payment.order.paymentStatus,
        deliveryStatus: payment.order.deliveryStatus,
        totalPaise: payment.order.totalPaise,
        currency: payment.order.currency,
        createdAt: payment.order.createdAt,
        customer: {
          email: payment.order.customer.user.email,
          phone: payment.order.customer.user.phone,
          fullName: payment.order.customer.user.fullName,
        },
        sellers: payment.order.sellerSplits.map((split) => ({
          id: split.sellerId,
          storeName: split.seller.storeName,
          sellerSubtotalPaise: split.sellerSubtotalPaise,
          settlementStatus: split.settlementStatus,
        })),
        deliveryDetail: payment.order.deliveryDetail
          ? {
              status: payment.order.deliveryDetail.status,
              codCollectionStatus: payment.order.deliveryDetail.codCollectionStatus,
              codCollectedAmountPaise: payment.order.deliveryDetail.codCollectedAmountPaise,
              codCollectedAt: payment.order.deliveryDetail.codCollectedAt,
              codCollectionNote: payment.order.deliveryDetail.codCollectionNote,
              codVerifiedAt: payment.order.deliveryDetail.codVerifiedAt,
              codVerificationNote: payment.order.deliveryDetail.codVerificationNote,
              codCollectedBy: payment.order.deliveryDetail.codCollectedBy
                ? {
                    id: payment.order.deliveryDetail.codCollectedBy.id,
                    email: payment.order.deliveryDetail.codCollectedBy.email,
                    fullName: payment.order.deliveryDetail.codCollectedBy.fullName,
                  }
                : null,
              codVerifiedBy: payment.order.deliveryDetail.codVerifiedBy
                ? {
                    id: payment.order.deliveryDetail.codVerifiedBy.id,
                    email: payment.order.deliveryDetail.codVerifiedBy.email,
                    fullName: payment.order.deliveryDetail.codVerifiedBy.fullName,
                  }
                : null,
            }
          : null,
      },
      events: payment.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        createdAt: event.createdAt,
      })),
    };
  }

  private aggregateMetric(count: number, amountPaise: number | null) {
    return {
      count,
      amountPaise: amountPaise ?? 0,
    };
  }

  private groupMetric(label: string, count: number, amountPaise: number | null) {
    return {
      label,
      count,
      amountPaise: amountPaise ?? 0,
    };
  }

  private paymentReference(rawResponse: Prisma.JsonValue | null) {
    const record = this.jsonObject(rawResponse);
    const reference = record?.customerReference ?? record?.transactionReference;

    return typeof reference === "string" && reference.trim() ? reference.trim() : null;
  }

  private bankTransferDetails(rawResponse: Prisma.JsonValue | null) {
    const record = this.jsonObject(rawResponse);
    const details = this.jsonObject(record?.bankTransferDetails);

    return details ?? null;
  }

  private mergePaymentRawResponse(
    rawResponse: Prisma.JsonValue | null,
    extra: Prisma.InputJsonObject,
  ) {
    const existing = this.jsonObject(rawResponse);

    return {
      ...(existing ?? {}),
      ...extra,
    } as Prisma.InputJsonObject;
  }

  private jsonObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
