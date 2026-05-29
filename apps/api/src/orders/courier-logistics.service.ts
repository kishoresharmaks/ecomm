import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CodCollectionSource,
  CodCollectionStatus,
  CourierCodRemittanceStatus,
  CourierShipmentStatus,
  CourierWebhookEventStatus,
  DeliveryMode,
  DeliveryStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SellerOrderStatus,
  SellerSettlementStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import {
  BookCourierShipmentDto,
  CourierCodRemittanceQueryDto,
  CourierShipmentQueryDto,
  UpdateCourierTrackingDto,
  UpsertCourierCodRemittanceDto,
  VerifyCourierCodRemittanceDto,
} from "./dto/courier-logistics.dto";

type CourierProviderSnapshot = {
  webhookSecret?: string | null;
};

const deliveryStatusRank = {
  [DeliveryStatus.NOT_ASSIGNED]: 0,
  [DeliveryStatus.PENDING]: 1,
  [DeliveryStatus.PACKED]: 2,
  [DeliveryStatus.DISPATCHED]: 3,
  [DeliveryStatus.IN_TRANSIT]: 4,
  [DeliveryStatus.DELIVERED]: 5,
  [DeliveryStatus.CANCELLED]: 6,
} satisfies Record<DeliveryStatus, number>;

@Injectable()
export class CourierLogisticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCourierShipments(query: CourierShipmentQueryDto) {
    const take = Math.min(query.limit ?? 50, 100);
    const where: Prisma.CourierShipmentWhereInput = {
      ...(query.providerCode ? { providerCode: query.providerCode.trim().toUpperCase() } : {}),
      ...(query.trackingStatus ? { trackingStatus: query.trackingStatus } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { awbNumber: { contains: query.search.trim(), mode: "insensitive" } },
              { providerOrderId: { contains: query.search.trim(), mode: "insensitive" } },
              { orderShipment: { shipmentNumber: { contains: query.search.trim(), mode: "insensitive" } } },
              { order: { orderNumber: { contains: query.search.trim(), mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.courierShipment.findMany({
        where,
        include: this.courierShipmentInclude(),
        orderBy: [{ updatedAt: "desc" }],
        take,
      }),
      this.prisma.client.courierShipment.count({ where }),
    ]);

    return { items: items.map((item) => this.courierShipmentReadback(item)), total };
  }

  async bookShipment(actor: RequestUser, shipmentNumber: string, dto: BookCourierShipmentDto) {
    const providerCode = dto.providerCode.trim().toUpperCase();
    const orderShipment = await this.prisma.client.orderShipment.findUnique({
      where: { shipmentNumber },
      include: {
        order: { include: { payments: true, shipments: true } },
        seller: true,
        courierShipment: true,
        courierCodRemittance: true,
      },
    });
    if (!orderShipment) {
      throw new NotFoundException("Seller package not found.");
    }
    if (orderShipment.deliveryMode !== DeliveryMode.THIRD_PARTY_COURIER) {
      throw new BadRequestException("Courier booking is only available for third-party courier packages.");
    }

    const provider = await this.prisma.client.courierProviderSetting.findUnique({
      where: { providerCode },
    });
    if (!provider?.isActive) {
      throw new BadRequestException("Courier provider is not active for routing.");
    }

    const status = dto.awbNumber ? CourierShipmentStatus.BOOKED : CourierShipmentStatus.NOT_BOOKED;
    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const courierShipment = await tx.courierShipment.upsert({
        where: { orderShipmentId: orderShipment.id },
        update: {
          providerCode,
          providerOrderId: dto.providerOrderId?.trim() || null,
          awbNumber: dto.awbNumber?.trim() || null,
          trackingStatus: status,
          trackingStatusLabel: dto.note ?? (dto.awbNumber ? "Shipment booked." : "Awaiting provider booking."),
          trackingUrl: dto.trackingUrl?.trim() || null,
          labelUrl: dto.labelUrl?.trim() || null,
          bookingAttemptCount: { increment: 1 },
          bookingError: null,
          bookedAt: dto.awbNumber ? new Date() : null,
          bookingPayloadSnapshot: {
            source: "ADMIN_PROVIDER_READY",
            providerCode,
            shipmentNumber,
            note: dto.note ?? null,
          },
          bookingResponseSnapshot: {
            awbNumber: dto.awbNumber?.trim() || null,
            providerOrderId: dto.providerOrderId?.trim() || null,
            labelUrl: dto.labelUrl?.trim() || null,
          },
        },
        create: {
          orderShipmentId: orderShipment.id,
          orderId: orderShipment.orderId,
          sellerId: orderShipment.sellerId,
          providerCode,
          providerOrderId: dto.providerOrderId?.trim() || null,
          awbNumber: dto.awbNumber?.trim() || null,
          trackingStatus: status,
          trackingStatusLabel: dto.note ?? (dto.awbNumber ? "Shipment booked." : "Awaiting provider booking."),
          trackingUrl: dto.trackingUrl?.trim() || null,
          labelUrl: dto.labelUrl?.trim() || null,
          bookingAttemptCount: 1,
          bookedAt: dto.awbNumber ? new Date() : null,
          bookingPayloadSnapshot: {
            source: "ADMIN_PROVIDER_READY",
            providerCode,
            shipmentNumber,
            note: dto.note ?? null,
          },
          bookingResponseSnapshot: {
            awbNumber: dto.awbNumber?.trim() || null,
            providerOrderId: dto.providerOrderId?.trim() || null,
            labelUrl: dto.labelUrl?.trim() || null,
          },
        },
      });

      await tx.orderShipment.update({
        where: { id: orderShipment.id },
        data: {
          deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
          courierProviderCode: providerCode,
          awbNumber: dto.awbNumber?.trim() || null,
          courierTrackingStatus: status,
          labelUrl: dto.labelUrl?.trim() || null,
          trackingReference: dto.awbNumber?.trim() || orderShipment.trackingReference,
          codCollectionSource: this.hasCodPayment(orderShipment.order.payments)
            ? CodCollectionSource.THIRD_PARTY_COURIER
            : orderShipment.codCollectionSource,
        },
      });

      await this.ensureCourierCodRemittance(tx, orderShipment.id, courierShipment.id, providerCode);
      await this.syncOrderLevelCourierFields(tx, orderShipment.orderId);
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "courier.shipment.booked",
          entityType: "order_shipment",
          entityId: orderShipment.id,
          newValue: {
            providerCode,
            shipmentNumber,
            awbNumber: dto.awbNumber?.trim() || null,
            providerOrderId: dto.providerOrderId?.trim() || null,
          },
        },
      });
      return orderShipment.orderId;
    });

    return this.getOrderCourierSummary(orderId);
  }

  async updateTracking(actor: RequestUser, courierShipmentId: string, dto: UpdateCourierTrackingDto) {
    const courierShipment = await this.prisma.client.courierShipment.findUnique({
      where: { id: courierShipmentId },
      include: this.courierShipmentInclude(),
    });
    if (!courierShipment) {
      throw new NotFoundException("Courier shipment not found.");
    }

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      await this.applyCourierTracking(tx, {
        courierShipmentId,
        providerCode: courierShipment.providerCode,
        awbNumber: courierShipment.awbNumber,
        trackingStatus: dto.trackingStatus,
        statusLabel: dto.trackingStatusLabel ?? dto.note ?? null,
        eventId: null,
        payload: { source: "ADMIN_MANUAL", note: dto.note ?? null },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "courier.shipment.tracking_updated",
          entityType: "courier_shipment",
          entityId: courierShipmentId,
          oldValue: { trackingStatus: courierShipment.trackingStatus },
          newValue: { trackingStatus: dto.trackingStatus, note: dto.note ?? null },
        },
      });
      return courierShipment.orderId;
    });

    return this.getOrderCourierSummary(orderId);
  }

  async handleTrackingWebhook(
    providerCodeParam: string,
    payload: unknown,
    signature?: string,
    rawBody?: Buffer,
  ) {
    const providerCode = providerCodeParam.trim().toUpperCase();
    const provider = await this.prisma.client.courierProviderSetting.findUnique({
      where: { providerCode },
    });
    if (!provider?.isActive) {
      throw new NotFoundException("Courier provider not found.");
    }
    this.verifyWebhookSignature(provider, payload, signature, rawBody);

    const eventId = this.payloadText(payload, ["eventId", "event_id", "webhookId", "id"]) ??
      this.fallbackWebhookEventId(providerCode, payload);
    const awbNumber = this.payloadText(payload, ["awbNumber", "awb_number", "awb", "trackingNumber"]);
    const providerOrderId = this.payloadText(payload, ["providerOrderId", "orderId", "shipmentId"]);
    const statusText = this.payloadText(payload, ["status", "trackingStatus", "shipmentStatus"]);
    const trackingStatus = this.mapCourierStatus(statusText);
    const existingEvent = await this.prisma.client.courierWebhookEvent.findUnique({
      where: { providerCode_providerEventId: { providerCode, providerEventId: eventId } },
      select: { id: true },
    });

    if (existingEvent) {
      return { status: "SKIPPED", reason: "Duplicate webhook event." };
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      try {
        const event = await tx.courierWebhookEvent.create({
          data: {
            providerCode,
            providerEventId: eventId,
            awbNumber,
            status: CourierWebhookEventStatus.RECEIVED,
            payload: this.inputJson(payload),
          },
        });

        const lookupClauses = [
          ...(awbNumber ? [{ awbNumber }] : []),
          ...(providerOrderId ? [{ providerOrderId }] : []),
        ];
        const courierShipment = lookupClauses.length
          ? await tx.courierShipment.findFirst({
              where: {
                providerCode,
                OR: lookupClauses,
              },
            })
          : null;
        if (!courierShipment) {
          await tx.courierWebhookEvent.update({
            where: { id: event.id },
            data: {
              status: CourierWebhookEventStatus.SKIPPED,
              processedAt: new Date(),
              failureReason: "No matching courier shipment found.",
            },
          });
          return { status: "SKIPPED", reason: "No matching courier shipment found." };
        }

        await this.applyCourierTracking(tx, {
          courierShipmentId: courierShipment.id,
          providerCode,
          awbNumber,
          trackingStatus,
          statusLabel: statusText,
          eventId: event.id,
          payload,
        });
        await tx.courierWebhookEvent.update({
          where: { id: event.id },
          data: {
            orderShipmentId: courierShipment.orderShipmentId,
            status: CourierWebhookEventStatus.PROCESSED,
            processedAt: new Date(),
          },
        });
        return { status: "PROCESSED", courierShipmentId: courierShipment.id };
      } catch (error) {
        if (this.isUniqueConstraint(error)) {
          return { status: "SKIPPED", reason: "Duplicate webhook event." };
        }
        throw error;
      }
    });

    return result;
  }

  async listCourierCodRemittances(query: CourierCodRemittanceQueryDto) {
    const take = Math.min(query.limit ?? 50, 100);
    const where: Prisma.CourierCodRemittanceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.providerCode ? { providerCode: query.providerCode.trim().toUpperCase() } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { awbNumber: { contains: query.search.trim(), mode: "insensitive" } },
              { remittanceReference: { contains: query.search.trim(), mode: "insensitive" } },
              { reportReference: { contains: query.search.trim(), mode: "insensitive" } },
              { orderShipment: { shipmentNumber: { contains: query.search.trim(), mode: "insensitive" } } },
              { order: { orderNumber: { contains: query.search.trim(), mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.courierCodRemittance.findMany({
        where,
        include: this.courierCodRemittanceInclude(),
        orderBy: [{ updatedAt: "desc" }],
        take,
      }),
      this.prisma.client.courierCodRemittance.count({ where }),
    ]);

    return { items: items.map((item) => this.courierCodRemittanceReadback(item)), total };
  }

  async upsertCourierCodRemittance(actor: RequestUser, dto: UpsertCourierCodRemittanceDto) {
    const target = await this.findRemittanceTarget(dto);
    const status =
      dto.remittedAmountPaise > 0
        ? CourierCodRemittanceStatus.REMITTED
        : CourierCodRemittanceStatus.COURIER_COLLECTED;
    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const remittance = await tx.courierCodRemittance.upsert({
        where: { orderShipmentId: target.orderShipment.id },
        update: {
          courierShipmentId: target.courierShipment?.id ?? null,
          providerCode: target.providerCode,
          awbNumber: dto.awbNumber?.trim() || target.courierShipment?.awbNumber || null,
          expectedAmountPaise: target.expectedAmountPaise,
          collectedAmountPaise: dto.collectedAmountPaise ?? dto.remittedAmountPaise,
          remittedAmountPaise: dto.remittedAmountPaise,
          remittanceDate: dto.remittanceDate ? new Date(dto.remittanceDate) : null,
          remittanceReference: dto.remittanceReference?.trim() || null,
          reportReference: dto.reportReference?.trim() || null,
          status,
          notes: dto.notes ?? null,
        },
        create: {
          courierShipmentId: target.courierShipment?.id ?? null,
          orderShipmentId: target.orderShipment.id,
          orderId: target.orderShipment.orderId,
          sellerId: target.orderShipment.sellerId,
          providerCode: target.providerCode,
          awbNumber: dto.awbNumber?.trim() || target.courierShipment?.awbNumber || null,
          expectedAmountPaise: target.expectedAmountPaise,
          collectedAmountPaise: dto.collectedAmountPaise ?? dto.remittedAmountPaise,
          remittedAmountPaise: dto.remittedAmountPaise,
          remittanceDate: dto.remittanceDate ? new Date(dto.remittanceDate) : null,
          remittanceReference: dto.remittanceReference?.trim() || null,
          reportReference: dto.reportReference?.trim() || null,
          status,
          notes: dto.notes ?? null,
        },
      });
      await tx.orderShipment.update({
        where: { id: target.orderShipment.id },
        data: {
          codCollectionSource: CodCollectionSource.THIRD_PARTY_COURIER,
          codCollectionStatus: CodCollectionStatus.COLLECTED,
          codCollectedAmountPaise: remittance.collectedAmountPaise ?? remittance.remittedAmountPaise,
          codCollectedAt: remittance.remittanceDate ?? new Date(),
          codCollectionNote: dto.notes ?? "Courier COD remittance imported.",
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "courier.cod_remittance.imported",
          entityType: "courier_cod_remittance",
          entityId: remittance.id,
          newValue: {
            shipmentNumber: target.orderShipment.shipmentNumber,
            providerCode: target.providerCode,
            remittedAmountPaise: dto.remittedAmountPaise,
            remittanceReference: dto.remittanceReference ?? null,
          },
        },
      });
      return target.orderShipment.orderId;
    });

    return this.getOrderCourierSummary(orderId);
  }

  async verifyCourierCodRemittance(
    actor: RequestUser,
    remittanceId: string,
    dto: VerifyCourierCodRemittanceDto,
  ) {
    const remittance = await this.prisma.client.courierCodRemittance.findUnique({
      where: { id: remittanceId },
      include: this.courierCodRemittanceInclude(),
    });
    if (!remittance) {
      throw new NotFoundException("Courier COD remittance not found.");
    }
    if (dto.decision === "VERIFY" && (remittance.remittedAmountPaise ?? 0) !== remittance.expectedAmountPaise) {
      throw new BadRequestException("Courier remittance amount does not match expected COD amount.");
    }

    const orderId = await this.prisma.client.$transaction(async (tx) => {
      const nextStatus =
        dto.decision === "VERIFY"
          ? CourierCodRemittanceStatus.VERIFIED
          : dto.decision === "DISPUTE"
            ? CourierCodRemittanceStatus.DISPUTED
            : CourierCodRemittanceStatus.REJECTED;
      const updated = await tx.courierCodRemittance.update({
        where: { id: remittance.id },
        data: {
          status: nextStatus,
          verifiedAt: new Date(),
          verifiedById: actor.id,
          verificationNote: dto.note ?? null,
        },
      });
      await tx.orderShipment.update({
        where: { id: remittance.orderShipmentId },
        data: {
          codCollectionSource: CodCollectionSource.THIRD_PARTY_COURIER,
          codCollectionStatus:
            nextStatus === CourierCodRemittanceStatus.VERIFIED
              ? CodCollectionStatus.VERIFIED
              : CodCollectionStatus.REJECTED,
          codVerifiedAt: nextStatus === CourierCodRemittanceStatus.VERIFIED ? new Date() : null,
          codVerifiedById: nextStatus === CourierCodRemittanceStatus.VERIFIED ? actor.id : null,
          codVerificationNote: dto.note ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "courier.cod_remittance.verified",
          entityType: "courier_cod_remittance",
          entityId: remittance.id,
          oldValue: { status: remittance.status },
          newValue: { status: updated.status, note: dto.note ?? null },
        },
      });
      if (nextStatus === CourierCodRemittanceStatus.VERIFIED) {
        await this.reconcileCodPayment(tx, remittance.orderId, actor, dto.note);
      }
      return remittance.orderId;
    });

    return this.getOrderCourierSummary(orderId);
  }

  private async applyCourierTracking(
    tx: Prisma.TransactionClient,
    input: {
      courierShipmentId: string;
      providerCode: string;
      awbNumber: string | null;
      trackingStatus: CourierShipmentStatus;
      statusLabel?: string | null;
      eventId: string | null;
      payload: unknown;
    },
  ) {
    const courierShipment = await tx.courierShipment.findUniqueOrThrow({
      where: { id: input.courierShipmentId },
    });
    const orderShipment = await tx.orderShipment.findUniqueOrThrow({
      where: { id: courierShipment.orderShipmentId },
    });
    const payments = await tx.payment.findMany({
      where: { orderId: courierShipment.orderId },
    });
    await tx.courierShipment.update({
      where: { id: input.courierShipmentId },
      data: {
        trackingStatus: input.trackingStatus,
        trackingStatusLabel: input.statusLabel ?? null,
        lastWebhookEventId: input.eventId,
        lastWebhookAt: input.eventId ? new Date() : courierShipment.lastWebhookAt,
        lastTrackedAt: new Date(),
      },
    });

    const nextDeliveryStatus = this.deliveryStatusFromCourierStatus(input.trackingStatus);
    if (nextDeliveryStatus) {
      const currentStatus = orderShipment.status;
      const packageStatus =
        deliveryStatusRank[nextDeliveryStatus] > deliveryStatusRank[currentStatus]
          ? nextDeliveryStatus
          : currentStatus;
      await tx.orderShipment.update({
        where: { id: courierShipment.orderShipmentId },
        data: {
          courierTrackingStatus: input.trackingStatus,
          status: packageStatus,
          awbNumber: input.awbNumber ?? courierShipment.awbNumber,
          codCollectionSource: this.hasCodPayment(payments)
            ? CodCollectionSource.THIRD_PARTY_COURIER
            : orderShipment.codCollectionSource,
        },
      });
      if (packageStatus !== currentStatus) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: courierShipment.orderId,
            statusType: "DELIVERY",
            oldStatus: currentStatus,
            newStatus: packageStatus,
            note: input.statusLabel ?? `Courier status ${input.trackingStatus}.`,
          },
        });
      }
    }

    if (input.trackingStatus === CourierShipmentStatus.DELIVERED) {
      await this.ensureCourierCodRemittance(
        tx,
        courierShipment.orderShipmentId,
        courierShipment.id,
        input.providerCode,
        CourierCodRemittanceStatus.COURIER_COLLECTED,
      );
    }
    await this.recalculateOrderDeliveryRollup(tx, courierShipment.orderId);
  }

  private async ensureCourierCodRemittance(
    tx: Prisma.TransactionClient,
    orderShipmentId: string,
    courierShipmentId: string | null,
    providerCode: string,
    status: CourierCodRemittanceStatus = CourierCodRemittanceStatus.PENDING,
  ) {
    const orderShipment = await tx.orderShipment.findUniqueOrThrow({
      where: { id: orderShipmentId },
    });
    const payments = await tx.payment.findMany({
      where: { orderId: orderShipment.orderId },
    });
    if (!this.hasCodPayment(payments)) {
      return null;
    }
    const shipments = await tx.orderShipment.findMany({
      where: { orderId: orderShipment.orderId },
    });
    const courierShipment = courierShipmentId
      ? await tx.courierShipment.findUnique({ where: { id: courierShipmentId } })
      : await tx.courierShipment.findUnique({ where: { orderShipmentId } });
    const expectedAmountPaise = this.expectedPackageCodAmountPaise({ payments, shipments }, orderShipment);
    if (status === CourierCodRemittanceStatus.COURIER_COLLECTED) {
      await tx.orderShipment.update({
        where: { id: orderShipmentId },
        data: {
          codCollectionSource: CodCollectionSource.THIRD_PARTY_COURIER,
          codCollectionStatus: CodCollectionStatus.COLLECTED,
          codCollectedAmountPaise: expectedAmountPaise,
          codCollectedAt: new Date(),
          codCollectionNote: "Courier marked shipment delivered; waiting for COD remittance verification.",
        },
      });
    }
    return tx.courierCodRemittance.upsert({
      where: { orderShipmentId },
      update: {
        courierShipmentId,
        providerCode,
        awbNumber: courierShipment?.awbNumber ?? orderShipment.awbNumber,
        expectedAmountPaise,
        ...(status !== CourierCodRemittanceStatus.PENDING ? { status } : {}),
        ...(status === CourierCodRemittanceStatus.COURIER_COLLECTED
          ? {
              collectedAmountPaise: expectedAmountPaise,
              notes: "Courier marked shipment delivered; waiting for remittance report.",
            }
          : {}),
      },
      create: {
        courierShipmentId,
        orderShipmentId,
        orderId: orderShipment.orderId,
        sellerId: orderShipment.sellerId,
        providerCode,
        awbNumber: courierShipment?.awbNumber ?? orderShipment.awbNumber,
        expectedAmountPaise,
        status,
        collectedAmountPaise:
          status === CourierCodRemittanceStatus.COURIER_COLLECTED ? expectedAmountPaise : null,
        notes:
          status === CourierCodRemittanceStatus.COURIER_COLLECTED
            ? "Courier marked shipment delivered; waiting for remittance report."
            : null,
      },
    });
  }

  private async reconcileCodPayment(
    tx: Prisma.TransactionClient,
    orderId: string,
    actor: RequestUser,
    note?: string,
  ) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const payments = await tx.payment.findMany({
      where: { orderId },
    });
    const deliveryDetail = await tx.deliveryDetail.findUnique({
      where: { orderId },
    });
    const courierCodRemittances = await tx.courierCodRemittance.findMany({
      where: { orderId },
    });
    const codPayment = payments.find(
      (payment) => payment.provider === PaymentProvider.COD || payment.method === "COD",
    );
    if (!codPayment || codPayment.status !== PaymentStatus.PENDING) {
      return;
    }

    const verifiedCourierAmount = courierCodRemittances
      .filter((remittance) => remittance.status === CourierCodRemittanceStatus.VERIFIED)
      .reduce((total, remittance) => total + (remittance.remittedAmountPaise ?? 0), 0);
    const verifiedLocalAmount =
      deliveryDetail?.codCollectionStatus === CodCollectionStatus.VERIFIED
        ? deliveryDetail.codCollectedAmountPaise ?? 0
        : 0;
    if (verifiedCourierAmount + verifiedLocalAmount < codPayment.amountPaise) {
      return;
    }

    const paymentUpdate = await tx.payment.updateMany({
      where: { id: codPayment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PAID },
    });
    if (paymentUpdate.count !== 1) {
      return;
    }
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: PaymentStatus.PAID },
    });
    await tx.paymentEvent.create({
      data: {
        paymentId: codPayment.id,
        eventType: "cod.courier_remittance.verified",
        oldStatus: PaymentStatus.PENDING,
        newStatus: PaymentStatus.PAID,
        payload: {
          orderId,
          verifiedCourierAmount,
          verifiedLocalAmount,
          note: note ?? null,
        },
      },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        statusType: "PAYMENT",
        oldStatus: PaymentStatus.PENDING,
        newStatus: PaymentStatus.PAID,
        note: note ?? "COD payment verified from courier remittance.",
        createdById: actor.id,
      },
    });
    if (order.orderStatus === OrderStatus.DELIVERED) {
      await tx.orderSellerSplit.updateMany({
        where: {
          orderId,
          sellerStatus: { not: SellerOrderStatus.CANCELLED },
          payoutId: null,
        },
        data: {
          settlementStatus: SellerSettlementStatus.ELIGIBLE,
          settlementEligibleAt: new Date(),
        },
      });
    }
  }

  private async recalculateOrderDeliveryRollup(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const shipments = await tx.orderShipment.findMany({
      where: { orderId },
    });
    const activeShipments = shipments.filter(
      (shipment) => shipment.status !== DeliveryStatus.CANCELLED,
    );
    if (activeShipments.length === 0) {
      return;
    }
    const nextDeliveryStatus = this.rollupDeliveryStatus(activeShipments.map((shipment) => shipment.status));
    const nextOrderStatus = this.orderStatusFromDeliveryStatus(order.orderStatus, nextDeliveryStatus);
    await tx.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: nextDeliveryStatus,
        ...(nextOrderStatus !== order.orderStatus ? { orderStatus: nextOrderStatus } : {}),
      },
    });
    await tx.deliveryDetail.upsert({
      where: { orderId },
      update: {
        status: nextDeliveryStatus,
        courierTrackingStatus: this.courierRollupStatus(shipments.map((shipment) => shipment.courierTrackingStatus)),
      },
      create: {
        orderId,
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        status: nextDeliveryStatus,
        courierTrackingStatus: this.courierRollupStatus(shipments.map((shipment) => shipment.courierTrackingStatus)),
      },
    });
  }

  private async syncOrderLevelCourierFields(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const shipments = await tx.orderShipment.findMany({
      where: { orderId },
    });
    const courierShipments = shipments.filter(
      (shipment) => shipment.deliveryMode === DeliveryMode.THIRD_PARTY_COURIER,
    );
    const singleCourierShipment = courierShipments.length === 1 ? courierShipments[0] : null;
    await tx.deliveryDetail.upsert({
      where: { orderId },
      update: {
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        courierProviderCode: singleCourierShipment?.courierProviderCode ?? null,
        awbNumber: singleCourierShipment?.awbNumber ?? null,
        courierTrackingStatus: this.courierRollupStatus(courierShipments.map((shipment) => shipment.courierTrackingStatus)),
        labelUrl: singleCourierShipment?.labelUrl ?? null,
        trackingReference: singleCourierShipment?.trackingReference ?? null,
      },
      create: {
        orderId,
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        status: order.deliveryStatus,
        courierProviderCode: singleCourierShipment?.courierProviderCode ?? null,
        awbNumber: singleCourierShipment?.awbNumber ?? null,
        courierTrackingStatus: this.courierRollupStatus(courierShipments.map((shipment) => shipment.courierTrackingStatus)),
        labelUrl: singleCourierShipment?.labelUrl ?? null,
        trackingReference: singleCourierShipment?.trackingReference ?? null,
      },
    });
  }

  private async findRemittanceTarget(dto: UpsertCourierCodRemittanceDto) {
    const courierShipment = dto.courierShipmentId || dto.awbNumber
      ? await this.prisma.client.courierShipment.findFirst({
          where: {
            OR: [
              ...(dto.courierShipmentId ? [{ id: dto.courierShipmentId }] : []),
              ...(dto.awbNumber ? [{ awbNumber: dto.awbNumber.trim() }] : []),
            ],
          },
          include: { orderShipment: { include: { order: { include: { payments: true, shipments: true } } } } },
        })
      : null;
    const orderShipment = courierShipment?.orderShipment ??
      (dto.shipmentNumber
        ? await this.prisma.client.orderShipment.findUnique({
            where: { shipmentNumber: dto.shipmentNumber },
            include: { order: { include: { payments: true, shipments: true } } },
          })
        : null);
    if (!orderShipment) {
      throw new NotFoundException("Courier remittance package was not found.");
    }
    if (!this.hasCodPayment(orderShipment.order.payments)) {
      throw new BadRequestException("This package does not belong to a COD order.");
    }
    const providerCode = courierShipment?.providerCode ?? orderShipment.courierProviderCode;
    if (!providerCode) {
      throw new BadRequestException(
        "Book this package with an active courier provider before recording COD remittance.",
      );
    }
    return {
      courierShipment,
      orderShipment,
      providerCode,
      expectedAmountPaise: this.expectedPackageCodAmountPaise(orderShipment.order, orderShipment),
    };
  }

  private expectedPackageCodAmountPaise(
    order: { payments: Array<{ provider: PaymentProvider; method: string | null; amountPaise: number }>; shipments: Array<{ id: string; subtotalPaise: number; shippingPaise: number; codSurchargePaise: number }> },
    orderShipment: { id: string; subtotalPaise: number; shippingPaise: number; codSurchargePaise: number },
  ) {
    const codPayment = order.payments.find(
      (payment) => payment.provider === PaymentProvider.COD || payment.method === "COD",
    );
    if (!codPayment) {
      return 0;
    }
    const shipments = [...order.shipments].sort((left, right) => left.id.localeCompare(right.id));
    if (shipments.length <= 1) {
      return codPayment.amountPaise;
    }
    const bases = shipments.map((shipment) => ({
      id: shipment.id,
      basis: shipment.subtotalPaise + shipment.shippingPaise + shipment.codSurchargePaise,
    }));
    const totalBasis = bases.reduce((total, item) => total + item.basis, 0);
    if (totalBasis <= 0) {
      const baseShare = Math.floor(codPayment.amountPaise / shipments.length);
      const remainder = codPayment.amountPaise - baseShare * shipments.length;
      const index = shipments.findIndex((shipment) => shipment.id === orderShipment.id);
      return baseShare + (index >= 0 && index < remainder ? 1 : 0);
    }
    let assignedPaise = 0;
    for (const item of bases) {
      if (item.id === bases[bases.length - 1]?.id) {
        return item.id === orderShipment.id ? codPayment.amountPaise - assignedPaise : 0;
      }
      const share = Math.floor((codPayment.amountPaise * item.basis) / totalBasis);
      if (item.id === orderShipment.id) {
        return share;
      }
      assignedPaise += share;
    }
    return 0;
  }

  private verifyWebhookSignature(
    provider: { webhookSecretConfigured: boolean; settingsSnapshot: Prisma.JsonValue | null },
    payload: unknown,
    signature?: string,
    rawBody?: Buffer,
  ) {
    if (!provider.webhookSecretConfigured) {
      return;
    }
    const snapshot = this.providerSnapshot(provider.settingsSnapshot);
    const secret = snapshot.webhookSecret?.trim();
    if (!secret) {
      throw new UnauthorizedException("Courier webhook secret is not configured.");
    }
    const expected = createHmac("sha256", secret)
      .update(rawBody?.length ? rawBody : this.stableStringify(payload))
      .digest("hex");
    const received = signature?.trim() ?? "";
    if (!received || !this.safeEqual(expected, received)) {
      throw new UnauthorizedException("Invalid courier webhook signature.");
    }
  }

  private providerSnapshot(value: Prisma.JsonValue | null): CourierProviderSnapshot {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as CourierProviderSnapshot)
      : {};
  }

  private mapCourierStatus(status?: string | null) {
    const normalized = status?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
    if (["BOOKED", "MANIFESTED", "SHIPMENT_BOOKED"].includes(normalized)) {
      return CourierShipmentStatus.BOOKED;
    }
    if (["PICKED", "PICKED_UP", "PICKUP_DONE", "HANDOVER_DONE"].includes(normalized)) {
      return CourierShipmentStatus.PICKED_UP;
    }
    if (["IN_TRANSIT", "TRANSIT", "SHIPPED"].includes(normalized)) {
      return CourierShipmentStatus.IN_TRANSIT;
    }
    if (["OUT_FOR_DELIVERY", "OFD"].includes(normalized)) {
      return CourierShipmentStatus.OUT_FOR_DELIVERY;
    }
    if (["DELIVERED", "DELIVERY_DONE"].includes(normalized)) {
      return CourierShipmentStatus.DELIVERED;
    }
    if (["FAILED", "DELIVERY_FAILED", "RTO", "RETURNED", "EXCEPTION"].includes(normalized)) {
      return CourierShipmentStatus.FAILED;
    }
    if (["CANCELLED", "CANCELED"].includes(normalized)) {
      return CourierShipmentStatus.CANCELLED;
    }
    return CourierShipmentStatus.IN_TRANSIT;
  }

  private deliveryStatusFromCourierStatus(status: CourierShipmentStatus) {
    switch (status) {
      case CourierShipmentStatus.BOOKED:
        return DeliveryStatus.PACKED;
      case CourierShipmentStatus.PICKED_UP:
        return DeliveryStatus.DISPATCHED;
      case CourierShipmentStatus.IN_TRANSIT:
      case CourierShipmentStatus.OUT_FOR_DELIVERY:
        return DeliveryStatus.IN_TRANSIT;
      case CourierShipmentStatus.DELIVERED:
        return DeliveryStatus.DELIVERED;
      case CourierShipmentStatus.CANCELLED:
        return DeliveryStatus.CANCELLED;
      default:
        return null;
    }
  }

  private rollupDeliveryStatus(statuses: DeliveryStatus[]) {
    if (statuses.every((status) => status === DeliveryStatus.DELIVERED)) {
      return DeliveryStatus.DELIVERED;
    }
    if (statuses.some((status) => status === DeliveryStatus.IN_TRANSIT)) {
      return DeliveryStatus.IN_TRANSIT;
    }
    if (statuses.some((status) => status === DeliveryStatus.DISPATCHED)) {
      return DeliveryStatus.DISPATCHED;
    }
    if (statuses.some((status) => status === DeliveryStatus.PACKED)) {
      return DeliveryStatus.PACKED;
    }
    return DeliveryStatus.PENDING;
  }

  private courierRollupStatus(statuses: CourierShipmentStatus[]) {
    if (statuses.some((status) => status === CourierShipmentStatus.OUT_FOR_DELIVERY)) {
      return CourierShipmentStatus.OUT_FOR_DELIVERY;
    }
    if (statuses.some((status) => status === CourierShipmentStatus.IN_TRANSIT)) {
      return CourierShipmentStatus.IN_TRANSIT;
    }
    if (statuses.some((status) => status === CourierShipmentStatus.PICKED_UP)) {
      return CourierShipmentStatus.PICKED_UP;
    }
    if (statuses.every((status) => status === CourierShipmentStatus.DELIVERED)) {
      return CourierShipmentStatus.DELIVERED;
    }
    if (statuses.some((status) => status === CourierShipmentStatus.BOOKED)) {
      return CourierShipmentStatus.BOOKED;
    }
    return CourierShipmentStatus.NOT_BOOKED;
  }

  private orderStatusFromDeliveryStatus(current: OrderStatus, deliveryStatus: DeliveryStatus) {
    if (current === OrderStatus.CANCELLED) {
      return current;
    }
    if (deliveryStatus === DeliveryStatus.DELIVERED) {
      return OrderStatus.DELIVERED;
    }
    if (deliveryStatus === DeliveryStatus.DISPATCHED || deliveryStatus === DeliveryStatus.IN_TRANSIT) {
      return OrderStatus.SHIPPED;
    }
    if (deliveryStatus === DeliveryStatus.PACKED) {
      return OrderStatus.PROCESSING;
    }
    return current;
  }

  private hasCodPayment(payments: Array<{ provider: PaymentProvider; method: string | null }>) {
    return payments.some((payment) => payment.provider === PaymentProvider.COD || payment.method === "COD");
  }

  private courierShipmentInclude() {
    return {
      orderShipment: { include: { seller: true, order: true, courierCodRemittance: true } },
      order: true,
      seller: true,
      codRemittance: true,
    } satisfies Prisma.CourierShipmentInclude;
  }

  private courierCodRemittanceInclude() {
    return {
      courierShipment: true,
      orderShipment: { include: { seller: true } },
      order: true,
      seller: true,
      verifiedBy: true,
    } satisfies Prisma.CourierCodRemittanceInclude;
  }

  private async getOrderCourierSummary(orderId: string) {
    const order = await this.prisma.client.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        shipments: {
          include: {
            seller: true,
            courierShipment: true,
            courierCodRemittance: true,
          },
          orderBy: { createdAt: "asc" },
        },
        courierCodRemittances: {
          include: this.courierCodRemittanceInclude(),
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      shipments: order.shipments.map((shipment) => ({
        ...shipment,
        courierShipment: shipment.courierShipment,
        courierCodRemittance: shipment.courierCodRemittance,
      })),
      courierCodRemittances: order.courierCodRemittances.map((item) =>
        this.courierCodRemittanceReadback(item),
      ),
    };
  }

  private courierShipmentReadback(
    shipment: Prisma.CourierShipmentGetPayload<{ include: ReturnType<CourierLogisticsService["courierShipmentInclude"]> }>,
  ) {
    return shipment;
  }

  private courierCodRemittanceReadback(
    item: Prisma.CourierCodRemittanceGetPayload<{ include: ReturnType<CourierLogisticsService["courierCodRemittanceInclude"]> }>,
  ) {
    return item;
  }

  private payloadText(payload: unknown, keys: string[]) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number") {
        return String(value);
      }
    }
    return null;
  }

  private fallbackWebhookEventId(providerCode: string, payload: unknown) {
    return createHmac("sha256", providerCode)
      .update(this.stableStringify(payload))
      .digest("hex");
  }

  private inputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private stableStringify(value: unknown) {
    return JSON.stringify(value, Object.keys((value as Record<string, unknown>) ?? {}).sort());
  }

  private safeEqual(expected: string, received: string) {
    const left = Buffer.from(expected);
    const right = Buffer.from(received);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private isUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
